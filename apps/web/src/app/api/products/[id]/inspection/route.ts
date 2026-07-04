import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

/**
 * §safety-modal-upgrade P4b (호영님 2026-07-04) — 물질(Product) 대표 안전 점검 저장.
 *   lot 엔드포인트(/api/inventory/[id]/inspection) 를 mirror. 물질 단위(productId) 점검 실저장.
 *   inspector = 세션 유저(canonical, 서버 기준). checklist = { storageOk, ppeOk, hasIssue }.
 *   result 파생: hasIssue ? (urgent→FAIL / 그 외→CAUTION) : PASS. 사진(photoUrl)은 후속(1차 텍스트).
 *   가짜성공 0: 저장/감사 성공만 201. 실패 시 enforcement.fail + 500.
 */

const SEVERITIES = new Set(["minor", "attention", "urgent"]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_update',
      targetEntityType: 'product',
      targetEntityId: params.id,
      sourceSurface: 'safety-api',
      routePath: '/api/products/[id]/inspection',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const product = await db.product.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // §SM-P4c-fix — Product 는 글로벌 카탈로그(userId/organizationId 없음). 소유·권한은
    //   ProductInventory(userId/organizationId)로 판정: 세션 사용자/속한 org 이 이 제품 재고를
    //   보유해야 점검 가능(GET 안전 목록 스코프와 동일 집합, multi-tenant 무접촉).
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const userOrgIds = memberships.map((m: { organizationId: string }) => m.organizationId);
    const ownedInv = await db.productInventory.findFirst({
      where: {
        productId: params.id,
        OR: userOrgIds.length > 0
          ? [{ userId: session.user.id }, { organizationId: { in: userOrgIds } }]
          : [{ userId: session.user.id }],
      },
      select: { organizationId: true },
    });
    if (!ownedInv) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const scopeOrganizationId = ownedInv.organizationId;

    const body = await request.json();
    const {
      inspectedAt,
      storageOk = false,
      ppeOk = false,
      hasIssue = false,
      severity = null,
      actionTaken = null,
    } = body ?? {};

    // 이상 발견 시 조치·심각도 필수(가짜/불완전 점검 방지).
    if (hasIssue) {
      if (!severity || !SEVERITIES.has(severity)) {
        return NextResponse.json(
          { error: "이상 발견 시 심각도(minor|attention|urgent)가 필요합니다.", code: "SEVERITY_REQUIRED" },
          { status: 400 }
        );
      }
      if (!actionTaken || !String(actionTaken).trim()) {
        return NextResponse.json(
          { error: "이상 발견 시 조치 내용이 필요합니다.", code: "ACTION_REQUIRED" },
          { status: 400 }
        );
      }
    }

    const result: "PASS" | "CAUTION" | "FAIL" = hasIssue
      ? (severity === "urgent" ? "FAIL" : "CAUTION")
      : "PASS";
    const checklist = { storageOk: !!storageOk, ppeOk: !!ppeOk, hasIssue: !!hasIssue };
    const notes = hasIssue ? String(actionTaken).trim() : null;
    const inspectedAtDate = inspectedAt ? new Date(inspectedAt) : new Date();
    const safeInspectedAt = Number.isNaN(inspectedAtDate.getTime()) ? new Date() : inspectedAtDate;

    const { ipAddress, userAgent } = extractRequestMeta(request);

    const inspection = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.inspection.create({
        data: {
          productId: params.id,
          userId: session.user.id,
          organizationId: scopeOrganizationId,
          result,
          checklist,
          severity: hasIssue ? severity : null,
          notes,
          inspectedAt: safeInspectedAt,
        },
      });

      await tx.product.update({
        where: { id: params.id },
        data: { lastInspectedAt: safeInspectedAt },
      });

      await createAuditLog(
        {
          userId: session.user.id,
          organizationId: scopeOrganizationId,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.INSPECTION,
          entityId: created.id,
          newData: { result, severity: hasIssue ? severity : null, checklist, notes },
          ipAddress,
          userAgent,
        },
        tx
      );

      return created;
    });

    enforcement.complete({});
    return NextResponse.json({ inspection }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating material inspection:", error);
    return NextResponse.json(
      { error: "Failed to create inspection" },
      { status: 500 }
    );
  }
}

/**
 * #user-supplier-registration Phase 2 — `/api/organization-vendors` collection route.
 *
 * GET  — list current user organization's vendors (org_book).
 * POST — create new OrganizationVendor (organizationId 자동 scope).
 *
 * canonical truth lock:
 *   - auth() 필수 — 비로그인 401.
 *   - current user 의 organization 확인 (OrganizationMember 의 첫 active row).
 *   - zod schema 검증 — vendorName / vendorEmail required.
 *   - @@unique([organizationId, vendorEmail]) 충돌 시 P2002 → 409 한국어 메시지.
 *   - audit — createActivityLog (best-effort, mutation atomic 보호).
 *   - ownership: organizationId 자동 scope (response 가 다른 organization 노출 0).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/organization-vendors");

// ── zod schema ──
const CreateOrganizationVendorSchema = z.object({
  vendorName: z.string().min(1, "공급사 이름을 입력해 주세요").max(200),
  vendorEmail: z.string().email("이메일 형식이 올바르지 않습니다"),
  vendorPhone: z.string().max(50).nullish(),
  notes: z.string().max(2000).nullish(),
  isPrimary: z.boolean().nullish(),
  // 기존 platform Vendor 연결 (선택). 없으면 inline 만으로 등록.
  vendorId: z.string().nullish(),
});

/**
 * Helper — current user 의 organization id 확인 (active OrganizationMember).
 * 없으면 null. 본 helper 가 ownership 의 single source.
 */
async function getCurrentOrganizationId(userId: string): Promise<string | null> {
  const member = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  return member?.organizationId ?? null;
}

/**
 * GET /api/organization-vendors
 * List current user's organization vendors (org_book source).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const organizationId = await getCurrentOrganizationId(session.user.id);
    if (!organizationId) {
      // organization 미가입 user — empty list (graceful).
      return NextResponse.json({ vendors: [] });
    }

    const vendors = await db.organizationVendor.findMany({
      where: { organizationId },
      orderBy: [{ isPrimary: "desc" }, { vendorName: "asc" }],
      select: {
        id: true,
        vendorName: true,
        vendorEmail: true,
        vendorPhone: true,
        notes: true,
        isPrimary: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        vendor: {
          select: { id: true, name: true, country: true },
        },
      },
    });

    return NextResponse.json({
      vendors: vendors.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error("[organization-vendors/GET] Error", error);
    return NextResponse.json(
      { error: "공급사 목록을 불러오지 못했습니다" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/organization-vendors
 * Create new OrganizationVendor for current user's organization.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const organizationId = await getCurrentOrganizationId(session.user.id);
    if (!organizationId) {
      return NextResponse.json(
        { error: "조직에 가입된 사용자만 공급사를 등록할 수 있습니다" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateOrganizationVendorSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: "VENDOR_REGISTRATION_VALIDATION_FAILED",
          message: firstIssue?.message ?? "공급사 정보를 다시 확인해 주세요",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    try {
      const vendor = await db.organizationVendor.create({
        data: {
          organizationId,
          createdById: session.user.id,
          vendorName: data.vendorName,
          vendorEmail: data.vendorEmail,
          vendorPhone: data.vendorPhone ?? null,
          notes: data.notes ?? null,
          isPrimary: data.isPrimary ?? false,
          vendorId: data.vendorId ?? null,
        },
        select: {
          id: true,
          vendorName: true,
          vendorEmail: true,
          vendorPhone: true,
          notes: true,
          isPrimary: true,
          vendorId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // audit (best-effort).
      try {
        const { ipAddress, userAgent } = extractRequestMeta(request);
        await createActivityLog({
          userId: session.user.id,
          organizationId,
          action: "organization_vendor_created",
          entityType: "OrganizationVendor",
          entityId: vendor.id,
          actorRole: await getActorRole({ userId: session.user.id, organizationId }),
          metadata: {
            vendorName: vendor.vendorName,
            vendorEmail: vendor.vendorEmail,
            isPrimary: vendor.isPrimary,
          },
          ipAddress,
          userAgent,
        });
      } catch (auditError) {
        logger.warn("[organization-vendors/POST] Audit log failed", auditError);
      }

      return NextResponse.json({
        vendor: {
          ...vendor,
          createdAt: vendor.createdAt.toISOString(),
          updatedAt: vendor.updatedAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      // P2002 — unique constraint (organizationId + vendorEmail) 충돌.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "VENDOR_ALREADY_REGISTERED",
            message: "이미 등록된 이메일입니다",
          },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error("[organization-vendors/POST] Error", error);
    return NextResponse.json(
      { error: "공급사 등록에 실패했습니다" },
      { status: 500 },
    );
  }
}

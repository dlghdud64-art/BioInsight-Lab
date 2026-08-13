import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { createHazardSnapshot } from "@/lib/matching/purchase-matcher";

/**
 * 구매 내역과 제품 매칭 (요구사항에 맞게 경로 변경)
 * POST /api/safety/spend/map
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const body = await request.json();
    const { purchaseId, productId } = body;

    if (!purchaseId || !productId) {
      return NextResponse.json(
        { error: "purchaseId and productId are required" },
        { status: 400 }
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (기타) — 대상 확정 이후로 핸들 이동.
      //   400 검증이 lock 보다 앞서므로 잘못된 요청은 lock 을 잡지 않는다.
      //   쓰기 대상은 PurchaseRecord 이며 purchaseId 가 그 id 다.
      targetEntityId: purchaseId,
      sourceSurface: 'web_app',
      routePath: '/api/safety/spend/map',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 구매 내역 조회 및 권한 확인
    const purchaseRecord = await db.purchaseRecord.findUnique({
      where: { id: purchaseId },
      include: {
        organization: true,
      },
    });

    if (!purchaseRecord) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Purchase record not found" },
        { status: 404 }
      );
    }

    // 권한 확인: safety_admin/admin/purchaser
    if (purchaseRecord.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: purchaseRecord.organizationId,
        },
      });

      const hasAccess =
        session.user.role === "ADMIN" ||
        membership?.role === OrganizationRole.OWNER ||
        membership?.role === OrganizationRole.ADMIN ||
        membership?.role === OrganizationRole.APPROVER ||
        membership?.role === OrganizationRole.VIEWER;

      if (!hasAccess) {
        enforcement.fail();
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 제품 존재 확인
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // 위험 정보 스냅샷 생성
    const hazardSnapshot = await createHazardSnapshot(productId);

    // 매칭 업데이트
    const updated = await db.purchaseRecord.update({
      where: { id: purchaseId },
      data: {
        productId,
        matchType: "MANUAL",
        hazardSnapshot,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            hazardCodes: true,
            msdsUrl: true,
          },
        },
      },
    });

    // 감사 로그 기록
    try {
      const { createAuditLog, auditRequestMeta } = await import("@/lib/audit/audit-logger");
      await createAuditLog({
        organizationId: purchaseRecord.organizationId || undefined,
        userId: session.user.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "purchase_record",
        entityId: purchaseId,
        action: "purchase_manual_map",
        ...auditRequestMeta(request), // §11.345-B5 — IP/UA 캡처
        changes: {
          before: { productId: purchaseRecord.productId },
          after: { productId, matchType: "MANUAL" },
        },
        metadata: {
          productName: product.name,
        },
      });
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
    }

    enforcement.complete({
      beforeState: { purchaseId, productId: purchaseRecord.productId, matchType: purchaseRecord.matchType },
      afterState: { purchaseId, productId, matchType: "MANUAL" },
    });

    return NextResponse.json({
      success: true,
      purchaseRecord: updated,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error matching product:", error);
    return NextResponse.json(
      { error: "Failed to match product" },
      { status: 500 }
    );
  }
}










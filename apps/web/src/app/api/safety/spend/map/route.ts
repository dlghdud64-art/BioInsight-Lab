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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { purchaseId, productId } = body;

    if (!purchaseId || !productId) {
      return NextResponse.json(
        { error: "purchaseId and productId are required" },
        { status: 400 }
      );
    }

    // 구매 내역 조회 및 권한 확인
    const purchaseRecord = await db.purchaseRecord.findUnique({
      where: { id: purchaseId },
      include: {
        organization: true,
      },
    });

    if (!purchaseRecord) {
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
        membership?.role === OrganizationRole.ADMIN ||
        membership?.role === OrganizationRole.APPROVER ||
        membership?.role === OrganizationRole.VIEWER;

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 제품 존재 확인
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
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
      const { createAuditLog } = await import("@/lib/audit/audit-logger");
      await createAuditLog({
        organizationId: purchaseRecord.organizationId || undefined,
        userId: session.user.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "purchase_record",
        entityId: purchaseId,
        action: "purchase_manual_map",
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

    return NextResponse.json({
      success: true,
      purchaseRecord: updated,
    });
  } catch (error: any) {
    console.error("Error matching product:", error);
    return NextResponse.json(
      { error: "Failed to match product" },
      { status: 500 }
    );
  }
}




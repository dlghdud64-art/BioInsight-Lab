/**
 * #vendor-catalog-product-matching Phase 2 — `/api/organization-vendor-products/[id]` item route.
 *
 * DELETE — delete vendor-product mapping. ownership check via organizationId.
 *
 * canonical truth lock:
 *   - auth() 필수.
 *   - ownership: entry.organizationId === user.currentOrganizationId.
 *     불일치 시 404 (not found 또는 존재하지 않음 — 다른 organization 노출 0).
 *   - audit log (createActivityLog, best-effort).
 *
 * (PATCH 는 현재 scope 외 — 수정 필요 시 delete + create 로 대체. notes 만 변경하는
 *  use-case 가 future 면 별도 트랙.)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/organization-vendor-products/[id]");

/**
 * Helper — current user 의 organization id 확인.
 */
async function getCurrentOrganizationId(userId: string): Promise<string | null> {
  const member = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  return member?.organizationId ?? null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const organizationId = await getCurrentOrganizationId(session.user.id);
    if (!organizationId) {
      return NextResponse.json(
        { error: "조직에 가입된 사용자만 매핑을 삭제할 수 있습니다" },
        { status: 403 },
      );
    }

    const { id } = await params;

    // ownership check — entry.organizationId === current organizationId.
    const entry = await db.organizationVendorProduct.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        vendorId: true,
        productId: true,
      },
    });

    if (!entry || entry.organizationId !== organizationId) {
      // existence leak avoidance — 다른 조직 row 도 same response.
      return NextResponse.json({ error: "매핑을 찾을 수 없습니다" }, { status: 404 });
    }

    await db.organizationVendorProduct.delete({ where: { id } });

    // audit (best-effort).
    try {
      const { ipAddress, userAgent } = extractRequestMeta(request);
      await createActivityLog({
        userId: session.user.id,
        organizationId,
        action: "organization_vendor_product_deleted",
        entityType: "OrganizationVendorProduct",
        entityId: id,
        actorRole: await getActorRole({ userId: session.user.id, organizationId }),
        metadata: {
          vendorId: entry.vendorId,
          productId: entry.productId,
        },
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      logger.warn("[organization-vendor-products/DELETE] Audit log failed", auditError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[organization-vendor-products/DELETE] Error", error);
    return NextResponse.json(
      { error: "매핑 삭제에 실패했습니다" },
      { status: 500 },
    );
  }
}

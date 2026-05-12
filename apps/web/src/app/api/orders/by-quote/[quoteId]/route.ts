/**
 * #post-approval-purchase-order-flow Phase 4.3 + 1.2 — GET /api/orders/by-quote/[quoteId]
 *
 * canonical truth = Order (DB). 1 Quote → N Order (vendor 별, option A 정합).
 * Phase 1.2 swap: `findUnique` → `findMany` (composite `(quoteId, vendorId)`
 * unique 로 변경). response shape: `{ order }` → `{ orders }` (caller 정합).
 *
 * Lock:
 *   - auth (인증된 사용자만)
 *   - ownership (Order.userId 또는 organizationMember) per-row 검증 후
 *     authorized rows 만 반환
 *   - 결재 승인 전 또는 cancelled — empty array 반환 (UI 가 hide)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { buildOrderDispatchReadiness, summarizeOrderDispatchReadiness } from "@/lib/orders/dispatch-readiness";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quoteId } = await params;
    // §11.234 — Prisma findMany return type implicit any drift. explicit annotation.
    type OrderRow = Awaited<ReturnType<typeof db.order.findMany>>[number] & {
      items?: unknown[];
      vendor?: { id?: string | null; name?: string | null; email?: string | null } | null;
    };
    const orders: OrderRow[] = await db.order.findMany({
      where: { quoteId },
      include: { items: true, vendor: true },
      orderBy: { createdAt: "asc" },
    }) as OrderRow[];

    if (orders.length === 0) {
      // 결재 승인 전 또는 cancelled — empty 반환 (UI 가 hide)
      return NextResponse.json({
        orders: [],
        dispatchReadiness: summarizeOrderDispatchReadiness([]),
      });
    }

    // ownership 검증 — per-row (defense in depth, vendor 별 row 가 다른
    // owner 일 가능성 0 — 1 Quote 1 owner 매핑이지만 권한 분리 정합)
    const userId = session.user.id;
    const orgIds = Array.from(
      new Set(
        orders
          .map((o: OrderRow) => o.organizationId)
          .filter((id: string | null): id is string => !!id),
      ),
    );
    let allowedOrgIds = new Set<string>();
    if (orgIds.length > 0) {
      const members = await db.organizationMember.findMany({
        where: { userId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      allowedOrgIds = new Set(members.map((m: { organizationId: string }) => m.organizationId));
    }
    const authorized = orders.filter((o: OrderRow) => {
      if (o.userId === userId) return true;
      if (o.organizationId && allowedOrgIds.has(o.organizationId)) return true;
      return false;
    });
    if (authorized.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ordersWithDispatchReadiness = authorized.map((order: OrderRow) => ({
      ...order,
      dispatchReadiness: buildOrderDispatchReadiness(order),
    }));

    return NextResponse.json({
      orders: ordersWithDispatchReadiness,
      dispatchReadiness: summarizeOrderDispatchReadiness(authorized),
    });
  } catch (error) {
    return handleApiError(error, "orders/by-quote/[quoteId]/GET");
  }
}

/**
 * /api/inventory/po-candidates-for-label — §11.326 v3
 *
 * GET ?catalogNumber=&productName=&organizationId=
 *   라벨/거래명세서로 식별한 품목과 매칭되는 **미입고 발주(Order)** 후보 반환.
 *
 * canonical truth = Order (DB). 이 route 는 읽기 전용 — 발주를 변경하지 않는다.
 * 입고 실행은 호출부가 orders/[id] PATCH(status→DELIVERED, restock 자동) 로 수행.
 * 미매칭(후보 0)이면 호출부가 smart-receiving 신규등록 fallback.
 *
 * overfetch 0: status in [ORDERED,CONFIRMED,SHIPPING] + items select 최소 +
 *   take 상한. 매칭은 순수 함수 matchLabelToOrders 로 위임.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  matchLabelToOrders,
  PENDING_ORDER_STATUSES,
  type OrderLike,
} from "@/lib/inventory/match-label-to-order";

const MAX_SCAN = 100; // 매칭 대상 미입고 발주 상한 (overfetch 가드)

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const catalogNumber = req.nextUrl.searchParams.get("catalogNumber") ?? undefined;
    const productName = req.nextUrl.searchParams.get("productName") ?? undefined;
    const organizationId = req.nextUrl.searchParams.get("organizationId") ?? undefined;

    if (!catalogNumber && !productName) {
      return NextResponse.json(
        { error: "catalogNumber 또는 productName 중 하나는 필요합니다." },
        { status: 400 },
      );
    }

    // 조직 접근 권한 확인 (orders GET 패턴 정합)
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { organizationId, userId: session.user.id },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "해당 조직에 접근 권한이 없습니다." },
          { status: 403 },
        );
      }
    }

    const where = organizationId
      ? { organizationId, status: { in: [...PENDING_ORDER_STATUSES] } }
      : { userId: session.user.id, status: { in: [...PENDING_ORDER_STATUSES] } };

    const orders = await db.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        expectedDelivery: true,
        vendor: { select: { name: true } },
        items: {
          select: { name: true, brand: true, catalogNumber: true, quantity: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_SCAN,
    });

    const normalized: OrderLike[] = orders.map((o: typeof orders[number]) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      expectedDelivery: o.expectedDelivery,
      vendorName: o.vendor?.name ?? null,
      items: o.items,
    }));

    const candidates = matchLabelToOrders(normalized, { catalogNumber, productName });

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[po-candidates-for-label] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * §order-entry-rewire P3-3 — 발주 예약 해제 서비스 (DB 경유)
 *
 * 순수 코어(order-reservation.ts)는 DB 를 모른다. 이 파일이 그 코어를 트랜잭션에
 * 잇는 단일 지점이다.
 *
 * 🔑 존재 이유: 주문 CANCELLED 진입점이 둘이다 —
 *   owner/org  PATCH /api/orders/[id]
 *   admin      PATCH /api/admin/orders/[id]/status
 * 두 경로가 같은 해제 계약을 이행해야 하는데, 각자 복붙하면 한쪽만 고쳐지는 형태가
 * 생긴다(admin 경로가 order_released 를 모른 채 releasePOVoided 만 알고 있던 것이
 * 정확히 그 자리 — 승계 대조 발견 2026-08-22). 그래서 한 함수로 둔다.
 */
import {
  buildReleaseEvent,
  activeReservedAmount,
  ORDER_RESERVED,
  ORDER_RELEASED,
  ORDER_CONFIRMED,
} from "@/lib/budget/order-reservation";

const LIFECYCLE = [ORDER_RESERVED, ORDER_RELEASED, ORDER_CONFIRMED];

/**
 * 주문의 활성 발주 예약을 해제한다(ORDER_RELEASED 기록).
 * - 예약이 없으면 no-op — release 창작 금지(경로 A 전용 주문·구매요청 유래 발주 보호)
 * - budgetEventKey unique + P2002 무시로 멱등(중복 취소 안전)
 * - preCommitted/postCommitted 는 **예산 전역** 활성 예약 축 (경로 A release 와 동형)
 * @returns 해제한 금액. 해제할 예약이 없으면 0.
 */
export async function releaseOrderReservation(
  tx: {
    budgetEvent: {
      findFirst: (args: unknown) => Promise<any>;
      findMany: (args: unknown) => Promise<any[]>;
      create: (args: unknown) => Promise<unknown>;
    };
  },
  params: { orderId: string; executedBy: string },
): Promise<number> {
  const { orderId, executedBy } = params;

  const reserve = await tx.budgetEvent.findFirst({
    where: { sourceEntityId: orderId, eventType: ORDER_RESERVED, budgetId: { not: null } },
  });
  if (!reserve?.budgetId) return 0;

  const budgetLedger = await tx.budgetEvent.findMany({
    where: { budgetId: reserve.budgetId, eventType: { in: LIFECYCLE } },
    select: { eventType: true, amount: true, sourceEntityId: true },
  });
  const mine = budgetLedger.filter((e) => e.sourceEntityId === orderId);
  const active = activeReservedAmount(mine);
  if (active <= 0) return 0;

  const preActive = activeReservedAmount(budgetLedger);
  const releaseEvent = buildReleaseEvent({
    budget: { id: reserve.budgetId, organizationId: reserve.organizationId, amount: 0 },
    orderId,
    amount: active,
    sequence: 1,
  });
  try {
    await tx.budgetEvent.create({
      data: {
        organizationId: reserve.organizationId,
        budgetEventKey: releaseEvent.budgetEventKey,
        eventType: releaseEvent.eventType,
        sourceEntityType: releaseEvent.sourceEntityType,
        sourceEntityId: orderId,
        budgetId: reserve.budgetId,
        yearMonth: reserve.yearMonth,
        amount: active,
        preCommitted: preActive,
        postCommitted: Math.max(0, preActive - active),
        executedBy,
      },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
    return 0; // 이미 해제됨 — 멱등
  }
  return active;
}

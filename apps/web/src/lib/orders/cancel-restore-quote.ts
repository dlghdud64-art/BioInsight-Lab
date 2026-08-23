/**
 * §cancel-restores-quote — 주문 취소 시 견적 복귀 (DB 경유 단일점)
 *
 * 🔑 존재 이유는 releaseOrderReservation 과 같다. 주문 CANCELLED 진입점이 둘이다 —
 *   owner/org  PATCH /api/orders/[id]
 *   admin      PATCH /api/admin/orders/[id]/status
 * 두 경로가 같은 복귀 계약을 이행해야 하는데 각자 복붙하면 한쪽만 고쳐지는 형태가
 * 생긴다 (§order-entry-rewire P3-3 이 봉합한 것과 정확히 같은 자리).
 *
 * 🛑 이것은 forward 전이가 아니라 **보상 전이(compensating)** 다.
 *   canonical ALLOWED_QUOTE_TRANSITIONS(lib/operations/state-machine.ts)의 PURCHASED 는
 *   terminal([]) 로 남는다 — 그 맵은 사용자 주도 forward 전이를 규율하고,
 *   여기는 발주를 무르는 되감기다. 맵을 넓히면 /api/quotes/[id]/status 의 수동 경로도
 *   함께 열리므로 넓히지 않았다. (판정 지점 — 호영님 재판정 시 맵으로 옮긴다.)
 *
 * 복귀 조건 3축 (인벤토리 실측 2026-08-23 근거):
 *   ① quote.status === "PURCHASED"          — 아니면 되돌릴 것이 없다 (멱등)
 *   ② 이 주문 외 활성(비CANCELLED) 주문 0건  — 다른 주문이 세운 PURCHASED 를 무르면 안 된다
 *   ③ PurchaseRecord 0건                     — 구매가 확정된 견적은 되돌리지 않는다
 */

/** 이 서비스가 쓰는 tx 표면만 구조적으로 요구한다 (Prisma 타입 결합 회피). */
type RestoreTx = {
  order: {
    findUnique: (args: unknown) => Promise<{ id: string; quoteId: string } | null>;
    count: (args: unknown) => Promise<number>;
  };
  quote: {
    findUnique: (args: unknown) => Promise<{ id: string; status: string } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  purchaseRecord: {
    findFirst: (args: unknown) => Promise<unknown | null>;
  };
};

/**
 * 취소된 주문의 견적을 COMPLETED 로 되돌린다.
 * 반드시 order.status 를 CANCELLED 로 갱신한 **뒤**, 예약 해제와 **같은 트랜잭션**에서 부른다.
 * (따로 부르면 예약만 풀리고 견적은 안 풀리는 옛 상태가 부분 재발한다.)
 *
 * @returns 되돌렸으면 true. 조건 미충족이면 false (no-op).
 */
export async function restoreQuoteOnOrderCancel(
  tx: RestoreTx,
  params: { orderId: string },
): Promise<boolean> {
  const { orderId } = params;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, quoteId: true },
  });
  if (!order?.quoteId) return false;

  const quote = await tx.quote.findUnique({
    where: { id: order.quoteId },
    select: { id: true, status: true },
  });
  // ① 되돌릴 것이 없다 — 이미 COMPLETED 로 돌아왔거나 애초에 PURCHASED 가 아니었다
  if (quote?.status !== "PURCHASED") return false;

  // ② 다른 활성 주문이 남아 있으면 그 주문이 PURCHASED 를 붙들고 있다
  const otherActive = await tx.order.count({
    where: {
      quoteId: order.quoteId,
      id: { not: orderId },
      status: { not: "CANCELLED" },
    },
  });
  if (otherActive > 0) return false;

  // ③ 구매 확정(PurchaseRecord)까지 간 견적은 발주 되감기의 대상이 아니다
  const purchased = await tx.purchaseRecord.findFirst({
    where: { quoteId: order.quoteId },
    select: { id: true },
  });
  if (purchased) return false;

  await tx.quote.update({
    where: { id: order.quoteId },
    data: { status: "COMPLETED" },
  });
  return true;
}

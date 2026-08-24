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
 *   terminal([]) 로 남는다 — 그 맵은 사용자 주도 forward 전이를 규율하고, 여기는 발주를
 *   무르는 되감기다. 맵을 넓히면 /api/quotes/[id]/status 의 수동 경로도 함께 열려
 *   "주문은 살아 있는데 견적만 복귀" 가 가능해진다. (호영님 유지 판정 2026-08-24)
 *
 * 복귀 조건 3축:
 *   ① quote.status === "PURCHASED"           — 아니면 되돌릴 것이 없다 (멱등)
 *   ② 이 주문 외 활성(비CANCELLED) 주문 0건   — 다른 주문이 세운 PURCHASED 를 무르면 안 된다
 *   ③ 이 주문의 ORDER_CONFIRMED 이벤트 0건    — 이 주문의 구매가 확정됐으면 되감기 대상이 아니다
 *
 * ③ 의 축 판정 (호영님 2026-08-24 · 프로덕션 실측 근거):
 *   🛑 옛 초안은 `PurchaseRecord 0건` 이었다. 그것은 **틀렸다** —
 *      PurchaseRecord 에는 orderId 컬럼이 없다(quoteId 만 있다). 원리상 주체를 식별할 수
 *      없어, ② 가 피한 함정("다른 주문이 세운 것을 무르지 마라")의 거울상이 된다.
 *      실측: quote 6QRG 의 PurchaseRecord 는 2026-08-18 생성인데 주문 C3PN 은 08-22,
 *      SKSQ 는 08-24 다. 두 주문 어느 쪽도 그 레코드를 만들 수 없는데 둘 다 막혔다.
 *   🛑 대안 `release > 0` 도 틀렸다 — 파생량이라 (a) confirm 이 예약을 소멸시킴 과
 *      (b) 애초에 예약이 없었음(레거시) 이 구분되지 않고, restore 가 release 의 반환값에
 *      묶여 호출 순서에 의존하게 된다.
 *   ✅ ORDER_CONFIRMED 는 sourceEntityId = orderId 로 **주체가 박힌 사건**이다.
 *      순서 무관 · 결합 0 · (a)/(b) 구분 가능.
 *
 * ⚠️ 알고 남긴 구멍 — 레거시 주문(2026-08-22 이전)
 *   예약이 없던 주문은 원장에 흔적이 없어 확정 여부를 원장으로 판정할 수 없다.
 *   그런 주문은 취소 시 "확정 안 됨" 으로 보고 견적을 복귀시킨다. 신규 주문에는 해당
 *   없다 — owner·admin 두 접수 경로 모두 예산 없으면 NO_BUDGET 으로 막으므로 예약 없는
 *   주문이 새로 생기지 않는다. 완전히 닫으려면 PurchaseRecord.orderId 추가(additive DDL)가
 *   필요하고 그건 별도 슬라이스 · 별도 승인이다. 계약 테스트가 이 케이스를 명시로 잠근다
 *   — 우연이 아니라 알고 남긴 것이다.
 */
import { ORDER_CONFIRMED } from "@/lib/budget/order-reservation";

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
  budgetEvent: {
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

  // ③ **이 주문**의 구매 확정 사건 — 주체가 sourceEntityId 에 박혀 있다
  const confirmed = await tx.budgetEvent.findFirst({
    where: { sourceEntityId: orderId, eventType: ORDER_CONFIRMED },
    select: { id: true },
  });
  if (confirmed) return false;

  await tx.quote.update({
    where: { id: order.quoteId },
    data: { status: "COMPLETED" },
  });
  return true;
}

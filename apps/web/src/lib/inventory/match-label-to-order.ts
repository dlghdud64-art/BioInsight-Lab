/**
 * §11.326 v3 — 라벨 추출값 ↔ 미입고 발주(Order) 매칭 (순수 함수)
 *
 * 스마트 입고에서 라벨/거래명세서로 식별한 품목을 기존 미입고 발주와 매칭.
 * canonical truth = Order (DB). 이 함수는 projection(라벨 추출값) 을 truth 와
 * 대조만 한다 — 어떤 발주도 자동 변경하지 않는다(사용자 확인 필수).
 *
 * 매칭 우선순위:
 *   1. catalogNumber 정확 일치 (대소문자/공백 정규화) — 가장 신뢰도 높음
 *   2. productName 부분 포함 (정규화 후 양방향 contains) — 보조
 * 둘 다 미매칭이면 후보 0 → 호출부가 신규등록 fallback.
 */

export interface OrderItemLike {
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  quantity: number;
}

export interface OrderLike {
  id: string;
  orderNumber: string;
  status: string;
  expectedDelivery?: Date | string | null;
  vendorName?: string | null;
  items: OrderItemLike[];
}

export interface LabelMatchInput {
  catalogNumber?: string | null;
  productName?: string | null;
}

export type MatchConfidence = "catalog" | "name";

export interface MatchedOrderCandidate {
  orderId: string;
  orderNumber: string;
  status: string;
  expectedDelivery: string | null;
  vendorName: string | null;
  matchedItem: {
    name: string;
    catalogNumber: string | null;
    quantity: number;
  };
  confidence: MatchConfidence;
}

/** 미입고로 간주하는 발주 상태 (DELIVERED/CANCELLED 제외). */
export const PENDING_ORDER_STATUSES = ["ORDERED", "CONFIRMED", "SHIPPING"] as const;

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") return d;
  return d.toISOString();
}

/**
 * 발주 목록에서 라벨과 매칭되는 후보를 추출한다.
 * - 발주당 가장 신뢰도 높은 item 1개만 후보로(catalog > name).
 * - catalog 매칭 발주를 name 매칭보다 앞에 정렬.
 */
export function matchLabelToOrders(
  orders: OrderLike[],
  label: LabelMatchInput,
): MatchedOrderCandidate[] {
  const catNo = norm(label.catalogNumber);
  const name = norm(label.productName);
  if (!catNo && !name) return [];

  const out: MatchedOrderCandidate[] = [];

  for (const order of orders) {
    let best: { item: OrderItemLike; confidence: MatchConfidence } | null = null;

    for (const item of order.items) {
      const itemCat = norm(item.catalogNumber);
      const itemName = norm(item.name);

      // 1) catalog 정확 일치 (최우선)
      if (catNo && itemCat && itemCat === catNo) {
        best = { item, confidence: "catalog" };
        break; // 더 볼 필요 없음
      }
      // 2) name 부분 포함 (양방향)
      if (!best && name && itemName && (itemName.includes(name) || name.includes(itemName))) {
        best = { item, confidence: "name" };
      }
    }

    if (best) {
      out.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        expectedDelivery: toIso(order.expectedDelivery),
        vendorName: order.vendorName ?? null,
        matchedItem: {
          name: best.item.name,
          catalogNumber: best.item.catalogNumber ?? null,
          quantity: best.item.quantity,
        },
        confidence: best.confidence,
      });
    }
  }

  // catalog 매칭 우선 정렬
  out.sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === "catalog" ? -1 : 1;
  });

  return out;
}

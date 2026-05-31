import { describe, it, expect } from "vitest";
import {
  matchLabelToOrders,
  PENDING_ORDER_STATUSES,
  type OrderLike,
} from "../match-label-to-order";

const orders: OrderLike[] = [
  {
    id: "o1",
    orderNumber: "ORD-1",
    status: "ORDERED",
    expectedDelivery: null,
    vendorName: "시그마",
    items: [
      { name: "Sodium Chloride", brand: "Sigma", catalogNumber: "S-7653", quantity: 5 },
    ],
  },
  {
    id: "o2",
    orderNumber: "ORD-2",
    status: "SHIPPING",
    expectedDelivery: null,
    vendorName: null,
    items: [
      { name: "에탄올 99.9%", brand: null, catalogNumber: null, quantity: 2 },
    ],
  },
];

describe("§11.326 v3 — matchLabelToOrders", () => {
  it("catalogNumber 정확 일치(공백/대소문자 무시)", () => {
    const r = matchLabelToOrders(orders, { catalogNumber: " s-7653 " });
    expect(r).toHaveLength(1);
    expect(r[0].orderId).toBe("o1");
    expect(r[0].confidence).toBe("catalog");
    expect(r[0].matchedItem.quantity).toBe(5);
  });

  it("productName 부분 포함 매칭(보조)", () => {
    const r = matchLabelToOrders(orders, { productName: "에탄올" });
    expect(r).toHaveLength(1);
    expect(r[0].orderId).toBe("o2");
    expect(r[0].confidence).toBe("name");
  });

  it("catalog 매칭이 name 매칭보다 앞에 정렬", () => {
    const r = matchLabelToOrders(orders, { catalogNumber: "S-7653", productName: "에탄올" });
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r[0].confidence).toBe("catalog");
  });

  it("미매칭이면 빈 배열(신규등록 fallback 트리거)", () => {
    const r = matchLabelToOrders(orders, { catalogNumber: "NO-MATCH", productName: "존재안함품목" });
    expect(r).toHaveLength(0);
  });

  it("catalog/name 둘 다 없으면 빈 배열", () => {
    const r = matchLabelToOrders(orders, {});
    expect(r).toHaveLength(0);
  });

  it("미입고 상태 상수에 DELIVERED/CANCELLED 미포함", () => {
    expect(PENDING_ORDER_STATUSES).toContain("ORDERED");
    expect(PENDING_ORDER_STATUSES).not.toContain("DELIVERED" as never);
    expect(PENDING_ORDER_STATUSES).not.toContain("CANCELLED" as never);
  });
});

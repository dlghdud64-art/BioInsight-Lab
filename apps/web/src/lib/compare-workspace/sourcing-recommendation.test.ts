/**
 * §11.318 Phase 1a (RED) — 대체품/벤더 추천 코어 (PurchaseRecord 기반)
 *
 * 결정(호영님 2026-05-29):
 *   - 1차 데이터 = 내부 PurchaseRecord(실거래) only → 환각 0.
 *   - 납기 = QuoteListItem.leadTime 파싱(상류) → leadTimeDays:number|null + leadTimeSource.
 *     없으면 "미확인"(null/"unknown"). 지어내지 않음.
 *   - 대체품 = 같은 catalogNumber 다른 벤더(정확) + 같은 category 근접(best-effort, 정밀 파싱 X).
 *   - 데이터 없으면 추천 없음(빈 상태) — 근거 없는 전략 생성 금지.
 *
 * 순수 함수(DB 미접근) — 단위 테스트 가능. 구현 전이므로 import 실패 = RED.
 */
import { describe, it, expect } from "vitest";
import {
  buildSourcingRecommendation,
  type PurchaseRecordLike,
  type LeadTimeIndex,
} from "./sourcing-recommendation";

function rec(p: Partial<PurchaseRecordLike>): PurchaseRecordLike {
  return {
    vendorName: "Vendor",
    itemName: "PBS 1X 1L",
    catalogNumber: "P0001",
    category: "REAGENT",
    unitPrice: 18000,
    amount: 18000,
    qty: 1,
    unit: "L",
    currency: "KRW",
    purchasedAt: "2026-02-15T00:00:00.000Z",
    quoteId: null,
    ...p,
  };
}

const target = { catalogNumber: "P0001", itemName: "PBS 1X 1L", category: "REAGENT" };

describe("§11.318 buildSourcingRecommendation — 빈 상태(환각 0)", () => {
  it("구매 이력 0 → hasData false, dataSource none, 빈 배열", () => {
    const r = buildSourcingRecommendation([], target);
    expect(r.hasData).toBe(false);
    expect(r.dataSource).toBe("none");
    expect(r.sameProductOtherVendors).toEqual([]);
    expect(r.substitutes).toEqual([]);
  });

  it("전 벤더 단가 null + 납기 미확인 → 가격/전략 지어내지 않음", () => {
    const r = buildSourcingRecommendation(
      [rec({ vendorName: "A", unitPrice: null }), rec({ vendorName: "B", unitPrice: null })],
      target,
    );
    // 벤더는 노출하되 최저가 플래그는 누구에게도 부여하지 않음(근거 없음)
    expect(r.sameProductOtherVendors.every((v) => v.isLowestPrice === false)).toBe(true);
    // 산출물에 자유 텍스트 "전략" 필드 없음 (환각 표면 원천 차단)
    expect(r).not.toHaveProperty("strategy");
    expect(r).not.toHaveProperty("recommendationText");
  });
});

describe("§11.318 buildSourcingRecommendation — 같은 제품 다른 벤더", () => {
  it("벤더별 그룹 + 최저가 플래그(비null 중 최저) + 단가 오름차순", () => {
    const r = buildSourcingRecommendation(
      [
        rec({ vendorName: "Thermo Fisher", unitPrice: 18000, purchasedAt: "2026-02-15T00:00:00.000Z" }),
        rec({ vendorName: "Sigma", unitPrice: 21000, purchasedAt: "2025-11-20T00:00:00.000Z" }),
      ],
      target,
    );
    expect(r.hasData).toBe(true);
    expect(r.dataSource).toBe("purchase_history");
    expect(r.sameProductOtherVendors).toHaveLength(2);
    expect(r.sameProductOtherVendors[0].vendorName).toBe("Thermo Fisher");
    expect(r.sameProductOtherVendors[0].isLowestPrice).toBe(true);
    expect(r.sameProductOtherVendors[1].isLowestPrice).toBe(false);
  });

  it("같은 벤더 다회 구매 → 1건으로 그룹(최근 단가·최근 구매일·횟수)", () => {
    const r = buildSourcingRecommendation(
      [
        rec({ vendorName: "Sigma", unitPrice: 21000, purchasedAt: "2025-11-20T00:00:00.000Z" }),
        rec({ vendorName: "Sigma", unitPrice: 20000, purchasedAt: "2026-01-10T00:00:00.000Z" }),
      ],
      target,
    );
    expect(r.sameProductOtherVendors).toHaveLength(1);
    const v = r.sameProductOtherVendors[0];
    expect(v.purchaseCount).toBe(2);
    expect(v.lastPurchasedAt).toBe("2026-01-10T00:00:00.000Z");
    expect(v.unitPrice).toBe(20000); // 최근 구매 단가
  });
});

describe("§11.318 buildSourcingRecommendation — 납기(ⓑ+ⓐ)", () => {
  it("quoteId + leadTimeIndex 있으면 leadTimeDays=number, source=quote", () => {
    const idx: LeadTimeIndex = { q1: 5 };
    const r = buildSourcingRecommendation(
      [rec({ vendorName: "Thermo Fisher", quoteId: "q1" })],
      target,
      idx,
    );
    const v = r.sameProductOtherVendors[0];
    expect(v.leadTimeDays).toBe(5);
    expect(v.leadTimeSource).toBe("quote");
  });

  it("납기 출처 없으면 leadTimeDays=null, source=unknown (미확인 — 지어내기 0)", () => {
    const r = buildSourcingRecommendation(
      [rec({ vendorName: "Sigma", quoteId: null })],
      target,
    );
    const v = r.sameProductOtherVendors[0];
    expect(v.leadTimeDays).toBeNull();
    expect(v.leadTimeSource).toBe("unknown");
    expect(v.isFastest).toBe(false);
  });

  it("최단 납기 플래그는 비null 납기 중에서만", () => {
    const idx: LeadTimeIndex = { q1: 5, q2: 3 };
    const r = buildSourcingRecommendation(
      [
        rec({ vendorName: "Thermo Fisher", quoteId: "q1" }),
        rec({ vendorName: "Sigma", quoteId: "q2" }),
      ],
      target,
      idx,
    );
    const fastest = r.sameProductOtherVendors.filter((v) => v.isFastest);
    expect(fastest).toHaveLength(1);
    expect(fastest[0].vendorName).toBe("Sigma");
  });
});

describe("§11.318 buildSourcingRecommendation — 대체품(같은 category, best-effort)", () => {
  it("같은 category 다른 catalog → substitutes 포함, 다른 category → 제외", () => {
    const r = buildSourcingRecommendation(
      [
        rec({ vendorName: "Thermo Fisher", catalogNumber: "P0001" }), // 같은 제품
        rec({ vendorName: "Sigma", itemName: "PBS 10X 농축", catalogNumber: "P0010", category: "REAGENT" }), // 대체
        rec({ vendorName: "Corning", itemName: "Pipette tips 1000uL", catalogNumber: "T9999", category: "CONSUMABLE" }), // 제외
      ],
      target,
    );
    const subCats = r.substitutes.map((s) => s.catalogNumber);
    expect(subCats).toContain("P0010");
    expect(subCats).not.toContain("T9999"); // 다른 카테고리(소모품) 제외 — §1 엉뚱 비교 차단
    expect(subCats).not.toContain("P0001"); // 같은 제품은 대체품 아님
  });

  it("대체품에도 근거 출처(reason) + 단가(없으면 null) 정직 표기", () => {
    const r = buildSourcingRecommendation(
      [rec({ vendorName: "Sigma", itemName: "PBS 10X 농축", catalogNumber: "P0010", category: "REAGENT", unitPrice: 15000 })],
      target,
    );
    expect(r.substitutes[0].reason).toMatch(/카테고리/);
    expect(typeof r.substitutes[0].unitPrice === "number" || r.substitutes[0].unitPrice === null).toBe(true);
  });
});

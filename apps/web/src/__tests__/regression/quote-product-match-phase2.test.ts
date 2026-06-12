// #catalog-spec-backfill ①-b Phase 2 — Core Matching Logic (호영님 P-track, 2026-06-11)
// Phase 1 계약을 GREEN 으로. 추가 core edge: exact 우선순위 / 다건 fuzzy / 폴백 순서.
// 패턴: pure unit. DB mount 없음.

import {
  matchQuoteItemToProduct,
  clampSpecForPromotion,
  type QuoteMatchInput,
  type QuoteProductTarget,
} from "@/lib/catalog/quote-product-match";

const P = (over: Partial<QuoteProductTarget>): QuoteProductTarget => ({
  id: "p", name: null, catalogNumber: null, modelNumber: null, ...over,
});
const Q = (over: Partial<QuoteMatchInput>): QuoteMatchInput => ({
  productName: null, catalogNumber: null, specification: null, ...over,
});

describe("§①-b P2 — 매칭 우선순위·폴백", () => {
  it("catalog exact 가 name fuzzy 보다 우선 (catalog 단일일치 시 name 무시)", () => {
    const r = matchQuoteItemToProduct(
      Q({ catalogNumber: "CAT-1", productName: "Ethanol" }),
      [
        P({ id: "cat", catalogNumber: "CAT-1", name: "Methanol" }),
        P({ id: "nm", name: "Ethanol absolute" }),
      ],
    );
    expect(r.tier).toBe("exact");
    expect(r.matches.map((m) => m.id)).toEqual(["cat"]);
  });

  it("catalog 무일치 시에만 name fuzzy 폴백", () => {
    const r = matchQuoteItemToProduct(
      Q({ catalogNumber: "MISS-9", productName: "Ethanol" }),
      [P({ id: "nm", name: "Ethanol absolute 99.9%" })],
    );
    expect(r.tier).toBe("candidate");
    expect(r.matches[0]?.id).toBe("nm");
  });

  it("name fuzzy 다건 → candidate 전부 반환(사람 선택)", () => {
    const r = matchQuoteItemToProduct(
      Q({ productName: "Tris" }),
      [
        P({ id: "a", name: "Tris-HCl pH 7.4" }),
        P({ id: "b", name: "Tris base" }),
        P({ id: "c", name: "Glycine" }),
      ],
    );
    expect(r.tier).toBe("candidate");
    expect(r.matches.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("catalog 일치가 catalogNumber·modelNumber 둘 다 스캔", () => {
    const r = matchQuoteItemToProduct(
      Q({ catalogNumber: "X9" }),
      [P({ id: "byModel", modelNumber: "x9" })],
    );
    expect(r.tier).toBe("exact");
    expect(r.matches[0]?.id).toBe("byModel");
  });
});

describe("§①-b P2 — clamp 경계", () => {
  it("정확히 200자 → ok(경계 포함)", () => {
    const r = clampSpecForPromotion("a".repeat(200));
    expect(r.ok).toBe(true);
    expect(r.value?.length).toBe(200);
  });
  it("앞뒤 공백 trim 후 길이 판정", () => {
    const r = clampSpecForPromotion("  " + "a".repeat(200) + "  ");
    expect(r.ok).toBe(true);
    expect(r.value?.length).toBe(200);
  });
});

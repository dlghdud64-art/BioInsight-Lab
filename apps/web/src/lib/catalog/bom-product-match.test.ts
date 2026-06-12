import { describe, it, expect } from "vitest";
import { computeIsHighRisk, toBomCandidate, HIGH_RISK_PICTOGRAMS } from "@/lib/catalog/bom-product-match";

// §catalog-A P3c P2 — BOM 매칭 머신 단위 테스트(순수). 안전정보 dead 복구 핵심 로직.

describe("§catalog-A P3c — computeIsHighRisk", () => {
  it("hazardCodes 1건 이상이면 위험", () => {
    expect(computeIsHighRisk(["H314"], [])).toBe(true);
    expect(computeIsHighRisk(["H290", "H314"], null)).toBe(true);
  });

  it("고위험 피크토그램(skull/flame/corrosive)이면 위험", () => {
    expect(computeIsHighRisk([], ["corrosive"])).toBe(true);
    expect(computeIsHighRisk([], ["exclamation", "flame"])).toBe(true);
  });

  it("저위험(코드 0 + 일반 피크토그램)은 false", () => {
    expect(computeIsHighRisk([], ["exclamation"])).toBe(false);
    expect(computeIsHighRisk([], [])).toBe(false);
  });

  it("Json? unknown 방어 — 배열 아니면 false", () => {
    expect(computeIsHighRisk(null, null)).toBe(false);
    expect(computeIsHighRisk(undefined, "not-array")).toBe(false);
    expect(computeIsHighRisk("{}", 42)).toBe(false);
  });

  it("HIGH_RISK_PICTOGRAMS 계약 — skull/flame/corrosive", () => {
    expect([...HIGH_RISK_PICTOGRAMS]).toEqual(["skull", "flame", "corrosive"]);
  });
});

describe("§catalog-A P3c — toBomCandidate (Product → BOM 투영 + 안전정보 복구)", () => {
  const base = {
    id: "p1",
    name: "Sodium Hydroxide",
    hazardCodes: ["H314"],
    pictograms: ["corrosive"],
    safetyNote: "강염기 — 보호장구 착용",
    vendors: [{ vendor: { name: "Sigma" }, priceInKRW: 25000, currency: "KRW" }],
  };

  it("vendor 최저가 첫 건 + 안전정보 서버 계산 투영", () => {
    const c = toBomCandidate(base);
    expect(c.productId).toBe("p1");
    expect(c.vendorName).toBe("Sigma");
    expect(c.price).toBe(25000);
    expect(c.isHighRisk).toBe(true); // dead 복구: hazardCodes + corrosive
    expect(c.hazardCodes).toEqual(["H314"]);
    expect(c.safetyNote).toBe("강염기 — 보호장구 착용");
  });

  it("vendor 없으면 price 0 / KRW / vendorName null (graceful)", () => {
    const c = toBomCandidate({ ...base, vendors: [] });
    expect(c.vendorName).toBeNull();
    expect(c.price).toBe(0);
    expect(c.currency).toBe("KRW");
  });

  it("저위험 제품은 isHighRisk false + hazardCodes 빈배열", () => {
    const c = toBomCandidate({ ...base, hazardCodes: [], pictograms: ["exclamation"], safetyNote: null });
    expect(c.isHighRisk).toBe(false);
    expect(c.hazardCodes).toEqual([]);
    expect(c.safetyNote).toBeUndefined();
  });
});

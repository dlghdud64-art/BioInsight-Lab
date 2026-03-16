import { describe, it, expect } from "@jest/globals";
import {
  computeProductDiff,
  computeMultiProductDiff,
} from "@/lib/compare-workspace/compare-engine";

const productA = {
  id: "prod-a",
  name: "Methanol HPLC Grade",
  brand: "Sigma-Aldrich",
  catalogNumber: "34860",
  grade: "HPLC",
  specification: "2.5L",
  storageCondition: "실온 보관",
  vendors: [
    {
      vendor: { name: "Sigma-Aldrich" },
      priceInKRW: 85000,
      leadTime: 7,
      minOrderQty: 1,
      stockStatus: "재고 있음",
    },
  ],
};

const productB = {
  id: "prod-b",
  name: "Methanol ACS Grade",
  brand: "Fisher Scientific",
  catalogNumber: "A412",
  grade: "ACS",
  specification: "2.5L",
  storageCondition: "실온 보관",
  vendors: [
    {
      vendor: { name: "Fisher Scientific" },
      priceInKRW: 72000,
      leadTime: 14,
      minOrderQty: 2,
      stockStatus: "재고 있음",
    },
  ],
};

const productC = {
  id: "prod-c",
  name: "Methanol HPLC Grade",
  brand: "Sigma-Aldrich",
  catalogNumber: "34860",
  grade: "HPLC",
  specification: "2.5L",
  storageCondition: "실온 보관",
  vendors: [
    {
      vendor: { name: "Sigma-Aldrich" },
      priceInKRW: 85000,
      leadTime: 7,
      minOrderQty: 1,
      stockStatus: "재고 있음",
    },
  ],
};

describe("computeProductDiff", () => {
  it("should compute diff between two different products", () => {
    const result = computeProductDiff(productA, productB, "test-compare-1");

    expect(result.compareId).toBe("test-compare-1");
    expect(result.sourceEntityId).toBe("prod-a");
    expect(result.targetEntityId).toBe("prod-b");
    expect(result.compareType).toBe("PRODUCT_VS_PRODUCT");
    expect(result.totalFieldsCompared).toBeGreaterThan(0);
    expect(result.totalDifferences).toBeGreaterThan(0);
    expect(result.items).toBeInstanceOf(Array);
    expect(result.summary).toBeDefined();
    expect(result.computedAt).toBeInstanceOf(Date);
  });

  it("should detect identical fields", () => {
    const result = computeProductDiff(productA, productB, "test-2");
    const specField = result.items.find((i) => i.fieldKey === "packSize");
    expect(specField?.diffType).toBe("IDENTICAL");
  });

  it("should detect different fields with correct significance", () => {
    const result = computeProductDiff(productA, productB, "test-3");
    const brandField = result.items.find((i) => i.fieldKey === "manufacturer");
    expect(brandField?.diffType).toBe("DIFFERENT");
    expect(brandField?.significance).toBe("HIGH");
    expect(brandField?.sourceValue).toBe("Sigma-Aldrich");
    expect(brandField?.targetValue).toBe("Fisher Scientific");
  });

  it("should compute correct summary counts", () => {
    const result = computeProductDiff(productA, productB, "test-4");
    const { summary } = result;
    expect(summary.criticalCount + summary.highCount + summary.mediumCount + summary.lowCount + summary.infoCount)
      .toBe(result.totalDifferences);
  });

  it("should return EQUIVALENT verdict for identical products", () => {
    const result = computeProductDiff(productA, productC, "test-5");
    expect(result.summary.overallVerdict).toBe("EQUIVALENT");
    expect(result.totalDifferences).toBe(0);
  });

  it("should assign correct actionability hints", () => {
    const result = computeProductDiff(productA, productB, "test-6");
    const gradeField = result.items.find((i) => i.fieldKey === "grade");
    // grade is HIGH significance + DIFFERENT → REQUIRES_REVIEW
    expect(gradeField?.actionability).toBe("REQUIRES_REVIEW");
  });
});

describe("computeMultiProductDiff", () => {
  it("should compare first product against all others", () => {
    const results = computeMultiProductDiff([productA, productB, productC], "session-1");
    expect(results).toHaveLength(2);
    expect(results[0].sourceEntityId).toBe("prod-a");
    expect(results[0].targetEntityId).toBe("prod-b");
    expect(results[1].sourceEntityId).toBe("prod-a");
    expect(results[1].targetEntityId).toBe("prod-c");
  });

  it("should return empty array for single product", () => {
    const results = computeMultiProductDiff([productA], "session-2");
    expect(results).toHaveLength(0);
  });

  it("should return empty array for empty input", () => {
    const results = computeMultiProductDiff([], "session-3");
    expect(results).toHaveLength(0);
  });
});

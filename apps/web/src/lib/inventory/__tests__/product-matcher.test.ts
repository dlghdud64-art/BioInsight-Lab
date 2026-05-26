/**
 * §11.309b #product-matcher — Unit test
 *
 * 4-tier 분기 검증:
 *   1. exact_catalog_brand (catalog + brand 모두 정합) — confidence 0.95
 *   2. exact_catalog (catalog 만 정합, brand mismatch/부재) — confidence 0.85
 *   3. fuzzy_name (productName/brand substring) — confidence 0.4~0.6
 *   4. new (매칭 0) — confidence 0
 *
 * Dependency injection mock — sandbox vitest 호환 (실 DB 없이 검증).
 */

import { describe, it, expect, vi } from "vitest";
import {
  matchProduct,
  type ProductMatcherDb,
  type ProductCandidate,
} from "../product-matcher";

function makeDbMock(opts: {
  findFirstResult?: ProductCandidate | null;
  findManyResult?: ProductCandidate[];
}): ProductMatcherDb {
  return {
    product: {
      findFirst: vi.fn().mockResolvedValue(opts.findFirstResult ?? null),
      findMany: vi.fn().mockResolvedValue(opts.findManyResult ?? []),
    },
  };
}

describe("§11.309b — Tier 1: exact_catalog_brand", () => {
  it("catalog + brand 모두 정합 시 confidence 0.95", async () => {
    const db = makeDbMock({
      findFirstResult: {
        id: "prod_1",
        name: "Trypsin-EDTA 0.25% 100ml",
        brand: "Thermo Fisher",
        catalogNumber: "25200-056",
      },
    });

    const result = await matchProduct(
      {
        catalogNumber: "25200-056",
        productName: "Trypsin-EDTA",
        brand: "Thermo Fisher",
      },
      { db },
    );

    expect(result.type).toBe("exact_catalog_brand");
    expect(result.confidence).toBe(0.95);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe("prod_1");
  });

  it("catalog + brand 모두 정합 (case insensitive)", async () => {
    const db = makeDbMock({
      findFirstResult: {
        id: "prod_2",
        name: "FBS 500ml",
        brand: "Sigma-Aldrich",
        catalogNumber: "F2442",
      },
    });

    const result = await matchProduct(
      { catalogNumber: "F2442", brand: "sigma-aldrich" },
      { db },
    );

    expect(result.type).toBe("exact_catalog_brand");
    expect(result.confidence).toBe(0.95);
  });
});

describe("§11.309b — Tier 2: exact_catalog (brand mismatch/부재)", () => {
  it("catalog 정합 + brand 부재 시 confidence 0.85", async () => {
    const db = makeDbMock({
      findFirstResult: {
        id: "prod_3",
        name: "PBS 1X 1L",
        brand: "Thermo Fisher",
        catalogNumber: "10010-023",
      },
    });

    const result = await matchProduct(
      { catalogNumber: "10010-023" },
      { db },
    );

    expect(result.type).toBe("exact_catalog");
    expect(result.confidence).toBe(0.85);
  });

  it("catalog 정합 + brand mismatch 시 confidence 0.85", async () => {
    const db = makeDbMock({
      findFirstResult: {
        id: "prod_4",
        name: "DMEM 500ml",
        brand: "Thermo Fisher",
        catalogNumber: "11965-092",
      },
    });

    const result = await matchProduct(
      {
        catalogNumber: "11965-092",
        brand: "Wrong Vendor",
      },
      { db },
    );

    expect(result.type).toBe("exact_catalog");
    expect(result.confidence).toBe(0.85);
  });

  it("catalog 정합 + DB brand null 시 confidence 0.85 (mismatch 취급)", async () => {
    const db = makeDbMock({
      findFirstResult: {
        id: "prod_5",
        name: "Generic Reagent",
        brand: null,
        catalogNumber: "ABC-123",
      },
    });

    const result = await matchProduct(
      { catalogNumber: "ABC-123", brand: "Some Vendor" },
      { db },
    );

    expect(result.type).toBe("exact_catalog");
    expect(result.confidence).toBe(0.85);
  });
});

describe("§11.309b — Tier 3: fuzzy_name (catalog 매칭 실패 시)", () => {
  it("catalog 매칭 실패 + productName fuzzy 매칭", async () => {
    const db = makeDbMock({
      findFirstResult: null,
      findManyResult: [
        { id: "prod_6", name: "Trypsin-EDTA 0.05%", brand: "Thermo Fisher", catalogNumber: "12345" },
        { id: "prod_7", name: "Trypsin 1X solution", brand: "Sigma", catalogNumber: "67890" },
      ],
    });

    const result = await matchProduct(
      { productName: "Trypsin" },
      { db },
    );

    expect(result.type).toBe("fuzzy_name");
    expect(result.candidates).toHaveLength(2);
    // brand 매칭 없으니 confidence 0.4
    expect(result.confidence).toBe(0.4);
  });

  it("fuzzy + productName + brand 둘 다 매칭 시 confidence 0.6", async () => {
    const db = makeDbMock({
      findFirstResult: null,
      findManyResult: [
        { id: "prod_8", name: "Trypsin-EDTA 0.25%", brand: "Thermo Fisher", catalogNumber: "25200-056" },
        { id: "prod_9", name: "FBS Premium", brand: "Sigma", catalogNumber: "F-1" },
      ],
    });

    const result = await matchProduct(
      { productName: "Trypsin", brand: "Thermo Fisher" },
      { db },
    );

    expect(result.type).toBe("fuzzy_name");
    expect(result.confidence).toBe(0.6);  // bothMatch 1건 (prod_8)
  });

  it("fuzzy take 5 — 5건 이상 매칭 시 5건만 반환", async () => {
    const candidates: ProductCandidate[] = Array.from({ length: 5 }, (_, i) => ({
      id: `prod_${i + 10}`,
      name: `Trypsin variant ${i}`,
      brand: "Generic",
      catalogNumber: `cat_${i}`,
    }));

    const db = makeDbMock({
      findFirstResult: null,
      findManyResult: candidates,
    });

    const result = await matchProduct(
      { productName: "Trypsin" },
      { db },
    );

    expect(result.type).toBe("fuzzy_name");
    expect(result.candidates).toHaveLength(5);
  });
});

describe("§11.309b — Tier 4: new (매칭 0)", () => {
  it("모든 매칭 실패 시 new + confidence 0 + candidates 0", async () => {
    const db = makeDbMock({
      findFirstResult: null,
      findManyResult: [],
    });

    const result = await matchProduct(
      {
        catalogNumber: "UNKNOWN-999",
        productName: "Never Seen Reagent",
        brand: "Unknown Vendor",
      },
      { db },
    );

    expect(result.type).toBe("new");
    expect(result.confidence).toBe(0);
    expect(result.candidates).toHaveLength(0);
  });

  it("input 전체 null/빈 string 시 new (DB 호출 0)", async () => {
    const db = makeDbMock({});

    const result = await matchProduct(
      { catalogNumber: null, productName: null, brand: null },
      { db },
    );

    expect(result.type).toBe("new");
    expect(result.confidence).toBe(0);
    // DB 호출 0 검증 (findFirst / findMany 모두 0회)
    expect(db.product.findFirst).not.toHaveBeenCalled();
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("input 빈 string + whitespace trim 시 new (DB 호출 0)", async () => {
    const db = makeDbMock({});

    const result = await matchProduct(
      { catalogNumber: "  ", productName: "", brand: "  " },
      { db },
    );

    expect(result.type).toBe("new");
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });
});

describe("§11.309b — 입력 normalize 및 edge case", () => {
  it("catalog 정확 매칭 시 raw 값 사용 (Prisma where 통과)", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "prod_99",
      name: "Test",
      brand: "Vendor",
      catalogNumber: "25200-056",
    });
    const db: ProductMatcherDb = {
      product: {
        findFirst,
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await matchProduct(
      { catalogNumber: "  25200-056  " },  // whitespace
      { db },
    );

    // trim 후 raw "25200-056" 으로 query
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { catalogNumber: "25200-056" },
      }),
    );
  });

  it("catalog 매칭 시도 후 결과 0 + productName 없으면 new", async () => {
    const db = makeDbMock({ findFirstResult: null, findManyResult: [] });

    const result = await matchProduct(
      { catalogNumber: "UNKNOWN" },  // productName/brand 없음
      { db },
    );

    expect(result.type).toBe("new");
    expect(db.product.findFirst).toHaveBeenCalledTimes(1);
    expect(db.product.findMany).not.toHaveBeenCalled();  // fuzzy 단계 skip
  });
});

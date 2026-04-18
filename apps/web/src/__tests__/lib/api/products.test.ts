// @ts-nocheck — Phase 3 tsc residual, Phase 4 deferred
// jest mocking creates type mismatches; db is mocked with never type
import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchProducts, getProductById, getBrands } from "@/lib/api/products";
import { db } from "@/lib/db";

// Prisma와 DB 모킹
// NOTE: isPrismaAvailable 은 products.ts 의 useSampleData 분기를 제어하므로
//       반드시 함께 export 해야 한다. 누락 시 sample data path 로 빠져 mock fn 들이 호출되지 않음.
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
  isPrismaAvailable: true,
}));

describe("Product API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchProducts", () => {
    it("should search products by query", async () => {
      const mockProducts = [
        {
          id: "1",
          name: "Test Product",
          category: "REAGENT",
          vendors: [],
        },
      ];

      (db.product.findMany as vi.Mock).mockResolvedValue(mockProducts);
      (db.product.count as vi.Mock).mockResolvedValue(1);

      const result = await searchProducts({ query: "test" });

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter by category", async () => {
      const mockProducts = [
        {
          id: "1",
          name: "Reagent Product",
          category: "REAGENT",
          vendors: [],
        },
      ];

      (db.product.findMany as vi.Mock).mockResolvedValue(mockProducts);
      (db.product.count as vi.Mock).mockResolvedValue(1);

      const result = await searchProducts({ category: "REAGENT" });

      expect(db.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: "REAGENT",
          }),
        })
      );
    });
  });

  describe("getProductById", () => {
    it("should return product by id", async () => {
      const mockProduct = {
        id: "1",
        name: "Test Product",
        vendors: [],
        recommendations: [],
      };

      (db.product.findUnique as vi.Mock).mockResolvedValue(mockProduct);

      const result = await getProductById("1");

      expect(result).toEqual(mockProduct);
      expect(db.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
        })
      );
    });

    it("should return null if product not found", async () => {
      (db.product.findUnique as vi.Mock).mockResolvedValue(null);

      const result = await getProductById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getBrands", () => {
    it("should return unique brands", async () => {
      // NOTE: getBrands 구현은 Prisma `distinct: ["brand"]` 에 위임하여 DB가 중복 제거 책임을 짐.
      //       따라서 mock 은 이미 distinct 가 적용된 결과를 반환해야 한다.
      const mockBrands = [{ brand: "Brand A" }, { brand: "Brand B" }];

      (db.product.findMany as vi.Mock).mockResolvedValue(mockBrands);

      const result = await getBrands();

      expect(result).toContain("Brand A");
      expect(result).toContain("Brand B");
      expect(result.filter((b) => b === "Brand A")).toHaveLength(1);
      // distinct 옵션이 실제로 쿼리에 포함되었는지 검증
      expect(db.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          distinct: ["brand"],
        }),
      );
    });
  });
});

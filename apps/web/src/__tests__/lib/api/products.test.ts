// @ts-nocheck
// jest mocking creates type mismatches; db is mocked with never type
import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchProducts, getProductById, getBrands } from "@/lib/api/products";
import { db } from "@/lib/db";

// Prisma와 DB 모킹
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
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
      const mockBrands = [
        { brand: "Brand A" },
        { brand: "Brand B" },
        { brand: "Brand A" }, // 중복
      ];

      (db.product.findMany as vi.Mock).mockResolvedValue(mockBrands);

      const result = await getBrands();

      expect(result).toContain("Brand A");
      expect(result).toContain("Brand B");
      expect(result.filter((b) => b === "Brand A")).toHaveLength(1);
    });
  });
});

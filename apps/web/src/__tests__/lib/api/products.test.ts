import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { searchProducts, getProductById, getBrands } from "@/lib/api/products";
import { db } from "@/lib/db";

// Prisma와 DB 모킹
jest.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe("Product API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      (db.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (db.product.count as jest.Mock).mockResolvedValue(1);

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

      (db.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (db.product.count as jest.Mock).mockResolvedValue(1);

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

      (db.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await getProductById("1");

      expect(result).toEqual(mockProduct);
      expect(db.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "1" },
        })
      );
    });

    it("should return null if product not found", async () => {
      (db.product.findUnique as jest.Mock).mockResolvedValue(null);

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

      (db.product.findMany as jest.Mock).mockResolvedValue(mockBrands);

      const result = await getBrands();

      expect(result).toContain("Brand A");
      expect(result).toContain("Brand B");
      expect(result.filter((b) => b === "Brand A")).toHaveLength(1);
    });
  });
});

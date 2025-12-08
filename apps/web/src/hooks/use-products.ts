import { useQuery } from "@tanstack/react-query";
import type { ProductCategory } from "@/types";

interface SearchProductsParams {
  query?: string;
  category?: ProductCategory;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_low" | "price_high" | "lead_time" | "review";
  page?: number;
  limit?: number;
}

export function useSearchProducts(params: SearchProductsParams) {
  return useQuery({
    queryKey: ["products", "search", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      
      if (params.query) searchParams.set("q", params.query);
      if (params.category) searchParams.set("category", params.category);
      if (params.brand) searchParams.set("brand", params.brand);
      if (params.minPrice !== undefined) searchParams.set("minPrice", params.minPrice.toString());
      if (params.maxPrice !== undefined) searchParams.set("maxPrice", params.maxPrice.toString());
      if (params.sortBy) searchParams.set("sortBy", params.sortBy);
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());

      const response = await fetch(`/api/products/search?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to search products");
      }
      return response.json();
    },
    enabled: true,
  });
}

// 제품 ID로 조회 hook
export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) throw new Error("Product ID is required");
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      return response.json();
    },
    enabled: !!productId,
  });
}

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

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch product");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["products", "brands"],
    queryFn: async () => {
      const response = await fetch("/api/products/brands");
      if (!response.ok) {
        throw new Error("Failed to fetch brands");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}



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

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch product");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["products", "brands"],
    queryFn: async () => {
      const response = await fetch("/api/products/brands");
      if (!response.ok) {
        throw new Error("Failed to fetch brands");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}



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

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch product");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["products", "brands"],
    queryFn: async () => {
      const response = await fetch("/api/products/brands");
      if (!response.ok) {
        throw new Error("Failed to fetch brands");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}






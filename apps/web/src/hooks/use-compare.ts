import { useMutation, useQuery } from "@tanstack/react-query";

export function useCompareProducts() {
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to compare products");
      }

      return response.json();
    },
  });
}




export function useCompareProducts() {
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to compare products");
      }

      return response.json();
    },
  });
}




export function useCompareProducts() {
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to compare products");
      }

      return response.json();
    },
  });
}







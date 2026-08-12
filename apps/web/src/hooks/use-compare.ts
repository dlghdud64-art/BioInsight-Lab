import { csrfFetch } from "@/lib/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function useCompareProducts() {
  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await csrfFetch("/api/products/compare", {
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


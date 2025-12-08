import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
  verified: boolean;
  createdAt: Date;
  user?: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export function useProductReviews(
  productId: string | undefined,
  params?: {
    page?: number;
    limit?: number;
    sortBy?: "recent" | "rating_high" | "rating_low";
  }
) {
  return useQuery<ReviewsResponse>({
    queryKey: ["product-reviews", productId, params],
    queryFn: async () => {
      if (!productId) throw new Error("Product ID is required");
      
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.sortBy) searchParams.set("sortBy", params.sortBy);

      const response = await fetch(
        `/api/products/${productId}/reviews?${searchParams.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
    enabled: !!productId,
  });
}

// 리뷰 생성 hook
export function useCreateReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      productId: string;
      rating: number;
      title?: string;
      comment?: string;
      pros?: string;
      cons?: string;
    }) => {
      const response = await fetch(`/api/products/${data.productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create review");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", variables.productId] });
    },
  });
}

// 리뷰 삭제 hook
export function useDeleteReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ reviewId, productId }: { reviewId: string; productId: string }) => {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete review");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-reviews", variables.productId] });
    },
  });
}

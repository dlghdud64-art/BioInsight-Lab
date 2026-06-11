import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

interface PersonalizedRecommendation {
  product: {
    id: string;
    name: string;
    nameEn?: string;
    brand?: string;
    category: string;
    description?: string;
    descriptionTranslated?: string;
    imageUrl?: string;
    vendors?: Array<{
      id: string;
      priceInKRW?: number;
      leadTime?: number;
      vendor?: {
        id: string;
        name: string;
      };
    }>;
  };
  score: number;
  reason: string;
}

export function usePersonalizedRecommendations(productId?: string, limit: number = 5, category?: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["personalized-recommendations", productId, limit, category],
    queryFn: async () => {
      if (!session?.user?.id) {
        return { recommendations: [] };
      }

      const params = new URLSearchParams();
      if (productId) params.set("productId", productId);
      // §1-2⑤ — 상세 맥락 카테고리 고정 (cross-category 추천 noise 차단)
      if (category) params.set("category", category);
      params.set("limit", limit.toString());

      const response = await fetch(`/api/recommendations/personalized?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch personalized recommendations");
      }
      return response.json() as Promise<{ recommendations: PersonalizedRecommendation[] }>;
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5분
  });
}


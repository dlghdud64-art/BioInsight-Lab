/**
 * §11.310b #use-reorder-recommendation — 재발주 추천 데이터 fetch hook.
 *
 * 호영님 P1 spec (Q32 = A):
 *   재고 운영 도우미 → 재발주안 검토 바텀시트의 추천 벤더 + 최근 구매 list.
 *   /api/inventory/reorder-recommendation 호출 (PurchaseRecord 집계).
 *
 * React Query 패턴:
 *   - enabled: !!productName (productName null 시 호출 0)
 *   - staleTime: 60s (재고 도우미 빈번 호출 방지)
 *   - retry: 1 (네트워크 실패 시 1회 재시도)
 *
 * 사용처: inventory-ai-assistant-panel.tsx 의 ReorderReviewSheet 데이터 주입.
 */

import { useQuery } from "@tanstack/react-query";
import type {
  ReorderVendorSuggestion,
  ReorderRecentPurchase,
  ReorderRecommendationResponse,
} from "@/app/api/inventory/reorder-recommendation/route";

export type {
  ReorderVendorSuggestion,
  ReorderRecentPurchase,
  ReorderRecommendationResponse,
};

export interface UseReorderRecommendationResult {
  vendors: ReorderVendorSuggestion[];
  recentPurchases: ReorderRecentPurchase[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * 재발주 추천 데이터 hook.
 *
 * @param productName 매칭할 품목명 (null 시 호출 0)
 */
export function useReorderRecommendation(
  productName: string | null,
): UseReorderRecommendationResult {
  const { data, isLoading, isError } = useQuery<ReorderRecommendationResponse>({
    queryKey: ["reorder-recommendation", productName],
    queryFn: async () => {
      const params = new URLSearchParams({ productName: productName ?? "" });
      const res = await fetch(
        `/api/inventory/reorder-recommendation?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error("재발주 추천 데이터 조회 실패");
      }
      return res.json();
    },
    enabled: !!productName && productName.trim().length > 0,
    staleTime: 60_000, // 60s
    retry: 1,
  });

  return {
    vendors: data?.vendors ?? [],
    recentPurchases: data?.recentPurchases ?? [],
    isLoading,
    isError,
  };
}

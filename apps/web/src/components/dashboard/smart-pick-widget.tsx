"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Sparkles, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ReorderRecommendation {
  inventoryId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
  };
  currentQuantity: number;
  safetyStock: number;
  recommendedQuantity: number;
  unit: string;
  urgency: "urgent" | "high" | "medium";
}

export function SmartPickWidget() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 사용자 이름 가져오기
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "연구원";
  const userDisplayName = userName.split(" ")[0] || userName;

  // 재주문 추천 조회
  const { data, isLoading } = useQuery<{ recommendations: ReorderRecommendation[] }>({
    queryKey: ["smart-pick-recommendations"],
    queryFn: async () => {
      const response = await fetch("/api/inventory/reorder-recommendations");
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
    enabled: !!session?.user,
  });

  const recommendations = data?.recommendations?.slice(0, 3) || []; // 최대 3개만 표시

  // 장바구니에 추가 mutation
  const addToCartMutation = useMutation({
    mutationFn: async (rec: ReorderRecommendation) => {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: rec.product.id,
          productName: rec.product.name,
          brand: rec.product.brand,
          catalogNumber: rec.product.catalogNumber,
          quantity: rec.recommendedQuantity,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to cart");
      }
      return response.json();
    },
    onSuccess: (data, rec) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast({
        title: "장바구니에 담겼어요",
        description: `${rec.product.name}이(가) 장바구니에 추가되었습니다.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "추가 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">추천 상품을 찾고 있어요...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null; // 추천이 없으면 표시하지 않음
  }

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg font-semibold text-gray-900">
            AI 추천: 슬슬 필요하지 않으세요?
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-gray-600 mt-1">
          {userDisplayName}님, 지난번 주문한 시약이 떨어질 때가 된 것 같아 챙겨봤어요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.inventoryId}
            className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">
                    {rec.product.name}
                  </h4>
                  {rec.urgency === "urgent" && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      긴급
                    </Badge>
                  )}
                </div>
                {rec.product.brand && (
                  <p className="text-xs text-gray-500 mb-2">{rec.product.brand}</p>
                )}
                <p className="text-xs text-blue-700 font-medium mb-2">
                  💡 보통 이맘때 재구매하셨어요
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span>
                    현재: <span className="font-medium">{rec.currentQuantity} {rec.unit}</span>
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>
                    추천: <span className="font-semibold text-blue-700">{rec.recommendedQuantity} {rec.unit}</span>
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => addToCartMutation.mutate(rec)}
                disabled={addToCartMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    담기
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
        {recommendations.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => router.push("/dashboard/inventory")}
          >
            더 많은 추천 보기
          </Button>
        )}
      </CardContent>
    </Card>
  );
}


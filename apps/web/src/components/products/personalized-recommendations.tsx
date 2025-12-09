"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersonalizedRecommendations } from "@/hooks/use-personalized-recommendations";
import { useCompareStore } from "@/lib/store/compare-store";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { Sparkles, TrendingUp, Package, ThumbsUp, ThumbsDown, DollarSign, Zap, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PersonalizedRecommendationsProps {
  productId?: string;
  currentProduct?: any; // 현재 제품 정보 (가격/스펙 비교용)
  title?: string;
  limit?: number;
}

export function PersonalizedRecommendations({
  productId,
  currentProduct,
  title = "연관 추천 제품",
  limit = 5,
}: PersonalizedRecommendationsProps) {
  const router = useRouter();
  const { data, isLoading } = usePersonalizedRecommendations(productId, limit);
  const { addProduct, removeProduct, hasProduct } = useCompareStore();

  const recommendations = data?.recommendations || [];
  
  // 현재 제품의 최소 가격 계산
  let currentMinPrice: number | null = null;
  if (currentProduct?.vendors && currentProduct.vendors.length > 0) {
    for (const v of currentProduct.vendors) {
      if (v.priceInKRW && (currentMinPrice === null || v.priceInKRW < currentMinPrice)) {
        currentMinPrice = v.priceInKRW;
      }
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">추천 제품을 분석 중입니다...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          {title}
        </CardTitle>
        <CardDescription>
          유사도 점수, 가격대 범위, 성능 차이를 비교하여 추천된 제품입니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => {
          const product = rec.product;
          let minPrice: number | null = null;
          let maxPrice: number | null = null;
          let minLeadTime: number | null = null;
          
          if (product.vendors && product.vendors.length > 0) {
            for (const v of product.vendors) {
              if (v.priceInKRW) {
                if (minPrice === null || v.priceInKRW < minPrice) {
                  minPrice = v.priceInKRW;
                }
                if (maxPrice === null || v.priceInKRW > maxPrice) {
                  maxPrice = v.priceInKRW;
                }
              }
              if (v.leadTime !== null && v.leadTime !== undefined && (minLeadTime === null || v.leadTime < minLeadTime)) {
                minLeadTime = v.leadTime;
              }
            }
          }
          const inCompare = hasProduct(product.id);

          // 가격 비교 (현재 제품 대비)
          const priceDiff = currentMinPrice && minPrice
            ? ((minPrice - currentMinPrice) / currentMinPrice) * 100
            : null;
          const priceRange = minPrice && maxPrice && minPrice !== maxPrice
            ? `₩${minPrice.toLocaleString()} ~ ₩${maxPrice.toLocaleString()}`
            : minPrice
            ? `₩${minPrice.toLocaleString()}`
            : null;

          // 유사도 점수 기반 배지 색상
          const similarityScore = rec.score || 0;
          const similarityBadgeVariant = similarityScore >= 0.8 ? "default" : similarityScore >= 0.6 ? "secondary" : "outline";

          return (
            <div
              key={product.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Link
                      href={`/products/${product.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {product.name}
                    </Link>
                    {product.brand && (
                      <p className="text-sm text-slate-500 mt-0.5">{product.brand}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={similarityBadgeVariant} className="text-xs font-semibold">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      유사도 {(similarityScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>

                {/* 가격대 범위 및 비교 */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {product.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                      </Badge>
                    )}
                    {(product as any).grade && (
                      <Badge variant="secondary" className="text-[10px]">
                        {(product as any).grade}
                      </Badge>
                    )}
                    {(product as any).specification && (
                      <Badge variant="outline" className="text-[10px]">
                        {(product as any).specification}
                      </Badge>
                    )}
                  </div>

                  {priceRange && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-3 w-3 text-slate-500" />
                      <span className="font-medium text-slate-700">{priceRange}</span>
                      {priceDiff !== null && (
                        <Badge
                          variant={priceDiff < -10 ? "default" : priceDiff > 10 ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {priceDiff > 0 ? "+" : ""}
                          {priceDiff.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  )}

                  {minLeadTime && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Package className="h-3 w-3" />
                      <span>납기: {minLeadTime}일</span>
                    </div>
                  )}
                </div>

                {/* 추천 근거 (Explainability) */}
                {rec.reason && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="h-3 w-3 mt-0.5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-blue-900 mb-1">추천 근거</p>
                        <p className="text-xs text-blue-700">{rec.reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 성능 차이 하이라이트 (스펙 차이가 있는 경우) */}
                {currentProduct && (product as any).specification && (currentProduct as any).specification && (
                  (product as any).specification !== (currentProduct as any).specification && (
                    <div className="flex items-center gap-2 text-xs">
                      <Zap className="h-3 w-3 text-amber-500" />
                      <span className="text-slate-600">
                        규격 차이: {(currentProduct as any).specification} → {(product as any).specification}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant={inCompare ? "outline" : "default"}
                  size="sm"
                  onClick={() => {
                    if (inCompare) {
                      removeProduct(product.id);
                    } else {
                      addProduct(product.id);
                    }
                  }}
                >
                  {inCompare ? "비교에서 제거" : "비교 추가"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/products/${product.id}`)}
                >
                  상세 보기
                </Button>
                <RecommendationFeedbackButton recommendationId={(rec as any).id || ""} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RecommendationFeedbackButton({ recommendationId }: { recommendationId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");

  const feedbackMutation = useMutation({
    mutationFn: async (data: { isHelpful: boolean; reason?: string }) => {
      const response = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId,
          isHelpful: data.isHelpful,
          reason: data.reason || undefined,
        }),
      });
      if (!response.ok) throw new Error("Failed to submit feedback");
      return response.json();
    },
    onSuccess: () => {
      setIsOpen(false);
      setIsHelpful(null);
      setReason("");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          피드백
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>추천 피드백</DialogTitle>
          <DialogDescription>
            이 추천이 도움이 되었나요?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={isHelpful === true ? "default" : "outline"}
              size="sm"
              onClick={() => setIsHelpful(true)}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              도움됨
            </Button>
            <Button
              variant={isHelpful === false ? "default" : "outline"}
              size="sm"
              onClick={() => setIsHelpful(false)}
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              도움 안됨
            </Button>
          </div>
          {isHelpful !== null && (
            <div>
              <Label htmlFor="reason">이유 (선택)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="추천이 도움이 되었거나 되지 않은 이유를 알려주세요"
                rows={3}
                className="mt-1"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={() => {
                if (isHelpful !== null) {
                  feedbackMutation.mutate({ isHelpful, reason });
                }
              }}
              disabled={isHelpful === null || feedbackMutation.isPending}
              className="flex-1"
            >
              제출
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
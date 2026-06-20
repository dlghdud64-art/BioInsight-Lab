"use client";

import { csrfFetch } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePersonalizedRecommendations } from "@/hooks/use-personalized-recommendations";
import { useCompareStore } from "@/lib/store/compare-store";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
// §11.368 §0 — Sparkles(AI 마케팅 데코) 제거.
// §1-2③ — TrendingUp(유사도 배지) 제거: score는 유사도가 아니라 빈도 카운트라 % 표기는 fake-metric.
import { Package, ThumbsUp, ThumbsDown, Zap, ChevronRight } from "lucide-react";
import Link from "next/link";
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
  /** §1-2⑤ — 상세 맥락 카테고리 고정 (cross-category 추천 noise 차단) */
  category?: string;
}

export function PersonalizedRecommendations({
  productId,
  currentProduct,
  title = "연관 추천 제품",
  limit = 5,
  category,
}: PersonalizedRecommendationsProps) {
  const { data, isLoading } = usePersonalizedRecommendations(productId, limit, category);
  const { addProduct, removeProduct, hasProduct } = useCompareStore();

  const recommendations = data?.recommendations || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
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
          <Zap className="h-5 w-5 text-purple-600" />
          {title}
        </CardTitle>
        <CardDescription>
          검색·구매 이력과 가격대를 반영해 추천된 제품입니다
        </CardDescription>
      </CardHeader>
      {/* §PD-flat(시안 rel-list) — 연관추천: 과폭/세로스택 폐기 → 컴팩트 1행(썸네일+이름+분류+인라인 버튼). */}
      <CardContent className="divide-y divide-gray-100 py-0">
        {recommendations.map((rec) => {
          const product = rec.product;
          let minPrice: number | null = null;
          if (product.vendors && product.vendors.length > 0) {
            for (const v of product.vendors) {
              if (v.priceInKRW && (minPrice === null || v.priceInKRW < minPrice)) minPrice = v.priceInKRW;
            }
          }
          const inCompare = hasProduct(product.id);
          const priceText = minPrice ? `₩${minPrice.toLocaleString()}` : null;

          return (
            <div
              key={product.id}
              className="flex items-center gap-3.5 py-3.5 first:pt-4 last:pb-4"
            >
              <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-gray-400" />
              </span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${product.id}`}
                  className="block font-semibold text-sm text-slate-900 hover:text-[#2456bd] transition-colors truncate"
                >
                  {product.name}
                </Link>
                <div className="flex items-center gap-1.5 mt-1">
                  {product.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#eaf1fd] text-[#2456bd]">
                      {PRODUCT_CATEGORIES[product.category as keyof typeof PRODUCT_CATEGORIES]}
                    </span>
                  )}
                  {priceText && <span className="text-[11px] text-slate-500">{priceText}</span>}
                </div>
                {/* §1-2③/honesty — 추천 근거(reason) 인라인 보존: 무근거 푸시 금지(정직성). 컴팩트 1줄. */}
                {rec.reason && (
                  <div className="flex items-center gap-1.5 mt-1 min-w-0">
                    <span className="text-[10px] text-slate-400 flex-shrink-0">추천 근거</span>
                    <span className="text-[11px] text-slate-600 truncate">{rec.reason}</span>
                    {(rec as any).source === "purchase_pattern" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0 whitespace-nowrap">구매 패턴 기반</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    if (inCompare) {
                      removeProduct(product.id);
                    } else {
                      addProduct(product.id);
                    }
                  }}
                >
                  {inCompare ? "비교 제거" : "비교"}
                </Button>
                <Link
                  href={`/products/${product.id}`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 hover:text-[#2456bd] px-2 py-1.5"
                >
                  상세 <ChevronRight className="h-3 w-3" />
                </Link>
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
      const response = await csrfFetch("/api/recommendations/feedback", {
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
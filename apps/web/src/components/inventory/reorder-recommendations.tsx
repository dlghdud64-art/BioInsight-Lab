"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShoppingCart, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

interface ReorderRecommendation {
  inventoryId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
    category?: string;
    vendors?: Array<{
      id: string;
      vendor?: {
        id: string;
        name: string;
      };
      priceInKRW?: number;
      currency?: string;
    }>;
  };
  currentQuantity: number;
  safetyStock: number;
  recommendedQuantity: number;
  estimatedMonthlyUsage: number;
  unit: string;
  urgency: "urgent" | "high" | "medium";
}

interface ReorderRecommendationsProps {
  organizationId?: string;
  onAddToQuoteList?: (recommendations: ReorderRecommendation[]) => void;
}

export function ReorderRecommendations({
  organizationId,
  onAddToQuoteList,
}: ReorderRecommendationsProps) {
  const { data, isLoading } = useQuery<{ recommendations: ReorderRecommendation[] }>({
    queryKey: ["reorder-recommendations", organizationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);

      const response = await fetch(`/api/inventory/reorder-recommendations?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
  });

  const recommendations = data?.recommendations || [];

  const handleAddToQuoteList = () => {
    if (onAddToQuoteList && recommendations.length > 0) {
      onAddToQuoteList(recommendations);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">재주문 추천을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">재주문 추천</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            자주 주문한 제품을 기반으로 재주문이 필요한 품목을 알려드려요.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <p className="text-center text-sm text-slate-500">
            아직 재주문 추천이 없습니다.
            <br />
            먼저 제품을 검색하고 견적을 받아보세요.
          </p>
          <div className="mt-4 flex justify-center">
            <Button size="sm" asChild>
              <Link href="/test/search">제품 검색하기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const urgentCount = recommendations.filter((r) => r.urgency === "urgent").length;
  const highCount = recommendations.filter((r) => r.urgency === "high").length;

  return (
    <Card className="border-none shadow-sm bg-white rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-base md:text-lg font-semibold text-gray-900">재주문 추천</CardTitle>
            <CardDescription className="text-xs md:text-sm text-gray-500">
              자주 주문한 제품을 기반으로 재주문이 필요한 품목을 알려드려요.
            </CardDescription>
          </div>
          <Button onClick={handleAddToQuoteList} size="sm" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white">
            <ShoppingCart className="h-4 w-4 mr-2" />
            모두 품목 리스트에 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {urgentCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>긴급 재주문 필요</AlertTitle>
            <AlertDescription>
              재고가 없는 제품이 {urgentCount}개 있습니다. 즉시 주문이 필요합니다.
            </AlertDescription>
          </Alert>
        )}

        {/* 모바일: 가로 스크롤, 데스크톱: 그리드 */}
        <div className="md:hidden overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3 min-w-max">
            {recommendations.map((rec) => {
              const vendor = rec.product.vendors?.[0];
              const urgencyColors = {
                urgent: "border-red-300 bg-red-50",
                high: "border-orange-300 bg-orange-50",
                medium: "border-yellow-300 bg-yellow-50",
              };
              const urgencyBadgeColors = {
                urgent: "bg-red-100 text-red-800 border-red-300",
                high: "bg-orange-100 text-orange-800 border-orange-300",
                medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
              };

              return (
                <div
                  key={rec.inventoryId}
                  className={`w-40 flex-shrink-0 p-4 border rounded-2xl shadow-sm ${urgencyColors[rec.urgency]}`}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-2">
                      <Badge variant="outline" className={`text-xs mb-2 ${urgencyBadgeColors[rec.urgency]}`}>
                        {rec.urgency === "urgent" ? "긴급" : rec.urgency === "high" ? "높음" : "보통"}
                      </Badge>
                      <h4 className="font-semibold text-sm line-clamp-2 mb-1">{rec.product.name}</h4>
                      {rec.product.brand && (
                        <p className="text-xs text-gray-600 mb-2">{rec.product.brand}</p>
                      )}
                    </div>
                    <div className="flex-1 space-y-1 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">추천:</span>
                        <span className="ml-1 font-semibold text-blue-700">
                          {rec.recommendedQuantity} {rec.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">현재:</span>
                        <span className="ml-1">{rec.currentQuantity} {rec.unit}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-8"
                      onClick={() => {
                        if (onAddToQuoteList) {
                          onAddToQuoteList([rec]);
                        }
                      }}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      바로담기
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 데스크톱: 기존 그리드 레이아웃 */}
        <div className="hidden md:grid md:grid-cols-1 lg:grid-cols-2 gap-4">
          {recommendations.map((rec) => {
            const vendor = rec.product.vendors?.[0];
            const urgencyColors = {
              urgent: "bg-red-100 text-red-800 border-red-300",
              high: "bg-orange-100 text-orange-800 border-orange-300",
              medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
            };

            return (
              <div
                key={rec.inventoryId}
                className={`p-4 border rounded-2xl shadow-sm ${urgencyColors[rec.urgency]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{rec.product.name}</h4>
                      {rec.product.brand && (
                        <span className="text-sm text-muted-foreground">
                          {rec.product.brand}
                        </span>
                      )}
                      <Badge variant="outline" className={urgencyColors[rec.urgency]}>
                        {rec.urgency === "urgent" ? "긴급" : rec.urgency === "high" ? "높음" : "보통"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">현재 재고:</span>
                        <span className="ml-2 font-medium">
                          {rec.currentQuantity} {rec.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">안전 재고:</span>
                        <span className="ml-2 font-medium">
                          {rec.safetyStock} {rec.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">추천 수량:</span>
                        <span className="ml-2 font-semibold text-blue-700">
                          {rec.recommendedQuantity} {rec.unit}
                        </span>
                      </div>
                      {rec.estimatedMonthlyUsage > 0 && (
                        <div>
                          <span className="text-muted-foreground">예상 월 사용량:</span>
                          <span className="ml-2">
                            {rec.estimatedMonthlyUsage.toFixed(1)} {rec.unit}
                          </span>
                        </div>
                      )}
                    </div>
                    {vendor && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        추천 벤더: {vendor.vendor?.name} · ₩
                        {vendor.priceInKRW?.toLocaleString()} ({vendor.currency || "KRW"})
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (onAddToQuoteList) {
                          onAddToQuoteList([rec]);
                        }
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      추가
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShoppingCart, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReorderRecommendation {
  inventoryId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
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
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">재주문 추천을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>재주문 추천</CardTitle>
          <CardDescription>안전 재고 이하인 제품이 없습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const urgentCount = recommendations.filter((r) => r.urgency === "urgent").length;
  const highCount = recommendations.filter((r) => r.urgency === "high").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>재주문 추천</CardTitle>
            <CardDescription>
              안전 재고 이하인 제품 {recommendations.length}개
              {urgentCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">
                  (긴급: {urgentCount}개)
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={handleAddToQuoteList} size="sm">
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

        <div className="space-y-3">
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
                className={`p-4 border rounded-lg ${urgencyColors[rec.urgency]}`}
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




import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShoppingCart, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReorderRecommendation {
  inventoryId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
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
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">재주문 추천을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>재주문 추천</CardTitle>
          <CardDescription>안전 재고 이하인 제품이 없습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const urgentCount = recommendations.filter((r) => r.urgency === "urgent").length;
  const highCount = recommendations.filter((r) => r.urgency === "high").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>재주문 추천</CardTitle>
            <CardDescription>
              안전 재고 이하인 제품 {recommendations.length}개
              {urgentCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">
                  (긴급: {urgentCount}개)
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={handleAddToQuoteList} size="sm">
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

        <div className="space-y-3">
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
                className={`p-4 border rounded-lg ${urgencyColors[rec.urgency]}`}
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




import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShoppingCart, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReorderRecommendation {
  inventoryId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
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
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">재주문 추천을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>재주문 추천</CardTitle>
          <CardDescription>안전 재고 이하인 제품이 없습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const urgentCount = recommendations.filter((r) => r.urgency === "urgent").length;
  const highCount = recommendations.filter((r) => r.urgency === "high").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>재주문 추천</CardTitle>
            <CardDescription>
              안전 재고 이하인 제품 {recommendations.length}개
              {urgentCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">
                  (긴급: {urgentCount}개)
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={handleAddToQuoteList} size="sm">
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

        <div className="space-y-3">
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
                className={`p-4 border rounded-lg ${urgencyColors[rec.urgency]}`}
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






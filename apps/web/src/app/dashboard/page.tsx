"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReorderRecommendations } from "@/components/inventory/reorder-recommendations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, History, ExternalLink, Calendar, MapPin, Package, DollarSign, TrendingUp, BarChart3, Activity } from "lucide-react";
import Link from "next/link";
import { QUOTE_STATUS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 견적 목록 조회
  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const response = await fetch("/api/quotes");
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 즐겨찾기 조회
  const { data: favoritesData, isLoading: favoritesLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const response = await fetch("/api/favorites");
      if (!response.ok) throw new Error("Failed to fetch favorites");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 최근 본 제품 조회
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-products"],
    queryFn: async () => {
      const response = await fetch("/api/recent-products");
      if (!response.ok) throw new Error("Failed to fetch recent products");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 구매 내역/예산 요약 조회
  const { data: purchaseSummary, isLoading: purchaseSummaryLoading } = useQuery({
    queryKey: ["purchase-summary"],
    queryFn: async () => {
      const response = await fetch("/api/reports/purchase?period=month");
      if (!response.ok) throw new Error("Failed to fetch purchase summary");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 최근 활동 로그 조회
  const { data: activityLogsData, isLoading: activityLogsLoading } = useQuery({
    queryKey: ["activity-logs-recent"],
    queryFn: async () => {
      const response = await fetch("/api/activity-logs?limit=5");
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard");
  //   return null;
  // }

  const quotes = quotesData?.quotes || [];
  const favorites = favoritesData?.favorites || [];
  const recentProducts = recentData?.products || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-6xl mx-auto">
            <PageHeader
              title="대시보드"
              description="견적, 즐겨찾기, 최근 본 제품, 구매 내역 요약을 한눈에 확인합니다."
              icon={LayoutDashboard}
            />

        {/* 구매 내역/예산 요약 카드 */}
        {!purchaseSummaryLoading && purchaseSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">이번 달 구매 금액</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₩{purchaseSummary.metrics?.totalAmount?.toLocaleString("ko-KR") || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {purchaseSummary.metrics?.itemCount || 0}개 품목
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예산 사용률</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {purchaseSummary.budgetUsage && purchaseSummary.budgetUsage.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold">
                      {purchaseSummary.budgetUsage[0]?.usageRate?.toFixed(1) || 0}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {purchaseSummary.budgetUsage[0]?.name || "예산"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">-</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Link href="/dashboard/budget" className="text-primary hover:underline">
                        예산 설정하기
                      </Link>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">구매 리포트</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Link href="/reports">
                  <Button variant="outline" className="w-full">
                    상세 리포트 보기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 재주문 추천 섹션 (상단에 표시) */}
        <div className="mb-6">
          <ReorderRecommendations
            onAddToQuoteList={(recommendations) => {
              // 추천 목록을 품목 리스트에 추가
              const productIds = recommendations.map((r) => r.product.id);
              router.push(`/search?bom=${encodeURIComponent(JSON.stringify(recommendations.map(r => ({
                name: r.product.name,
                quantity: r.recommendedQuantity,
                category: r.product.category,
              }))))}`);
            }}
          />
        </div>

        <Tabs defaultValue="quotes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="quotes">
              <ShoppingCart className="h-4 w-4 mr-2" />
              견적 요청 ({quotes.length})
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Heart className="h-4 w-4 mr-2" />
              즐겨찾기 ({favorites.length})
            </TabsTrigger>
            <TabsTrigger value="recent">
              <History className="h-4 w-4 mr-2" />
              최근 본 제품 ({recentProducts.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              최근 활동
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              재고 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>견적 요청 현황</CardTitle>
                <CardDescription>
                  내가 보낸 견적 요청과 응답 상태를 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotesLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : quotes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">견적 요청 내역이 없습니다</p>
                    <Link href="/search">
                      <Button>제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((quote: any) => (
                      <Card key={quote.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{quote.title}</CardTitle>
                              <CardDescription className="mt-1">
                                {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
                              </CardDescription>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                quote.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : quote.status === "RESPONDED"
                                  ? "bg-blue-100 text-blue-800"
                                  : quote.status === "CANCELLED"
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {QUOTE_STATUS[quote.status as keyof typeof QUOTE_STATUS]}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {quote.message && (
                            <p className="text-sm text-muted-foreground mb-3">{quote.message}</p>
                          )}
                          <div className="space-y-2 text-sm">
                            {quote.deliveryDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>납기 희망일: {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}</span>
                              </div>
                            )}
                            {quote.deliveryLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>납품 장소: {quote.deliveryLocation}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">
                              요청 제품 ({quote.items?.length || 0}개)
                            </p>
                            <div className="space-y-1">
                              {quote.items?.map((item: any) => (
                                <div key={item.id} className="text-sm text-muted-foreground">
                                  • {item.product?.name} (수량: {item.quantity})
                                </div>
                              ))}
                            </div>
                          </div>
                          {quote.responses && quote.responses.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm font-medium mb-2">
                                견적 응답 ({quote.responses.length}개)
                              </p>
                              {quote.responses.map((response: any) => (
                                <div key={response.id} className="text-sm">
                                  <span className="font-medium">{response.vendor?.name}:</span>{" "}
                                  {response.totalPrice
                                    ? `₩${response.totalPrice.toLocaleString()}`
                                    : "가격 문의"}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-4">
                            <Link href={`/dashboard/quotes/${quote.id}`}>
                              <Button variant="outline" size="sm">
                                상세 보기
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>즐겨찾기 제품</CardTitle>
                <CardDescription>
                  저장한 제품을 빠르게 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {favoritesLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">즐겨찾기한 제품이 없습니다</p>
                    <Link href="/search">
                      <Button>제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.map((favorite: any) => {
                      const product = favorite.product;
                      const minPrice = product?.vendors?.reduce(
                        (min: number, v: any) =>
                          v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                        null
                      );

                      return (
                        <Card key={favorite.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <CardTitle className="text-base">
                              <Link
                                href={`/products/${product.id}`}
                                className="hover:underline"
                              >
                                {product.name}
                              </Link>
                            </CardTitle>
                            {product.brand && (
                              <CardDescription>{product.brand}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {product.category && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  {PRODUCT_CATEGORIES[product.category]}
                                </span>
                              )}
                              {minPrice ? (
                                <div className="text-lg font-semibold">
                                  ₩{minPrice.toLocaleString()}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">가격 문의</div>
                              )}
                              <Link href={`/products/${product.id}`}>
                                <Button size="sm" className="w-full mt-2">
                                  상세 보기
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>최근 본 제품</CardTitle>
                <CardDescription>
                  최근에 조회한 제품 목록입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : recentProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">최근 본 제품이 없습니다</p>
                    <Link href="/search">
                      <Button>제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentProducts.map((product: any) => {
                      const minPrice = product?.vendors?.reduce(
                        (min: number, v: any) =>
                          v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                        null
                      );

                      return (
                        <Card key={product.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <CardTitle className="text-base">
                              <Link
                                href={`/products/${product.id}`}
                                className="hover:underline"
                              >
                                {product.name}
                              </Link>
                            </CardTitle>
                            {product.brand && (
                              <CardDescription>{product.brand}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {product.category && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  {PRODUCT_CATEGORIES[product.category]}
                                </span>
                              )}
                              {minPrice ? (
                                <div className="text-lg font-semibold">
                                  ₩{minPrice.toLocaleString()}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">가격 문의</div>
                              )}
                              <Link href={`/products/${product.id}`}>
                                <Button size="sm" className="w-full mt-2">
                                  상세 보기
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>최근 활동</CardTitle>
                    <CardDescription>
                      최근 활동 내역을 확인할 수 있습니다
                    </CardDescription>
                  </div>
                  <Link href="/dashboard/activity-logs">
                    <Button variant="outline" size="sm">
                      전체 보기
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {activityLogsLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : !activityLogsData?.logs || activityLogsData.logs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">활동 내역이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activityLogsData.logs.slice(0, 5).map((log: any) => {
                      const activityLabels: Record<string, string> = {
                        QUOTE_CREATED: "리스트 생성",
                        QUOTE_UPDATED: "리스트 수정",
                        QUOTE_DELETED: "리스트 삭제",
                        QUOTE_SHARED: "리스트 공유",
                        QUOTE_VIEWED: "리스트 조회",
                        PRODUCT_COMPARED: "제품 비교",
                        PRODUCT_VIEWED: "제품 조회",
                        PRODUCT_FAVORITED: "제품 즐겨찾기",
                        SEARCH_PERFORMED: "검색 수행",
                      };
                      const label = activityLabels[log.activityType] || log.activityType;
                      const date = new Date(log.createdAt);
                      const timeAgo = date.toLocaleString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Activity className="h-4 w-4 text-slate-400" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {label}
                            </div>
                            {log.metadata?.title && (
                              <div className="text-xs text-slate-500 mt-1">
                                {log.metadata.title}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 whitespace-nowrap">
                            {timeAgo}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
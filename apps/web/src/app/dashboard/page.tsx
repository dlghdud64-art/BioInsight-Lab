"use client";

import { useState } from "react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDashboardWidgets } from "@/lib/store/dashboard-widgets-store";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { DraggableWidget } from "@/components/dashboard/draggable-widget";
import { Settings, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

const DASHBOARD_TABS = [
  { id: "quotes", label: "견적" },
  { id: "favorites", label: "즐겨찾기" },
  { id: "recent", label: "최근" },
  { id: "activity", label: "활동" },
  { id: "inventory", label: "재고" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("quotes");
  const [activityPeriod, setActivityPeriod] = useState<string>("month");
  const [purchasePeriod, setPurchasePeriod] = useState<string>("month");
  const { isEditMode, setEditMode, widgets, resetLayout, loadLayout } = useDashboardWidgets();

  // 레이아웃 로드
  useEffect(() => {
    if (status === "authenticated") {
      loadLayout();
    }
  }, [status, loadLayout]);

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
  const { data: purchaseSummary, isLoading: purchaseSummaryLoading, error: purchaseSummaryError } = useQuery({
    queryKey: ["purchase-summary", purchasePeriod],
    queryFn: async () => {
      const response = await fetch(`/api/reports/purchase?period=${purchasePeriod}`);
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

  // 액티비티 로그 통계 조회
  const { data: activityStats, isLoading: activityStatsLoading } = useQuery({
    queryKey: ["activity-logs-stats", activityPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/activity-logs/stats?period=${activityPeriod}`);
      if (!response.ok) throw new Error("Failed to fetch activity stats");
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
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <PageHeader
                title="대시보드"
                description="견적, 즐겨찾기, 최근 본 제품, 구매 내역 요약을 한눈에 확인합니다."
                icon={LayoutDashboard}
              />
              <div className="flex gap-2">
                {isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetLayout}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    초기화
                  </Button>
                )}
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(!isEditMode)}
                  className="text-xs"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  {isEditMode ? "완료" : "편집"}
                </Button>
              </div>
            </div>

        {/* 구매 내역/예산 요약 카드 */}
        <WidgetGrid>
          {widgets
            .filter((w) => w.id === "purchase-summary" && w.visible)
            .map((widget) => (
              <DraggableWidget
                key={widget.id}
                id={widget.id}
                title="구매 내역 요약"
                defaultSize={widget.size}
              >
                <div className="space-y-3 md:space-y-4">
                  {/* 기간 선택 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs md:text-sm text-slate-600">기간 선택</span>
                    <Select value={purchasePeriod} onValueChange={setPurchasePeriod}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">이번 달</SelectItem>
                        <SelectItem value="quarter">이번 분기</SelectItem>
                        <SelectItem value="year">이번 해</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 로딩 상태 */}
                  {purchaseSummaryLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="p-3 md:p-6">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4 rounded" />
                          </CardHeader>
                          <CardContent className="px-0 pb-0">
                            <Skeleton className="h-8 w-32 mt-2" />
                            <Skeleton className="h-3 w-20 mt-2" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* 에러 상태 */}
                  {purchaseSummaryError && !purchaseSummaryLoading && (
                    <Card className="p-3 md:p-6">
                      <CardContent className="flex flex-col items-center justify-center py-6">
                        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                        <p className="text-sm text-red-600 mb-2">데이터를 불러오는 중 오류가 발생했습니다.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.reload()}
                          className="text-xs"
                        >
                          다시 시도
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* 빈 상태 */}
                  {!purchaseSummaryLoading && !purchaseSummaryError && (!purchaseSummary || purchaseSummary.metrics?.itemCount === 0) && (
                    <Card className="p-3 md:p-6">
                      <CardContent className="flex flex-col items-center justify-center py-6">
                        <Package className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500 mb-2">구매 내역이 없습니다.</p>
                        <Link href="/dashboard/purchases">
                          <Button variant="outline" size="sm" className="text-xs">
                            구매내역 추가하기
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )}

                  {/* 데이터 표시 */}
                  {!purchaseSummaryLoading && !purchaseSummaryError && purchaseSummary && purchaseSummary.metrics?.itemCount > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      <Card className="p-3 md:p-6">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                          <CardTitle className="text-xs md:text-sm font-medium">구매 금액</CardTitle>
                          <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                          <div className="text-lg md:text-2xl font-bold">
                            ₩{purchaseSummary.metrics?.totalAmount?.toLocaleString("ko-KR") || 0}
                          </div>
                          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                            {purchaseSummary.metrics?.itemCount || 0}개 품목
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="p-3 md:p-6">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                          <CardTitle className="text-xs md:text-sm font-medium">예산 사용률</CardTitle>
                          <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                          {purchaseSummary.budgetUsage && purchaseSummary.budgetUsage.length > 0 ? (
                            <>
                              <div className="text-lg md:text-2xl font-bold">
                                {purchaseSummary.budgetUsage[0]?.usageRate?.toFixed(1) || 0}%
                              </div>
                              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                                {purchaseSummary.budgetUsage[0]?.name || "예산"}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="text-lg md:text-2xl font-bold">-</div>
                              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                                <Link href="/dashboard/budget" className="text-primary hover:underline">
                                  예산 설정하기
                                </Link>
                              </p>
                            </>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="p-3 md:p-6">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
                          <CardTitle className="text-xs md:text-sm font-medium">구매 리포트</CardTitle>
                          <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                          <Link href="/dashboard/purchases">
                            <Button variant="outline" className="w-full text-xs md:text-sm h-8 md:h-10 whitespace-nowrap">
                              구매내역 보기
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </DraggableWidget>
            ))}
        </WidgetGrid>

        {/* 재주문 추천 섹션 (상단에 표시) */}
        <WidgetGrid>
          {widgets
            .filter((w) => w.id === "reorder-recommendations" && w.visible)
            .map((widget) => (
              <DraggableWidget
                key={widget.id}
                id={widget.id}
                title="재주문 추천"
                defaultSize={widget.size}
              >
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
              </DraggableWidget>
            ))}
        </WidgetGrid>

        {/* 탭 바 - 칩 스타일 (모바일) */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
                activeTab === tab.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 md:space-y-4">
          <TabsList className="hidden md:inline-flex">
            <TabsTrigger value="quotes" className="text-xs md:text-sm whitespace-nowrap">
              <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span>견적 요청</span>
              <span className="ml-1">({quotes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs md:text-sm whitespace-nowrap">
              <Heart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span>즐겨찾기</span>
              <span className="ml-1">({favorites.length})</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="text-xs md:text-sm whitespace-nowrap">
              <History className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span>최근 본 제품</span>
              <span className="ml-1">({recentProducts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs md:text-sm whitespace-nowrap">
              <Activity className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span>최근 활동</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs md:text-sm whitespace-nowrap">
              <Package className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span>재고 관리</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <WidgetGrid>
              {widgets
                .filter((w) => w.id === "quote-status" && w.visible)
                .map((widget) => (
                  <DraggableWidget
                    key={widget.id}
                    id={widget.id}
                    title="견적 요청 현황"
                    description="내가 보낸 견적 요청과 응답 상태를 한눈에 확인할 수 있습니다."
                    defaultSize={widget.size}
                  >
                    <section className="mt-6">
                  {quotesLoading ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">로딩 중...</p>
                  ) : quotes.length === 0 ? (
                    <>
                      <div className="text-center text-sm text-slate-500">
                        아직 보낸 견적 요청이 없습니다.
                      </div>
                      <div className="mt-4 flex justify-center">
                        <Button size="sm" asChild>
                          <Link href="/test/search">제품 검색하고 견적 받기</Link>
                        </Button>
                      </div>
                    </>
                  ) : (
                  <div className="space-y-3 md:space-y-4">
                    {quotes.map((quote: any) => (
                      <Card key={quote.id} className="hover:shadow-md transition-shadow p-3 md:p-6">
                        <CardHeader className="px-0 pt-0 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm md:text-lg truncate">{quote.title}</CardTitle>
                              <CardDescription className="mt-1 text-xs md:text-sm">
                                {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
                              </CardDescription>
                            </div>
                            <span
                              className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-medium flex-shrink-0 ${
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
                        <CardContent className="px-0 pb-0 space-y-3">
                          {quote.message && (
                            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{quote.message}</p>
                          )}
                          <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                            {quote.deliveryDate && (
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">납기: {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}</span>
                              </div>
                            )}
                            {quote.deliveryLocation && (
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <MapPin className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{quote.deliveryLocation}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 md:mt-4">
                            <p className="text-xs md:text-sm font-medium mb-1.5 md:mb-2">
                              요청 제품 ({quote.items?.length || 0}개)
                            </p>
                            <div className="space-y-1">
                              {quote.items?.slice(0, 3).map((item: any) => (
                                <div key={item.id} className="text-xs md:text-sm text-muted-foreground truncate">
                                  • {item.product?.name} (×{item.quantity})
                                </div>
                              ))}
                              {quote.items?.length > 3 && (
                                <div className="text-xs md:text-sm text-muted-foreground">
                                  + {quote.items.length - 3}개 더
                                </div>
                              )}
                            </div>
                          </div>
                          {quote.responses && quote.responses.length > 0 && (
                            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t">
                              <p className="text-xs md:text-sm font-medium mb-1.5 md:mb-2">
                                견적 응답 ({quote.responses.length}개)
                              </p>
                              {quote.responses.map((response: any) => (
                                <div key={response.id} className="text-xs md:text-sm">
                                  <span className="font-medium">{response.vendor?.name}:</span>{" "}
                                  {response.totalPrice
                                    ? `₩${response.totalPrice.toLocaleString()}`
                                    : "가격 문의"}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 md:mt-4">
                            <Link href={`/quotes/${quote.id}`}>
                              <Button variant="outline" size="sm" className="text-xs md:text-sm h-7 md:h-9 w-full md:w-auto">
                                상세 보기
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  )}
                    </section>
                  </DraggableWidget>
                ))}
            </WidgetGrid>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-3 md:space-y-4">
            <Card className="p-3 md:p-6">
              <CardHeader className="px-0 pt-0 pb-3">
                <CardTitle className="text-sm md:text-lg">즐겨찾기 제품</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  저장한 제품을 빠르게 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {favoritesLoading ? (
                  <p className="text-center text-muted-foreground py-6 md:py-8 text-xs md:text-sm">로딩 중...</p>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-6 md:py-8">
                    <p className="text-muted-foreground mb-3 md:mb-4 text-xs md:text-sm">즐겨찾기한 제품이 없습니다</p>
                    <Link href="/search">
                      <Button size="sm" className="text-xs md:text-sm h-8 md:h-10">제품 검색하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {favorites.map((favorite: any) => {
                      const product = favorite.product;
                      const minPrice = product?.vendors?.reduce(
                        (min: number, v: any) =>
                          v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min,
                        null
                      );

                      return (
                        <Card key={favorite.id} className="hover:shadow-md transition-shadow p-3 md:p-6">
                          <CardHeader className="px-0 pt-0 pb-2">
                            <CardTitle className="text-sm md:text-base">
                              <Link
                                href={`/products/${product.id}`}
                                className="hover:underline line-clamp-2"
                              >
                                {product.name}
                              </Link>
                            </CardTitle>
                            {product.brand && (
                              <CardDescription className="text-xs md:text-sm truncate">{product.brand}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="px-0 pb-0 space-y-2">
                            {product.category && (
                              <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 bg-secondary rounded">
                                {PRODUCT_CATEGORIES[product.category]}
                              </span>
                            )}
                            {minPrice ? (
                              <div className="text-base md:text-lg font-semibold">
                                ₩{minPrice.toLocaleString()}
                              </div>
                            ) : (
                              <div className="text-xs md:text-sm text-muted-foreground">가격 문의</div>
                            )}
                            <Link href={`/products/${product.id}`}>
                              <Button size="sm" className="w-full mt-2 text-xs md:text-sm h-7 md:h-9">
                                상세 보기
                              </Button>
                            </Link>
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
            {/* 액티비티 통계 */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
                  <div>
                    <CardTitle>활동 통계</CardTitle>
                    <CardDescription>
                      기간별 활동 통계를 확인할 수 있습니다
                    </CardDescription>
                  </div>
                  <Select value={activityPeriod} onValueChange={setActivityPeriod}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">최근 24시간</SelectItem>
                      <SelectItem value="week">최근 7일</SelectItem>
                      <SelectItem value="month">이번 달</SelectItem>
                      <SelectItem value="year">이번 해</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {activityStatsLoading ? (
                  <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                ) : activityStats ? (
                  <div className="space-y-6">
                    {/* KPI 카드 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">총 활동 수</div>
                        <div className="text-2xl font-bold text-slate-900">{activityStats.total || 0}</div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">활동 유형</div>
                        <div className="text-2xl font-bold text-slate-900">{activityStats.activityTypeStats?.length || 0}개</div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">엔티티 유형</div>
                        <div className="text-2xl font-bold text-slate-900">{activityStats.entityTypeStats?.length || 0}개</div>
                      </div>
                    </div>

                    {/* 활동 유형별 차트 */}
                    {activityStats.activityTypeStats && activityStats.activityTypeStats.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3">활동 유형별 통계</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={activityStats.activityTypeStats}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="type" 
                              tick={{ fontSize: 12 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* 일별 활동 추이 */}
                    {activityStats.dailyStats && activityStats.dailyStats.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3">일별 활동 추이 (최근 30일)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={activityStats.dailyStats}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 12 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#10b981" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">통계 데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>

            {/* 최근 활동 로그 */}
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
                    <Button variant="outline" size="sm" className="text-xs md:text-sm h-8 md:h-10">
                      전체 보기
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {activityLogsLoading ? (
                  <p className="text-center text-muted-foreground py-8 text-xs md:text-sm">로딩 중...</p>
                ) : !activityLogsData?.logs || activityLogsData.logs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4 text-xs md:text-sm">활동 내역이 없습니다</p>
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
                          <Activity className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs md:text-sm font-medium text-slate-900">
                              {label}
                            </div>
                            {log.metadata?.title && (
                              <div className="text-[10px] md:text-xs text-slate-500 mt-1 truncate">
                                {log.metadata.title}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] md:text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
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
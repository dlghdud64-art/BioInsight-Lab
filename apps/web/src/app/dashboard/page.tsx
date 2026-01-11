"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReorderRecommendations } from "@/components/inventory/reorder-recommendations";
import { SmartPickWidget } from "@/components/dashboard/smart-pick-widget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, History, ExternalLink, Calendar, MapPin, Package, DollarSign, TrendingUp, BarChart3, Activity, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
import { QUOTE_STATUS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { LayoutDashboard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useDashboardWidgets } from "@/lib/store/dashboard-widgets-store";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { DraggableWidget } from "@/components/dashboard/draggable-widget";
import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { GrantWalletWidget } from "@/components/dashboard/grant-wallet-widget";
import { Settings, RotateCcw, Save } from "lucide-react";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DASHBOARD_TABS = [
  { id: "workspace", label: "📋 내 업무", description: "할 일과 진행 현황" },
  { id: "analytics", label: "📊 재무 현황", description: "예산과 지출 분석" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dashboard-active-tab") || "workspace";
    }
    return "workspace";
  });
  const [activityPeriod, setActivityPeriod] = useState<string>("month");
  const [purchasePeriod, setPurchasePeriod] = useState<string>("month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const { isEditMode, setEditMode, widgets, resetLayout, loadLayout, saveLayout } = useDashboardWidgets();
  const { toast } = useToast();

  // 레이아웃 로드 (페이지 마운트 시)
  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // 탭 상태 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard-active-tab", activeTab);
    }
  }, [activeTab]);

  // [저장] 버튼 클릭 핸들러
  const handleSaveLayout = () => {
    const success = saveLayout();
    if (success) {
      toast({
        title: "저장 완료",
        description: "대시보드 설정이 저장되었습니다.",
      });
    } else {
      toast({
        title: "저장 실패",
        description: "설정 저장에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  // [초기화] 버튼 클릭 핸들러
  const handleResetLayout = () => {
    resetLayout();
    toast({
      title: "초기화 완료",
      description: "대시보드 설정이 기본값으로 초기화되었습니다.",
    });
  };

  // 견적 목록 조회 (Workspace 탭에서만)
  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const response = await fetch("/api/quotes");
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated" && activeTab === "workspace",
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

  // 구매 내역/예산 요약 조회 (Analytics 탭에서만)
  const { data: purchaseSummary, isLoading: purchaseSummaryLoading, error: purchaseSummaryError } = useQuery({
    queryKey: ["purchase-summary", purchasePeriod, customStartDate, customEndDate],
    queryFn: async () => {
      let url = `/api/reports/purchase?period=${purchasePeriod}`;
      if (purchasePeriod === "custom" && customStartDate && customEndDate) {
        url = `/api/reports/purchase?startDate=${customStartDate}&endDate=${customEndDate}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch purchase summary");
      return response.json();
    },
    enabled: status === "authenticated" && activeTab === "analytics" && (purchasePeriod !== "custom" || (customStartDate !== "" && customEndDate !== "")),
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

  // 대시보드 통계 조회 (재고 부족, 진행 중인 견적, 지출 등)
  const { data: dashboardStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 배송 중인 주문 조회
  const { data: shippingOrders } = useQuery({
    queryKey: ["shipping-orders"],
    queryFn: async () => {
      const response = await fetch("/api/orders?status=SHIPPING");
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 모든 주문 조회 (타임라인용)
  const { data: allOrdersData } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const response = await fetch("/api/orders?limit=10");
      if (!response.ok) throw new Error("Failed to fetch orders");
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
  const allOrders = allOrdersData?.orders || [];

  const userName = session?.user?.name || "연구자";
  const userDisplayName = userName.split(" ")[0] || userName;

  return (
    <div className="w-full max-w-full px-3 md:px-4 py-4 md:py-8">
      <div className="max-w-6xl mx-auto w-full">
            {/* 웰컴 섹션 */}
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                반가워요, <span className="text-blue-600">{userDisplayName}</span> 님! 👋
              </h1>
              <p className="text-sm md:text-base text-gray-500">
                오늘도 성공적인 실험 되세요.
              </p>
            </div>

            <div className="flex items-center justify-between mb-4 gap-2 md:hidden">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">대시보드</h2>
              </div>
              <div className="flex gap-1 md:gap-2 flex-shrink-0">
                {isEditMode && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetLayout}
                      className="text-xs md:inline-flex hidden"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      초기화
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetLayout}
                      className="md:hidden p-2"
                      title="초기화"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveLayout}
                      className="text-xs bg-green-600 hover:bg-green-700 md:inline-flex hidden"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      저장
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveLayout}
                      className="md:hidden p-2 bg-green-50 hover:bg-green-100 text-green-700"
                      title="저장"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant={isEditMode ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(!isEditMode)}
                  className="text-xs md:inline-flex hidden"
                >
                  <Settings className="h-3 w-3 mr-1 md:mr-1" />
                  {isEditMode ? "완료" : "편집"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(!isEditMode)}
                  className="md:hidden p-2"
                  title={isEditMode ? "완료" : "편집"}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

        {/* 새로운 Tab 구조: 내 업무 / 재무 현황 */}
        <Tabs defaultValue="workspace" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="workspace" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>내 업무</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>재무 현황</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: 내 업무 */}
          <TabsContent value="workspace" className="space-y-6">
            {/* KPI Cards: 재고 부족 알림, 진행 중인 견적, 배송 중인 물품 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 재고 부족 알림 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">재고 부족 알림</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardStats?.reorderNeededCount || 0}개 품목
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">곧 동납니다</p>
                  <Link href="/dashboard/inventory" className="mt-2 inline-block">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      주문하기
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* 진행 중인 견적 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">진행 중인 견적</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₩{(dashboardStats?.quoteStats?.pendingAmount || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">승인 대기 중인 예상 지출</p>
                </CardContent>
              </Card>

              {/* 배송 중인 물품 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">배송 중인 물품</CardTitle>
                  <Package className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {shippingOrders?.total || 0}건
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">배송 진행 중</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content: Left (재구매 추천) / Right (견적/주문 현황) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: 재구매 추천 리스트 */}
              <Card>
                <CardHeader>
                  <CardTitle>재구매 추천</CardTitle>
                  <CardDescription>재고가 부족한 품목을 확인하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReorderRecommendations
                    onAddToQuoteList={(recommendations) => {
                      router.push(`/search?bom=${encodeURIComponent(JSON.stringify(recommendations.map(r => ({
                        name: r.product.name,
                        quantity: r.recommendedQuantity,
                        category: r.product.category,
                      }))))}`);
                    }}
                  />
                </CardContent>
              </Card>

              {/* Right: 내 견적/주문 현황 (타임라인) */}
              <Card>
                <CardHeader>
                  <CardTitle>내 견적/주문 현황</CardTitle>
                  <CardDescription>견적 요청 → 승인 대기 → 발주 완료 흐름</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* 타임라인 형태로 표시 - 견적과 주문을 함께 */}
                  <div className="space-y-4">
                    {(() => {
                      // 견적과 주문을 합쳐서 날짜순으로 정렬
                      const timelineItems = [
                        ...quotes.slice(0, 10).map((q: any) => ({
                          id: `quote-${q.id}`,
                          type: "quote" as const,
                          title: q.title,
                          status: q.status,
                          date: q.createdAt,
                          amount: q.items?.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0) || 0,
                        })),
                        ...allOrders.slice(0, 10).map((o: any) => ({
                          id: `order-${o.id}`,
                          type: "order" as const,
                          title: o.quote?.title || `주문 ${o.orderNumber}`,
                          status: o.status,
                          date: o.createdAt,
                          amount: o.totalAmount,
                        })),
                      ]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 8);

                      return timelineItems.length > 0 ? (
                        timelineItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full ${
                                item.type === "order" 
                                  ? item.status === "DELIVERED" ? "bg-green-500" :
                                    item.status === "SHIPPING" ? "bg-blue-500" :
                                    item.status === "CONFIRMED" ? "bg-purple-500" :
                                    "bg-yellow-500"
                                  : item.status === "COMPLETED" ? "bg-green-500" :
                                    item.status === "RESPONDED" ? "bg-blue-500" :
                                    "bg-yellow-500"
                              }`} />
                              {item !== timelineItems[timelineItems.length - 1] && (
                                <div className="w-px h-full bg-gray-200 mt-1 min-h-[40px]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                      {item.type === "order" ? "주문" : "견적"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {item.type === "order" 
                                        ? item.status === "DELIVERED" ? "배송완료" :
                                          item.status === "SHIPPING" ? "배송중" :
                                          item.status === "CONFIRMED" ? "확인됨" :
                                          "접수대기"
                                        : QUOTE_STATUS[item.status as keyof typeof QUOTE_STATUS]}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(item.date).toLocaleDateString("ko-KR")}
                                  </p>
                                </div>
                                {item.amount > 0 && (
                                  <p className="text-xs font-medium text-slate-700 whitespace-nowrap">
                                    ₩{item.amount.toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          견적 요청이나 주문이 없습니다
                        </p>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: 재무 현황 */}
          <TabsContent value="financials" className="space-y-6">
            {/* KPI Cards: 이번 달 지출, 잔여 예산, 총 보유 자산 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 이번 달 지출 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">이번 달 지출</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₩{(dashboardStats?.thisMonthPurchaseAmount || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">이번 달 구매 금액</p>
                </CardContent>
              </Card>

              {/* 잔여 예산 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">잔여 예산</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₩{(dashboardStats?.budget?.remainingAmount || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">사용 가능한 예산</p>
                </CardContent>
              </Card>

              {/* 총 보유 자산 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 보유 자산</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₩{(dashboardStats?.totalAssetValue || 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">랩 냉장고 시약 총액</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts: 지출 추이, 예산 비중 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 지출 추이 (Line Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>지출 추이</CardTitle>
                  <CardDescription>지난달보다 돈을 아꼈나요?</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const monthlySpending = dashboardStats?.monthlySpending?.map((item: any) => ({
                      month: item.month.slice(5), // "MM" 형식으로 변환
                      amount: item.amount || 0,
                    })) || [];
                    return monthlySpending.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlySpending}>
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `${value}월`}
                          />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => `₩${(value / 1000000).toFixed(0)}M`}
                          />
                          <Tooltip
                            formatter={(value: number) => [`₩${value.toLocaleString()}`, "지출"]}
                            labelFormatter={(label) => `${label}월`}
                          />
                          <Legend />
                          <Bar dataKey="amount" fill="#3b82f6" name="지출" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        데이터가 없습니다
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* 예산 비중 (Donut Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>예산 비중</CardTitle>
                  <CardDescription>우리가 시약(Reagent)에 돈을 제일 많이 쓰는구나</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const categorySpending = dashboardStats?.categorySpending || [];
                    const totalCategoryAmount = categorySpending.reduce(
                      (sum: number, item: any) => sum + (item.amount || 0),
                      0
                    );
                    const categoryData = categorySpending.map((item: any) => ({
                      name: item.category || "기타",
                      value: item.amount || 0,
                      percentage: totalCategoryAmount > 0
                        ? ((item.amount || 0) / totalCategoryAmount * 100).toFixed(1)
                        : "0",
                    }));
                    const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];
                    
                    return categoryData.length > 0 ? (
                      <div className="space-y-4">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {categoryData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, name: string, props: any) => [
                                `₩${value.toLocaleString()} (${props.payload.percentage}%)`,
                                name,
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                          {categoryData.map((item: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span>{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  ₩{item.value.toLocaleString()}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  ({item.percentage}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        데이터가 없습니다
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* 월별 지출 상세 테이블 */}
            <Card>
              <CardHeader>
                <CardTitle>월별 지출 상세</CardTitle>
                <CardDescription>월별 구매 내역을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    const monthlySpending = dashboardStats?.monthlySpending?.map((item: any) => ({
                      month: item.month, // "YYYY-MM" 형식
                      displayMonth: item.month.slice(5), // "MM" 형식
                      amount: item.amount || 0,
                    })) || [];
                    return monthlySpending.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">월</th>
                              <th className="text-right py-2">지출 금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlySpending.map((item: any) => (
                              <tr key={item.month} className="border-b hover:bg-slate-50">
                                <td className="py-2 font-medium">{item.displayMonth}월</td>
                                <td className="text-right py-2">₩{item.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        데이터가 없습니다
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 기존 탭 구조는 유지하되 숨김 처리 */}
        <div className="hidden">
          {/* Executive Dashboard */}
          <div className="mb-6">
            <ExecutiveDashboard />
          </div>

          {/* Analytics Dashboard */}
          <div className="mb-6">
            <AnalyticsDashboard />
          </div>

          {/* Smart Pick Widget - AI 추천 */}
          <div className="mb-6">
            <SmartPickWidget />
          </div>

          {/* 구매 내역/예산 요약 카드 및 내 지갑 - 삭제됨 */}
          <WidgetGrid>
            {/* 내 지갑 위젯 */}
            <div className="col-span-1">
              <GrantWalletWidget />
            </div>
            
            {/* 구매 내역 요약 - 삭제 */}
            {widgets
              .filter((w) => w.id === "purchase-summary" && w.visible)
              .map((widget) => (
              <DraggableWidget
                key={widget.id}
                id={widget.id}
                title="구매 내역 요약"
                defaultSize={widget.size}
              >
                <div className="space-y-4 md:space-y-6">
                  {/* 기간 선택 */}
                  <div className="flex flex-col gap-2">
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
                          <SelectItem value="custom">직접 선택</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* 직접 선택 시 날짜 입력 */}
                    {purchasePeriod === "custom" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="startDate" className="text-xs text-slate-500">시작</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-[130px] h-8 text-xs"
                          />
                        </div>
                        <span className="text-xs text-slate-400">~</span>
                        <div className="flex items-center gap-1">
                          <Label htmlFor="endDate" className="text-xs text-slate-500">종료</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-[130px] h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 로딩 상태 */}
                  {purchaseSummaryLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="p-5 rounded-2xl shadow-sm bg-white">
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
                    <Card className="p-5 rounded-2xl shadow-sm bg-white">
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
                    <Card className="p-5 rounded-2xl shadow-sm bg-white">
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      {/* 구매 금액 카드 - 파란색 그라데이션 */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 shadow-sm">
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-white/90">구매 금액</span>
                            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                            ₩{purchaseSummary.metrics?.totalAmount?.toLocaleString("ko-KR") || 0}
                          </div>
                          <p className="text-xs text-white/80">
                            {purchaseSummary.metrics?.itemCount || 0}개 품목
                          </p>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                      </div>

                      {/* 예산 사용률 카드 - 프로그레스 바 */}
                      <div className="bg-white rounded-2xl shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">예산 사용률</span>
                          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-orange-600" />
                          </div>
                        </div>
                        {purchaseSummary.budgetUsage && purchaseSummary.budgetUsage.length > 0 ? (
                          <>
                            <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                              {purchaseSummary.budgetUsage[0]?.usageRate?.toFixed(1) || 0}%
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(purchaseSummary.budgetUsage[0]?.usageRate || 0, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">
                              {purchaseSummary.budgetUsage[0]?.name || "예산"}
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl md:text-3xl font-bold text-gray-400 mb-3">-</div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                              <div className="bg-gray-200 h-2.5 rounded-full w-0" />
                            </div>
                            <p className="text-xs text-gray-500">
                              <Link href="/dashboard/budget" className="text-blue-600 hover:underline">
                                예산 설정하기
                              </Link>
                            </p>
                          </>
                        )}
                      </div>

                      {/* 구매 리포트 카드 - 차트 시각화 */}
                      <div className="bg-white rounded-2xl shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">구매 리포트</span>
                          <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-purple-600" />
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="flex items-end justify-between gap-2 h-20">
                            {[65, 80, 45, 70].map((height, idx) => (
                              <div key={idx} className="flex-1 flex flex-col items-center">
                                <div 
                                  className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-lg transition-all duration-500 hover:opacity-80"
                                  style={{ height: `${height}%` }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <Link href="/dashboard/purchases">
                          <Button variant="outline" className="w-full text-xs md:text-sm h-9 md:h-10 whitespace-nowrap border-purple-200 hover:bg-purple-50 hover:border-purple-300">
                            구매내역 보기
                          </Button>
                        </Link>
                      </div>
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
        </div>

        {/* 탭 바 - 칩 스타일 (모바일) */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
          {DASHBOARD_TABS.map((tab) => {
            const getIcon = () => {
              switch (tab.id) {
                case "quotes":
                  return <ShoppingCart className="h-3 w-3 mr-1" />;
                case "favorites":
                  return <Heart className="h-3 w-3 mr-1" />;
                case "recent":
                  return <History className="h-3 w-3 mr-1" />;
                case "activity":
                  return <Activity className="h-3 w-3 mr-1" />;
                case "inventory":
                  return <Package className="h-3 w-3 mr-1" />;
                default:
                  return null;
              }
            };
            const getCount = () => {
              switch (tab.id) {
                case "quotes":
                  return quotes.length;
                case "favorites":
                  return favorites.length;
                case "recent":
                  return recentProducts.length;
                default:
                  return null;
              }
            };
            const count = getCount();
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors flex items-center",
                  activeTab === tab.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {getIcon()}
                <span>{tab.label}</span>
                {count !== null && <span className="ml-1">({count})</span>}
              </button>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 md:space-y-4 w-full">
          <div className="hidden md:block overflow-x-auto pb-1 -mx-1 px-1 w-full">
            <TabsList className="inline-flex w-full">
              <TabsTrigger value="quotes" className="text-xs md:text-sm whitespace-nowrap flex-shrink-0">
                <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span>견적 요청</span>
                <span className="ml-1">({quotes.length})</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="text-xs md:text-sm whitespace-nowrap flex-shrink-0">
                <Heart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span>즐겨찾기</span>
                <span className="ml-1">({favorites.length})</span>
              </TabsTrigger>
              <TabsTrigger value="recent" className="text-xs md:text-sm whitespace-nowrap flex-shrink-0">
                <History className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span>최근 본 제품</span>
                <span className="ml-1">({recentProducts.length})</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs md:text-sm whitespace-nowrap flex-shrink-0">
                <Activity className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span>최근 활동</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs md:text-sm whitespace-nowrap flex-shrink-0">
                <Package className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span>재고 관리</span>
              </TabsTrigger>
            </TabsList>
          </div>

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
  );
}
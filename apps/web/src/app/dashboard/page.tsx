"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, DollarSign, FileText, Search, Plus, TrendingUp, Truck, ChevronRight, Beaker, LayoutDashboard, Calendar } from "lucide-react";
import { BudgetPredictionWidget } from "@/components/dashboard/BudgetPredictionWidget";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  // 대시보드 통계 조회
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // localStorage의 guestKey를 헤더에 포함 (guestKey scopeKey로 저장된 구매 내역 포함)
      const guestKey =
        typeof window !== "undefined"
          ? localStorage.getItem("biocompare_guest_key") || ""
          : "";
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;

      const response = await fetch("/api/dashboard/stats", { headers });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 0,
    refetchOnMount: "always",
  });

  // 최근 구매 내역은 dashboardStats.recentPurchases 에서 가져옴 (별도 쿼리 불필요)

  if (status === "loading" || statsLoading) {
    return (
      <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-[160px] animate-pulse border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f]">
              <CardContent className="p-6">
                <div className="h-20 rounded bg-slate-100 dark:bg-slate-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const rawStats = dashboardStats || {};

  // API 필드를 UI 변수에 정확히 매핑 (mock 폴백 제거)
  const stats = {
    totalInventory: rawStats.totalInventory ?? 0,
    lowStockAlerts: rawStats.lowStockAlerts ?? 0,
    monthlySpending: rawStats.thisMonthPurchaseAmount ?? 0,   // PurchaseRecord 기반
    activeQuotes: rawStats.quoteStats?.pending ?? 0,           // PENDING 견적 수
    monthOverMonthChange: parseFloat(rawStats.monthOverMonthChange ?? "0"),
    budgetUsageRate: parseFloat(rawStats.budgetUsageRate ?? "0"),
    monthlySpendingChart: (rawStats.monthlySpending ?? []) as Array<{ month: string; amount: number }>,
    expiringItems: (rawStats.expiringItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      expiryDate: string; currentQuantity: number; unit: string; daysLeft: number;
    }>,
    lowStockItems: (rawStats.lowStockItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      currentQuantity: number; safetyStock: number; unit: string;
    }>,
    expiringCount: rawStats.expiringCount ?? 0,
    // 최근 구매 기록 (PurchaseRecord, stats API에서 가져옴)
    recentPurchases: (rawStats.recentPurchases ?? []) as Array<{
      id: string; itemName: string | null; vendorName: string | null;
      amount: number | null; purchasedAt: string; category: string | null;
      qty: number | null; unit: string | null;
    }>,
  };

  // 최근 구매 내역 표시용 가공 함수
  const processPurchaseData = (p: typeof stats.recentPurchases[0], index: number) => {
    const productName = p.itemName || "품목명 없음";
    const vendor = p.vendorName || "공급사 정보 없음";
    const amount = p.amount ?? 0;
    const dateObj = new Date(p.purchasedAt);
    const date = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(dateObj.getDate()).padStart(2, "0")}`;
    return { id: p.id || `p-${index}`, productName, vendor, amount, date };
  };


  // 구매 완료 배지 공통 스타일
  const purchaseBadgeClass = "h-6 px-2.5 py-0.5 rounded-full font-semibold text-[11px] tracking-wide flex items-center gap-1.5 w-fit border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";

  // 구매 내역 행 렌더링 (데스크탑 테이블용)
  const renderPurchaseRow = (p: { id: string; productName: string; vendor: string; amount: number; date: string }) => (
    <TableRow key={p.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <TableCell className="py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
            <Beaker className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{p.productName}</span>
            <span className="text-xs text-muted-foreground mt-0.5 truncate">{p.vendor}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4">
        <Badge variant="outline" className={purchaseBadgeClass}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          구매 완료
        </Badge>
      </TableCell>
      <TableCell className="py-4 text-sm text-slate-500">{p.date}</TableCell>
      <TableCell className="py-4 text-right font-bold text-slate-900 dark:text-slate-100">
        ₩{p.amount.toLocaleString("ko-KR")}
      </TableCell>
    </TableRow>
  );

  // 구매 내역 카드 렌더링 (모바일용)
  const renderPurchaseCard = (p: { id: string; productName: string; vendor: string; amount: number; date: string }) => (
    <div key={p.id} className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] shadow-sm w-full min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
          <Beaker className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden space-y-1">
          <p className="text-sm font-medium leading-tight text-slate-900 dark:text-slate-100 truncate">{p.productName}</p>
          <p className="text-xs text-muted-foreground truncate">{p.vendor}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={purchaseBadgeClass}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            구매 완료
          </Badge>
          <span className="text-xs text-slate-500 dark:text-slate-400">{p.date}</span>
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">₩{p.amount.toLocaleString("ko-KR")}</p>
      </div>
    </div>
  );

  // 알림 데이터 (Mock Data)
  const notifications = [
    {
      id: 1,
      type: "alert",
      title: "재고 부족: FBS (남은 수량 1개)",
      content: "FBS (Fetal Bovine Serum) 수량이 1개 남았습니다.",
      time: "10분 전",
      unread: true,
    },
    {
      id: 2,
      type: "quote",
      title: "견적 도착: Thermo Fisher 외 2건",
      content: "요청하신 견적서가 도착했습니다.",
      time: "1시간 전",
      unread: true,
    },
    {
      id: 3,
      type: "delivery",
      title: "입고 완료: 50ml Conical Tube",
      content: "50ml Conical Tube (500/case) 입고 처리가 완료되었습니다.",
      time: "어제",
      unread: false,
    },
    {
      id: 4,
      type: "alert",
      title: "재고 부족: Trypsin-EDTA",
      content: "Trypsin-EDTA Solution 수량이 부족합니다.",
      time: "2일 전",
      unread: false,
    },
  ];

  // 알림 아이콘 렌더링 함수 (재고 부족 시 pulse로 긴급감 연출)
  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return (
          <div className="flex-shrink-0 rounded-md bg-red-100 p-2">
            <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
          </div>
        );
      case "quote":
        return (
          <div className="flex-shrink-0 rounded-md bg-blue-100 p-2">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
        );
      case "delivery":
        return (
          <div className="flex-shrink-0 rounded-md bg-green-100 p-2">
            <Truck className="h-4 w-4 text-green-600" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4 overflow-x-hidden">
      {/* 페이지 헤더 영역 */}
      <div className="flex flex-col space-y-2 min-w-0">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 truncate min-w-0">
          <LayoutDashboard className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <span className="truncate">대시보드</span>
        </h2>
        <p className="text-muted-foreground">
          안녕하세요! 오늘도 효율적인 연구와 업무를 지원합니다. 🚀
        </p>
      </div>

      {/* 예산 소진 예측 위젯 */}
      <BudgetPredictionWidget />

      {/* 모바일 전용 레이아웃 */}
      <div className="md:hidden space-y-4">
        {/* 1. 빠른 실행 (최상단, 컴팩트) - 계층별 스타일 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          <Link href="/test/search" className="flex-shrink-0">
            <Button variant="outline" size="sm" className="h-10 px-3 text-xs bg-slate-50 text-slate-500 hover:bg-slate-100 border-dashed">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              통합 검색
            </Button>
          </Link>
          <Link href="/dashboard/inventory" className="flex-shrink-0">
            <Button variant="outline" size="sm" className="h-10 px-3 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              재고 등록
            </Button>
          </Link>
          <Link href="/test/quote" className="flex-shrink-0">
            <Button size="sm" className="h-10 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              견적 요청
            </Button>
          </Link>
        </div>

        {/* 2. KPI Cards - grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-0">
            <Link href="/dashboard/inventory">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-400 border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 truncate min-w-0">총 재고 수</CardTitle>
                  <div className="rounded-full p-2 bg-blue-50 dark:bg-blue-950/50 flex-shrink-0">
                    <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="text-auto-scale text-slate-900 dark:text-slate-200">{stats.totalInventory.toLocaleString("ko-KR")}</div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">↑ 12% (전월 대비)</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/inventory?filter=low">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all border-red-100 dark:border-slate-800/50 bg-red-50/10 dark:bg-[#161d2f] shadow-sm hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-400 truncate min-w-0 antialiased">부족 알림</CardTitle>
                  <div className="rounded-full p-2 bg-red-100 dark:bg-red-950/50 flex-shrink-0 antialiased">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="text-auto-scale text-red-600 dark:text-red-400 antialiased">{stats.lowStockAlerts}</div>
                  <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1 antialiased">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                    </span>
                    즉시 발주 필요 {stats.lowStockAlerts}건
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/purchases">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-400 border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-medium text-muted-foreground truncate min-w-0">이번 달 지출</CardTitle>
                  <div className="rounded-full p-2 bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="flex flex-col gap-2">
                    <div className="text-auto-scale leading-none text-slate-900 dark:text-slate-200">
                      ₩{stats.monthlySpending.toLocaleString("ko-KR")}
                    </div>
                    <div className={`flex items-center text-xs font-medium w-fit px-2 py-0.5 rounded ${
                      stats.monthOverMonthChange >= 0
                        ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
                        : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20"
                    }`}>
                      {stats.monthOverMonthChange >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(stats.monthOverMonthChange).toFixed(1)}% 전월 대비
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/quotes">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-400 border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 truncate min-w-0">진행 중인 견적</CardTitle>
                  <div className="rounded-full p-2 bg-violet-50 dark:bg-violet-950/50 flex-shrink-0">
                    <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="text-auto-scale text-slate-900 dark:text-slate-200">{stats.activeQuotes}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                    {rawStats?.quoteStats?.responded > 0
                      ? `응답 수신 ${rawStats.quoteStats.responded}건`
                      : "새 견적 요청하기"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

        {/* 3. 최근 구매 내역 & 알림 센터 탭 통합 */}
        <Card className="bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50">
          <CardContent className="p-0">
            <Tabs defaultValue="purchases" className="w-full">
              <div className="border-b border-slate-200 dark:border-slate-800/50 px-4 pt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="purchases" className="text-xs">
                    최근 구매
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="text-xs">
                    알림 센터
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* 최근 구매 내역 탭 */}
              <TabsContent value="purchases" className="m-0">
                <div className="grid gap-4 p-4 w-full min-w-0">
                  {stats.recentPurchases.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                      구매 내역이 없습니다.
                    </div>
                  ) : (
                    stats.recentPurchases.map((p, index) => {
                      const pData = processPurchaseData(p, index);
                      return renderPurchaseCard(pData);
                    })
                  )}
                  <Link href="/dashboard/purchases" className="block mt-1">
                    <Button variant="outline" className="w-full text-xs h-9">모두 보기</Button>
                  </Link>
                </div>
              </TabsContent>

                {/* 알림 센터 탭 */}
                <TabsContent value="notifications" className="m-0">
                  <div className="p-4 space-y-3">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">
                        알림이 없습니다.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">최근 알림</h3>
                          <Link href="/dashboard/notifications">
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              모두 보기
                            </Button>
                          </Link>
                        </div>
                        {notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href="/dashboard/notifications"
                            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                              notification.unread ? "bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                          >
                            {renderNotificationIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{notification.title}</p>
                                {notification.unread && (
                                  <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-blue-600 flex-shrink-0">
                                    새
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 line-clamp-2">{notification.content}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">{notification.time}</p>
                            </div>
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* 데스크탑 레이아웃 */}
      <div className="hidden md:grid md:grid-cols-7 md:gap-6">
        {/* --- Left Main Content (Span 5) --- */}
        <div className="md:col-span-5 space-y-6">
          {/* 1. KPI Cards - grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Link href="/dashboard/inventory">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 truncate min-w-0">총 재고 수</CardTitle>
                  <div className="rounded-full p-2 bg-blue-50 flex-shrink-0">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="text-auto-scale text-slate-900 dark:text-slate-200">{stats.totalInventory.toLocaleString("ko-KR")}</div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">↑ 12% (전월 대비)</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/inventory?filter=low">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all border-red-100 dark:border-slate-800/50 bg-red-50/10 dark:bg-[#161d2f] shadow-sm hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-400 truncate min-w-0 antialiased">부족 알림</CardTitle>
                  <div className="rounded-full p-2 bg-red-100 dark:bg-red-950/50 flex-shrink-0 antialiased">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="text-auto-scale text-red-600 dark:text-red-400">{stats.lowStockAlerts}</div>
                  <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-1 flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                    </span>
                    즉시 발주 필요 {stats.lowStockAlerts}건
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/purchases">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-400 border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-medium text-muted-foreground truncate min-w-0">이번 달 지출</CardTitle>
                  <div className="rounded-full p-2 bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="flex flex-col gap-2">
                    <div className="text-auto-scale leading-none text-slate-900 dark:text-slate-200">
                      ₩{stats.monthlySpending.toLocaleString("ko-KR")}
                    </div>
                    <div className={`flex items-center text-xs font-medium w-fit px-2 py-0.5 rounded ${
                      stats.monthOverMonthChange >= 0
                        ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
                        : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20"
                    }`}>
                      {stats.monthOverMonthChange >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(stats.monthOverMonthChange).toFixed(1)}% 전월 대비
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/quotes">
              <Card className="h-[160px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all border-slate-200 dark:border-slate-800/50 shadow-sm hover:shadow-md bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                  <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 truncate min-w-0">진행 중인 견적</CardTitle>
                  <div className="rounded-full p-2 bg-violet-50 flex-shrink-0">
                    <FileText className="h-4 w-4 text-violet-600" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="text-auto-scale text-slate-900 dark:text-slate-200">{stats.activeQuotes}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
                    {rawStats?.quoteStats?.responded > 0
                      ? `응답 수신 ${rawStats.quoteStats.responded}건`
                      : "새 견적 요청하기"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* 2. 최근 구매 내역 */}
          <Card className="min-h-[400px] overflow-hidden bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50">
            <CardHeader className="p-4">
              <div className="flex justify-between items-center">
                <CardTitle className="truncate text-slate-900 dark:text-slate-100">최근 구매 내역</CardTitle>
                <Link
                  href="/dashboard/purchases"
                  className="flex items-center text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors"
                >
                  모두 보기
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {stats.recentPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <Package className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">최근 구매 내역이 없습니다.</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">구매 내역을 등록하면 여기에 표시됩니다.</p>
                  <Link href="/dashboard/purchases" className="mt-4">
                    <Button variant="outline" size="sm">구매 내역 등록하기</Button>
                  </Link>
                </div>
              ) : (
                <>
                  {/* md 해상도: 카드 리스트 */}
                  <div className="lg:hidden grid gap-4 p-4 w-full min-w-0">
                    {stats.recentPurchases.map((p, index) => {
                      const pData = processPurchaseData(p, index);
                      return renderPurchaseCard(pData);
                    })}
                  </div>
                  {/* lg 이상: 테이블 */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>품목 정보</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>날짜</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.recentPurchases.map((p, index) => {
                          const pData = processPurchaseData(p, index);
                          return renderPurchaseRow(pData);
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Right Side Panel (Span 2) --- */}
        <div className="md:col-span-2 space-y-6">

          {/* 지출 추이 차트 (최근 6개월) */}
          <Card className="bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold truncate">지출 추이 (최근 6개월)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {stats.monthlySpendingChart.every((d) => d.amount === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3 mb-3">
                    <TrendingUp className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">데이터를 쌓는 중입니다</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">구매 내역이 생기면 차트가 표시됩니다</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.monthlySpendingChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v: string) => v.slice(5)}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                      labelFormatter={(label: string) => `${label}`}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 유통기한 임박 위젯 */}
          {stats.expiringCount > 0 && (
            <Card className="bg-amber-50/30 dark:bg-[#161d2f] border-amber-100 dark:border-slate-800/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    유통기한 임박 ({stats.expiringCount}건)
                  </CardTitle>
                  <Link href="/dashboard/inventory">
                    <Button variant="ghost" size="sm" className="text-xs h-6 text-amber-600">확인</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {stats.expiringItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-amber-100 dark:border-slate-800/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.productName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.currentQuantity} {item.unit}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`ml-2 text-xs flex-shrink-0 ${
                        item.daysLeft <= 7
                          ? "border-red-200 bg-red-50 text-red-700 dark:text-red-400"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {item.daysLeft}일 남음
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 부족 재고 위젯 */}
          {stats.lowStockItems.length > 0 && (
            <Card className="bg-red-50/20 dark:bg-[#161d2f] border-red-100 dark:border-slate-800/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    부족 재고 알림
                  </CardTitle>
                  <Link href="/dashboard/inventory">
                    <Button variant="ghost" size="sm" className="text-xs h-6 text-red-600">발주</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {stats.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-red-100 dark:border-slate-800/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.productName}</p>
                      <p className="text-xs text-red-500">{item.currentQuantity}/{item.safetyStock} {item.unit}</p>
                    </div>
                    <span className="relative flex h-2 w-2 ml-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 3. Quick Actions - 답답함 해소, Affordance 강화 */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f]">
            <CardHeader className="pb-4 min-w-0">
              <CardTitle className="text-lg font-bold truncate min-w-0">빠른 실행</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link href="/test/search" className="block">
                <Button variant="outline" className="w-full h-12 justify-between rounded-lg bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center">
                    <Search className="mr-3 h-4 w-4 text-slate-500" />
                    통합 검색
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Button>
              </Link>
              <Link href="/dashboard/inventory" className="block">
                <Button variant="outline" className="w-full h-12 justify-between rounded-lg border-blue-200 text-blue-700 bg-blue-50/30 hover:bg-blue-50 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center">
                    <Plus className="mr-3 h-4 w-4" />
                    새 재고 등록
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-300" />
                </Button>
              </Link>
              <Link href="/test/quote" className="block">
                <Button className="w-full h-12 justify-between rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center">
                    <FileText className="mr-3 h-4 w-4" />
                    견적 요청하기
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-300" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 4. Recent Notifications (Fixed) */}
          <Card className="bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50">
            <CardHeader className="min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <CardTitle className="text-lg truncate min-w-0">최근 알림</CardTitle>
                <Link href="/dashboard/notifications">
                  <Button variant="ghost" size="sm" className="text-xs">
                    모두 보기
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href="/dashboard/notifications"
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    notification.unread ? "bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {renderNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{notification.title}</p>
                      {notification.unread && (
                        <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-blue-600">
                          새
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{notification.content}</p>
                    <p className="text-xs text-slate-400">{notification.time}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

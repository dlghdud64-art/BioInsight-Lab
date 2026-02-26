"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, DollarSign, FileText, Search, Plus, ShoppingCart, TrendingUp, TrendingDown, Truck, ChevronRight, Beaker, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  // 대시보드 통계 조회
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 최근 주문 내역 조회
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const response = await fetch("/api/orders?limit=10");
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: status === "authenticated",
  });

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

  const rawStats = dashboardStats || {
    totalInventory: 0,
    lowStockAlerts: 0,
    monthlySpending: 0,
    activeQuotes: 0,
  };

  // 데모 생동감: API 값이 0이면 Mock 값 사용
  const stats = {
    totalInventory: rawStats.totalInventory || 1245,
    lowStockAlerts: rawStats.lowStockAlerts || 12,
    monthlySpending: rawStats.monthlySpending || 12500000,
    activeQuotes: rawStats.activeQuotes || 3,
  };

  const orders = ordersData?.orders || [];

  // 더미 주문 데이터 (Mock Data)
  const mockOrders = [
    {
      id: "ORD-2024-001",
      product: "Gibco FBS (500ml)",
      vendor: "Thermo Fisher",
      amount: 150000,
      status: "배송 중",
      date: "2026.01.15",
    },
    {
      id: "ORD-2024-002",
      product: "Falcon 50ml Conical Tube",
      vendor: "Corning",
      amount: 85000,
      status: "승인 대기",
      date: "2026.01.14",
    },
    {
      id: "ORD-2024-003",
      product: "DMEM Medium (500ml)",
      vendor: "Sigma-Aldrich",
      amount: 120000,
      status: "배송 완료",
      date: "2026.01.13",
    },
    {
      id: "ORD-2024-004",
      product: "Trypsin-EDTA Solution",
      vendor: "Gibco",
      amount: 95000,
      status: "배송 중",
      date: "2026.01.12",
    },
    {
      id: "ORD-2024-005",
      product: "Pipette Tips (1000μL)",
      vendor: "Eppendorf",
      amount: 65000,
      status: "승인 대기",
      date: "2026.01.11",
    },
  ];

  // 주문 데이터가 없으면 더미 데이터 사용
  const displayOrders = orders.length > 0 ? orders : mockOrders;


  // 주문 데이터 처리 함수
  const processOrderData = (order: any, index: number) => {
    const productName = order.product || order.items?.[0]?.productName || "제품명 없음";
    const vendor = order.vendor || "공급사 정보 없음";
    const amount = order.amount || order.totalAmount || 0;
    let status = order.status;
    if (!status) {
      if (order.status === "SHIPPING") status = "배송 중";
      else if (order.status === "DELIVERED") status = "배송 완료";
      else status = "승인 대기";
    }
    let date = order.date;
    if (!date && order.createdAt) {
      const dateObj = new Date(order.createdAt);
      date = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, "0")}.${String(dateObj.getDate()).padStart(2, "0")}`;
    }
    const orderId = order.id || `order-${index}`;

    return {
      orderId,
      productName,
      vendor,
      amount,
      status,
      date,
    };
  };

  // 프리미엄 Pill 뱃지 (Status Dot + 공통 클래스)
  const renderStatusPill = (status: string) => {
    const base = "h-6 px-2.5 py-0.5 rounded-full font-semibold text-[11px] tracking-wide flex items-center gap-1.5 w-fit border";
    switch (status) {
      case "배송 중":
        return (
          <Badge variant="outline" className={`${base} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
            {status}
          </Badge>
        );
      case "승인 대기":
        return (
          <Badge variant="outline" className={`${base} border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
            {status}
          </Badge>
        );
      case "배송 완료":
        return (
          <Badge variant="outline" className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={`${base} border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
            {status}
          </Badge>
        );
    }
  };

  // 주문 행 렌더링 함수 (데스크탑 테이블용)
  const renderOrderRow = (orderData: {
    orderId: string;
    productName: string;
    vendor: string;
    amount: number;
    status: string;
    date: string;
  }) => {
    return (
      <TableRow 
        key={orderData.orderId} 
        className="group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <TableCell className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
              <Beaker className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="font-medium text-sm text-slate-900 truncate">{orderData.productName}</span>
              <span className="text-xs text-muted-foreground mt-0.5 truncate">{orderData.vendor}</span>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-4">
          {renderStatusPill(orderData.status)}
        </TableCell>
        <TableCell className="py-4 text-sm text-slate-500">
          {orderData.date}
        </TableCell>
        <TableCell className="py-4 text-right font-bold text-slate-900">
          ₩{orderData.amount.toLocaleString("ko-KR")}
        </TableCell>
        <TableCell className="py-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 group-hover:text-blue-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // 상세보기 로직 추가 가능
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  // 주문 카드 렌더링 함수 (모바일용)
  const renderOrderCard = (orderData: {
    orderId: string;
    productName: string;
    vendor: string;
    amount: number;
    status: string;
    date: string;
  }) => {
    return (
      <div
        key={orderData.orderId}
        className="flex flex-col gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] shadow-sm w-full min-w-0"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <Beaker className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden space-y-1">
            <p className="text-sm font-medium leading-tight text-slate-900 dark:text-slate-100 truncate">{orderData.productName}</p>
            <p className="text-xs text-muted-foreground truncate">{orderData.vendor}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {renderStatusPill(orderData.status)}
            <span className="text-xs text-slate-500 dark:text-slate-400">{orderData.date}</span>
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ₩{orderData.amount.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>
    );
  };

  // 상태별 주문 필터링 함수
  const filterOrdersByStatus = (orders: any[], status: string) => {
    return orders.filter((order: any) => {
      let orderStatus = order.status;
      if (!orderStatus) {
        if (order.status === "SHIPPING") orderStatus = "배송 중";
        else if (order.status === "DELIVERED") orderStatus = "배송 완료";
        else orderStatus = "승인 대기";
      }
      return orderStatus === status;
    });
  };

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
                    즉시 발주 필요 5건
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
                    <div className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-0.5 rounded">
                      예산 소진율 25%
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
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">최저가 분석 중 2건</p>
                </CardContent>
              </Card>
            </Link>
          </div>

        {/* 3. 주문 내역 & 알림 센터 탭 통합 */}
        <Card className="bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50">
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">로딩 중...</div>
            ) : (
              <Tabs defaultValue="orders" className="w-full">
                <div className="border-b border-slate-200 dark:border-slate-800/50 px-4 pt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="orders" className="text-xs">
                      최근 주문
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="text-xs">
                      알림 센터
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* 주문 내역 탭 */}
                <TabsContent value="orders" className="m-0">
                  <Tabs defaultValue="all" className="w-full">
                    <div className="border-b border-slate-200 dark:border-slate-800/50 px-4 pt-4">
                      <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                        <TabsList className="inline-flex w-auto justify-start min-w-full">
                          <TabsTrigger value="all" className="text-xs whitespace-nowrap">
                            전체
                          </TabsTrigger>
                          <TabsTrigger value="shipping" className="text-xs whitespace-nowrap">
                            배송 중
                          </TabsTrigger>
                          <TabsTrigger value="pending" className="text-xs whitespace-nowrap">
                            승인 대기
                          </TabsTrigger>
                          <TabsTrigger value="completed" className="text-xs whitespace-nowrap">
                            완료
                          </TabsTrigger>
                        </TabsList>
                      </div>
                    </div>

                    {/* 전체 탭 */}
                    <TabsContent value="all" className="m-0">
                      <div className="grid gap-4 p-4 w-full min-w-0">
                        {displayOrders.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">
                            주문 내역이 없습니다.
                          </div>
                        ) : (
                          displayOrders.map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderCard(orderData);
                          })
                        )}
                      </div>
                    </TabsContent>

                    {/* 배송 중 탭 */}
                    <TabsContent value="shipping" className="m-0">
                      <div className="grid gap-4 p-4 w-full min-w-0">
                        {filterOrdersByStatus(displayOrders, "배송 중").length === 0 ? (
                          <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">
                            배송 중인 주문 내역이 없습니다.
                          </div>
                        ) : (
                          filterOrdersByStatus(displayOrders, "배송 중").map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderCard(orderData);
                          })
                        )}
                      </div>
                    </TabsContent>

                    {/* 승인 대기 탭 */}
                    <TabsContent value="pending" className="m-0">
                      <div className="grid gap-4 p-4 w-full min-w-0">
                        {filterOrdersByStatus(displayOrders, "승인 대기").length === 0 ? (
                          <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">
                            승인 대기 중인 주문 내역이 없습니다.
                          </div>
                        ) : (
                          filterOrdersByStatus(displayOrders, "승인 대기").map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderCard(orderData);
                          })
                        )}
                      </div>
                    </TabsContent>

                    {/* 완료 탭 */}
                    <TabsContent value="completed" className="m-0">
                      <div className="grid gap-4 p-4 w-full min-w-0">
                        {filterOrdersByStatus(displayOrders, "배송 완료").length === 0 ? (
                          <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">
                            완료된 주문 내역이 없습니다.
                          </div>
                        ) : (
                          filterOrdersByStatus(displayOrders, "배송 완료").map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderCard(orderData);
                          })
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
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
            )}
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
                    즉시 발주 필요 5건
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
                    <div className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-0.5 rounded">
                      예산 소진율 25%
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
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">최저가 분석 중 2건</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* 2. Recent Orders - md: 카드 리스트, lg: 테이블 */}
          <Card className="min-h-[400px] overflow-hidden bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50">
            <CardHeader className="p-4">
              <CardTitle className="truncate text-slate-900 dark:text-slate-100">최근 주문 내역</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">로딩 중...</div>
              ) : (
                <Tabs defaultValue="all" className="w-full">
                  <div className="border-b border-slate-200 dark:border-slate-800/50 px-6 pt-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all" className="text-sm">
                        전체
                      </TabsTrigger>
                      <TabsTrigger value="shipping" className="text-sm">
                        배송 중
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="text-sm">
                        승인 대기
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="text-sm">
                        완료
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* 전체 탭 - md: 카드, lg: 테이블 */}
                  <TabsContent value="all" className="m-0">
                    {/* md 해상도: 카드 리스트 */}
                    <div className="lg:hidden grid gap-4 p-4 w-full min-w-0">
                      {displayOrders.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">주문 내역이 없습니다.</div>
                      ) : (
                        displayOrders.map((order: any, index: number) => {
                          const orderData = processOrderData(order, index);
                          return renderOrderCard(orderData);
                        })
                      )}
                    </div>
                    {/* lg 이상: 테이블 */}
                    <div className="hidden lg:block overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문 정보</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>날짜</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                              주문 내역이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          displayOrders.map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderRow(orderData);
                          })
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </TabsContent>

                  {/* 배송 중 탭 */}
                  <TabsContent value="shipping" className="m-0">
                    <div className="lg:hidden grid gap-4 p-4 w-full min-w-0">
                      {filterOrdersByStatus(displayOrders, "배송 중").length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">배송 중인 주문 내역이 없습니다.</div>
                      ) : (
                        filterOrdersByStatus(displayOrders, "배송 중").map((order: any, index: number) => {
                          const orderData = processOrderData(order, index);
                          return renderOrderCard(orderData);
                        })
                      )}
                    </div>
                    <div className="hidden lg:block overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문 정보</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>날짜</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterOrdersByStatus(displayOrders, "배송 중").length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                              배송 중인 주문 내역이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filterOrdersByStatus(displayOrders, "배송 중").map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderRow(orderData);
                          })
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </TabsContent>

                  {/* 승인 대기 탭 */}
                  <TabsContent value="pending" className="m-0">
                    <div className="lg:hidden grid gap-4 p-4 w-full min-w-0">
                      {filterOrdersByStatus(displayOrders, "승인 대기").length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">승인 대기 중인 주문 내역이 없습니다.</div>
                      ) : (
                        filterOrdersByStatus(displayOrders, "승인 대기").map((order: any, index: number) => {
                          const orderData = processOrderData(order, index);
                          return renderOrderCard(orderData);
                        })
                      )}
                    </div>
                    <div className="hidden lg:block overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문 정보</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>날짜</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterOrdersByStatus(displayOrders, "승인 대기").length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                              승인 대기 중인 주문 내역이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filterOrdersByStatus(displayOrders, "승인 대기").map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderRow(orderData);
                          })
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </TabsContent>

                  {/* 완료 탭 */}
                  <TabsContent value="completed" className="m-0">
                    <div className="lg:hidden grid gap-4 p-4 w-full min-w-0">
                      {filterOrdersByStatus(displayOrders, "배송 완료").length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-400 text-sm">완료된 주문 내역이 없습니다.</div>
                      ) : (
                        filterOrdersByStatus(displayOrders, "배송 완료").map((order: any, index: number) => {
                          const orderData = processOrderData(order, index);
                          return renderOrderCard(orderData);
                        })
                      )}
                    </div>
                    <div className="hidden lg:block overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문 정보</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>날짜</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterOrdersByStatus(displayOrders, "배송 완료").length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                              완료된 주문 내역이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filterOrdersByStatus(displayOrders, "배송 완료").map((order: any, index: number) => {
                            const orderData = processOrderData(order, index);
                            return renderOrderRow(orderData);
                          })
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Right Side Panel (Span 2) --- */}
        <div className="md:col-span-2 space-y-6">
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

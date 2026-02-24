"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, DollarSign, FileText, Search, Plus, ShoppingCart, TrendingUp, TrendingDown, Truck, ChevronRight, Beaker } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-slate-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = dashboardStats || {
    totalInventory: 0,
    lowStockAlerts: 0,
    monthlySpending: 0,
    activeQuotes: 0,
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

  // 상태 뱃지 스타일 및 점 색상 함수
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "배송 중":
        return {
          className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
          dotColor: "bg-blue-500",
        };
      case "승인 대기":
        return {
          className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
          dotColor: "bg-yellow-500",
        };
      case "배송 완료":
        return {
          className: "bg-green-100 text-green-700 hover:bg-green-100",
          dotColor: "bg-green-500",
        };
      default:
        return {
          className: "bg-slate-100 text-slate-700 hover:bg-slate-100",
          dotColor: "bg-slate-500",
        };
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
    const statusStyle = getStatusBadgeStyle(orderData.status);
    return (
      <TableRow 
        key={orderData.orderId} 
        className="group cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <TableCell className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
              <Beaker className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm text-slate-900 truncate">{orderData.productName}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{orderData.vendor}</span>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-4">
          <Badge 
            variant="secondary" 
            className={cn(
              "rounded-full px-3 py-1 font-medium shadow-none inline-flex items-center gap-2",
              statusStyle.className
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusStyle.dotColor)} />
            {orderData.status}
          </Badge>
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
    const statusStyle = getStatusBadgeStyle(orderData.status);
    return (
      <div
        key={orderData.orderId}
        className="flex items-center justify-between p-4 rounded-lg border bg-white shadow-sm w-full min-w-0"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 아이콘 박스 */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Beaker className="h-5 w-5" />
          </div>
          <div className="space-y-1 flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium leading-none truncate">{orderData.productName}</p>
            <p className="text-xs text-muted-foreground truncate">{orderData.vendor} • {orderData.date}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-sm font-bold mb-1 whitespace-nowrap">₩{orderData.amount.toLocaleString("ko-KR")}</p>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-[10px] px-1.5 h-5 inline-flex items-center gap-1 whitespace-nowrap",
              statusStyle.className
            )}
          >
            <span className={cn("h-1 w-1 rounded-full shrink-0", statusStyle.dotColor)} />
            <span className="truncate">{orderData.status}</span>
          </Badge>
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

  // 알림 아이콘 렌더링 함수
  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return (
          <div className="flex-shrink-0 rounded-md bg-red-100 p-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
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
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">대시보드</h2>
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

        {/* 2. KPI Cards (2x2 그리드) - 모던화 */}
        <div className="grid grid-cols-2 gap-3">
            <Link href="/dashboard/inventory">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">총 재고 수</CardTitle>
                  <div className="rounded-full p-2 bg-blue-50">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-slate-900">{stats.totalInventory || 0}</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>+12%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">개 품목</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/inventory?filter=low">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">부족 알림</CardTitle>
                  <div className="rounded-full p-2 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-red-600">{stats.lowStockAlerts || 0}</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                      <TrendingDown className="h-3 w-3" />
                      <span>-3%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">품목 재주문 필요</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/purchases">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">이번 달 지출</CardTitle>
                  <div className="rounded-full p-2 bg-emerald-50">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-slate-900">
                      ₩{stats.monthlySpending ? stats.monthlySpending.toLocaleString("ko-KR") : "0"}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>+8%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">구매 금액</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/quotes">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">진행 중인 견적</CardTitle>
                  <div className="rounded-full p-2 bg-violet-50">
                    <FileText className="h-4 w-4 text-violet-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-slate-900">{stats.activeQuotes || 0}</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      <span>→</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">대기 중인 요청</p>
                </CardContent>
              </Card>
            </Link>
          </div>

        {/* 3. 주문 내역 & 알림 센터 탭 통합 */}
        <Card>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="p-8 text-center text-slate-500">로딩 중...</div>
            ) : (
              <Tabs defaultValue="orders" className="w-full">
                <div className="border-b border-slate-200 px-4 pt-4">
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
                    <div className="border-b border-slate-200 px-4 pt-4">
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
                          <div className="text-center py-8 text-slate-500 text-sm">
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
                          <div className="text-center py-8 text-slate-500 text-sm">
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
                          <div className="text-center py-8 text-slate-500 text-sm">
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
                          <div className="text-center py-8 text-slate-500 text-sm">
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
                      <div className="text-center py-8 text-slate-500 text-sm">
                        알림이 없습니다.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-slate-900">최근 알림</h3>
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
                              notification.unread ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                            }`}
                          >
                            {renderNotificationIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm text-slate-900 truncate">{notification.title}</p>
                                {notification.unread && (
                                  <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-blue-600 flex-shrink-0">
                                    새
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mb-1 line-clamp-2">{notification.content}</p>
                              <p className="text-xs text-slate-400">{notification.time}</p>
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
          {/* 1. KPI Cards - 모던화 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Link href="/dashboard/inventory">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">총 재고 수</CardTitle>
                  <div className="rounded-full p-2 bg-blue-50">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-slate-900">{stats.totalInventory || 0}</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>+12%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">개 품목</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/inventory?filter=low">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">부족 알림</CardTitle>
                  <div className="rounded-full p-2 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-red-600">{stats.lowStockAlerts || 0}</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                      <TrendingDown className="h-3 w-3" />
                      <span>-3%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">품목 재주문 필요</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/purchases">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">이번 달 지출</CardTitle>
                  <div className="rounded-full p-2 bg-emerald-50">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-slate-900">
                      ₩{stats.monthlySpending ? stats.monthlySpending.toLocaleString("ko-KR") : "0"}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>+8%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">구매 금액</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/quotes">
              <Card className="cursor-pointer transition-all border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">진행 중인 견적</CardTitle>
                  <div className="rounded-full p-2 bg-violet-50">
                    <FileText className="h-4 w-4 text-violet-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold tracking-tight text-slate-900">{stats.activeQuotes || 0}</div>
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      <span>→</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">대기 중인 요청</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* 2. Recent Orders Table */}
          <Card className="min-h-[400px]">
            <CardHeader>
              <CardTitle>최근 주문 내역</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-8 text-center text-slate-500">로딩 중...</div>
              ) : (
                <Tabs defaultValue="all" className="w-full">
                  <div className="border-b border-slate-200 px-6 pt-4">
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

                  {/* 전체 탭 */}
                  <TabsContent value="all" className="m-0">
                    <Table>
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
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
                  </TabsContent>

                  {/* 배송 중 탭 */}
                  <TabsContent value="shipping" className="m-0">
                    <Table>
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
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
                  </TabsContent>

                  {/* 승인 대기 탭 */}
                  <TabsContent value="pending" className="m-0">
                    <Table>
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
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
                  </TabsContent>

                  {/* 완료 탭 */}
                  <TabsContent value="completed" className="m-0">
                    <Table>
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
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Right Side Panel (Span 2) --- */}
        <div className="md:col-span-2 space-y-6">
          {/* 3. Quick Actions - 답답함 해소, Affordance 강화 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">빠른 실행</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/test/search">
                <Button variant="outline" className="w-full h-12 justify-between rounded-lg bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center">
                    <Search className="mr-3 h-4 w-4 text-slate-500" />
                    통합 검색
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Button>
              </Link>
              <Link href="/dashboard/inventory">
                <Button variant="outline" className="w-full h-12 justify-between rounded-lg border-blue-200 text-blue-700 bg-blue-50/30 hover:bg-blue-50 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center">
                    <Plus className="mr-3 h-4 w-4" />
                    새 재고 등록
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-300" />
                </Button>
              </Link>
              <Link href="/test/quote">
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">최근 알림</CardTitle>
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
                    notification.unread ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  {renderNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-slate-900">{notification.title}</p>
                      {notification.unread && (
                        <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-blue-600">
                          새
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mb-1">{notification.content}</p>
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

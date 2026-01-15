"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, DollarSign, FileText, Search, Plus, ShoppingCart, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <div className="space-y-8">
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

  // 상태 뱃지 스타일 함수
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "배송 중":
        return "bg-blue-100 text-blue-700";
      case "승인 대기":
        return "bg-yellow-100 text-yellow-700";
      case "배송 완료":
        return "bg-green-100 text-green-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

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

  // 주문 행 렌더링 함수
  const renderOrderRow = (orderData: {
    orderId: string;
    productName: string;
    vendor: string;
    amount: number;
    status: string;
    date: string;
  }) => {
    return (
      <TableRow key={orderData.orderId}>
        <TableCell>
          <div>
            <div className="font-medium text-sm text-slate-900">{orderData.productName}</div>
            <div className="text-xs text-slate-500 mt-0.5">{orderData.vendor}</div>
          </div>
        </TableCell>
        <TableCell>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(orderData.status)}`}>
            {orderData.status}
          </span>
        </TableCell>
        <TableCell className="text-sm text-slate-600">{orderData.date}</TableCell>
        <TableCell className="text-right font-medium text-sm text-slate-900">
          ₩{orderData.amount.toLocaleString("ko-KR")}
        </TableCell>
      </TableRow>
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

  return (
    <div className="space-y-8 pt-8">
      {/* 1. KPI Cards (Top Row) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 총 재고 수 */}
        <Link href="/dashboard/inventory">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-blue-400">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">총 재고 수</CardTitle>
              <Package className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl md:text-4xl font-bold text-slate-900">{stats.totalInventory || 0}</div>
                <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <TrendingUp className="h-3 w-3" />
                  <span>+12%</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">개 품목</p>
            </CardContent>
          </Card>
        </Link>

        {/* 부족 알림 */}
        <Link href="/dashboard/inventory?filter=low">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-blue-400">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">부족 알림</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl md:text-4xl font-bold text-red-600">{stats.lowStockAlerts || 0}</div>
                <div className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <TrendingDown className="h-3 w-3" />
                  <span>-3%</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">품목 재주문 필요</p>
            </CardContent>
          </Card>
        </Link>

        {/* 이번 달 지출 */}
        <Link href="/dashboard/purchases">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-blue-400">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">이번 달 지출</CardTitle>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl md:text-4xl font-bold text-slate-900">
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

        {/* 진행 중인 견적 */}
        <Link href="/dashboard/quotes">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-blue-400">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">진행 중인 견적</CardTitle>
              <FileText className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl md:text-4xl font-bold text-slate-900">{stats.activeQuotes || 0}</div>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <span>→</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">대기 중인 요청</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 2. Quick Actions (Middle Row) */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">빠른 실행</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {/* 물품 검색/구매 */}
          <Link href="/test/search" className="group">
            <div className="relative overflow-hidden rounded-xl border-2 border-blue-200 bg-blue-50 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                  <Search className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-bold text-lg text-blue-900 mb-2">🔍 물품 검색 및 구매</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                500만 개 시약 최저가 검색
                <br />
                필요한 시약과 장비를 최저가로 찾아보세요.
              </p>
            </div>
          </Link>

          {/* 재고 등록 */}
          <Link href="/dashboard/inventory" className="group">
            <div className="relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-slate-600 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">📦 재고 등록</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                실험실 자재 등록하기
                <br />
                새로 입고된 시약과 장비를 인벤토리에 추가하세요.
              </p>
            </div>
          </Link>

          {/* 견적 요청 */}
          <Link href="/dashboard/quotes" className="group">
            <div className="relative overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-6 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-slate-600 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">📋 견적 요청</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                장바구니 확인
                <br />
                진행 중인 견적 요청을 확인하고 관리하세요.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Recent Activity Table (Bottom Row) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">최근 주문 내역</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="p-8 text-center text-slate-500">로딩 중...</div>
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <div className="border-b border-slate-200 px-6 pt-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all" className="text-xs md:text-sm">
                      전체
                    </TabsTrigger>
                    <TabsTrigger value="shipping" className="text-xs md:text-sm">
                      배송 중
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs md:text-sm">
                      승인 대기
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs md:text-sm">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterOrdersByStatus(displayOrders, "배송 중").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterOrdersByStatus(displayOrders, "승인 대기").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterOrdersByStatus(displayOrders, "배송 완료").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
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
    </div>
  );
}

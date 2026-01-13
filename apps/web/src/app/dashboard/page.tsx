"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, DollarSign, FileText, Search, Plus, ShoppingCart, ArrowRight } from "lucide-react";
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

  return (
    <div className="space-y-8">
      {/* 1. KPI Cards (Top Row) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 총 재고 수 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">총 재고 수</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.totalInventory || 0}</div>
            <p className="text-xs text-slate-500 mt-1">개 품목</p>
          </CardContent>
        </Card>

        {/* 부족 알림 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">부족 알림</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.lowStockAlerts || 0}</div>
            <p className="text-xs text-slate-500 mt-1">품목 재주문 필요</p>
          </CardContent>
        </Card>

        {/* 이번 달 지출 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">이번 달 지출</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              ₩{stats.monthlySpending ? stats.monthlySpending.toLocaleString("ko-KR") : "0"}
            </div>
            <p className="text-xs text-slate-500 mt-1">구매 금액</p>
          </CardContent>
        </Card>

        {/* 진행 중인 견적 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">진행 중인 견적</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.activeQuotes || 0}</div>
            <p className="text-xs text-slate-500 mt-1">대기 중인 요청</p>
          </CardContent>
        </Card>
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
        <h2 className="text-lg font-semibold text-slate-900 mb-4">최근 주문 내역</h2>
        <Card>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="p-8 text-center text-slate-500">로딩 중...</div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="mb-2">주문 내역이 없습니다</p>
                <Link href="/test/search">
                  <Button variant="outline" size="sm" className="mt-2">
                    제품 검색하기
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">주문 번호</TableHead>
                    <TableHead>제품명</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-right">주문일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, 10).map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-sm">#{order.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">
                        {order.items?.[0]?.productName || "제품명 없음"}
                        {order.items?.length > 1 && ` 외 ${order.items.length - 1}개`}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                          {order.status === "SHIPPING" ? "배송 중" : order.status === "DELIVERED" ? "배송 완료" : "대기 중"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ₩{order.totalAmount ? order.totalAmount.toLocaleString("ko-KR") : "0"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

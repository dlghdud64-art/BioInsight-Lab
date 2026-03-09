"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart, ChevronRight, BarChart2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── 타입 정의 ─────────────────────────────────────────────
interface BudgetSummary {
  total: number;
  used: number;
  remaining: number;
  usageRate: number;
}
interface MonthlyPoint { month: string; amount: number; }
interface CategoryPoint { name: string; value: number; amount: number; color: string; }
interface TopSpendingItem {
  id: string; item: string; vendor: string;
  category: string; amount: number; date: string;
}
interface AnalyticsDashboardData {
  budget: BudgetSummary;
  monthlySpending: MonthlyPoint[];
  categorySpending: CategoryPoint[];
  topSpending: TopSpendingItem[];
}

// ── 데이터 패칭 ───────────────────────────────────────────
async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const res = await fetch("/api/analytics/dashboard");
  if (!res.ok) throw new Error("Failed to fetch analytics data");
  return res.json();
}

// ── 스켈레톤 ─────────────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── 파이 차트 색상 팔레트 ─────────────────────────────────
const CATEGORY_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

// ── 빈 상태 ──────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 gap-2">
      <BarChart2 className="h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────
export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery<AnalyticsDashboardData>({
    queryKey: ["analytics-dashboard"],
    queryFn: fetchAnalyticsDashboard,
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  const budget = data?.budget ?? { total: 0, used: 0, remaining: 0, usageRate: 0 };
  const monthlySpending = data?.monthlySpending ?? [];
  const categorySpending = data?.categorySpending ?? [];
  const topSpending = data?.topSpending ?? [];
  const hasMonthlyData = monthlySpending.some((m) => m.amount > 0);
  const hasCategoryData = categorySpending.length > 0;
  const hasTopData = topSpending.length > 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex flex-col space-y-2 mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          지출 분석
        </h2>
        <p className="text-muted-foreground">연구비 소진 현황을 확인하세요.</p>
      </div>
      <Separator />

      {/* 오류 상태 */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* 요약 카드 */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium truncate min-w-0">총 예산</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {budget.total > 0 ? (
                <>
                  <div className="text-2xl md:text-3xl font-bold break-words">
                    ₩ {budget.total.toLocaleString("ko-KR")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">올해 등록된 예산 합계</p>
                </>
              ) : (
                <div className="text-sm text-slate-400 mt-1">예산이 등록되어 있지 않습니다.</div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium truncate min-w-0">현재 사용액</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl md:text-3xl font-bold break-words">
                ₩ {budget.used.toLocaleString("ko-KR")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                사용률: {budget.usageRate}%
              </p>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${budget.usageRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-sm font-medium truncate min-w-0">잔액</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {budget.total > 0 ? (
                <>
                  <div className="text-2xl md:text-3xl font-bold break-words">
                    ₩ {budget.remaining.toLocaleString("ko-KR")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">남은 예산</p>
                </>
              ) : (
                <div className="text-sm text-slate-400 mt-1">예산 등록 후 확인 가능합니다.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 차트 */}
      {isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 월별 지출 추이 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>월별 지출 추이</CardTitle>
                <CardDescription>최근 6개월간 지출액 변화</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 text-sm shrink-0" asChild>
                <Link href="/dashboard/analytics/monthly">
                  상세보기 <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {hasMonthlyData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlySpending}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} stroke="#cbd5e1" />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      stroke="#cbd5e1"
                      tickFormatter={(v) => `₩${(v / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", backgroundColor: "white" }}
                      formatter={(value: number) => [`₩ ${value.toLocaleString("ko-KR")}`, "지출액"]}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="아직 지출 내역이 없습니다." />
              )}
            </CardContent>
          </Card>

          {/* 카테고리별 비중 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>카테고리별 비중</CardTitle>
                <CardDescription>시약, 장비, 소모품 비율</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 text-sm shrink-0" asChild>
                <Link href="/dashboard/analytics/category">
                  상세보기 <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {hasCategoryData ? (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={categorySpending}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {categorySpending.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", backgroundColor: "white" }}
                        formatter={(value: number, name: string, item: { payload?: CategoryPoint }) => [
                          `₩ ${(item.payload?.amount ?? value).toLocaleString("ko-KR")}`,
                          `${name} (${item.payload?.value ?? value}%)`,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {categorySpending.map((cat, index) => (
                      <div key={cat.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                          />
                          <span className="text-slate-600">{cat.name}</span>
                        </div>
                        <span className="font-medium">₩ {cat.amount.toLocaleString("ko-KR")}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart message="아직 지출 내역이 없습니다." />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 5 지출 테이블 */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>최근 큰 지출 Top 5</CardTitle>
          <CardDescription>가격이 높은 순서대로 구매 내역</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : !hasTopData ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Package className="h-10 w-10 opacity-30" />
              <p className="text-sm">아직 구매 내역이 없습니다.</p>
              <Link href="/dashboard/purchases">
                <Button variant="outline" size="sm" className="mt-2">
                  구매 내역 등록하기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">순위</TableHead>
                    <TableHead>품목명</TableHead>
                    <TableHead>벤더</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>구매일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSpending.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px] min-w-0">
                        <span className="truncate block">{item.item}</span>
                      </TableCell>
                      <TableCell>{item.vendor}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.category === "시약" && <FlaskConical className="h-4 w-4 text-blue-600" />}
                          {item.category === "장비" && <Package className="h-4 w-4 text-green-600" />}
                          {item.category === "소모품" && <ShoppingCart className="h-4 w-4 text-orange-600" />}
                          <span>{item.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ₩ {item.amount.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {new Date(item.date).toLocaleDateString("ko-KR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

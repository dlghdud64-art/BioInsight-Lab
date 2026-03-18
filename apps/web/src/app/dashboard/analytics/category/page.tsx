"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { ArrowLeft, FlaskConical, Microscope, ShoppingCart, Package, HelpCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

// ── 메인 analytics 페이지와 동일한 색상 팔레트 ──────────────
const CATEGORY_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

// ── 카테고리명 → 아이콘 매핑 ─────────────────────────────────
function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("시약") || lower.includes("reagent")) return FlaskConical;
  if (lower.includes("장비") || lower.includes("equipment") || lower.includes("instrument")) return Microscope;
  if (lower.includes("소모품") || lower.includes("consumable") || lower.includes("tool")) return ShoppingCart;
  if (lower.includes("키트") || lower.includes("kit")) return Package;
  return HelpCircle;
}

// ── 타입 ──────────────────────────────────────────────────
interface CategoryPoint {
  name: string;
  value: number;   // 비중(%)
  amount: number;  // 실 금액(KRW)
  color: string;
}
interface AnalyticsDashboardData {
  categorySpending: CategoryPoint[];
}

// ── 데이터 패칭 ───────────────────────────────────────────
async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const res = await fetch("/api/analytics/dashboard");
  if (!res.ok) throw new Error("Failed to fetch analytics data");
  return res.json();
}

// ── 금액 포맷터 ───────────────────────────────────────────
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(value);

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function CategoryAnalyticsPage() {
  const { data, isLoading, isError } = useQuery<AnalyticsDashboardData>({
    queryKey: ["analytics-dashboard"],
    queryFn: fetchAnalyticsDashboard,
    staleTime: 1000 * 60 * 5,
  });

  const categorySpending = data?.categorySpending ?? [];
  const hasData = categorySpending.length > 0;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* 상단 헤더 */}
      <div className="mb-6">
        <Link
          href="/dashboard/analytics"
          className="text-sm text-slate-500 hover:text-slate-100  hover:text-slate-100 flex items-center mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          지출 분석 홈으로
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-slate-100">
          카테고리별 지출 분석
        </h2>
        <p className="text-muted-foreground mt-2">
          어떤 항목에 연구비가 가장 많이 쓰이는지 확인하세요.
        </p>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-[300px] w-full rounded-lg" /></CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-4 pt-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 에러 */}
      {isError && (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          데이터를 불러오는 중 오류가 발생했습니다.
        </div>
      )}

      {/* 데이터 없음 */}
      {!isLoading && !isError && !hasData && (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          아직 카테고리별 지출 내역이 없습니다.
        </div>
      )}

      {/* 실데이터 렌더링 */}
      {!isLoading && !isError && hasData && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* 좌측: 도넛 차트 */}
          <Card className="shadow-sm border-[#2a2a2e]">
            <CardHeader>
              <CardTitle className="text-lg">비중 (도넛 차트)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[350px]">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="amount"
                    stroke="none"
                  >
                    {categorySpending.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "금액"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* 커스텀 Legend - 색상 동기화 */}
              <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2">
                {categorySpending.map((cat, index) => (
                  <div key={cat.name} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                    />
                    {cat.name} ({cat.value}%)
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 우측: 항목별 상세 금액 리스트 */}
          <Card className="shadow-sm border-[#2a2a2e]">
            <CardHeader>
              <CardTitle className="text-lg">항목별 상세 금액</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {categorySpending.map((item, index) => {
                const Icon = getCategoryIcon(item.name);
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-4 rounded-lg border border-slate-100 border-[#2a2a2e] bg-[#111114] bg-[#1a1a1e]/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${color}1a` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.value}% 비중</p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-100 ml-4 whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

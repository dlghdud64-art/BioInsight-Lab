"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart,
  ChevronRight, BarChart2, AlertTriangle, CheckCircle2, Info,
  Lightbulb, CreditCard,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── 타입 ────────────────────────────────────────────────────
interface BudgetSummary { total: number; used: number; remaining: number; usageRate: number; }
interface MonthlyPoint { month: string; amount: number; }
interface CategoryPoint { name: string; value: number; amount: number; color: string; }
interface TopSpendingItem { id: string; item: string; vendor: string; category: string; amount: number; date: string; }
interface AnalyticsDashboardData {
  budget: BudgetSummary;
  monthlySpending: MonthlyPoint[];
  categorySpending: CategoryPoint[];
  topSpending: TopSpendingItem[];
}
interface AggregatedItem {
  item: string; vendor: string; category: string;
  totalAmount: number; count: number; latestDate: string;
}
interface InsightItem {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  text: string;
}

// ── 데이터 패칭 ───────────────────────────────────────────
async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const res = await fetch("/api/analytics/dashboard");
  if (!res.ok) throw new Error("Failed to fetch analytics data");
  return res.json();
}

// ── 색상 팔레트 ──────────────────────────────────────────
const CATEGORY_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316",
];

// ── 카테고리 아이콘 ───────────────────────────────────────
function CategoryIcon({ category }: { category: string }) {
  if (category === "시약") return <FlaskConical className="h-3.5 w-3.5 text-blue-500" />;
  if (category === "장비") return <Package className="h-3.5 w-3.5 text-emerald-500" />;
  if (category === "소모품") return <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />;
  return <Package className="h-3.5 w-3.5 text-slate-400" />;
}

// ── 예산 상태 헬퍼 ──────────────────────────────────────
function getUsageStatus(rate: number) {
  if (rate >= 90) return { level: "경고", barColor: "bg-red-500", textColor: "text-red-600 dark:text-red-400" };
  if (rate >= 75) return { level: "주의", barColor: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" };
  return { level: "정상", barColor: "bg-blue-500", textColor: "text-emerald-600 dark:text-emerald-400" };
}

// ── 잔액 해석 ────────────────────────────────────────────
function getRemainingInsight(usageRate: number, remaining: number): string {
  if (usageRate >= 90) return "추가 집행 전 예산 검토가 필요합니다";
  if (usageRate >= 75) return "잔여 예산 집행 속도를 점검하세요";
  const monthsLeft = 12 - (new Date().getMonth() + 1);
  if (monthsLeft > 0 && remaining > 0) {
    const monthly = Math.round(remaining / monthsLeft);
    return `월 평균 ₩${monthly.toLocaleString("ko-KR")} 수준으로 운영 가능`;
  }
  return "연도 마감까지 남은 잔액입니다";
}

// ── 인사이트 생성 ────────────────────────────────────────
function generateInsights(data: AnalyticsDashboardData): InsightItem[] {
  const { budget, monthlySpending, categorySpending } = data;
  const insights: InsightItem[] = [];

  // 예산 집행률 인사이트
  if (budget.total > 0) {
    if (budget.usageRate >= 90) {
      insights.push({ icon: AlertTriangle, color: "text-red-600", text: `예산의 ${budget.usageRate}%를 집행했습니다. 추가 구매 전 예산 검토가 필요합니다.` });
    } else if (budget.usageRate >= 75) {
      insights.push({ icon: AlertTriangle, color: "text-amber-600", text: `예산의 ${budget.usageRate}%를 집행했습니다. 잔여 예산 운영 계획을 점검하세요.` });
    } else {
      insights.push({ icon: CheckCircle2, color: "text-emerald-600", text: `이번 연도 예산의 ${budget.usageRate}%를 집행 중입니다. 현재 운영 속도는 안정적입니다.` });
    }
  }

  // 카테고리 집중 인사이트
  if (categorySpending.length > 0) {
    const top = categorySpending[0];
    insights.push({ icon: Info, color: "text-blue-600", text: `주요 지출은 '${top.name}' 카테고리에 집중되어 있으며, 전체의 ${top.value}%를 차지합니다.` });
  }

  // 월별 추이 인사이트
  const validMonths = monthlySpending.filter((m) => m.amount > 0);
  if (validMonths.length >= 2) {
    const cur = validMonths[validMonths.length - 1];
    const prev = validMonths[validMonths.length - 2];
    const change = Math.round(((cur.amount - prev.amount) / prev.amount) * 100);
    if (Math.abs(change) >= 10) {
      const dir = change > 0 ? "증가" : "감소";
      const Icon = change > 0 ? TrendingUp : TrendingDown;
      const color = change > 0 ? "text-amber-600" : "text-emerald-600";
      insights.push({ icon: Icon, color, text: `이번 달(${cur.month}) 지출은 전월 대비 ${Math.abs(change)}% ${dir}했습니다.` });
    }
  }

  return insights.slice(0, 3);
}

// ── Top 품목 집계 (동일 품목 그루핑) ──────────────────────
function aggregateTopItems(items: TopSpendingItem[]): AggregatedItem[] {
  const map: Record<string, AggregatedItem> = {};
  for (const it of items) {
    const key = it.item || "미등록";
    if (!map[key]) {
      map[key] = { item: key, vendor: it.vendor, category: it.category || "기타", totalAmount: 0, count: 0, latestDate: it.date };
    }
    map[key].totalAmount += it.amount || 0;
    map[key].count += 1;
    if (it.date > map[key].latestDate) {
      map[key].latestDate = it.date;
      map[key].vendor = it.vendor;
    }
  }
  return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
}

// ── 최고 지출 달 ──────────────────────────────────────────
function getPeakMonth(monthly: MonthlyPoint[]): MonthlyPoint | null {
  const valid = monthly.filter((m) => m.amount > 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (a.amount > b.amount ? a : b));
}

// ── 스켈레톤 ─────────────────────────────────────────────
function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="rounded-xl border-slate-200/60 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-28" />
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
        <Card key={i} className="rounded-xl border-slate-200/60 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-[240px] w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── 빈 상태 ──────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] text-slate-400 gap-2">
      <BarChart2 className="h-8 w-8 opacity-25" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────
export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery<AnalyticsDashboardData>({
    queryKey: ["analytics-dashboard"],
    queryFn: fetchAnalyticsDashboard,
    staleTime: 1000 * 60 * 5,
  });

  const budget = data?.budget ?? { total: 0, used: 0, remaining: 0, usageRate: 0 };
  const monthlySpending = data?.monthlySpending ?? [];
  const categorySpending = data?.categorySpending ?? [];
  const topSpending = data?.topSpending ?? [];

  const hasMonthlyData = monthlySpending.some((m) => m.amount > 0);
  const hasCategoryData = categorySpending.length > 0;
  const hasTopData = topSpending.length > 0;

  const usageStatus = getUsageStatus(budget.usageRate);
  const insights = data ? generateInsights(data) : [];
  const peakMonth = getPeakMonth(monthlySpending);
  const topCat = categorySpending[0] ?? null;
  const aggregatedItems = aggregateTopItems(topSpending);

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 1. 페이지 헤더 + 빠른 액션 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            지출 분석
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            예산 소진 현황과 지출 패턴을 확인하고 다음 행동으로 이어가세요.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/dashboard/purchases">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              <ShoppingCart className="h-3.5 w-3.5" />
              구매 내역
            </Button>
          </Link>
          <Link href="/dashboard/budget">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              <CreditCard className="h-3.5 w-3.5" />
              예산 관리
            </Button>
          </Link>
        </div>
      </div>

      {/* 오류 상태 */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* ══ 2. KPI 카드 — 숫자 + 해석 ══ */}
      {isLoading ? <KPISkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 총 예산 */}
          <Card className="overflow-hidden rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">총 예산</CardTitle>
              <div className="rounded-full p-1.5 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {budget.total > 0 ? (
                <>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">
                    ₩{budget.total.toLocaleString("ko-KR")}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
                    올해 등록된 연간 운영 예산
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold text-slate-400 dark:text-slate-500 mt-1">미등록</div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                    예산 관리에서 등록 후 확인 가능합니다
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 현재 사용액 */}
          <Card className="overflow-hidden rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">현재 사용액</CardTitle>
              <div className={`rounded-full p-1.5 flex-shrink-0 ${budget.usageRate >= 75 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-blue-50 dark:bg-blue-950/30"}`}>
                <TrendingUp className={`h-3.5 w-3.5 ${budget.usageRate >= 75 ? "text-amber-600" : "text-blue-600"}`} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">
                ₩{budget.used.toLocaleString("ko-KR")}
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${budget.total > 0 ? usageStatus.textColor : "text-slate-500"}`}>
                    {budget.total > 0 ? `예산의 ${budget.usageRate}% 사용 중` : "지출 집계 기준 (예산 미등록)"}
                  </span>
                  {budget.total > 0 && (
                    <span className={`text-[11px] font-semibold ${usageStatus.textColor}`}>
                      {usageStatus.level}
                    </span>
                  )}
                </div>
                {budget.total > 0 && (
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usageStatus.barColor}`}
                      style={{ width: `${Math.min(100, budget.usageRate)}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 잔액 */}
          <Card className={`overflow-hidden rounded-xl shadow-sm ${budget.usageRate >= 90 ? "border-red-200/60 dark:border-red-900/30 bg-red-50/20 dark:bg-red-950/10" : "border-slate-200/60 dark:border-slate-800/50 bg-white dark:bg-[#161d2f]"}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${budget.usageRate >= 90 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
                잔액
              </CardTitle>
              <div className={`rounded-full p-1.5 flex-shrink-0 ${budget.usageRate >= 90 ? "bg-red-100 dark:bg-red-950/40" : "bg-emerald-50 dark:bg-emerald-950/30"}`}>
                <TrendingDown className={`h-3.5 w-3.5 ${budget.usageRate >= 90 ? "text-red-600" : "text-emerald-600"}`} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {budget.total > 0 ? (
                <>
                  <div className={`text-2xl font-bold break-words ${budget.usageRate >= 90 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>
                    ₩{budget.remaining.toLocaleString("ko-KR")}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
                    {getRemainingInsight(budget.usageRate, budget.remaining)}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold text-slate-400 dark:text-slate-500 mt-1">—</div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">예산 등록 후 확인 가능합니다</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══ 3. 지출 분석 요약 인사이트 ══ */}
      {!isLoading && insights.length > 0 && (
        <Card className="rounded-xl border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/10 shadow-sm">
          <CardHeader className="pb-2 p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">지출 분석 요약</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="space-y-2">
              {insights.map((insight, i) => {
                const Icon = insight.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${insight.color}`} />
                    <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{insight.text}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ══ 4. 차트 분석 ══ */}
      {isLoading ? <ChartSkeleton /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 월별 지출 추이 */}
          <Card className="rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">월별 지출 추이</CardTitle>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {peakMonth
                    ? `최고 지출: ${peakMonth.month} (₩${peakMonth.amount.toLocaleString("ko-KR")})`
                    : "최근 6개월 지출 변화"}
                </p>
              </div>
              <Link href="/dashboard/analytics/monthly" className="flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-blue-600 gap-0.5">
                  상세 <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {hasMonthlyData ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlySpending} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000000 ? `${(v / 1000000).toFixed(0)}M`
                          : v >= 1000 ? `${(v / 1000).toFixed(0)}K`
                          : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                      formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="아직 지출 내역이 없습니다." />
              )}
            </CardContent>
          </Card>

          {/* 카테고리별 비중 */}
          <Card className="rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">카테고리별 지출 비중</CardTitle>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {topCat ? `${topCat.name} 지출이 ${topCat.value}%로 가장 높음` : "시약 · 장비 · 소모품 비율"}
                </p>
              </div>
              <Link href="/dashboard/analytics/category" className="flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-blue-600 gap-0.5">
                  상세 <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {hasCategoryData ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categorySpending}
                        cx="50%" cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={85}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="white"
                      >
                        {categorySpending.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                        formatter={(value: number, name: string, item: { payload?: CategoryPoint }) => [
                          `₩${(item.payload?.amount ?? value).toLocaleString("ko-KR")}`,
                          `${name} (${item.payload?.value ?? value}%)`,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* 범례 */}
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800/40 pt-3">
                    {categorySpending.map((cat, index) => (
                      <div key={cat.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-400">{cat.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-0">
                            {cat.value}%
                          </Badge>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          ₩{cat.amount.toLocaleString("ko-KR")}
                        </span>
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

      {/* ══ 5. 고지출 품목 인사이트 테이블 ══ */}
      <Card className="rounded-xl border-slate-200/60 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">고지출 품목</CardTitle>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                구매 금액 기준 상위 품목 · 반복 구매 포함
              </p>
            </div>
            <Link href="/dashboard/purchases">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-blue-600 gap-0.5 flex-shrink-0">
                전체 구매 내역 <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : !hasTopData ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <Package className="h-8 w-8 opacity-25" />
              <p className="text-sm">아직 구매 내역이 없습니다.</p>
              <Link href="/dashboard/purchases">
                <Button variant="outline" size="sm" className="mt-2 h-8 text-xs font-medium">
                  구매 내역 등록하기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[540px]">
                <TableHeader>
                  <TableRow className="border-slate-100 dark:border-slate-800/50">
                    <TableHead className="w-8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">품목명</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">벤더</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">분류</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">지출 합계</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">구매 횟수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedItems.map((item, index) => (
                    <TableRow key={item.item} className="border-slate-100 dark:border-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <TableCell className="py-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-[160px]">
                        <span className="truncate block">{item.item || "품목명 미등록"}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-slate-600 dark:text-slate-400">
                        {item.vendor || "—"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <CategoryIcon category={item.category} />
                          <span className="text-xs text-slate-600 dark:text-slate-400">{item.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          ₩{item.totalAmount.toLocaleString("ko-KR")}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        {item.count > 1 ? (
                          <Badge className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-0 font-semibold">
                            {item.count}회
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">1회</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ 6. 분석 후 다음 액션 ══ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-900/30 p-4">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          분석 후 이어서 확인하기
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/dashboard/purchases">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
              <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
              구매 내역 보기
            </Button>
          </Link>
          <Link href="/dashboard/budget">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
              <CreditCard className="h-3.5 w-3.5 text-slate-500" />
              예산 관리
            </Button>
          </Link>
          <Link href="/dashboard/analytics/category">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
              <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
              카테고리 분석
            </Button>
          </Link>
          <Link href="/dashboard/analytics/monthly">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium transition-colors">
              <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
              월별 추이
            </Button>
          </Link>
        </div>
      </div>

    </div>
  );
}

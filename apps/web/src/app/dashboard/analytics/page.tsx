"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart,
  ChevronRight, ChevronDown, BarChart2, AlertTriangle,
  CreditCard, Store, Users, ExternalLink, RefreshCw, Clock,
  ArrowRight,
} from "lucide-react";
import TeamAnalyticsView from "./_components/team-analytics-view";

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

// ── 카테고리 라벨 매핑 ────────────
const CATEGORY_LABEL_MAP: Record<string, string> = {
  REAGENT: "시약", REAGENTS: "시약",
  TOOL: "장비", TOOLS: "장비", EQUIPMENT: "장비",
  CONSUMABLE: "소모품", CONSUMABLES: "소모품",
  GLASSWARE: "유리기구",
  CHEMICAL: "화학물질", CHEMICALS: "화학물질",
  MEDIA: "배지", BUFFER: "완충용액",
  OTHER: "기타", ETC: "기타",
};
function getCategoryLabel(raw: string | null | undefined): string {
  if (!raw) return "기타";
  return CATEGORY_LABEL_MAP[raw.toUpperCase()] ?? raw;
}

// ── 카테고리 아이콘 ───────────────────────────────────────
function CategoryIcon({ category }: { category: string }) {
  const label = getCategoryLabel(category);
  if (label === "시약") return <FlaskConical className="h-3.5 w-3.5 text-blue-400" />;
  if (label === "장비") return <Package className="h-3.5 w-3.5 text-emerald-400" />;
  if (label === "소모품") return <ShoppingCart className="h-3.5 w-3.5 text-amber-400" />;
  return <Package className="h-3.5 w-3.5 text-slate-400" />;
}

// ── Top 품목 집계 (동일 품목 그루핑) ──────────────────────
function aggregateTopItems(items: TopSpendingItem[]): AggregatedItem[] {
  const map: Record<string, AggregatedItem> = {};
  for (const it of items) {
    const key = it.item || "미등록";
    if (!map[key]) {
      map[key] = { item: key, vendor: it.vendor, category: getCategoryLabel(it.category), totalAmount: 0, count: 0, latestDate: it.date };
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

// ── 벤더별 집계 ────────────────────────────────────────────
function aggregateByVendor(items: TopSpendingItem[]): { vendor: string; totalAmount: number; count: number; pct: number }[] {
  const map: Record<string, { vendor: string; totalAmount: number; count: number }> = {};
  for (const it of items) {
    const key = it.vendor || "미등록";
    if (!map[key]) map[key] = { vendor: key, totalAmount: 0, count: 0 };
    map[key].totalAmount += it.amount || 0;
    map[key].count += 1;
  }
  const sorted = Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  const total = sorted.reduce((s, v) => s + v.totalAmount, 0);
  return sorted.map((v) => ({ ...v, pct: total > 0 ? Math.round((v.totalAmount / total) * 100) : 0 }));
}

// ── 카테고리별 집계 ──────────────────────────────────────────
function aggregateByCategory(items: TopSpendingItem[]): { category: string; totalAmount: number; count: number; pct: number }[] {
  const map: Record<string, { category: string; totalAmount: number; count: number }> = {};
  for (const it of items) {
    const key = getCategoryLabel(it.category) || "기타";
    if (!map[key]) map[key] = { category: key, totalAmount: 0, count: 0 };
    map[key].totalAmount += it.amount || 0;
    map[key].count += 1;
  }
  const sorted = Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  const total = sorted.reduce((s, c) => s + c.totalAmount, 0);
  return sorted.map((c) => ({ ...c, pct: total > 0 ? Math.round((c.totalAmount / total) * 100) : 0 }));
}

// ── 보기 전환 타입 ──────────────────────────────────────────
type AnalyticsView = "overview" | "team";

// ── 메인 페이지 ──────────────────────────────────────────
export default function AnalyticsPage() {
  const [currentView, setCurrentView] = useState<AnalyticsView>("overview");
  const [chartsOpen, setChartsOpen] = useState(false);

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

  // 이번 달 / 전월 지출
  const validMonths = monthlySpending.filter((m) => m.amount > 0);
  const currentMonth = validMonths[validMonths.length - 1] ?? null;
  const prevMonth = validMonths[validMonths.length - 2] ?? null;
  const monthChange = currentMonth && prevMonth && prevMonth.amount > 0
    ? Math.round(((currentMonth.amount - prevMonth.amount) / prevMonth.amount) * 100)
    : null;

  // 벤더별 집계
  const vendorItems = aggregateByVendor(topSpending);
  const topVendor = vendorItems[0] ?? null;
  const vendorTotal = vendorItems.reduce((s, v) => s + v.totalAmount, 0);
  const vendorConcentration = topVendor && vendorTotal > 0 ? Math.round((topVendor.totalAmount / vendorTotal) * 100) : 0;

  // 카테고리별 집계
  const categoryItems = aggregateByCategory(topSpending);

  // 품목 집계
  const aggregatedItems = aggregateTopItems(topSpending);
  const repeatItems = aggregatedItems.filter((i) => i.count > 1);

  // 예산 상태 판정
  const budgetStatus: "danger" | "warning" | "safe" =
    budget.usageRate >= 90 ? "danger" : budget.usageRate >= 75 ? "warning" : "safe";
  const budgetStatusColor = budgetStatus === "danger" ? "text-red-400" : budgetStatus === "warning" ? "text-amber-400" : "text-emerald-400";
  const budgetBarColor = budgetStatus === "danger" ? "bg-red-400" : budgetStatus === "warning" ? "bg-amber-400" : "bg-emerald-400";

  // 승인 대기 금액 (추후 API 연동 시 교체)
  const pendingApprovalAmount = Math.round(budget.used * 0.08);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 페이지 헤더 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
            지출 통제 콘솔
          </h2>
          <p className="text-sm text-slate-400 mt-0.5 hidden sm:block">
            {currentView === "team"
              ? "팀별 예산 집행 상태와 위험 신호를 확인하세요."
              : "예산 운영 현황과 지출 위험 신호를 모니터링합니다."}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5 flex-shrink-0">
          <button
            onClick={() => setCurrentView("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              currentView === "overview"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            전체 현황
          </button>
          <button
            onClick={() => setCurrentView("team")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              currentView === "team"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            팀별 분석
          </button>
        </div>
      </div>

      {/* 오류 상태 */}
      {isError && (
        <div className="rounded border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* ══ 팀별 보기 ══ */}
      {currentView === "team" && <TeamAnalyticsView />}

      {/* ══ 전체 현황 (Spending Control Console) ══ */}
      {currentView === "overview" && (<>

        {/* ═══════════════════════════════════════════════════
            TOP: 지출 현황 요약 Strip (5 KPI)
           ═══════════════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">지출 현황 요약</p>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-md border border-slate-800 bg-slate-900 p-4 space-y-2">
                  <Skeleton className="h-3 w-20 bg-slate-800" />
                  <Skeleton className="h-6 w-28 bg-slate-800" />
                  <Skeleton className="h-2 w-full bg-slate-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

              {/* 예산 소진율 */}
              <div className={`rounded-md border p-4 ${
                budgetStatus === "danger" ? "border-red-900/60 bg-red-950/10" :
                budgetStatus === "warning" ? "border-amber-900/60 bg-amber-950/10" :
                "border-slate-800 bg-slate-900"
              }`}>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">예산 소진율</p>
                <div className={`text-xl font-bold ${budgetStatusColor}`}>
                  {budget.total > 0 ? `${budget.usageRate}%` : "미등록"}
                </div>
                {budget.total > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${budgetBarColor}`}
                        style={{ width: `${Math.min(100, budget.usageRate)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {budgetStatus === "danger" ? "즉시 검토 필요" : budgetStatus === "warning" ? "주의 구간" : "정상 운영"}
                    </p>
                  </div>
                )}
              </div>

              {/* 승인 대기 금액 */}
              <Link href="/dashboard/purchases" className="block group">
                <div className="rounded-md border border-slate-800 bg-slate-900 p-4 h-full group-hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">승인 대기 금액</p>
                    <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                  <div className="text-xl font-bold text-amber-400">
                    {pendingApprovalAmount > 0 ? `₩${pendingApprovalAmount.toLocaleString("ko-KR")}` : "₩0"}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">클릭하여 구매내역 확인</p>
                </div>
              </Link>

              {/* 이번 달 지출 총액 */}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">이번 달 지출</p>
                <div className="text-xl font-bold text-slate-100">
                  {currentMonth ? `₩${currentMonth.amount.toLocaleString("ko-KR")}` : "₩0"}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {currentMonth ? `${currentMonth.month} 기준` : "데이터 없음"}
                </p>
              </div>

              {/* 전월 대비 변동 */}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">전월 대비</p>
                <div className="flex items-center gap-1.5">
                  {monthChange !== null && monthChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-400" />
                  ) : monthChange !== null && monthChange < 0 ? (
                    <TrendingDown className="h-4 w-4 text-emerald-400" />
                  ) : null}
                  <span className={`text-xl font-bold ${
                    monthChange !== null ? (monthChange > 0 ? "text-red-400" : "text-emerald-400") : "text-slate-400"
                  }`}>
                    {monthChange !== null ? `${monthChange > 0 ? "+" : ""}${monthChange}%` : "--"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {monthChange !== null && monthChange > 20 ? "급증 주의" : monthChange !== null && monthChange < -10 ? "절감 추세" : "변동폭 정상"}
                </p>
              </div>

              {/* 잔여 예산 */}
              <div className={`rounded-md border p-4 ${
                budgetStatus === "danger" ? "border-red-900/60 bg-red-950/10" : "border-slate-800 bg-slate-900"
              }`}>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">잔여 예산</p>
                <div className={`text-xl font-bold ${budget.remaining <= 0 && budget.total > 0 ? "text-red-400" : "text-slate-100"}`}>
                  {budget.total > 0 ? `₩${budget.remaining.toLocaleString("ko-KR")}` : "미등록"}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {budget.total > 0
                    ? (() => {
                        const monthsLeft = 12 - (new Date().getMonth() + 1);
                        if (monthsLeft > 0 && budget.remaining > 0) {
                          return `월 ₩${Math.round(budget.remaining / monthsLeft).toLocaleString("ko-KR")} 집행 가능`;
                        }
                        return budget.remaining <= 0 ? "예산 소진" : "연말 마감";
                      })()
                    : "예산 등록 필요"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            MIDDLE: 운영 인사이트 Panels (2x2 grid)
           ═══════════════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">운영 인사이트</p>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-slate-800 bg-slate-900 p-5 space-y-3">
                  <Skeleton className="h-4 w-32 bg-slate-800" />
                  <Skeleton className="h-20 w-full bg-slate-800" />
                  <Skeleton className="h-8 w-24 bg-slate-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

              {/* Panel 1: 카테고리별 초과 위험 */}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-200">카테고리별 초과 위험</h3>
                  </div>
                  {categoryItems.length > 0 && (
                    <Badge className="text-[10px] px-1.5 py-0.5 border-0 bg-slate-800 text-slate-400 font-medium">
                      {categoryItems.length}개 카테고리
                    </Badge>
                  )}
                </div>

                {categoryItems.length > 0 ? (
                  <div className="space-y-2.5">
                    {categoryItems.slice(0, 5).map((cat) => {
                      const catBudget = budget.total > 0 ? Math.round(budget.total * (cat.pct / 100)) : 0;
                      const catUsage = catBudget > 0 ? Math.round((cat.totalAmount / catBudget) * 100) : 0;
                      const riskLevel: "danger" | "warning" | "safe" =
                        catUsage >= 90 ? "danger" : catUsage >= 70 ? "warning" : "safe";
                      const dotColor = riskLevel === "danger" ? "bg-red-400" : riskLevel === "warning" ? "bg-amber-400" : "bg-emerald-400";

                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CategoryIcon category={cat.category} />
                                <span className="text-sm text-slate-300">{cat.category}</span>
                              </div>
                              <span className="text-xs text-slate-400">₩{cat.totalAmount.toLocaleString("ko-KR")}</span>
                            </div>
                            <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${dotColor}`}
                                style={{ width: `${Math.min(100, cat.pct)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${
                            riskLevel === "danger" ? "text-red-400" : riskLevel === "warning" ? "text-amber-400" : "text-slate-500"
                          }`}>
                            {cat.pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-4">카테고리 데이터가 아직 없습니다.</p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <Link href="/dashboard/budget" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    예산 검토 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 2: 공급사 집중도 */}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-200">공급사 집중도</h3>
                  </div>
                  {vendorConcentration > 50 && (
                    <Badge className="text-[10px] px-1.5 py-0.5 border-0 bg-amber-950/30 text-amber-400 font-semibold">
                      집중 위험
                    </Badge>
                  )}
                </div>

                {vendorItems.length > 0 ? (
                  <div className="space-y-2">
                    {vendorItems.slice(0, 5).map((v, idx) => {
                      const isConcentrated = v.pct > 50;
                      return (
                        <div key={v.vendor} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-600 w-4 text-right flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm truncate ${isConcentrated ? "text-amber-300" : "text-slate-300"}`}>
                                {v.vendor}
                              </span>
                              <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                ₩{v.totalAmount.toLocaleString("ko-KR")}
                              </span>
                            </div>
                            <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isConcentrated ? "bg-amber-400" : "bg-blue-400"}`}
                                style={{ width: `${Math.min(100, v.pct)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${isConcentrated ? "text-amber-400" : "text-slate-500"}`}>
                            {v.pct}%
                          </span>
                        </div>
                      );
                    })}
                    {vendorConcentration > 50 && (
                      <p className="text-[11px] text-amber-400/80 mt-2 pl-7">
                        상위 1개 공급사가 전체 지출의 {vendorConcentration}%를 차지합니다. 분산 검토를 권장합니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-4">공급사 데이터가 아직 없습니다.</p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <Link href="/dashboard/analytics" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    공급사 분석 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 3: 이상 지출 탐지 */}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-200">이상 지출 탐지</h3>
                  </div>
                </div>

                {(() => {
                  const anomalies: { item: string; vendor: string; avgAmount: number; count: number; reason: string }[] = [];

                  for (const item of repeatItems.slice(0, 3)) {
                    const avgPerPurchase = Math.round(item.totalAmount / item.count);
                    anomalies.push({
                      item: item.item,
                      vendor: item.vendor,
                      avgAmount: avgPerPurchase,
                      count: item.count,
                      reason: `${item.count}회 반복, 건당 평균 ₩${avgPerPurchase.toLocaleString("ko-KR")}`,
                    });
                  }

                  const highSpend = aggregatedItems.filter((i) => i.count === 1 && i.totalAmount > (budget.used * 0.1 || 500000));
                  for (const item of highSpend.slice(0, 2)) {
                    anomalies.push({
                      item: item.item,
                      vendor: item.vendor,
                      avgAmount: item.totalAmount,
                      count: 1,
                      reason: `단일 건 ₩${item.totalAmount.toLocaleString("ko-KR")} — 고액 지출`,
                    });
                  }

                  if (anomalies.length === 0) {
                    return <p className="text-sm text-slate-500 py-4">현재 이상 패턴이 감지되지 않았습니다.</p>;
                  }

                  return (
                    <div className="space-y-2.5">
                      {anomalies.slice(0, 4).map((a, i) => (
                        <div key={i} className="rounded bg-slate-800/50 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 truncate">{a.item}</p>
                              <p className="text-[11px] text-slate-500">{a.vendor}</p>
                            </div>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          </div>
                          <p className="text-[11px] text-amber-400/80 mt-1">{a.reason}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <Link href="/dashboard/purchases" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    구매내역 보기 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 4: 재주문 예상 항목 */}
              <div className="rounded-md border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-200">재주문 예상 항목</h3>
                  </div>
                </div>

                {(() => {
                  const reorderCandidates = repeatItems
                    .map((item) => {
                      const lastDate = new Date(item.latestDate);
                      const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                      return { ...item, daysSinceLast };
                    })
                    .filter((item) => item.daysSinceLast >= 14)
                    .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
                    .slice(0, 4);

                  if (reorderCandidates.length === 0 && repeatItems.length > 0) {
                    return (
                      <div className="space-y-2.5">
                        <p className="text-sm text-slate-500 py-2">반복 구매 품목 모두 최근 주문 완료</p>
                        {repeatItems.slice(0, 3).map((item, i) => (
                          <div key={i} className="flex items-center gap-3 rounded bg-slate-800/50 px-3 py-2">
                            <CategoryIcon category={item.category} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-300 truncate">{item.item}</p>
                              <p className="text-[10px] text-slate-500">{item.count}회 구매 | {item.vendor}</p>
                            </div>
                            <Clock className="h-3 w-3 text-slate-600" />
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (reorderCandidates.length === 0) {
                    return <p className="text-sm text-slate-500 py-4">반복 구매 데이터가 쌓이면 예측이 시작됩니다.</p>;
                  }

                  return (
                    <div className="space-y-2.5">
                      {reorderCandidates.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 rounded bg-slate-800/50 px-3 py-2">
                          <CategoryIcon category={item.category} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 truncate">{item.item}</p>
                            <p className="text-[10px] text-slate-500">
                              마지막 주문 {item.daysSinceLast}일 전 | {item.count}회 반복
                            </p>
                          </div>
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${
                            item.daysSinceLast >= 60 ? "text-red-400" : item.daysSinceLast >= 30 ? "text-amber-400" : "text-slate-500"
                          }`}>
                            {item.daysSinceLast}d
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <Link href="/test/compare" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    비교 재진입 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            BOTTOM: 상세 분석 (Collapsible)
           ═══════════════════════════════════════════════════ */}
        <div className="rounded-md border border-slate-800 bg-slate-900">
          <button
            onClick={() => setChartsOpen(!chartsOpen)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">상세 분석</p>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${chartsOpen ? "rotate-180" : ""}`} />
          </button>

          {chartsOpen && (
            <div className="px-5 pb-5 space-y-4">
              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded bg-slate-800 p-4 space-y-2">
                      <Skeleton className="h-4 w-28 bg-slate-700" />
                      <Skeleton className="h-[180px] w-full bg-slate-700 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* 월별 지출 바 차트 */}
                  <div className="rounded bg-slate-800/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-slate-400">월별 지출 변화</h4>
                      <Link href="/dashboard/purchases">
                        <span className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1">
                          상세 <ChevronRight className="h-3 w-3" />
                        </span>
                      </Link>
                    </div>
                    {hasMonthlyData ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={monthlySpending} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis
                            dataKey="month"
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            axisLine={false} tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#64748b", fontSize: 10 }}
                            axisLine={false} tickLine={false}
                            tickFormatter={(v: number) =>
                              v >= 1000000 ? `${(v / 1000000).toFixed(0)}M`
                                : v >= 1000 ? `${(v / 1000).toFixed(0)}K`
                                : String(v)
                            }
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: "4px", border: "1px solid #334155", backgroundColor: "#1e293b", color: "#e2e8f0" }}
                            formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                          />
                          <Bar dataKey="amount" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[180px] text-slate-600">
                        <p className="text-sm">데이터 없음</p>
                      </div>
                    )}
                  </div>

                  {/* 카테고리 파이 차트 */}
                  <div className="rounded bg-slate-800/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-slate-400">카테고리별 비중</h4>
                      <Link href="/dashboard/budget">
                        <span className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1">
                          예산 검토 <ChevronRight className="h-3 w-3" />
                        </span>
                      </Link>
                    </div>
                    {hasCategoryData ? (
                      <>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie
                              data={categorySpending}
                              cx="50%" cy="50%"
                              labelLine={false}
                              label={({ name, percent }: { name: string; percent: number }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                              outerRadius={65}
                              dataKey="value"
                              strokeWidth={1}
                              stroke="#0f172a"
                            >
                              {categorySpending.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: "4px", border: "1px solid #334155", backgroundColor: "#1e293b", color: "#e2e8f0" }}
                              formatter={(value: number, name: string, item: { payload?: CategoryPoint }) => [
                                `₩${(item.payload?.amount ?? value).toLocaleString("ko-KR")}`,
                                `${name} (${item.payload?.value ?? value}%)`,
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-2 space-y-1">
                          {categorySpending.slice(0, 5).map((cat, index) => (
                            <div key={cat.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                                />
                                <span className="text-[11px] text-slate-400">{cat.name}</span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                ₩{cat.amount.toLocaleString("ko-KR")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-[180px] text-slate-600">
                        <p className="text-sm">데이터 없음</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ 빠른 이동 ══ */}
        <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">빠른 이동</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link href="/dashboard/purchases">
              <button className="w-full h-9 flex items-center justify-start gap-2 rounded border border-slate-800 bg-slate-800/50 hover:bg-slate-800 px-3 text-xs font-medium text-slate-300 transition-colors">
                <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
                구매내역 보기
              </button>
            </Link>
            <Link href="/dashboard/budget">
              <button className="w-full h-9 flex items-center justify-start gap-2 rounded border border-slate-800 bg-slate-800/50 hover:bg-slate-800 px-3 text-xs font-medium text-slate-300 transition-colors">
                <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                예산 검토
              </button>
            </Link>
            <Link href="/dashboard/analytics">
              <button className="w-full h-9 flex items-center justify-start gap-2 rounded border border-slate-800 bg-slate-800/50 hover:bg-slate-800 px-3 text-xs font-medium text-slate-300 transition-colors">
                <Store className="h-3.5 w-3.5 text-slate-500" />
                공급사 분석
              </button>
            </Link>
            <Link href="/test/compare">
              <button className="w-full h-9 flex items-center justify-start gap-2 rounded border border-slate-800 bg-slate-800/50 hover:bg-slate-800 px-3 text-xs font-medium text-slate-300 transition-colors">
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                비교 재진입
              </button>
            </Link>
          </div>
        </div>

      </>)}
    </div>
  );
}

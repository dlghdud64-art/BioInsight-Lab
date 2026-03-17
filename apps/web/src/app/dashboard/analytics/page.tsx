"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
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
  Lightbulb, CreditCard, Store, Users, PieChart as PieChartIcon,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

// ── 카테고리 라벨 매핑 (raw EN → 사용자 언어) ────────────
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
  if (label === "시약") return <FlaskConical className="h-3.5 w-3.5 text-blue-500" />;
  if (label === "장비") return <Package className="h-3.5 w-3.5 text-emerald-500" />;
  if (label === "소모품") return <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />;
  return <Package className="h-3.5 w-3.5 text-slate-400" />;
}

// ── 예산 상태 헬퍼 ──────────────────────────────────────
function getUsageStatus(rate: number) {
  if (rate >= 90) return { level: "경고", barColor: "bg-red-500", textColor: "text-red-400" };
  if (rate >= 75) return { level: "주의", barColor: "bg-amber-500", textColor: "text-amber-400" };
  return { level: "정상", barColor: "bg-blue-500", textColor: "text-emerald-400" };
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
      insights.push({ icon: AlertTriangle, color: "text-red-400", text: `예산의 ${budget.usageRate}%를 집행했습니다. 추가 구매 전 예산 검토가 필요합니다.` });
    } else if (budget.usageRate >= 75) {
      insights.push({ icon: AlertTriangle, color: "text-amber-400", text: `예산의 ${budget.usageRate}%를 집행했습니다. 잔여 예산 운영 계획을 점검하세요.` });
    } else {
      insights.push({ icon: CheckCircle2, color: "text-emerald-400", text: `이번 연도 예산의 ${budget.usageRate}%를 집행 중입니다. 현재 운영 속도는 안정적입니다.` });
    }
  }

  // 카테고리 집중 인사이트
  if (categorySpending.length > 0) {
    const top = categorySpending[0];
    insights.push({ icon: Info, color: "text-blue-400", text: `주요 지출은 '${top.name}' 카테고리에 집중되어 있으며, 전체의 ${top.value}%를 차지합니다.` });
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
      const color = change > 0 ? "text-amber-400" : "text-emerald-400";
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
        <Card key={i} className="rounded-xl border-slate-800/60 shadow-none">
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
        <Card key={i} className="rounded-xl border-slate-800/60 shadow-none">
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
// ── 보기 전환 타입 ──────────────────────────────────────────
type AnalyticsView = "overview" | "team" | "category" | "vendor";

const VIEW_OPTIONS: { key: AnalyticsView; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "전체", shortLabel: "전체", icon: BarChart2 },
  { key: "team", label: "팀별", shortLabel: "팀별", icon: Users },
  { key: "category", label: "카테고리별", shortLabel: "카테고리", icon: PieChartIcon },
  { key: "vendor", label: "벤더별", shortLabel: "벤더", icon: Store },
];

export default function AnalyticsPage() {
  const [currentView, setCurrentView] = useState<AnalyticsView>("overview");
  const [tableTab, setTableTab] = useState<"top" | "repeat" | "vendor">("top");

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
  const vendorItems = aggregateByVendor(topSpending);
  const categoryItems = aggregateByCategory(topSpending);
  const repeatItems = aggregatedItems.filter((i) => i.count > 1);

  // 이번 달 / 전월 지출
  const validMonths = monthlySpending.filter((m) => m.amount > 0);
  const currentMonth = validMonths[validMonths.length - 1] ?? null;
  const prevMonth = validMonths[validMonths.length - 2] ?? null;
  const monthChange = currentMonth && prevMonth && prevMonth.amount > 0
    ? Math.round(((currentMonth.amount - prevMonth.amount) / prevMonth.amount) * 100)
    : null;

  // 벤더 집중도 계산
  const topVendor = vendorItems[0] ?? null;
  const vendorTotal = vendorItems.reduce((s, v) => s + v.totalAmount, 0);
  const vendorConcentration = topVendor && vendorTotal > 0 ? Math.round((topVendor.totalAmount / vendorTotal) * 100) : 0;

  // 벤더 파이 데이터 (top 5 + 기타)
  const vendorPieData = (() => {
    const top5 = vendorItems.slice(0, 5);
    const rest = vendorItems.slice(5);
    const restTotal = rest.reduce((s, v) => s + v.totalAmount, 0);
    const result = top5.map((v) => ({ name: v.vendor, value: v.pct, amount: v.totalAmount }));
    if (restTotal > 0) {
      const restPct = vendorTotal > 0 ? Math.round((restTotal / vendorTotal) * 100) : 0;
      result.push({ name: "기타", value: restPct, amount: restTotal });
    }
    return result;
  })();

  // 활성 카테고리 수
  const activeCategoryCount = categoryItems.filter((c) => c.totalAmount > 0).length;

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 1. 페이지 헤더 + 빠른 액션 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
            지출 분석
          </h2>
          <p className="text-sm text-slate-400 mt-0.5 hidden sm:block">
            {currentView === "team"
              ? "팀별 예산 집행 상태와 위험 신호를 확인하세요."
              : "지출 패턴과 예산 운영 상태를 분석하고 의사결정에 활용하세요."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/dashboard/purchases">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              <ShoppingCart className="h-3.5 w-3.5" />
              구매 내역 보기
            </Button>
          </Link>
          <Link href="/dashboard/budget">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 font-medium">
              <CreditCard className="h-3.5 w-3.5" />
              예산 관리 보기
            </Button>
          </Link>
        </div>
      </div>

      {/* ══ 보기 전환 ══ */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 w-fit overflow-x-auto">
        {VIEW_OPTIONS.map(({ key, label, shortLabel, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setCurrentView(key);
              if (key === "vendor") setTableTab("vendor");
              else if (key === "category") setTableTab("top");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              currentView === key
                ? "bg-slate-700 text-slate-100 shadow-none"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        ))}
      </div>

      {/* 오류 상태 */}
      {isError && (
        <div className="rounded-lg border border-red-800 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* ══ 팀별 보기 ══ */}
      {currentView === "team" && <TeamAnalyticsView />}

      {/* ══ 전체 / 카테고리 / 벤더 보기 (공통 Fixed Area) ══ */}
      {currentView !== "team" && (<>

      {/* ══ 2. Global KPI Strip (3-card) ══ */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-slate-800/60 bg-[#161d2f] p-4 shadow-none space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {/* 총 구매액 */}
          <div className="rounded-xl border border-slate-800/60 bg-[#161d2f] border-slate-800/50 p-4 shadow-none">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">총 구매액</span>
            </div>
            <div className="text-lg font-bold text-slate-100">
              ₩{budget.used.toLocaleString("ko-KR")}
            </div>
            <p className="text-xs text-slate-400 mt-1">올해 누적 지출</p>
          </div>

          {/* 예산 사용률 */}
          <div className={`rounded-xl border p-4 shadow-none ${
            budget.usageRate >= 90
              ? "border-red-800/60 bg-red-950/10 border-red-900/30"
              : budget.usageRate >= 75
                ? "border-amber-800/60 bg-amber-950/10 border-amber-900/30"
                : "border-slate-800/60 bg-[#161d2f] border-slate-800/50"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">예산 사용률</span>
            </div>
            <div className={`text-lg font-bold ${budget.usageRate >= 90 ? "text-red-400" : budget.usageRate >= 75 ? "text-amber-400" : "text-slate-100"}`}>
              {budget.total > 0 ? `${budget.usageRate}%` : "미등록"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {budget.total > 0 ? `잔여 ₩${budget.remaining.toLocaleString("ko-KR")}` : "예산 등록 필요"}
            </p>
          </div>

          {/* 전월 대비 증감률 */}
          <div className="rounded-xl border border-slate-800/60 bg-[#161d2f] border-slate-800/50 p-4 shadow-none">
            <div className="flex items-center gap-2 mb-2">
              {monthChange !== null && monthChange > 0
                ? <TrendingUp className="h-4 w-4 text-amber-500 flex-shrink-0" />
                : <TrendingDown className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              }
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">전월 대비</span>
            </div>
            <div className={`text-lg font-bold ${monthChange !== null ? (monthChange > 0 ? "text-amber-400" : "text-emerald-400") : "text-slate-100"}`}>
              {monthChange !== null ? `${monthChange > 0 ? "+" : ""}${monthChange}%` : "—"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {currentMonth ? `${currentMonth.month} 기준` : "비교 데이터 없음"}
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           Tab-specific Analysis Panels
         ══════════════════════════════════════════════════════════ */}

      {/* ══ OVERVIEW 패널 ══ */}
      {currentView === "overview" && (<>

        {/* ── 인사이트 텍스트 카드 ── */}
        {!isLoading && insights.length > 0 && (
          <Card className="rounded-xl border-blue-900/30 bg-blue-950/20/40 bg-blue-950/10 shadow-none">
            <CardHeader className="pb-2 p-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <CardTitle className="text-sm font-semibold text-slate-200">패턴 분석 요약</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ul className="space-y-2">
                {insights.map((insight, i) => {
                  const Icon = insight.icon;
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${insight.color}`} />
                      <span className="text-sm text-slate-300 leading-snug">{insight.text}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ── KPI 카드 — 숫자 + 해석 ── */}
        {isLoading ? <KPISkeleton /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 총 예산 */}
            <Card className="overflow-hidden rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">총 예산</CardTitle>
                <div className="rounded-full p-1.5 bg-slate-800 flex-shrink-0">
                  <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {budget.total > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-slate-100 break-words">
                      ₩{budget.total.toLocaleString("ko-KR")}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-snug">
                      올해 등록된 연간 운영 예산
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-semibold text-slate-400 text-slate-500 mt-1">미등록</div>
                    <p className="text-xs text-slate-400 text-slate-500 mt-1.5">
                      예산 관리에서 등록 후 확인 가능합니다
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 현재 사용액 */}
            <Card className="overflow-hidden rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">현재 사용액</CardTitle>
                <div className={`rounded-full p-1.5 flex-shrink-0 ${budget.usageRate >= 75 ? "bg-amber-950/30" : "bg-blue-950/30"}`}>
                  <TrendingUp className={`h-3.5 w-3.5 ${budget.usageRate >= 75 ? "text-amber-400" : "text-blue-400"}`} />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-slate-100 break-words">
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
                    <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
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
            <Card className={`overflow-hidden rounded-xl shadow-none ${budget.usageRate >= 90 ? "border-red-800/60 border-red-900/30 bg-red-950/30/20 bg-red-950/10" : "border-slate-800/60 border-slate-800/50 bg-[#161d2f]"}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className={`text-xs font-semibold uppercase tracking-wider${budget.usageRate >= 90 ? "text-red-400" : "text-slate-400"}`}>
                  잔액
                </CardTitle>
                <div className={`rounded-full p-1.5 flex-shrink-0 ${budget.usageRate >= 90 ? "bg-red-950/40" : "bg-emerald-950/30"}`}>
                  <TrendingDown className={`h-3.5 w-3.5 ${budget.usageRate >= 90 ? "text-red-400" : "text-emerald-400"}`} />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {budget.total > 0 ? (
                  <>
                    <div className={`text-2xl font-bold break-words${budget.usageRate >= 90 ? "text-red-400" : "text-slate-100"}`}>
                      ₩{budget.remaining.toLocaleString("ko-KR")}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-snug">
                      {getRemainingInsight(budget.usageRate, budget.remaining)}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-semibold text-slate-400 text-slate-500 mt-1">—</div>
                    <p className="text-xs text-slate-400 text-slate-500 mt-1.5">예산 등록 후 확인 가능합니다</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 차트 분석 ── */}
        {isLoading ? <ChartSkeleton /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* 월별 지출 추이 */}
            <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-slate-200">월별 지출 변화</CardTitle>
                  <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">
                    {peakMonth
                      ? `최고 지출월: ${peakMonth.month} (₩${peakMonth.amount.toLocaleString("ko-KR")})`
                      : "최근 6개월 지출 추이 분석"}
                  </p>
                </div>
                <Link href="/dashboard/analytics/monthly" className="flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-blue-400 gap-0.5">
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
            <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-slate-200">카테고리별 예산 사용</CardTitle>
                  <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">
                    {topCat ? `${topCat.name}이(가) 전체의 ${topCat.value}%를 차지` : "시약 · 장비 · 소모품 예산 배분"}
                  </p>
                </div>
                <Link href="/dashboard/analytics/category" className="flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-blue-400 gap-0.5">
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
                    <div className="mt-3 space-y-1.5 border-t border-slate-800/40 pt-3">
                      {categorySpending.map((cat, index) => (
                        <div key={cat.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                            />
                            <span className="text-xs text-slate-400">{cat.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-slate-800 text-slate-400 border-0">
                              {cat.value}%
                            </Badge>
                          </div>
                          <span className="text-xs font-semibold text-slate-300">
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

        {/* ── 분석 테이블 (탭: 고액 TOP 10 / 반복 TOP 10 / 벤더 요약) ── */}
        <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
          <CardHeader className="p-4 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-200">지출 패턴 분석</CardTitle>
                <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">
                  고액 구매 · 반복 구매 · 벤더별 지출 패턴
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 flex-shrink-0">
                {(["top", "repeat", "vendor"] as const).map((tab) => {
                  const labels = { top: "고액 TOP 10", repeat: "반복 TOP 10", vendor: "벤더 요약" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setTableTab(tab)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors${
                        tableTab === tab
                          ? "bg-slate-700 text-slate-100 shadow-none"
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {labels[tab]}
                      {tab === "repeat" && repeatItems.length > 0 && (
                        <span className="ml-1 text-[10px] text-blue-400 font-bold">{repeatItems.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3">
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
            ) : tableTab === "vendor" ? (
              /* ── 벤더별 탭 ── */
              <div className="overflow-x-auto">
                <Table className="min-w-[400px]">
                  <TableHeader>
                    <TableRow className="border-slate-800/50">
                      <TableHead className="w-8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">벤더명</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">주문 건수</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">지출 합계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorItems.slice(0, 10).map((v, index) => (
                      <TableRow key={v.vendor} className="border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <TableCell className="py-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-[11px] font-bold text-slate-400">
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Store className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="font-medium text-slate-200 text-sm">{v.vendor}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-slate-800 text-slate-400 border-0">
                            {v.count}건
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="font-semibold text-slate-200">
                            ₩{v.totalAmount.toLocaleString("ko-KR")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* ── 고지출 / 반복구매 탭 ── */
              <div className="overflow-x-auto">
                <Table className="min-w-[540px]">
                  <TableHeader>
                    <TableRow className="border-slate-800/50">
                      <TableHead className="w-8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">품목명</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">벤더</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">분류</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">지출 합계</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">구매 횟수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tableTab === "repeat" ? repeatItems : aggregatedItems).slice(0, 10).map((item, index) => (
                      <TableRow key={item.item} className="border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <TableCell className="py-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-[11px] font-bold text-slate-400">
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 font-medium text-slate-200 max-w-[160px]">
                          <span className="truncate block">{item.item || "품목명 미등록"}</span>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-slate-400">
                          {item.vendor || "—"}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <CategoryIcon category={item.category} />
                            <span className="text-xs text-slate-400">{item.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="font-semibold text-slate-200">
                            ₩{item.totalAmount.toLocaleString("ko-KR")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          {item.count > 1 ? (
                            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-blue-950/30 text-blue-400 border-0 font-semibold">
                              {item.count}회
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 text-slate-500">1회</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {tableTab === "repeat" && repeatItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-400">
                          반복 구매 품목이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </>)}

      {/* ══ CATEGORY 패널 ══ */}
      {currentView === "category" && (<>

        {/* ── 카테고리 인사이트 요약 ── */}
        {!isLoading && (
          <Card className="rounded-xl border-blue-900/30 bg-blue-950/20/40 bg-blue-950/10 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <PieChartIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm text-blue-300 leading-snug">
                  {topCat
                    ? `'${topCat.name}' 카테고리가 전체 지출의 ${topCat.value}%를 차지합니다.`
                    : "카테고리별 지출 데이터가 아직 없습니다."}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 보조 카드 (2-column) ── */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 주요 카테고리 */}
            <div className="rounded-xl border border-slate-800/60 bg-[#161d2f] border-slate-800/50 p-4 shadow-none">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">주요 카테고리</span>
              </div>
              <div className="text-lg font-bold text-slate-100">
                {topCat ? topCat.name : "—"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {topCat ? `전체 지출의 ${topCat.value}%` : "데이터 없음"}
              </p>
            </div>

            {/* 활성 카테고리 */}
            <div className="rounded-xl border border-slate-800/60 bg-[#161d2f] border-slate-800/50 p-4 shadow-none">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">활성 카테고리</span>
              </div>
              <div className="text-lg font-bold text-slate-100">
                {activeCategoryCount}개
              </div>
              <p className="text-xs text-slate-400 mt-1">지출이 있는 카테고리 수</p>
            </div>
          </div>
        )}

        {/* ── 차트 (2-column) ── */}
        {isLoading ? <ChartSkeleton /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* 카테고리 점유율 (Pie) */}
            <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold text-slate-200">카테고리 점유율</CardTitle>
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
                            <Cell key={`cell-cat-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
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
                    <div className="mt-3 space-y-1.5 border-t border-slate-800/40 pt-3">
                      {categorySpending.map((cat, index) => (
                        <div key={cat.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                            />
                            <span className="text-xs text-slate-400">{cat.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-slate-800 text-slate-400 border-0">
                              {cat.value}%
                            </Badge>
                          </div>
                          <span className="text-xs font-semibold text-slate-300">
                            ₩{cat.amount.toLocaleString("ko-KR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyChart message="아직 카테고리 데이터가 없습니다." />
                )}
              </CardContent>
            </Card>

            {/* 카테고리별 지출 규모 (Horizontal Bar) */}
            <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold text-slate-200">카테고리별 지출 규모</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {hasCategoryData ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categorySpending} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000000 ? `${(v / 1000000).toFixed(0)}M`
                            : v >= 1000 ? `${(v / 1000).toFixed(0)}K`
                            : String(v)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                        formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                        {categorySpending.map((_, index) => (
                          <Cell key={`bar-cat-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="아직 카테고리 데이터가 없습니다." />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 카테고리 TOP 랭킹 테이블 ── */}
        <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
          <CardHeader className="p-4 pb-0">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-200">카테고리 TOP 랭킹</CardTitle>
              <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">
                카테고리별 지출 합계 및 비중
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : categoryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                <Package className="h-8 w-8 opacity-25" />
                <p className="text-sm">아직 카테고리 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow className="border-slate-800/50">
                      <TableHead className="w-8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">카테고리명</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">지출 합계</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">비중(%)</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">건수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems.map((c, index) => (
                      <TableRow key={c.category} className="border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <TableCell className="py-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-[11px] font-bold text-slate-400">
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <CategoryIcon category={c.category} />
                            <span className="font-medium text-slate-200 text-sm">{c.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="font-semibold text-slate-200">
                            ₩{c.totalAmount.toLocaleString("ko-KR")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-blue-950/30 text-blue-400 border-0 font-semibold">
                            {c.pct}%
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-slate-800 text-slate-400 border-0">
                            {c.count}건
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </>)}

      {/* ══ VENDOR 패널 ══ */}
      {currentView === "vendor" && (<>

        {/* ── 벤더 인사이트 요약 ── */}
        {!isLoading && (
          <Card className="rounded-xl border-blue-900/30 bg-blue-950/20/40 bg-blue-950/10 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <Store className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm text-blue-300 leading-snug">
                  {topVendor
                    ? `'${topVendor.vendor}' 벤더 지출 집중도가 가장 높습니다. (${vendorConcentration}%)`
                    : "벤더별 지출 데이터가 아직 없습니다."}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 보조 카드 (2-column) ── */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 주요 벤더 */}
            <div className="rounded-xl border border-slate-800/60 bg-[#161d2f] border-slate-800/50 p-4 shadow-none">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">주요 벤더</span>
              </div>
              <div className="text-lg font-bold text-slate-100 truncate">
                {topVendor ? topVendor.vendor : "—"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {topVendor ? `₩${topVendor.totalAmount.toLocaleString("ko-KR")}` : "데이터 없음"}
              </p>
            </div>

            {/* 벤더 집중도 */}
            <div className={`rounded-xl border p-4 shadow-none ${
              vendorConcentration >= 70
                ? "border-amber-800/60 bg-amber-950/30/30 bg-amber-950/10 border-amber-900/30"
                : "border-slate-800/60 bg-[#161d2f] border-slate-800/50"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${vendorConcentration >= 70 ? "text-amber-500" : "text-slate-400"}`} />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">벤더 집중도</span>
              </div>
              <div className={`text-lg font-bold${vendorConcentration >= 70 ? "text-amber-400" : "text-slate-100"}`}>
                {vendorConcentration > 0 ? `${vendorConcentration}%` : "—"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {vendorConcentration >= 70 ? "집중도가 높습니다 — 분산 검토 필요" : "상위 1개 벤더 비중"}
              </p>
            </div>
          </div>
        )}

        {/* ── 차트 (2-column) ── */}
        {isLoading ? <ChartSkeleton /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* 벤더 집중도 (Pie) */}
            <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold text-slate-200">벤더 집중도</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {vendorItems.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={vendorPieData}
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
                          {vendorPieData.map((_, index) => (
                            <Cell key={`cell-vendor-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                          formatter={(value: number, name: string, item: { payload?: { amount?: number; value?: number } }) => [
                            `₩${(item.payload?.amount ?? 0).toLocaleString("ko-KR")}`,
                            `${name} (${item.payload?.value ?? value}%)`,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1.5 border-t border-slate-800/40 pt-3">
                      {vendorPieData.map((v, index) => (
                        <div key={v.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                            />
                            <span className="text-xs text-slate-400">{v.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-slate-800 text-slate-400 border-0">
                              {v.value}%
                            </Badge>
                          </div>
                          <span className="text-xs font-semibold text-slate-300">
                            ₩{v.amount.toLocaleString("ko-KR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyChart message="아직 벤더 데이터가 없습니다." />
                )}
              </CardContent>
            </Card>

            {/* 벤더별 지출 규모 (Horizontal Bar) */}
            <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold text-slate-200">벤더별 지출 규모</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {vendorItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={vendorItems.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000000 ? `${(v / 1000000).toFixed(0)}M`
                            : v >= 1000 ? `${(v / 1000).toFixed(0)}K`
                            : String(v)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="vendor"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false} tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)", backgroundColor: "white" }}
                        formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                      />
                      <Bar dataKey="totalAmount" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="아직 벤더 데이터가 없습니다." />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 벤더 TOP 랭킹 테이블 ── */}
        <Card className="rounded-xl border-slate-800/60 border-slate-800/50 shadow-none bg-[#161d2f]">
          <CardHeader className="p-4 pb-0">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-200">벤더 TOP 랭킹</CardTitle>
              <p className="text-[11px] text-slate-400 text-slate-500 mt-0.5">
                벤더별 주문 건수, 지출 합계 및 비중
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-3">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : vendorItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                <Package className="h-8 w-8 opacity-25" />
                <p className="text-sm">아직 벤더 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader>
                    <TableRow className="border-slate-800/50">
                      <TableHead className="w-8 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">#</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">벤더명</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">주문 건수</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">지출 합계</TableHead>
                      <TableHead className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">비중(%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorItems.slice(0, 10).map((v, index) => (
                      <TableRow key={v.vendor} className="border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <TableCell className="py-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-[11px] font-bold text-slate-400">
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Store className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="font-medium text-slate-200 text-sm">{v.vendor}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-slate-800 text-slate-400 border-0">
                            {v.count}건
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span className="font-semibold text-slate-200">
                            ₩{v.totalAmount.toLocaleString("ko-KR")}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 border-0 font-semibold${
                            v.pct >= 70
                              ? "bg-amber-950/30 text-amber-400"
                              : "bg-blue-950/30 text-blue-400"
                          }`}>
                            {v.pct}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </>)}

      {/* ══ 관련 페이지 이동 ══ */}
      <div className="rounded-xl border border-slate-800/50 bg-slate-900/60 bg-slate-900/30 p-4">
        <p className="text-[10px] font-semibold text-slate-400 text-slate-500 uppercase tracking-wider mb-3">
          관련 페이지 바로가기
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/dashboard/purchases">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-slate-900 hover:bg-slate-800 border-slate-700 font-medium transition-colors">
              <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
              구매 내역 보기
            </Button>
          </Link>
          <Link href="/dashboard/budget">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-slate-900 hover:bg-slate-800 border-slate-700 font-medium transition-colors">
              <CreditCard className="h-3.5 w-3.5 text-slate-500" />
              예산 관리 보기
            </Button>
          </Link>
          <button
            onClick={() => { setCurrentView("vendor"); setTableTab("vendor"); }}
            className="flex h-10 items-center justify-start gap-2 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 text-xs font-medium text-slate-300 transition-colors w-full"
          >
            <Store className="h-3.5 w-3.5 text-slate-500" />
            벤더 비교 보기
          </button>
          <Link href="/dashboard/inventory">
            <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-slate-900 hover:bg-slate-800 border-slate-700 font-medium transition-colors">
              <Package className="h-3.5 w-3.5 text-slate-500" />
              재고 현황 보기
            </Button>
          </Link>
        </div>
      </div>

      </>)}
    </div>
  );
}

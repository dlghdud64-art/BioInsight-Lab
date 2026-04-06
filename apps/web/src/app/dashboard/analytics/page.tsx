"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StaggerItem } from "@/components/ui/stagger-container";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart,
  ChevronRight, BarChart2, Gauge, AlertTriangle, RotateCcw,
  CreditCard, Users, ExternalLink, RefreshCw, Clock, Wallet,
  ArrowRight, Layers, Sparkles, Loader2,
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
  const [aiInsight, setAiInsight] = useState<{ summary: string; dataPoints: number; analyzedAt: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analytics/ai-insight", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 분석 실패");
      setAiInsight({ summary: data.summary, dataPoints: data.dataPoints ?? 0, analyzedAt: data.analyzedAt ?? new Date().toISOString() });
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI 분석 중 오류 발생");
    } finally {
      setAiLoading(false);
    }
  };

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

  // 승인 대기 금액 — 실제 API 미연동, 추정치 플래그 표시
  const pendingApprovalAmount = Math.round(budget.used * 0.08);
  const pendingApprovalIsEstimate = true; // TODO: API 연동 후 false로 전환

  // ── 분석 준비도 계산 ──
  const purchaseRecordCount = topSpending.length;
  const recent90dCount = topSpending.filter((it) => {
    const d = new Date(it.date);
    return Date.now() - d.getTime() < 90 * 86400000;
  }).length;
  const categoryMappedCount = topSpending.filter((it) => it.category && it.category !== "OTHER" && it.category !== "ETC").length;
  const categoryMappingRate = purchaseRecordCount > 0 ? Math.round((categoryMappedCount / purchaseRecordCount) * 100) : 0;
  const vendorIdentifiedCount = topSpending.filter((it) => it.vendor && it.vendor !== "미등록").length;
  const vendorIdentificationRate = purchaseRecordCount > 0 ? Math.round((vendorIdentifiedCount / purchaseRecordCount) * 100) : 0;
  const analysisReady = recent90dCount >= 10 && categoryMappingRate >= 50 && vendorIdentificationRate >= 50;

  // 분석 준비 상태 항목
  const readinessItems = [
    { label: "최근 90일 구매 데이터", value: `${recent90dCount}건`, ready: recent90dCount >= 10, tip: recent90dCount < 10 ? `10건 이상 필요 (현재 ${recent90dCount}건)` : "분석 가능" },
    { label: "카테고리 매핑 완료율", value: `${categoryMappingRate}%`, ready: categoryMappingRate >= 50, tip: categoryMappingRate < 50 ? "50% 이상 필요 — 구매 내역에서 카테고리 보완" : "분석 가능" },
    { label: "공급사 식별 완료율", value: `${vendorIdentificationRate}%`, ready: vendorIdentificationRate >= 50, tip: vendorIdentificationRate < 50 ? "50% 이상 필요 — 공급사 매핑 점검" : "분석 가능" },
    { label: "분석 가능 상태", value: analysisReady ? "가능" : "제한됨", ready: analysisReady, tip: analysisReady ? "인사이트 생성 가능" : "위 항목 충족 시 분석이 활성화됩니다" },
  ];

  return (
    <div className="min-h-screen bg-sh p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 페이지 헤더 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
            지출 통제 콘솔
          </h2>
          <p className="text-sm text-slate-600 mt-0.5 hidden sm:block">
            {currentView === "team"
              ? "팀별 예산 집행 상태와 위험 신호를 확인하세요."
              : "예산 운영 현황과 지출 위험 신호를 모니터링합니다."}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-pn border border-bd rounded-md p-0.5 flex-shrink-0">
          <button
            onClick={() => setCurrentView("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              currentView === "overview"
                ? "bg-el text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            전체 현황
          </button>
          <button
            onClick={() => setCurrentView("team")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              currentView === "team"
                ? "bg-el text-slate-900"
                : "text-slate-400 hover:text-slate-600"
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
            분석 준비 브리프 — 데이터가 부족할 때 우선 표시
           ═══════════════════════════════════════════════════ */}
        {!isLoading && !analysisReady && (() => {
          const topBlocker = readinessItems.find((item) => !item.ready);
          return (
            <div className="space-y-3">
              {/* Primary blocker callout */}
              {topBlocker && (
                <div className="rounded-lg border border-bd bg-pn px-5 py-4 animate-stagger-up" style={{ animationDelay: "0ms" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">분석 제한: {topBlocker.label}</p>
                      <p className="text-sm text-slate-500 mt-1">{topBlocker.tip}</p>
                      <p className="text-xs text-slate-500 mt-2">현재 값: <span className="font-semibold text-slate-600">{topBlocker.value}</span> — 이 항목이 해결되면 인사이트가 활성화됩니다</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Readiness blocks */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {readinessItems.map((item, idx) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-bd bg-pn px-4 py-3 hover:shadow-md transition-shadow animate-stagger-up"
                    style={{ animationDelay: `${80 + idx * 60}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${item.ready ? "bg-emerald-400" : "bg-amber-400"}`} style={{ boxShadow: item.ready ? "0 0 8px rgba(52,211,153,0.5)" : "0 0 8px rgba(251,191,36,0.6)" }} />
                      <p className="text-xs font-semibold text-slate-400">{item.label}</p>
                    </div>
                    <p className="text-2xl font-extrabold tracking-tight text-slate-700">{item.value}</p>
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500 leading-relaxed">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════
            TODAY FOCUS: 오늘의 우선 확인 — 3초 안에 "무엇을 해야 하나" 전달
           ═══════════════════════════════════════════════════ */}
        {!isLoading && (() => {
          const focusAction = budgetStatus === "danger"
            ? { label: "예산 소진율 90% 초과 — 즉시 예산 검토가 필요합니다", href: "/dashboard/budget" }
            : budgetStatus === "warning"
              ? { label: "예산 소진율 75% 초과 — 잔여 예산 배분을 점검하세요", href: "/dashboard/budget" }
              : vendorConcentration > 50
                ? { label: `상위 1개 공급사 의존도 ${vendorConcentration}% — 분산 검토가 필요합니다`, href: "/dashboard/purchases" }
                : repeatItems.filter(i => { const d = Math.round((Date.now() - new Date(i.latestDate).getTime()) / 86400000); return d >= 30; }).length > 0
                  ? { label: `재주문 검토 대상 ${repeatItems.filter(i => Math.round((Date.now() - new Date(i.latestDate).getTime()) / 86400000) >= 30).length}건 — 소싱 시점을 확인하세요`, href: "/dashboard/stock-risk" }
                  : null;
          if (!focusAction) return null;
          return (
            <div className="rounded-md border border-bd bg-pn px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">오늘의 우선 확인</span>
                  <span className="text-sm text-slate-600">{focusAction.label}</span>
                </div>
                <Link href={focusAction.href} className="shrink-0 ml-3">
                  <span className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                    확인 <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════
            TOP: 지출 현황 요약 Strip (5 KPI)
           ═══════════════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">지출 현황 요약</p>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-md border border-bd bg-pn p-4 space-y-2">
                  <Skeleton className="h-3 w-20 bg-el" />
                  <Skeleton className="h-6 w-28 bg-el" />
                  <Skeleton className="h-2 w-full bg-el" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

              {/* 예산 소진율 */}
              <div className="rounded-md border border-bd bg-pn p-4 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <Gauge className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">예산 소진율</p>
                    <div className={`w-2 h-2 rounded-full ${budgetStatus === "danger" ? "bg-red-400" : budgetStatus === "warning" ? "bg-amber-400" : "bg-emerald-400"}`} style={{ boxShadow: budgetStatus === "danger" ? "0 0 8px rgba(248,113,113,0.6)" : budgetStatus === "warning" ? "0 0 8px rgba(251,191,36,0.6)" : "0 0 8px rgba(52,211,153,0.5)" }} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {budget.total > 0 ? `${budget.usageRate}%` : "미등록"}
                </div>
                {budget.total > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="h-1 bg-el rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-slate-400"
                        style={{ width: `${Math.min(100, budget.usageRate)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {budgetStatus === "danger" ? "즉시 검토 필요" : budgetStatus === "warning" ? "주의 구간" : "정상 운영"}
                    </p>
                  </div>
                )}
              </div>

              {/* 승인 대기 금액 */}
              <Link href="/dashboard/purchases" className="block group animate-stagger-up" style={{ animationDelay: "60ms" }}>
                <div className="rounded-md border border-bd bg-pn p-4 h-full hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">승인 대기 금액</p>
                      {pendingApprovalIsEstimate && (
                        <span className="text-xs px-1 py-0.5 rounded bg-amber-600/10 text-amber-400/70 border border-amber-600/20 font-medium">추정</span>
                      )}
                    </div>
                    <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {pendingApprovalAmount > 0 ? `₩${pendingApprovalAmount.toLocaleString("ko-KR")}` : "₩0"}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">{pendingApprovalIsEstimate ? "실제 승인 내역 연동 전 추정치입니다" : "클릭하여 구매내역 확인"}</p>
                  </div>
                </div>
              </Link>

              {/* 이번 달 지출 총액 — PRIMARY */}
              <div className="rounded-md border border-blue-200 bg-blue-50/30 p-4 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "120ms" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">이번 달 지출</p>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {currentMonth ? `₩${currentMonth.amount.toLocaleString("ko-KR")}` : <span className="text-slate-500">미수집</span>}
                </div>
                <div className="mt-3 pt-3 border-t border-blue-100">
                  <p className="text-xs text-slate-500">
                    {currentMonth ? `${currentMonth.month} 기준` : "아직 수집된 지출 데이터 없음"}
                  </p>
                </div>
              </div>

              {/* 전월 대비 변동 */}
              <div className="rounded-md border border-bd bg-pn p-4 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "180ms" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                    {monthChange !== null && monthChange < 0
                      ? <TrendingDown className="h-4 w-4 text-slate-500" />
                      : <TrendingUp className="h-4 w-4 text-slate-500" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">전월 대비</p>
                    {monthChange !== null && monthChange > 20 && <div className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />}
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {monthChange !== null ? `${monthChange > 0 ? "+" : ""}${monthChange}%` : "--"}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    {monthChange !== null ? (monthChange > 20 ? "급증 주의" : monthChange < -10 ? "절감 추세" : "변동폭 정상") : "비교 가능한 월별 데이터 부족"}
                  </p>
                </div>
              </div>

              {/* 잔여 예산 */}
              <div className="rounded-md border border-bd bg-pn p-4 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "240ms" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">잔여 예산</p>
                    {budget.total > 0 && budget.remaining <= 0 && <div className="w-2 h-2 rounded-full bg-red-400" style={{ boxShadow: "0 0 8px rgba(248,113,113,0.6)" }} />}
                  </div>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {budget.total > 0 ? `₩${budget.remaining.toLocaleString("ko-KR")}` : "미등록"}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
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
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            MIDDLE: 운영 인사이트 Panels (2x2 grid)
           ═══════════════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">운영 인사이트</p>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-bd bg-pn p-5 space-y-3">
                  <Skeleton className="h-4 w-32 bg-el" />
                  <Skeleton className="h-20 w-full bg-el" />
                  <Skeleton className="h-8 w-24 bg-el" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

              {/* Panel 1: 카테고리별 초과 위험 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">카테고리별 초과 위험</h3>
                    {categoryItems.some(cat => { const u = budget.total > 0 ? Math.round((cat.totalAmount / (budget.total * cat.pct / 100)) * 100) : 0; return u >= 90; }) && <div className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />}
                  </div>
                  {categoryItems.length > 0 && (
                    <Badge className="text-xs px-1.5 py-0.5 border-0 bg-el text-slate-400 font-medium">
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
                                <span className="text-sm text-slate-600">{cat.category}</span>
                              </div>
                              <span className="text-xs text-slate-500">₩{cat.totalAmount.toLocaleString("ko-KR")}</span>
                            </div>
                            <div className="mt-1 h-1 bg-el rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${dotColor}`}
                                style={{ width: `${Math.min(100, cat.pct)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 ${
                            riskLevel === "danger" ? "text-red-400" : riskLevel === "warning" ? "text-amber-400" : "text-slate-500"
                          }`}>
                            {cat.pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-el text-slate-400 border border-bd">준비중</span>
                    </div>
                    <p className="text-xs text-slate-500">카테고리 매핑이 {categoryMappingRate}%로 편중 분석을 시작할 수 없습니다</p>
                    <p className="text-xs text-slate-500">구매 내역에서 카테고리를 보완하면 초과 위험 분석이 활성화됩니다</p>
                    <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                      구매 내역에서 카테고리 보완 <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-bd">
                  <Link href="/dashboard/budget" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    예산 검토 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 2: 공급사 집중도 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "80ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">공급사 집중도</h3>
                    {vendorConcentration > 50 && <div className="w-2 h-2 rounded-full bg-amber-400" style={{ boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />}
                  </div>
                  {vendorConcentration > 50 && (
                    <span className="text-xs text-slate-500 font-medium">주의</span>
                  )}
                </div>

                {vendorItems.length > 0 ? (
                  <div className="space-y-2">
                    {vendorItems.slice(0, 5).map((v, idx) => {
                      const isConcentrated = v.pct > 50;
                      return (
                        <div key={v.vendor} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-600 w-4 text-right flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm truncate text-slate-600">
                                {v.vendor}
                              </span>
                              <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                                ₩{v.totalAmount.toLocaleString("ko-KR")}
                              </span>
                            </div>
                            <div className="mt-1 h-1 bg-el rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isConcentrated ? "bg-amber-400" : "bg-blue-400"}`}
                                style={{ width: `${Math.min(100, v.pct)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-semibold flex-shrink-0 text-slate-400">
                            {v.pct}%
                          </span>
                        </div>
                      );
                    })}
                    {vendorConcentration > 50 && (
                      <p className="text-xs text-slate-500 mt-2 pl-7">
                        상위 1개 공급사가 전체 지출의 {vendorConcentration}%를 차지합니다. 분산 검토를 권장합니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-el text-slate-400 border border-bd">준비중</span>
                    </div>
                    <p className="text-xs text-slate-500">최근 30일 공급사 데이터가 {vendorItems.length}건으로 집중도 분석이 불완전합니다</p>
                    <p className="text-xs text-slate-500">공급사 매핑이 충분해지면 의존 위험과 분산 필요 공급사를 보여줍니다</p>
                    <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                      구매 내역 확인 <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-bd">
                  <Link href="/dashboard/purchases" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    공급사별 구매 내역 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 3: 이상 지출 탐지 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "160ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">이상 지출 탐지</h3>
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
                    return (
                      <div className="py-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${recent90dCount >= 10 ? "bg-el text-slate-600 border-bd" : "bg-el text-slate-400 border-bd"}`}>
                            {recent90dCount >= 10 ? "정상" : "준비중"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {recent90dCount >= 10
                            ? "최근 90일 데이터에서 이상 패턴이 감지되지 않았습니다"
                            : `최근 90일 구매 데이터가 ${recent90dCount}건 미만이라 이상 지출 탐지가 제한됩니다`}
                        </p>
                        <p className="text-xs text-slate-500">반복 구매와 고액 단건 지출이 축적되면 비정상 패턴을 자동 탐지합니다</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {anomalies.slice(0, 4).map((a, i) => (
                        <div key={i} className="rounded bg-el/50 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-slate-700 truncate">{a.item}</p>
                              <p className="text-xs text-slate-500">{a.vendor}</p>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{a.reason}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* AI 분석 결과 */}
                {aiInsight && (
                  <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-xs font-semibold text-violet-600">AI 분석 결과</span>
                      <span className="text-xs text-slate-400 ml-auto">{aiInsight.dataPoints}건 분석</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{aiInsight.summary}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(aiInsight.analyzedAt).toLocaleString("ko-KR")} 기준 · Gemini 2.0 Flash
                    </p>
                  </div>
                )}

                {aiError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50/50 px-3.5 py-2.5">
                    <p className="text-xs text-red-500">{aiError}</p>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-bd flex items-center justify-between">
                  <Link href="/dashboard/purchases" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    구매내역 보기 <ArrowRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={runAiAnalysis}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 hover:border-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {aiLoading ? "분석 중..." : "AI 분석 실행"}
                  </button>
                </div>
              </div>

              {/* Panel 4: 재주문 예상 항목 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "240ms" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <RotateCcw className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">재주문 예상 항목</h3>
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
                          <div key={i} className="flex items-center gap-3 rounded bg-el/50 px-3 py-2">
                            <CategoryIcon category={item.category} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-600 truncate">{item.item}</p>
                              <p className="text-xs text-slate-500">{item.count}회 구매 | {item.vendor}</p>
                            </div>
                            <Clock className="h-3 w-3 text-slate-600" />
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (reorderCandidates.length === 0) {
                    return (
                      <div className="py-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-el text-slate-400 border border-bd">준비중</span>
                        </div>
                        <p className="text-xs text-slate-500">반복 구매 패턴이 {repeatItems.length}건으로 재주문 예측을 시작하기엔 부족합니다</p>
                        <p className="text-xs text-slate-500">구매 이력과 재고 소비 패턴이 축적되면 재주문 시점을 자동 제안합니다</p>
                        <Link href="/app/search" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">소싱 시작하기 <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {reorderCandidates.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 rounded bg-el/50 px-3 py-2">
                          <CategoryIcon category={item.category} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{item.item}</p>
                            <p className="text-xs text-slate-500">
                              마지막 주문 {item.daysSinceLast}일 전 | {item.count}회 반복
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.daysSinceLast >= 60 && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                            <span className="text-xs font-semibold text-slate-400">
                              {item.daysSinceLast}d
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="mt-4 pt-3 border-t border-bd">
                  <Link href="/app/compare" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    비교 재진입 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            BOTTOM: 상세 분석 (항상 표시)
           ═══════════════════════════════════════════════════ */}
        <div className="rounded-lg border border-bd bg-pn">
          <div className="flex items-center justify-between px-5 py-4 border-b border-bd">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">상세 분석</p>
            {!hasMonthlyData && !hasCategoryData && (
              <span className="text-xs text-slate-500">데이터가 축적되면 차트가 자동 채워집니다</span>
            )}
          </div>

          <div className="px-5 pb-5 space-y-4">
              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded bg-el p-4 space-y-2">
                      <Skeleton className="h-4 w-28 bg-slate-200" />
                      <Skeleton className="h-[180px] w-full bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* 월별 지출 바 차트 */}
                  <div className="rounded bg-el/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-slate-400">월별 지출 변화</h4>
                      <Link href="/dashboard/purchases">
                        <span className="text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1">
                          상세 <ChevronRight className="h-3 w-3" />
                        </span>
                      </Link>
                    </div>
                    {hasMonthlyData ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={monthlySpending} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
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
                            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#1e293b" }}
                            formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fill="url(#colorAmount)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[180px] gap-2.5">
                        <BarChart2 className="h-8 w-8 text-slate-500" />
                        <p className="text-sm font-medium text-slate-400">분석 준비 필요</p>
                        <p className="text-xs text-slate-500 text-center leading-relaxed">최근 구매 데이터가 {recent90dCount}건입니다.<br />10건 이상 축적되면 월별 추이가 표시됩니다.</p>
                      </div>
                    )}
                  </div>

                  {/* 카테고리 파이 차트 */}
                  <div className="rounded bg-el/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-slate-400">카테고리별 비중</h4>
                      <Link href="/dashboard/budget">
                        <span className="text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1">
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
                              stroke="#f8fafc"
                            >
                              {categorySpending.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: "4px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#1e293b" }}
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
                                <span className="text-xs text-slate-500">{cat.name}</span>
                              </div>
                              <span className="text-xs text-slate-500">
                                ₩{cat.amount.toLocaleString("ko-KR")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[180px] gap-2.5">
                        <CreditCard className="h-8 w-8 text-slate-500" />
                        <p className="text-sm font-medium text-slate-400">카테고리 분류 필요</p>
                        <p className="text-xs text-slate-500 text-center leading-relaxed">카테고리 매핑 {categoryMappingRate}%입니다.<br />50% 이상이면 비중 차트가 표시됩니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* ══ 조치 바로가기 — 상태 기반 ══ */}
        <div className="rounded-lg border border-bd bg-pn p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">다음 조치</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Link href="/dashboard/budget" className="block">
              <div className="flex items-start gap-3 rounded border border-bd bg-el/30 hover:bg-el/50 px-4 py-3 transition-colors">
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${budgetStatus === "danger" ? "bg-red-400" : budgetStatus === "warning" ? "bg-amber-400" : "bg-slate-500"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700">예산 위험 검토</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {budgetStatus === "danger" ? "소진율 90% 이상 — 즉시 검토 필요" : budgetStatus === "warning" ? "소진율 75% 이상 — 주의 구간 진입" : budget.total > 0 ? "현재 정상 범위 — 추이 확인" : "예산 등록 후 모니터링 가능"}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
              </div>
            </Link>
            <Link href="/dashboard/purchases" className="block">
              <div className="flex items-start gap-3 rounded border border-bd bg-el/30 hover:bg-el/50 px-3 py-2.5 transition-colors">
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${vendorConcentration > 50 ? "bg-amber-400" : "bg-slate-500"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600">공급사 의존 점검</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {vendorConcentration > 50 ? `상위 1개 공급사 ${vendorConcentration}% — 분산 검토 필요` : vendorItems.length > 0 ? `${vendorItems.length}개 공급사 — 집중도 정상` : "공급사 데이터 축적 후 점검 가능"}
                  </p>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-600 mt-0.5 flex-shrink-0" />
              </div>
            </Link>
            <Link href="/dashboard/stock-risk" className="block">
              <div className="flex items-start gap-3 rounded border border-bd bg-el/30 hover:bg-el/50 px-3 py-2.5 transition-colors">
                <div className="mt-1 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600">재주문 후보 검토</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {repeatItems.length > 0 ? `반복 구매 ${repeatItems.length}건 — 재주문 시점 확인` : "반복 구매 데이터 축적 후 예측 시작"}
                  </p>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-600 mt-0.5 flex-shrink-0" />
              </div>
            </Link>
            <Link href="/dashboard/quotes" className="block">
              <div className="flex items-start gap-3 rounded border border-bd bg-el/30 hover:bg-el/50 px-3 py-2.5 transition-colors">
                <div className="mt-1 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600">견적 비교 열기</p>
                  <p className="text-xs text-slate-500 mt-0.5">견적 워크큐에서 비교 검토 및 발주 전환 진행</p>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-600 mt-0.5 flex-shrink-0" />
              </div>
            </Link>
          </div>
        </div>

      </>)}
    </div>
  );
}

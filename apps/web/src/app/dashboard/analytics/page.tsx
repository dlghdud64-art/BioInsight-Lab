"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart,
  ChevronRight, BarChart2, Gauge, AlertTriangle, RotateCcw,
  CreditCard, Users, ExternalLink, Clock, Wallet,
  ArrowRight, Layers, Sparkles, Loader2, FileWarning,
  CheckCircle2, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import TeamAnalyticsView from "./_components/team-analytics-view";

// ── 타입 ────────────────────────────────────────────────────
interface BudgetSummary { total: number; used: number; remaining: number; usageRate: number; }
interface PendingApproval { amount: number; count: number; isEstimate: boolean; }
interface MonthlyPoint { month: string; amount: number; }
interface CategoryPoint { name: string; value: number; amount: number; color: string; }
interface TopSpendingItem { id: string; item: string; vendor: string; category: string; amount: number; date: string; }
interface AnalyticsDashboardData {
  budget: BudgetSummary;
  pendingApproval?: PendingApproval;
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

// ── 포맷 유틸 ──────────────────────────────────────────────
function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
}

// ── KPI 카드 ───────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, statusDot, delay, href, badge,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  statusDot?: "danger" | "warning" | "safe" | null; delay: number;
  href?: string; badge?: React.ReactNode;
}) {
  const dotColor = statusDot === "danger" ? "bg-red-400" : statusDot === "warning" ? "bg-amber-400" : statusDot === "safe" ? "bg-emerald-400" : null;
  const inner = (
    <div className="rounded-lg border border-bd bg-pn p-4 hover:shadow-md transition-all animate-stagger-up h-full" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</p>
          {dotColor && <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
          {badge}
        </div>
        {href && <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />}
      </div>
      <div className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">{value}</div>
      <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">{sub}</p>
    </div>
  );
  if (href) return <Link href={href} className="block group">{inner}</Link>;
  return inner;
}

// ── 메인 페이지 ──────────────────────────────────────────
export default function AnalyticsPage() {
  const [currentView, setCurrentView] = useState<AnalyticsView>("overview");
  const [aiInsight, setAiInsight] = useState<{ summary: string; dataPoints: number; analyzedAt: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

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
  const pendingApproval = data?.pendingApproval ?? { amount: 0, count: 0, isEstimate: true };
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
  const vendorItems = useMemo(() => aggregateByVendor(topSpending), [topSpending]);
  const topVendor = vendorItems[0] ?? null;
  const vendorTotal = vendorItems.reduce((s, v) => s + v.totalAmount, 0);
  const vendorConcentration = topVendor && vendorTotal > 0 ? Math.round((topVendor.totalAmount / vendorTotal) * 100) : 0;

  // 카테고리별 집계
  const categoryItems = useMemo(() => aggregateByCategory(topSpending), [topSpending]);

  // 품목 집계
  const aggregatedItems = useMemo(() => aggregateTopItems(topSpending), [topSpending]);
  const repeatItems = aggregatedItems.filter((i) => i.count > 1);

  // 예산 상태 판정
  const budgetStatus: "danger" | "warning" | "safe" =
    budget.usageRate >= 90 ? "danger" : budget.usageRate >= 75 ? "warning" : "safe";

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
  ];

  // 위험 신호 수 집계
  const riskSignals = useMemo(() => {
    let count = 0;
    if (budgetStatus === "danger") count += 1;
    if (vendorConcentration > 50) count += 1;
    if (monthChange !== null && monthChange > 30) count += 1;
    const anomalyCount = repeatItems.filter(i => i.count >= 3).length +
      aggregatedItems.filter(i => i.count === 1 && i.totalAmount > (budget.used * 0.15 || 500000)).length;
    if (anomalyCount > 0) count += 1;
    return count;
  }, [budgetStatus, vendorConcentration, monthChange, repeatItems, aggregatedItems, budget.used]);

  // 재주문 후보
  const reorderCandidates = useMemo(() =>
    repeatItems
      .map((item) => {
        const lastDate = new Date(item.latestDate);
        const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...item, daysSinceLast };
      })
      .filter((item) => item.daysSinceLast >= 14)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
      .slice(0, 5),
  [repeatItems]);

  // 이상 지출 감지
  const anomalies = useMemo(() => {
    const result: { item: string; vendor: string; amount: number; reason: string; severity: "high" | "medium" }[] = [];
    for (const item of repeatItems.slice(0, 4)) {
      const avgPerPurchase = Math.round(item.totalAmount / item.count);
      result.push({
        item: item.item, vendor: item.vendor, amount: item.totalAmount,
        reason: `${item.count}회 반복, 건당 평균 ${fmtKRW(avgPerPurchase)}`,
        severity: item.count >= 3 ? "high" : "medium",
      });
    }
    const highSpend = aggregatedItems.filter((i) => i.count === 1 && i.totalAmount > (budget.used * 0.1 || 500000));
    for (const item of highSpend.slice(0, 2)) {
      result.push({
        item: item.item, vendor: item.vendor, amount: item.totalAmount,
        reason: `단일 건 ${fmtKRW(item.totalAmount)} — 고액 지출`,
        severity: "high",
      });
    }
    return result;
  }, [repeatItems, aggregatedItems, budget.used]);

  return (
    <div className="min-h-screen bg-sh p-4 md:p-6 lg:p-8 pt-4 md:pt-5 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 페이지 헤더 ══ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              지출 통제 콘솔
            </h2>
            {riskSignals > 0 && !isLoading && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                <AlertTriangle className="h-3 w-3" />
                {riskSignals}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">
            {currentView === "team"
              ? "팀별 예산 집행 상태와 위험 신호를 확인하세요."
              : "예산 운영 현황과 지출 위험 신호를 모니터링합니다."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={runAiAnalysis}
            disabled={aiLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? "분석 중..." : "AI 예산 이상 탐지"}
          </button>
          <div className="flex items-center gap-1 bg-pn border border-bd rounded-lg p-0.5">
            <button
              onClick={() => setCurrentView("overview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === "overview" ? "bg-el text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              전체 현황
            </button>
            <button
              onClick={() => setCurrentView("team")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                currentView === "team" ? "bg-el text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              팀별 분석
            </button>
          </div>
        </div>
      </div>

      {/* ══ AI 스마트 분석 리포트 ══ */}
      {aiInsight && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4 animate-stagger-up">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-bold text-slate-900">AI 스마트 분석 리포트</h3>
                <span className="text-xs text-slate-400">{aiInsight.dataPoints}건 분석</span>
                <span className="text-xs text-slate-400 ml-auto">
                  {new Date(aiInsight.analyzedAt).toLocaleString("ko-KR")} 기준
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{aiInsight.summary}</p>
            </div>
          </div>
        </div>
      )}

      {aiError && !aiLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{aiError}</p>
          <button onClick={runAiAnalysis} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium underline">재시도</button>
        </div>
      )}

      {/* 데이터 오류 */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-600">
          데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* ══ 팀별 보기 ══ */}
      {currentView === "team" && <TeamAnalyticsView />}

      {/* ══ 전체 현황 (Spending Control Console) ══ */}
      {currentView === "overview" && (<>

        {/* ═══ 분석 준비 브리프 (데이터 부족 시) ═══ */}
        {!isLoading && !analysisReady && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-start gap-3 mb-3">
              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-700">분석 데이터가 부족합니다</p>
                <p className="text-xs text-slate-500 mt-0.5">아래 항목이 충족되면 인사이트가 자동 활성화됩니다.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 rounded-md bg-white/60 px-3 py-2 border border-amber-100">
                  {item.ready
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-300 shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-600">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.value} — {item.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 오늘의 우선 확인 (상태 기반) ═══ */}
        {!isLoading && (() => {
          const focusAction = budgetStatus === "danger"
            ? { label: "예산 소진율 90% 초과 — 즉시 예산 검토가 필요합니다", href: "/dashboard/budget", severity: "danger" as const }
            : budgetStatus === "warning"
              ? { label: "예산 소진율 75% 초과 — 잔여 예산 배분을 점검하세요", href: "/dashboard/budget", severity: "warning" as const }
              : vendorConcentration > 50
                ? { label: `상위 1개 공급사 의존도 ${vendorConcentration}% — 분산 검토가 필요합니다`, href: "/dashboard/purchases", severity: "warning" as const }
                : reorderCandidates.length > 0
                  ? { label: `재주문 검토 대상 ${reorderCandidates.length}건 — 소싱 시점을 확인하세요`, href: "/dashboard/stock-risk", severity: "info" as const }
                  : null;
          if (!focusAction) return null;
          const barColors = { danger: "bg-red-500", warning: "bg-amber-500", info: "bg-blue-500" };
          return (
            <div className="rounded-lg border border-bd bg-pn overflow-hidden">
              <div className={`h-0.5 ${barColors[focusAction.severity]}`} />
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">오늘의 우선 확인</span>
                  <span className="text-sm text-slate-600">{focusAction.label}</span>
                </div>
                <Link href={focusAction.href} className="shrink-0 ml-3">
                  <span className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 transition-colors">
                    확인 <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
            </div>
          );
        })()}

        {/* ═══ KPI 카드 스트립 ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border border-bd bg-pn p-4 space-y-2.5">
                <Skeleton className="h-3 w-20 bg-el" />
                <Skeleton className="h-7 w-28 bg-el" />
                <Skeleton className="h-2 w-full bg-el" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard
              icon={<Gauge className="h-4 w-4 text-slate-500" />}
              label="예산 소진율"
              value={budget.total > 0 ? `${budget.usageRate}%` : "미등록"}
              sub={budgetStatus === "danger" ? "즉시 검토 필요" : budgetStatus === "warning" ? "주의 구간" : budget.total > 0 ? "정상 운영" : "예산 등록 필요"}
              statusDot={budget.total > 0 ? budgetStatus : null}
              delay={0}
            />
            <KpiCard
              icon={<Clock className="h-4 w-4 text-slate-500" />}
              label="승인 대기"
              value={pendingApproval.amount > 0 ? fmtKRW(pendingApproval.amount) : "₩0"}
              sub={pendingApproval.isEstimate
                ? "실제 승인 내역 연동 전 추정치"
                : pendingApproval.count > 0 ? `${pendingApproval.count}건 대기 중` : "대기 건 없음"}
              statusDot={null}
              delay={60}
              href="/dashboard/purchases"
              badge={pendingApproval.isEstimate ? (
                <span className="text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-200 font-medium leading-none">추정</span>
              ) : undefined}
            />
            <KpiCard
              icon={<CreditCard className="h-4 w-4 text-blue-500" />}
              label="이번 달 지출"
              value={currentMonth ? fmtKRW(currentMonth.amount) : "미수집"}
              sub={currentMonth ? `${currentMonth.month} 기준` : "아직 수집된 지출 없음"}
              statusDot={null}
              delay={120}
            />
            <KpiCard
              icon={monthChange !== null && monthChange < 0 ? <TrendingDown className="h-4 w-4 text-slate-500" /> : <TrendingUp className="h-4 w-4 text-slate-500" />}
              label="전월 대비"
              value={monthChange !== null ? `${monthChange > 0 ? "+" : ""}${monthChange}%` : "--"}
              sub={monthChange !== null ? (monthChange > 20 ? "급증 주의" : monthChange < -10 ? "절감 추세" : "변동폭 정상") : "비교 가능한 데이터 부족"}
              statusDot={monthChange !== null && monthChange > 20 ? "warning" : null}
              delay={180}
            />
            <KpiCard
              icon={<Wallet className="h-4 w-4 text-slate-500" />}
              label="잔여 예산"
              value={budget.total > 0 ? fmtKRW(budget.remaining) : "미등록"}
              sub={budget.total > 0
                ? (() => {
                    const monthsLeft = 12 - (new Date().getMonth() + 1);
                    if (monthsLeft > 0 && budget.remaining > 0) return `월 ${fmtKRW(Math.round(budget.remaining / monthsLeft))} 집행 가능`;
                    return budget.remaining <= 0 ? "예산 소진" : "연말 마감";
                  })()
                : "예산 등록 필요"}
              statusDot={budget.total > 0 && budget.remaining <= 0 ? "danger" : null}
              delay={240}
            />
          </div>
        )}

        {/* ═══ 차트 섹션: 월별 추이 + 카테고리 비중 ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-3 rounded-lg border border-bd bg-pn p-5"><Skeleton className="h-[220px] w-full bg-el" /></div>
            <div className="lg:col-span-2 rounded-lg border border-bd bg-pn p-5"><Skeleton className="h-[220px] w-full bg-el" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {/* 월별 지출 추이 (넓게) */}
            <div className="lg:col-span-3 rounded-lg border border-bd bg-pn p-5 animate-stagger-up" style={{ animationDelay: "0ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">월별 지출 추이</h3>
                <Link href="/dashboard/purchases">
                  <span className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
                    상세 <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
              {hasMonthlyData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlySpending} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#1e293b", fontSize: "12px" }}
                      formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorAmount)" dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }} isAnimationActive animationDuration={1200} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                  <BarChart2 className="h-7 w-7 text-slate-300" />
                  <p className="text-sm text-slate-400">구매 데이터가 축적되면 월별 추이가 표시됩니다.</p>
                  <p className="text-xs text-slate-400">현재 {recent90dCount}건 수집됨</p>
                </div>
              )}
            </div>

            {/* 카테고리별 비중 (좁게) */}
            <div className="lg:col-span-2 rounded-lg border border-bd bg-pn p-5 animate-stagger-up" style={{ animationDelay: "60ms" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">카테고리별 비중</h3>
                <Link href="/dashboard/budget">
                  <span className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
                    예산 검토 <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
              {hasCategoryData ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={categorySpending}
                        cx="50%" cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={60}
                        innerRadius={30}
                        dataKey="value"
                        strokeWidth={1}
                        stroke="#f8fafc"
                        isAnimationActive
                        animationDuration={1000}
                      >
                        {categorySpending.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#1e293b", fontSize: "12px" }}
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
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                          <span className="text-xs text-slate-500">{cat.name}</span>
                        </div>
                        <span className="text-xs text-slate-500">{fmtKRW(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                  <CreditCard className="h-7 w-7 text-slate-300" />
                  <p className="text-sm text-slate-400">카테고리 분류가 필요합니다.</p>
                  <p className="text-xs text-slate-400">매핑 {categoryMappingRate}% — 50% 이상 필요</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 운영 인사이트 패널 (2x2) ═══ */}
        {!isLoading && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">운영 인사이트</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

              {/* Panel 1: 카테고리별 초과 위험 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <Layers className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">카테고리별 초과 위험</h3>
                  </div>
                  {categoryItems.length > 0 && (
                    <Badge className="text-[10px] px-1.5 py-0.5 border-0 bg-el text-slate-400 font-medium">{categoryItems.length}개</Badge>
                  )}
                </div>
                {categoryItems.length > 0 ? (
                  <div className="space-y-2">
                    {categoryItems.slice(0, 5).map((cat) => {
                      const catBudget = budget.total > 0 ? Math.round(budget.total * (cat.pct / 100)) : 0;
                      const catUsage = catBudget > 0 ? Math.round((cat.totalAmount / catBudget) * 100) : 0;
                      const risk: "danger" | "warning" | "safe" = catUsage >= 90 ? "danger" : catUsage >= 70 ? "warning" : "safe";
                      const dc = risk === "danger" ? "bg-red-400" : risk === "warning" ? "bg-amber-400" : "bg-emerald-400";
                      return (
                        <div key={cat.category} className="flex items-center gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dc}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <CategoryIcon category={cat.category} />
                                <span className="text-sm text-slate-600">{cat.category}</span>
                              </div>
                              <span className="text-xs text-slate-500">{fmtKRW(cat.totalAmount)}</span>
                            </div>
                            <div className="mt-1 h-1 bg-el rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${dc}`} style={{ width: `${Math.min(100, cat.pct)}%` }} />
                            </div>
                          </div>
                          <span className={`text-xs font-semibold shrink-0 ${risk === "danger" ? "text-red-400" : risk === "warning" ? "text-amber-400" : "text-slate-400"}`}>{cat.pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-3">
                    <p className="text-xs text-slate-500">카테고리 매핑이 {categoryMappingRate}%로 분석을 시작할 수 없습니다.</p>
                    <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2">
                      구매 내역에서 카테고리 보완 <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-bd">
                  <Link href="/dashboard/budget" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium">
                    예산 검토 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 2: 공급사 집중도 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "60ms" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">공급사 집중도</h3>
                    {vendorConcentration > 50 && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                </div>
                {vendorItems.length > 0 ? (
                  <div className="space-y-2">
                    {vendorItems.slice(0, 5).map((v, idx) => (
                      <div key={v.vendor} className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-slate-400 w-4 text-right shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm truncate text-slate-600">{v.vendor}</span>
                            <span className="text-xs text-slate-500 shrink-0 ml-2">{fmtKRW(v.totalAmount)}</span>
                          </div>
                          <div className="mt-1 h-1 bg-el rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${v.pct > 50 ? "bg-amber-400" : "bg-blue-400"}`} style={{ width: `${Math.min(100, v.pct)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-semibold shrink-0 text-slate-400">{v.pct}%</span>
                      </div>
                    ))}
                    {vendorConcentration > 50 && (
                      <p className="text-xs text-amber-600 mt-2 pl-6 font-medium">
                        상위 1개 공급사가 전체 지출의 {vendorConcentration}%를 차지합니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-3">
                    <p className="text-xs text-slate-500">공급사 데이터가 {vendorItems.length}건으로 집중도 분석이 불완전합니다.</p>
                    <Link href="/dashboard/purchases" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2">
                      구매 내역 확인 <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-bd">
                  <Link href="/dashboard/purchases" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium">
                    공급사별 구매 내역 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 3: 이상 지출 탐지 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "120ms" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">이상 지출 탐지</h3>
                    {anomalies.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-semibold">{anomalies.length}</span>}
                  </div>
                  <button
                    onClick={runAiAnalysis}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {aiLoading ? "분석 중" : "AI 분석"}
                  </button>
                </div>

                {anomalies.length > 0 ? (
                  <div className="space-y-2">
                    {anomalies.slice(0, 4).map((a, i) => (
                      <div key={i} className="rounded-md bg-el/50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 truncate">{a.item}</p>
                            <p className="text-xs text-slate-500">{a.vendor}</p>
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${a.severity === "high" ? "bg-red-400" : "bg-amber-400"}`} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{a.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${recent90dCount >= 10 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-el text-slate-400 border-bd"}`}>
                      {recent90dCount >= 10 ? "정상" : "준비중"}
                    </span>
                    <p className="text-xs text-slate-500 mt-2">
                      {recent90dCount >= 10
                        ? "최근 90일 데이터에서 이상 패턴이 감지되지 않았습니다."
                        : `최근 90일 구매 데이터가 ${recent90dCount}건 — 이상 지출 탐지가 제한됩니다.`}
                    </p>
                  </div>
                )}

                {/* AI 분석 결과 인라인 */}
                {aiInsight && (
                  <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="h-3 w-3 text-violet-500" />
                      <span className="text-xs font-semibold text-violet-600">AI 분석 결과</span>
                      <span className="text-xs text-slate-400 ml-auto">{aiInsight.dataPoints}건</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{aiInsight.summary}</p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-bd">
                  <Link href="/dashboard/purchases" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium">
                    구매내역 보기 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Panel 4: 재주문 예상 항목 */}
              <div className="rounded-lg border border-bd bg-pn p-5 hover:shadow-md transition-shadow animate-stagger-up" style={{ animationDelay: "180ms" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <RotateCcw className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">재주문 예상 항목</h3>
                    {reorderCandidates.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold">{reorderCandidates.length}</span>}
                  </div>
                </div>

                {reorderCandidates.length > 0 ? (
                  <div className="space-y-2">
                    {reorderCandidates.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-md bg-el/50 px-3 py-2">
                        <CategoryIcon category={item.category} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{item.item}</p>
                          <p className="text-xs text-slate-500">마지막 주문 {item.daysSinceLast}일 전 | {item.count}회 반복</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.daysSinceLast >= 60 && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          <span className="text-xs font-semibold text-slate-400">{item.daysSinceLast}d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : repeatItems.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 py-1">반복 구매 품목 모두 최근 주문 완료</p>
                    {repeatItems.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-md bg-el/50 px-3 py-2">
                        <CategoryIcon category={item.category} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-600 truncate">{item.item}</p>
                          <p className="text-xs text-slate-500">{item.count}회 구매 | {item.vendor}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-el text-slate-400 border border-bd">준비중</span>
                    <p className="text-xs text-slate-500 mt-2">반복 구매 패턴이 축적되면 재주문 시점을 자동 제안합니다.</p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-bd">
                  <Link href="/app/compare" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium">
                    비교 재진입 <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Top 5 고액 지출 (접이식) ═══ */}
        {!isLoading && aggregatedItems.length > 0 && (
          <div className="rounded-lg border border-bd bg-pn animate-stagger-up" style={{ animationDelay: "200ms" }}>
            <button
              onClick={() => setExpandedPanel(expandedPanel === "top5" ? null : "top5")}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-el/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FileWarning className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700">Top 5 고액 지출 품목</p>
                <Badge className="text-[10px] px-1.5 py-0.5 border-0 bg-el text-slate-400 font-medium">{aggregatedItems.length}건</Badge>
              </div>
              {expandedPanel === "top5" ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {expandedPanel === "top5" && (
              <div className="px-5 pb-4 space-y-2 border-t border-bd pt-3">
                {aggregatedItems.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md bg-el/40 px-3 py-2.5">
                    <span className="text-sm font-bold text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
                    <CategoryIcon category={item.category} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{item.item}</p>
                      <p className="text-xs text-slate-500">{item.vendor} · {item.category} · {item.count}건</p>
                    </div>
                    <span className="text-sm font-bold text-slate-700 shrink-0">{fmtKRW(item.totalAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ 다음 조치 바로가기 ═══ */}
        {!isLoading && (
          <div className="rounded-lg border border-bd bg-pn p-4 animate-stagger-up" style={{ animationDelay: "240ms" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">다음 조치</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {([
                { href: "/dashboard/budget", title: "예산 위험 검토", dot: budgetStatus === "danger" ? "bg-red-400" : budgetStatus === "warning" ? "bg-amber-400" : "bg-slate-300",
                  desc: budgetStatus === "danger" ? "소진율 90% 이상 — 즉시 검토 필요" : budgetStatus === "warning" ? "소진율 75% 이상 — 주의 구간" : budget.total > 0 ? "추이 확인" : "예산 등록 필요" },
                { href: "/dashboard/purchases", title: "공급사 의존 점검", dot: vendorConcentration > 50 ? "bg-amber-400" : "bg-slate-300",
                  desc: vendorConcentration > 50 ? `상위 1개 공급사 ${vendorConcentration}% — 분산 검토` : vendorItems.length > 0 ? `${vendorItems.length}개 공급사 — 정상` : "데이터 축적 후 점검" },
                { href: "/dashboard/stock-risk", title: "재주문 후보 검토", dot: reorderCandidates.length > 0 ? "bg-blue-400" : "bg-slate-300",
                  desc: reorderCandidates.length > 0 ? `${reorderCandidates.length}건 재주문 시점 확인` : "반복 구매 데이터 축적 필요" },
                { href: "/dashboard/quotes", title: "견적 비교 열기", dot: "bg-slate-300", desc: "견적 워크큐에서 비교 검토 및 발주 전환" },
              ] as const).map((action) => (
                <Link key={action.href} href={action.href} className="block">
                  <div className="flex items-center gap-2.5 rounded-md border border-bd bg-el/30 hover:bg-el/50 px-3.5 py-2.5 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${action.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-600">{action.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </>)}
    </div>
  );
}

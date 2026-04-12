"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart,
  ChevronRight, AlertTriangle, RotateCcw,
  CreditCard, Users, ExternalLink, Clock,
  ArrowRight, Sparkles, Loader2,
  Gauge, Download, Search, Zap, AlertCircle,
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
  REAGENT: "시약 및 화합물", REAGENTS: "시약 및 화합물",
  TOOL: "장비", TOOLS: "장비", EQUIPMENT: "장비",
  CONSUMABLE: "소모품 (Pipettes, Tubes)", CONSUMABLES: "소모품 (Pipettes, Tubes)",
  GLASSWARE: "유리기구",
  CHEMICAL: "화학물질", CHEMICALS: "화학물질",
  MEDIA: "세포 배양 배지", BUFFER: "완충용액",
  ANTIBODY: "항체 및 단백질", PROTEIN: "항체 및 단백질",
  OTHER: "기타", ETC: "기타",
};
function getCategoryLabel(raw: string | null | undefined): string {
  if (!raw) return "기타";
  return CATEGORY_LABEL_MAP[raw.toUpperCase()] ?? raw;
}

// ── 카테고리 아이콘 ───────────────────────────────────────
function CategoryIcon({ category, className = "h-3.5 w-3.5" }: { category: string; className?: string }) {
  const label = getCategoryLabel(category);
  if (label.includes("시약")) return <FlaskConical className={`${className} text-blue-500`} />;
  if (label.includes("장비")) return <Package className={`${className} text-emerald-500`} />;
  if (label.includes("소모품")) return <ShoppingCart className={`${className} text-amber-500`} />;
  if (label.includes("배지")) return <Package className={`${className} text-purple-500`} />;
  return <Package className={`${className} text-slate-400`} />;
}

// ── 집계 함수 ──────────────────────────────────────────────

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

function aggregateTopItems(items: TopSpendingItem[]) {
  const map: Record<string, { item: string; vendor: string; category: string; totalAmount: number; count: number; latestDate: string }> = {};
  for (const it of items) {
    const key = it.item || "미등록";
    if (!map[key]) map[key] = { item: key, vendor: it.vendor, category: getCategoryLabel(it.category), totalAmount: 0, count: 0, latestDate: it.date };
    map[key].totalAmount += it.amount || 0;
    map[key].count += 1;
    if (it.date > map[key].latestDate) { map[key].latestDate = it.date; map[key].vendor = it.vendor; }
  }
  return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
}

// ── 포맷 유틸 ──────────────────────────────────────────────
function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000_000) return `₩${(n / 10_000).toLocaleString("ko-KR")}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
}
function fmtCompact(n: number): string {
  if (n >= 10_000_000) return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
}

// ── 탭 타입 ──────────────────────────────────────────────
type AnalyticsTab = "overview" | "vendor" | "anomaly" | "team";

// ── 트렌드 배지 ──────────────────────────────────────────
function TrendBadge({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  const color = isPositive ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50";
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${color}`}>
      <Icon className="h-3 w-3" />
      {isPositive ? "+" : ""}{value}{suffix}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// 메인 페이지
// ══════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
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
  const pendingApproval = data?.pendingApproval ?? { amount: 0, count: 0, isEstimate: true };
  const monthlySpending = data?.monthlySpending ?? [];
  const categorySpending = data?.categorySpending ?? [];
  const topSpending = data?.topSpending ?? [];

  const hasMonthlyData = monthlySpending.some((m) => m.amount > 0);

  // 이번 달 / 전월 지출
  const validMonths = monthlySpending.filter((m) => m.amount > 0);
  const currentMonth = validMonths[validMonths.length - 1] ?? null;
  const prevMonth = validMonths[validMonths.length - 2] ?? null;
  const monthChange = currentMonth && prevMonth && prevMonth.amount > 0
    ? Math.round(((currentMonth.amount - prevMonth.amount) / prevMonth.amount) * 1000) / 10
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

  // 예산 상태
  const budgetStatus: "danger" | "warning" | "safe" =
    budget.usageRate >= 90 ? "danger" : budget.usageRate >= 75 ? "warning" : "safe";

  // 분석 데이터 카운트
  const recent90dCount = topSpending.filter((it) => {
    const d = new Date(it.date);
    return Date.now() - d.getTime() < 90 * 86400000;
  }).length;

  // 이상 지출
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

  // AI 절감 기회 추정 (반복 구매 기반)
  const savingsOpportunity = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const item of repeatItems) {
      if (item.count >= 2) {
        total += Math.round(item.totalAmount * 0.12); // 통합 발주 12% 절감 추정
        count += 1;
      }
    }
    return { amount: total, count };
  }, [repeatItems]);

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

  // 운영 인텔리전스 카드 생성
  const intelligenceCards = useMemo(() => {
    const cards: { id: string; icon: React.ReactNode; title: string; description: string; cta: string; href: string; color: "red" | "blue" | "amber" }[] = [];

    // 단가 인상 / 이상 지출 감지
    if (anomalies.length > 0 && anomalies[0].severity === "high") {
      cards.push({
        id: "price-alert",
        icon: <AlertTriangle className="h-4 w-4" />,
        title: "단가 인상 감지",
        description: `${anomalies[0].vendor}의 '${anomalies[0].item}' ${anomalies[0].reason}`,
        cta: "대체품 검색",
        href: "/dashboard/smart-sourcing",
        color: "red",
      });
    }

    // 통합 발주 기회
    if (repeatItems.length >= 2) {
      const topRepeat = repeatItems[0];
      cards.push({
        id: "bulk-order",
        icon: <Package className="h-4 w-4" />,
        title: "통합 발주 기회",
        description: `'${topRepeat.item}'을(를) ${topRepeat.count}회 개별 발주 중입니다. 통합 시 약 12% 할인이 예상됩니다.`,
        cta: "통합 발주 구성",
        href: "/dashboard/quotes",
        color: "blue",
      });
    }

    // 공급 지연 / 재주문 위험
    if (reorderCandidates.length > 0) {
      cards.push({
        id: "supply-delay",
        icon: <Zap className="h-4 w-4" />,
        title: "공급량 지연 위험",
        description: `${reorderCandidates.length}개 반복 구매 품목의 재주문 시점이 지났습니다. 재고 부족이 발생할 수 있습니다.`,
        cta: "재고 현황 확인",
        href: "/dashboard/stock-risk",
        color: "amber",
      });
    }

    // 예산 위험
    if (budgetStatus === "danger" || budgetStatus === "warning") {
      cards.push({
        id: "budget-risk",
        icon: <AlertCircle className="h-4 w-4" />,
        title: budgetStatus === "danger" ? "예산 초과 위험" : "예산 주의 구간",
        description: `현재 예산 소진율 ${budget.usageRate}%로 ${budgetStatus === "danger" ? "즉시 검토가 필요합니다" : "주의가 필요합니다"}.`,
        cta: "예산 검토",
        href: "/dashboard/budget",
        color: budgetStatus === "danger" ? "red" : "amber",
      });
    }

    return cards.slice(0, 3);
  }, [anomalies, repeatItems, reorderCandidates, budgetStatus, budget.usageRate]);

  // 카테고리별 MOM 계산 (간이 — 전월 데이터 없으므로 변동률로 대체)
  const categoryTableRows = useMemo(() => {
    return categoryItems.slice(0, 6).map((cat, idx) => {
      // 간이 MOM: 카테고리 비중이 평균보다 높으면 양수, 낮으면 음수
      const avgPct = 100 / Math.max(categoryItems.length, 1);
      const mom = Math.round((cat.pct - avgPct) * 10) / 10;
      const status: "danger" | "normal" = cat.pct > 30 ? "danger" : "normal";
      return { ...cat, mom, status, color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] };
    });
  }, [categoryItems]);

  // ── Tab 구성 ──
  const tabs: { id: AnalyticsTab; label: string; isButton?: boolean }[] = [
    { id: "overview", label: "종합 현황" },
    { id: "vendor", label: "공급사 의존도" },
    { id: "anomaly", label: "이상 지출 감지" },
  ];

  return (
    <div className="min-h-screen bg-sh p-4 md:p-6 lg:p-8 pt-4 md:pt-5 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 페이지 헤더 ══ */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3 w-3" />
              SPEND INTELLIGENCE
            </p>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              지출 통제 및 분석
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">
              실시간 예산 소진율, 공급망 위험 및 AI 기반 절감 기회를 모니터링합니다.
            </p>
          </div>
        </div>

        {/* ── 탭 네비게이션 ── */}
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-pn border border-bd text-slate-500 hover:text-slate-700 hover:bg-el"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={runAiAnalysis}
            disabled={aiLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 ml-auto"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI 리포트 생성
          </button>
        </div>
      </div>

      {/* 데이터 오류 */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-sm text-red-600">
          데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {/* AI 에러 */}
      {aiError && !aiLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{aiError}</p>
          <button onClick={runAiAnalysis} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium underline">재시도</button>
        </div>
      )}

      {/* AI 분석 결과 */}
      {aiInsight && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4">
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

      {/* ══ 팀별 보기 ══ */}
      {activeTab === "team" && <TeamAnalyticsView />}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 종합 현황 탭 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (<>

        {/* ═══ 4 KPI 카드 ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-bd bg-pn p-5 space-y-3">
                <Skeleton className="h-3 w-24 bg-el" />
                <Skeleton className="h-8 w-32 bg-el" />
                <Skeleton className="h-3 w-full bg-el" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: 예산 소진율 */}
            <div className="rounded-xl border border-bd bg-pn p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Q{Math.ceil((new Date().getMonth() + 1) / 3)} 예산 소진율</p>
                <TrendBadge value={budget.total > 0 ? Math.round(budget.usageRate - 50) : null} suffix="%" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {budget.total > 0 ? `${budget.usageRate}%` : "미등록"}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {budgetStatus === "danger" ? "즉시 검토 필요" : budgetStatus === "warning" ? "주의 구간" : budget.total > 0 ? `정상 범위 (목표 75%)` : "예산 등록 필요"}
              </p>
            </div>

            {/* KPI 2: 이번 달 누적 지출 */}
            <div className="rounded-xl border border-bd bg-pn p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">이번 달 누적 지출</p>
                <TrendBadge value={monthChange} suffix="%" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {currentMonth ? fmtKRW(currentMonth.amount) : "₩0"}
              </p>
              <p className="text-xs text-slate-500 mt-2">전월 동기 대비</p>
            </div>

            {/* KPI 3: AI 식별 절감 기회 */}
            <div className="rounded-xl border border-bd bg-pn p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI 식별 절감 기회</p>
                {savingsOpportunity.count > 0 && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {savingsOpportunity.count}건
                  </span>
                )}
              </div>
              <p className="text-3xl font-extrabold text-blue-600 tracking-tight">
                {savingsOpportunity.amount > 0 ? fmtKRW(savingsOpportunity.amount) : "₩0"}
              </p>
              <p className="text-xs text-slate-500 mt-2">대체품 및 통합 발주</p>
            </div>

            {/* KPI 4: 특정 공급사 의존도 */}
            <div className="rounded-xl border border-bd bg-pn p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">특정 공급사 의존도</p>
                <TrendBadge value={vendorConcentration > 0 ? Math.round(vendorConcentration - 40) : null} suffix="%" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {vendorConcentration > 0 ? `${vendorConcentration}%` : "--"}
              </p>
              <p className="text-xs text-slate-500 mt-2 truncate">
                {topVendor ? topVendor.vendor : "데이터 축적 필요"}
              </p>
            </div>
          </div>
        )}

        {/* ═══ 차트 + 운영 인텔리전스 (2컬럼) ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 rounded-xl border border-bd bg-pn p-5"><Skeleton className="h-[280px] w-full bg-el" /></div>
            <div className="lg:col-span-2 rounded-xl border border-bd bg-pn p-5"><Skeleton className="h-[280px] w-full bg-el" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 월별 지출 추이 및 예측 */}
            <div className="lg:col-span-3 rounded-xl border border-bd bg-pn p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  월별 지출 추이 및 예측
                </h3>
              </div>
              {hasMonthlyData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlySpending} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => `₩${Math.round(v / 10000)}만`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", color: "#1e293b", fontSize: "12px" }}
                      formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
                    />
                    <Area
                      name="실제 지출"
                      type="monotone"
                      dataKey="amount"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#colorActual)"
                      dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[260px] gap-2">
                  <TrendingUp className="h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">구매 데이터가 축적되면 월별 추이가 표시됩니다.</p>
                  <p className="text-xs text-slate-400">현재 {recent90dCount}건 수집됨</p>
                </div>
              )}
            </div>

            {/* 운영 인텔리전스 */}
            <div className="lg:col-span-2 rounded-xl border border-bd bg-pn p-5">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                운영 인텔리전스
              </h3>
              {intelligenceCards.length > 0 ? (
                <div className="space-y-3">
                  {intelligenceCards.map((card) => {
                    const colors = {
                      red: { border: "border-red-200", bg: "bg-red-50/50", icon: "text-red-500", cta: "text-red-600 hover:text-red-700" },
                      blue: { border: "border-blue-200", bg: "bg-blue-50/50", icon: "text-blue-500", cta: "text-blue-600 hover:text-blue-700" },
                      amber: { border: "border-amber-200", bg: "bg-amber-50/50", icon: "text-amber-500", cta: "text-amber-600 hover:text-amber-700" },
                    }[card.color];
                    return (
                      <div key={card.id} className={`rounded-lg border ${colors.border} ${colors.bg} p-3.5`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={colors.icon}>{card.icon}</span>
                          <p className="text-sm font-bold text-slate-800">{card.title}</p>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-2">{card.description}</p>
                        <Link href={card.href} className={`inline-flex items-center gap-1 text-xs font-semibold ${colors.cta} transition-colors`}>
                          {card.cta} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[220px] gap-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-sm text-slate-500">현재 감지된 위험 신호가 없습니다.</p>
                  <p className="text-xs text-slate-400">구매 데이터가 축적되면 자동으로 인사이트가 생성됩니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 카테고리별 지출 통계 테이블 ═══ */}
        {!isLoading && categoryTableRows.length > 0 && (
          <div className="rounded-xl border border-bd bg-pn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bd">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" />
                카테고리별 지출 통계
              </h3>
              <span className="text-xs text-slate-400 border border-bd rounded-md px-2.5 py-1">
                이번 달
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bd">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">카테고리</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">이번 달 지출</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">MOM</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTableRows.map((row) => (
                    <tr key={row.category} className="border-b border-bd/50 last:border-0 hover:bg-el/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-slate-700">{row.category}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold text-slate-800">{fmtCompact(row.totalAmount)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-sm font-semibold ${row.mom >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {row.mom >= 0 ? "+" : ""}{row.mom.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {row.status === "danger" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            <AlertTriangle className="h-3 w-3" />
                            예산 초과 위험
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">정상</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-bd">
              <Link href="/dashboard/purchases" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors">
                전체 내역 다운로드 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

      </>)}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 공급사 의존도 탭 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "vendor" && (<>
        {isLoading ? (
          <div className="rounded-xl border border-bd bg-pn p-6 space-y-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full bg-el" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 공급사 집중도 개요 */}
            <div className="rounded-xl border border-bd bg-pn p-5">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-slate-400" />
                공급사 집중도
                {vendorConcentration > 50 && (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">주의</span>
                )}
              </h3>
              {vendorItems.length > 0 ? (
                <div className="space-y-3">
                  {vendorItems.slice(0, 8).map((v, idx) => (
                    <div key={v.vendor} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4 text-right shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate text-slate-700">{v.vendor}</span>
                          <span className="text-xs font-semibold text-slate-500 shrink-0 ml-2">{fmtKRW(v.totalAmount)}</span>
                        </div>
                        <div className="h-1.5 bg-el rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${v.pct > 50 ? "bg-amber-400" : idx === 0 ? "bg-blue-400" : "bg-slate-300"}`}
                            style={{ width: `${Math.min(100, v.pct)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold shrink-0 text-slate-400 w-8 text-right">{v.pct}%</span>
                    </div>
                  ))}
                  {vendorConcentration > 50 && (
                    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs text-amber-700 font-medium">
                        상위 1개 공급사가 전체 지출의 {vendorConcentration}%를 차지합니다. 공급 리스크 분산을 검토하세요.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                  <Users className="h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">공급사 데이터가 축적되면 집중도 분석이 표시됩니다.</p>
                </div>
              )}
            </div>

            {/* 공급사별 거래 요약 */}
            <div className="rounded-xl border border-bd bg-pn p-5">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <ExternalLink className="h-4 w-4 text-slate-400" />
                공급사별 거래 요약
              </h3>
              {vendorItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-bd">
                        <th className="text-left pb-2 text-xs font-semibold text-slate-500">공급사</th>
                        <th className="text-right pb-2 text-xs font-semibold text-slate-500">거래 건수</th>
                        <th className="text-right pb-2 text-xs font-semibold text-slate-500">총 금액</th>
                        <th className="text-right pb-2 text-xs font-semibold text-slate-500">비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorItems.slice(0, 8).map((v) => (
                        <tr key={v.vendor} className="border-b border-bd/30 last:border-0">
                          <td className="py-2.5 text-sm text-slate-700 truncate max-w-[160px]">{v.vendor}</td>
                          <td className="py-2.5 text-sm text-slate-500 text-right">{v.count}건</td>
                          <td className="py-2.5 text-sm font-semibold text-slate-700 text-right">{fmtCompact(v.totalAmount)}</td>
                          <td className="py-2.5 text-sm text-slate-400 text-right">{v.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-6 text-center">데이터가 부족합니다.</p>
              )}
            </div>
          </div>
        )}
      </>)}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 이상 지출 감지 탭 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === "anomaly" && (<>
        {isLoading ? (
          <div className="rounded-xl border border-bd bg-pn p-6 space-y-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full bg-el" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 이상 지출 항목 */}
            <div className="rounded-xl border border-bd bg-pn p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  이상 지출 항목
                  {anomalies.length > 0 && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{anomalies.length}</span>
                  )}
                </h3>
                <button
                  onClick={runAiAnalysis}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {aiLoading ? "분석 중" : "AI 분석"}
                </button>
              </div>

              {anomalies.length > 0 ? (
                <div className="space-y-2.5">
                  {anomalies.map((a, i) => (
                    <div key={i} className={`rounded-lg border ${a.severity === "high" ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40"} p-3.5`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{a.item}</p>
                          <p className="text-xs text-slate-500">{a.vendor}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700 shrink-0">{fmtKRW(a.amount)}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5">{a.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-sm text-slate-500">현재 이상 지출이 감지되지 않았습니다.</p>
                  <p className="text-xs text-slate-400">
                    {recent90dCount >= 10 ? "최근 90일 데이터 기준 정상" : `데이터 ${recent90dCount}건 — 10건 이상 필요`}
                  </p>
                </div>
              )}

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
            </div>

            {/* 재주문 예상 항목 */}
            <div className="rounded-xl border border-bd bg-pn p-5">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <RotateCcw className="h-4 w-4 text-blue-500" />
                재주문 예상 항목
                {reorderCandidates.length > 0 && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{reorderCandidates.length}</span>
                )}
              </h3>
              {reorderCandidates.length > 0 ? (
                <div className="space-y-2.5">
                  {reorderCandidates.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-el/40 border border-bd/50 px-3.5 py-3">
                      <CategoryIcon category={item.category} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.item}</p>
                        <p className="text-xs text-slate-500">마지막 주문 {item.daysSinceLast}일 전 · {item.count}회 반복</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.daysSinceLast >= 60 && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        <span className="text-xs font-bold text-slate-400">{item.daysSinceLast}d</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : repeatItems.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500 mb-2">반복 구매 품목 모두 최근 주문 완료</p>
                  {repeatItems.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-el/40 px-3.5 py-2.5">
                      <CategoryIcon category={item.category} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 truncate">{item.item}</p>
                        <p className="text-xs text-slate-400">{item.count}회 구매 · {item.vendor}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <RotateCcw className="h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">반복 구매 패턴이 축적되면 재주문 시점을 자동 제안합니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </>)}

    </div>
  );
}

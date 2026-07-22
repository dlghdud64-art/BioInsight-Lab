"use client";

export const dynamic = "force-dynamic";

import { csrfFetch } from "@/lib/api-client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// §mobile-budgets 7b 진입점 ③ — 8a 단계 카드 `등록 ›` → 공용 시트(페이지 이동 대체)
import { BudgetRegisterSheet } from "@/components/budget/budget-register-sheet";
import Link from "next/link";
// §11.246b-1 — Next.js route segment config `export const dynamic` 와 충돌 회피
//   위해 alias 로 import (canonical Next.js convention).
import nextDynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// §11.246b-1 #recharts-dynamic-bundle-split — 호영님 P0 성능 #1+#5.
//   recharts (~200KB) 를 lazy load 으로 모바일 초기 hydration 단축.
//   ssr:false (recharts 는 client only), Skeleton 260px 동일 높이 placeholder.
const SpendTrendAreaChart = nextDynamic(
  () => import("@/components/analytics/spend-trend-area-chart"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full rounded-lg" />,
  },
);
// §11.196f — dead lucide imports 6 symbol 제거 (ChevronRight Clock
//   Download Gauge Search Zap actual 사용 0). 나머지 보존.
import {
  TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart,
  AlertTriangle, RotateCcw,
  CreditCard, Users, ExternalLink,
  ArrowRight, Sparkles, Loader2,
  AlertCircle, Building2, FileText, X,
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
/**
 * §11.244 Phase C #1 — 호영님 P0: 10초 timeout + AbortController.
 *   10초 초과 시 fetch abort + "지연" error throw. useQuery 가 isError 분기
 *   trigger → 재시도 button 노출. 사용자 무한 스켈레톤 차단.
 */
const ANALYTICS_TIMEOUT_MS = 10000;

async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYTICS_TIMEOUT_MS);
  try {
    const res = await fetch("/api/analytics/dashboard", { signal: controller.signal });
    if (!res.ok) throw new Error("Failed to fetch analytics data");
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("데이터 로딩이 지연되고 있습니다 (Timeout 10s)");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
  if (label.includes("소모품")) return <ShoppingCart className={`${className} text-yellow-500`} />;
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
  // §analytics-ai-report-sian — 호영님 P1 "리포트 예시 명시".
  //   시안형 AI 지출 리포트(분기요약·절감Top3·공급사 의존도·AI 권고)를 생성하는
  //   실 endpoint 는 없음 (/api/reports/purchase=구매내역, /api/budget/report=XLSX).
  //   따라서 정직하게 "예시 미리보기"(format preview) 로만 노출. 모든 수치 = 샘플.
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await csrfFetch("/api/analytics/ai-insight", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 분석 실패");
      setAiInsight({ summary: data.summary, dataPoints: data.dataPoints ?? 0, analyzedAt: data.analyzedAt ?? new Date().toISOString() });
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI 분석 중 오류 발생");
    } finally {
      setAiLoading(false);
    }
  };

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsDashboardData>({
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
  // §11.244 #6 — 호영님 P0: AI 리포트 disabled derive. monthly spending 0 = AI
  //   분석 무의미 (Anthropic/Gemini 호출 시 빈 데이터 → 빈 리포트 또는 에러).
  const dataInsufficient = !hasMonthlyData;

  // §11.244 Phase B #4 — 호영님 P0: 빈 차트 mockup data (§11.243b 패턴 reuse).
  //   실제 데이터 1건+ 시 자동 hide (hasMonthlyData / vendorItems / anomalies 분기).
  //   회색 톤 표시 전용 — overlay 안내로 실제 데이터와 혼동 0.
  const MOCKUP_MONTHLY_DATA = [
    { month: "12월", amount: 3_200_000 },
    { month: "1월", amount: 4_100_000 },
    { month: "2월", amount: 3_800_000 },
    { month: "3월", amount: 5_200_000 },
    { month: "4월", amount: 4_700_000 },
    { month: "5월", amount: 5_900_000 },
  ];
  const MOCKUP_VENDOR_DATA = [
    { vendor: "공급사 A", pct: 42 },
    { vendor: "공급사 B", pct: 28 },
    { vendor: "공급사 C", pct: 18 },
    { vendor: "기타", pct: 12 },
  ];

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

  // 지출 인사이트 카드 생성 (spend-only 항목만)
  // 비-지출 항목(통합 발주 기회, 공급 지연 위험, 비교 검토 필요 등)은 제외
  const intelligenceCards = useMemo(() => {
    const cards: { id: string; icon: React.ReactNode; title: string; description: string; cta: string; href: string; color: "red" | "blue" | "amber" }[] = [];

    // 단가 인상 / 이상 지출 감지
    if (anomalies.length > 0 && anomalies[0].severity === "high") {
      cards.push({
        id: "price-alert",
        icon: <AlertTriangle className="h-4 w-4" />,
        title: "단가 인상 감지",
        description: `${anomalies[0].vendor}의 '${anomalies[0].item}' ${anomalies[0].reason}`,
        cta: "관련 지출 확인",
        href: "/dashboard/reports",
        color: "red",
      });
    }

    // 공급사 집중도 위험
    if (vendorConcentration >= 60 && topVendor) {
      cards.push({
        id: "vendor-concentration",
        icon: <AlertCircle className="h-4 w-4" />,
        title: "공급사 집중도 위험",
        description: `${topVendor.vendor ?? "상위 공급사"}에 지출의 ${vendorConcentration}%가 집중되어 있습니다.`,
        cta: "공급사별 분석",
        href: "/dashboard/reports",
        color: "amber",
      });
    }

    // 예산 초과 위험
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

  // ══════════════════════════════════════════════════════════════
  // §11.244-sian Phase 1 — 빈상태 온보딩 (호영님 시안 honesty 무위험 부분)
  // ══════════════════════════════════════════════════════════════
  // canonical 빈상태 판정: 월별 지출 0건 AND topSpending 0건 = 발주 데이터 미수집.
  //   데이터 1건+ 시 자동 false → 기존 실제 차트 경로 그대로 (변경 0).
  const spendDataEmpty = !hasMonthlyData && topSpending.length === 0;
  // 예산 등록 여부 = canonical budget.total > 0.
  const budgetRegistered = budget.total > 0;
  // 활성화 3단계 (canonical derive — 하드코딩 금지):
  //   ① 워크스페이스 생성 (페이지 도달 = 항상 done)
  //   ② 예산 등록 (done = budget.total > 0)
  //   ③ 첫 발주 완료 (done = 지출 데이터 존재 = !spendDataEmpty)
  const onboardingSteps = [
    { id: "workspace", label: "워크스페이스 생성", done: true, href: null as string | null, cta: null as string | null },
    { id: "budget", label: "예산 등록", done: budgetRegistered, href: "/dashboard/budget", cta: "예산 등록" },
    { id: "first-order", label: "첫 발주 완료", done: !spendDataEmpty, href: "/app/search", cta: "소싱에서 시작" },
  ];
  const onboardingDoneCount = onboardingSteps.filter((s) => s.done).length;
  const onboardingRemaining = onboardingSteps.length - onboardingDoneCount;
  // 미리보기 sparkline 좌표 (장식 — 실수치 아님, "미리보기" 명시).
  const PREVIEW_SPARK_POINTS = "0,46 40,38 80,42 120,28 160,32 200,18 240,22 280,8";

  // §mobile-budgets 8a — 공용 등록 시트(모바일 통합 카드 `등록 ›`)
  const queryClient = useQueryClient();
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);

  // ── Tab 구성 ──
  const tabs: { id: AnalyticsTab; label: string; isButton?: boolean }[] = [
    { id: "overview", label: "종합 현황" },
    { id: "vendor", label: "공급사 의존도" },
    { id: "anomaly", label: "이상 지출 감지" },
  ];

  return (
    <div className="w-full bg-canvas min-h-screen">
      {/* §dashboard-surface-unify — 회색 캔버스 full-width 외곽 + 콘텐츠 max-w-7xl 중앙(중앙 회색 컬럼 방지). */}
      <div className="p-4 md:p-6 lg:p-8 pt-4 md:pt-5 space-y-5 max-w-7xl mx-auto w-full">

      {/* ══ 페이지 헤더 ══ */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
              지출 분석
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">
              예산 소진, 공급사 의존도, 이상 지출 신호를 확인합니다.
            </p>
          </div>
        </div>

        {/* ── 탭 네비게이션 ── */}
        <div className="relative">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap touch-manipulation active:scale-95 ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-pn border border-bd text-slate-500 hover:text-slate-700 hover:bg-el"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {/* §11.244 #6 — 호영님 P0: 데이터 부족 시 AI 리포트 disabled + tooltip.
              dataInsufficient = !hasMonthlyData (월별 지출 0건 시). aiLoading 과
              OR 처리 → 데이터 없을 때 mutation 호출 자체 차단. */}
          {/* §analytics-ai-report-sian — 호영님 P1 "리포트 예시 명시".
              실 endpoint 부재 → "예시 미리보기" 모달만 오픈 (dead button 아님:
              실제 모달 노출 동작). 기존 "AI 리포트 생성"(실 endpoint) 과 별개. */}
          <button
            onClick={() => setReportModalOpen(true)}
            className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold bg-pn border border-bd text-slate-600 hover:bg-el hover:text-slate-800 shadow-sm transition-colors flex items-center gap-1.5 ml-auto whitespace-nowrap touch-manipulation active:scale-95"
          >
            <FileText className="h-3.5 w-3.5" />
            AI 리포트 예시
          </button>
          <button
            onClick={runAiAnalysis}
            disabled={aiLoading || dataInsufficient}
            title={
              dataInsufficient
                ? "리포트 생성에 최소 1건의 완료된 발주 데이터가 필요합니다"
                : undefined
            }
            className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap touch-manipulation active:scale-95"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI 리포트 생성
          </button>
        </div>
        {/* §mobile-budgets §3 — 탭 칩 잘림 우측 페이드 힌트(모바일) */}
        <span className="md:hidden pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-canvas to-transparent" aria-hidden />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* §analytics-ai-report-sian — AI 지출 리포트 · 예시 미리보기 모달 */}
      {/* 실 endpoint 부재 → 형식(format) 미리보기 전용. 모든 수치 = 샘플.       */}
      {/* honesty: 헤더 "예시 미리보기" + 상단 배너 + 풋터 고지 = 3곳 명시.       */}
      {/* dead button 0: PDF 저장 버튼 없음 (실 다운로드 부재). 닫기만.          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {reportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setReportModalOpen(false)}
          data-testid="ai-report-modal"
        >
          <div
            className="bg-pn w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-bd shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── 모달 헤더 ── */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-bd bg-pn">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-slate-900 truncate">
                    AI 지출 리포트 · 예시 미리보기
                  </h3>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    발주 데이터가 쌓이면 이 형식으로 자동 생성됩니다
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                aria-label="닫기"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-el hover:text-slate-700 transition-colors touch-manipulation active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── 상단 예시 고지 배너 (prominent) ── */}
            <div className="mx-5 mt-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-blue-800 break-keep">예시 리포트입니다.</p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed break-keep">
                    실제 발주 데이터가 쌓이면 이 형식으로 AI가 자동 생성합니다. (아래 수치는 샘플)
                  </p>
                </div>
              </div>
            </div>

            {/* ── 본문 섹션 ── */}
            <div className="p-5 space-y-5">

              {/* 섹션 1: 분기 요약 (샘플) */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  분기 요약 <span className="text-slate-400 font-semibold normal-case tracking-normal">· 샘플</span>
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-bd bg-el/30 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">총지출</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1 tracking-tight">₩2,840만</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">예시</p>
                  </div>
                  <div className="rounded-xl border border-bd bg-el/30 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">예산 소진율</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1 tracking-tight">71%</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">예시</p>
                  </div>
                  <div className="rounded-xl border border-bd bg-el/30 p-3">
                    <p className="text-[11px] font-semibold text-slate-500">AI 절감</p>
                    <p className="text-lg font-extrabold text-blue-600 mt-1 tracking-tight">₩340만</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">예시</p>
                  </div>
                </div>
              </section>

              {/* 섹션 2: AI 절감 기회 Top3 (샘플) */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  AI 절감 기회 Top 3 <span className="text-slate-400 font-semibold normal-case tracking-normal">· 샘플</span>
                </h4>
                <ul className="space-y-2">
                  {[
                    { rank: 1, title: "대체품 전환", desc: "동급 시약 대체 시 단가 18% 절감 가능 (예시)", save: "₩150만" },
                    { rank: 2, title: "통합 발주", desc: "반복 소모품 3종 통합 발주로 배송·단가 절감 (예시)", save: "₩120만" },
                    { rank: 3, title: "단가 재협상", desc: "상위 공급사 거래량 기준 단가 재협상 여지 (예시)", save: "₩70만" },
                  ].map((opp) => (
                    <li key={opp.rank} className="flex items-center gap-3 rounded-xl border border-bd bg-pn px-3.5 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                        {opp.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{opp.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 break-keep">{opp.desc}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0 tabular-nums">{opp.save}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 섹션 3: 공급사 의존도 (샘플 바) */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  공급사 의존도 <span className="text-slate-400 font-semibold normal-case tracking-normal">· 샘플</span>
                </h4>
                <ul className="space-y-2.5 rounded-xl border border-bd bg-pn p-3.5">
                  {[
                    { name: "공급사 A", pct: 42, color: "#3b82f6" },
                    { name: "공급사 B", pct: 28, color: "#10b981" },
                    { name: "공급사 C", pct: 18, color: "#8b5cf6" },
                    { name: "기타", pct: 12, color: "#94a3b8" },
                  ].map((bar) => (
                    <li key={bar.name} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-700 w-16 truncate">{bar.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, backgroundColor: bar.color }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-10 text-right tabular-nums">{bar.pct}%</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 섹션 4: AI 권고 (샘플) */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  AI 권고 <span className="text-slate-400 font-semibold normal-case tracking-normal">· 샘플</span>
                </h4>
                <ul className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                  {[
                    "공급사 A 집중도(42%)가 높아 분산 검토를 권고합니다. (예시)",
                    "반복 소모품의 통합 발주 주기를 월 1회로 조정하면 단가 절감이 기대됩니다. (예시)",
                    "Q 예산 소진율 71% — 잔여 분기 지출 페이스 유지 시 예산 내 마감 가능합니다. (예시)",
                  ].map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-700 leading-relaxed break-keep">{rec}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* ── 풋터: 예시 고지 + 닫기 (PDF 저장 버튼 없음 — dead button 금지) ── */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-bd bg-pn">
              <p className="text-[11px] text-slate-500 break-keep min-w-0">
                예시 데이터 기준 · 실제 리포트는 발주 누적 시 생성
              </p>
              <button
                onClick={() => setReportModalOpen(false)}
                className="shrink-0 inline-flex items-center justify-center h-10 px-5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors touch-manipulation active:scale-95"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §11.244 Phase C #2 — 호영님 P0: 데이터 오류 + 10초 timeout + 재시도 button.
          AbortController abort 시 "데이터 로딩이 지연되고 있습니다 (Timeout 10s)"
          error throw → isError true → refetch() onClick 으로 즉시 재시도. */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-red-600">
            데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </div>
          <button
            onClick={() => refetch()}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            재시도
          </button>
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

        {/* ══════════════════════════════════════════════════════════ */}
        {/* §11.244-sian Phase 1 — 빈상태 온보딩 (발주 데이터 0건일 때만) */}
        {/* 데이터 1건+ 시 spendDataEmpty=false → 아래 기존 차트 경로 그대로 노출 */}
        {/* ══════════════════════════════════════════════════════════ */}
        {!isLoading && spendDataEmpty && (
          <div className="space-y-5" data-testid="analytics-onboarding">
            {/* §mobile-budgets §3 — 모바일: 히어로+체크리스트 통합 단일 카드(중복 0). CTA = 현재 단계 1개만.
                초록 = 완료 표시만(대형 초록 CTA 금지). 단계 데이터 = 기존 onboardingSteps canonical derive 소비. */}
            <div className="md:hidden rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#16233f,#1d3157)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#93c5fd" }}>
                  분석 활성화 · {onboardingDoneCount}/{onboardingSteps.length} 완료
                </p>
                <div className="flex gap-1" aria-hidden>
                  {onboardingSteps.map((st) => (
                    <span key={st.id} className={`w-1.5 h-1.5 rounded-full ${st.done ? "bg-emerald-400" : "bg-white/25"}`} />
                  ))}
                </div>
              </div>
              <h3 className="text-[15px] font-extrabold mt-1.5 break-keep">첫 발주가 완료되면 지출 분석이 자동으로 켜집니다</h3>
              <ul className="mt-3 space-y-1.5">
                {onboardingSteps.map((step, idx) => {
                  const isCurrent = !step.done && onboardingSteps.slice(0, idx).every((x) => x.done);
                  return (
                    <li key={step.id} className="flex items-center gap-2.5 min-h-[44px]">
                      <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold flex-none ${step.done ? "bg-emerald-500 text-white" : isCurrent ? "bg-blue-500 text-white" : "bg-white/15 text-slate-400"}`}>
                        {step.done ? "✓" : idx + 1}
                      </span>
                      <span className={`flex-1 text-[13px] ${step.done ? "line-through text-slate-400" : isCurrent ? "font-bold text-white" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                      {isCurrent && step.id === "budget" && (
                        <button type="button" onClick={() => setBudgetSheetOpen(true)} className="min-h-[44px] text-[12px] font-bold" style={{ color: "#93c5fd" }}>
                          등록 ›
                        </button>
                      )}
                      {isCurrent && step.id === "first-order" && (
                        <Link href="/app/search" className="min-h-[44px] inline-flex items-center text-[12px] font-bold" style={{ color: "#93c5fd" }}>
                          소싱에서 시작 ›
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ── 온보딩 히어로 (네이비) ── */}
            <div className="hidden md:block rounded-2xl bg-slate-900 text-white p-5 md:p-7 overflow-hidden relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-300/90">
                분석 활성화까지 {onboardingRemaining}단계
              </p>
              <h2 className="text-lg md:text-2xl font-extrabold tracking-tight mt-1.5 break-keep">
                첫 발주가 완료되면 지출 분석이 자동으로 켜집니다
              </h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed max-w-2xl break-keep">
                예산 소진율, 공급사 의존도, 이상 지출 신호는 모두 실제 발주 데이터에서 계산됩니다.
                지금은 0건 수집됨 — 첫 발주가 완료되면 아래 미리보기가 실제 차트로 전환됩니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
                <Link
                  href="/app/search"
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors touch-manipulation active:scale-95"
                >
                  <ShoppingCart className="h-4 w-4" />
                  소싱에서 시작
                </Link>
                <Link
                  href="/dashboard/budget"
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-lg bg-white/10 text-white text-sm font-semibold border border-white/20 hover:bg-white/20 transition-colors touch-manipulation active:scale-95"
                >
                  <CreditCard className="h-4 w-4" />
                  예산 먼저 등록
                </Link>
              </div>
            </div>

            {/* ── 활성화 3단계 체크리스트 ── */}
            <div className="hidden md:block rounded-xl border border-bd bg-pn p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">활성화 단계</h3>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {onboardingDoneCount} / {onboardingSteps.length} 완료
                </span>
              </div>
              <ol className="space-y-2.5">
                {onboardingSteps.map((step, idx) => {
                  // 현재 단계 = 첫 미완료 단계 (primary 강조)
                  const isCurrent = !step.done && onboardingSteps.slice(0, idx).every((s) => s.done);
                  return (
                    <li
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 ${
                        step.done
                          ? "border-emerald-200 bg-emerald-50/50"
                          : isCurrent
                            ? "border-blue-300 bg-blue-50/50"
                            : "border-bd bg-pn"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          step.done
                            ? "bg-emerald-600 text-white"
                            : isCurrent
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {step.done ? "✓" : idx + 1}
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          step.done ? "text-slate-700" : isCurrent ? "text-slate-900" : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      {!step.done && step.href && step.cta && (
                        <Link
                          href={step.href}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 shrink-0"
                        >
                          {step.cta} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* §mobile-budgets §3 — 모바일 분석 미리보기: 접힌 행 3(소진율·의존도·이상 감지), 데이터 시 제자리 확장 */}
            <div className="md:hidden bg-white rounded-2xl border border-[#e6eaf0] px-4 py-1.5 divide-y divide-slate-100">
              {budgetRegistered ? (
                <div className="py-3.5">
                  <p className="text-[13px] font-bold text-slate-800">예산 소진율</p>
                  <p className="text-[12px] text-slate-500 mt-0.5 tabular-nums">현재 {budget.usageRate}% · 발주가 쌓이면 추이가 그려져요</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-3 min-h-[44px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-700">예산 소진율</p>
                    <p className="text-[11px] text-slate-400">예산 등록 시 채워집니다</p>
                  </div>
                  <span className="text-[11px] text-slate-300" aria-disabled="true">›</span>
                </div>
              )}
              <div className="flex items-center gap-3 py-3 min-h-[44px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-700">공급사 의존도</p>
                  <p className="text-[11px] text-slate-400">발주 공급사 비중을 분석해요</p>
                </div>
                <span className="text-[11px] text-slate-300" aria-disabled="true">›</span>
              </div>
              <div className="flex items-center gap-3 py-3 min-h-[44px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-700">이상 지출 감지</p>
                  <p className="text-[11px] text-slate-400">3개월 이상 데이터 축적 시 활성화</p>
                </div>
                <span className="text-[11px] text-slate-300" aria-disabled="true">›</span>
              </div>
            </div>

            {/* ── KPI 4 고도화 (언제 채워지는지 힌트 + ghost bar) ── */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {/* KPI 1: Q 예산 소진율 */}
              <div className="rounded-xl border border-bd bg-pn p-3 md:p-4">
                <p className="text-xs font-semibold text-slate-500">Q{Math.ceil((new Date().getMonth() + 1) / 3)} 예산 소진율</p>
                <p className="text-lg md:text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                  {budgetRegistered ? `${budget.usageRate}%` : "미등록"}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-200" style={{ width: "30%" }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 break-keep">예산 등록 시 채워집니다</p>
              </div>
              {/* KPI 2: 이번 달 누적 지출 */}
              <div className="rounded-xl border border-bd bg-pn p-3 md:p-4">
                <p className="text-xs font-semibold text-slate-500">이번 달 누적 지출</p>
                <p className="text-lg md:text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">₩0</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-200" style={{ width: "20%" }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 break-keep">발주 완료 시 채워집니다</p>
              </div>
              {/* KPI 3: AI 식별 절감 기회 */}
              <div className="rounded-xl border border-bd bg-pn p-3 md:p-4">
                <p className="text-xs font-semibold text-slate-500">AI 식별 절감 기회</p>
                <p className="text-lg md:text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">--</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-200" style={{ width: "25%" }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 break-keep">발주 데이터로 AI 자동 산출</p>
              </div>
              {/* KPI 4: 특정 공급사 의존도 */}
              <div className="rounded-xl border border-bd bg-pn p-3 md:p-4">
                <p className="text-xs font-semibold text-slate-500">특정 공급사 의존도</p>
                <p className="text-lg md:text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">--</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-200" style={{ width: "40%" }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 break-keep">발주 3건+ 누적 시 산출</p>
              </div>
            </div>

            {/* ── 미리보기 차트 2개 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* 월별 지출 추이 미리보기 (점선 sparkline = 장식) */}
              <div className="lg:col-span-3 rounded-xl border border-bd bg-pn p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                    월별 지출 추이
                  </h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    미리보기
                  </span>
                </div>
                <svg viewBox="0 0 280 56" className="w-full h-[120px]" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    points={PREVIEW_SPARK_POINTS}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-xs text-slate-400 mt-2 break-keep">
                  발주 데이터가 쌓이면 이렇게 표시됩니다 (예시 — 실제 수치 아님)
                </p>
              </div>

              {/* 지출 인사이트 미리보기 (ghost rows) */}
              <div className="lg:col-span-2 rounded-xl border border-bd bg-pn p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-slate-300" />
                    지출 인사이트
                  </h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    대기
                  </span>
                </div>
                <div className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border border-bd bg-el/30 p-3 space-y-2">
                      <div className="h-2.5 w-2/3 rounded bg-slate-200" />
                      <div className="h-2 w-full rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3 break-keep">
                  데이터가 축적되면 자동 생성됩니다 (예시 미리보기)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 데이터-있음 경로 (기존 차트/KPI/테이블 전부 보존, spendDataEmpty 시 hide) ═══ */}
        {!spendDataEmpty && (<>
        {/* ═══ 4 KPI 카드 ═══ */}
        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="min-w-[160px] snap-start shrink-0 sm:min-w-0 sm:shrink rounded-xl border border-bd bg-pn p-4 sm:p-5 space-y-3">
                <Skeleton className="h-3 w-24 bg-el" />
                <Skeleton className="h-8 w-32 bg-el" />
                <Skeleton className="h-3 w-full bg-el" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0">
            {/* KPI 1: 예산 소진율 */}
            <div className="min-w-[160px] snap-start shrink-0 sm:min-w-0 sm:shrink rounded-xl border border-bd bg-pn p-4 sm:p-5 hover:shadow-md transition-shadow">
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
            <div className="min-w-[160px] snap-start shrink-0 sm:min-w-0 sm:shrink rounded-xl border border-bd bg-pn p-4 sm:p-5 hover:shadow-md transition-shadow">
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
            <div className="min-w-[160px] snap-start shrink-0 sm:min-w-0 sm:shrink rounded-xl border border-bd bg-pn p-4 sm:p-5 hover:shadow-md transition-shadow">
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
            <div className="min-w-[160px] snap-start shrink-0 sm:min-w-0 sm:shrink rounded-xl border border-bd bg-pn p-4 sm:p-5 hover:shadow-md transition-shadow">
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

        {/* ═══ 차트 + 지출 인사이트 (2컬럼) ═══ */}
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
                <SpendTrendAreaChart data={monthlySpending} variant="real" />
              ) : (
                /* §11.244 Phase B #4a — 호영님 P0: 빈 차트 mockup + 반투명 overlay
                   (§11.243b 패턴 reuse). 회색 톤 sample AreaChart + backdrop-blur
                   안내 — "쌓이면 무엇을 볼 수 있는지" 사전 인지. */
                <div className="relative h-[260px]">
                  <div className="h-full opacity-40 grayscale pointer-events-none">
                    <SpendTrendAreaChart data={MOCKUP_MONTHLY_DATA} variant="mockup" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px] bg-white/40">
                    <div className="text-center px-6 max-w-md">
                      <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        발주 데이터가 쌓이면 월별 지출 트렌드와 카테고리별 비중을 확인할 수 있습니다
                      </p>
                      <p className="text-xs text-slate-500 break-keep">
                        첫 발주 완료 후 자동 활성화 · 현재 {recent90dCount}건 수집됨
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 지출 인사이트 */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                지출 인사이트
              </h3>
              {intelligenceCards.length > 0 ? (
                <div className="space-y-3">
                  {intelligenceCards.map((card) => {
                    const colors = {
                      red: { border: "border-red-200", bg: "bg-red-50/50", icon: "text-red-500", cta: "text-red-600 hover:text-red-700" },
                      blue: { border: "border-blue-200", bg: "bg-blue-50/50", icon: "text-blue-500", cta: "text-blue-600 hover:text-blue-700" },
                      amber: { border: "border-yellow-200", bg: "bg-yellow-50/50", icon: "text-yellow-500", cta: "text-yellow-600 hover:text-yellow-700" },
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

        {/* ═══ §11.205 공급사 점유율 + 실시간 이상 지출 로그 (호영님 시안 정합) ═══ */}
        {/* 좌: TOP SUPPLIER DEPENDENCY MATRIX (vendorItems top 3 + Others 합계 horizontal bar)
            우: AUTOMATED RISK MONITORING (anomalies severity 색상 list)
            데이터 0 시 placeholder + 축적 안내. canonical truth 변경 0 — 기존 derived
            (vendorItems / anomalies) 재사용. */}
        {!isLoading && (() => {
          // 상위 3 + Others (vendorItems 4개+ 일 때 합계)
          const top3 = vendorItems.slice(0, 3);
          const othersAmount = vendorItems.slice(3).reduce((s, v) => s + v.totalAmount, 0);
          const othersCount = Math.max(0, vendorItems.length - 3);
          const supplierBars: Array<{ name: string; amount: number; percent: number; color: string }> = [];
          if (vendorTotal > 0) {
            const palette = ["#3b82f6", "#10b981", "#f59e0b", "#94a3b8"]; // blue / emerald / amber / slate
            top3.forEach((v, i) => {
              supplierBars.push({
                name: v.vendor ?? "공급사",
                amount: v.totalAmount,
                percent: Math.round((v.totalAmount / vendorTotal) * 1000) / 10,
                color: palette[i] ?? "#94a3b8",
              });
            });
            if (othersAmount > 0) {
              supplierBars.push({
                name: othersCount > 0 ? `Others (${othersCount}+)` : "Others",
                amount: othersAmount,
                percent: Math.round((othersAmount / vendorTotal) * 1000) / 10,
                color: palette[3],
              });
            }
          }
          const maxPercent = supplierBars[0]?.percent ?? 0;
          const totalSignals = anomalies.length;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 좌: 공급사 점유율 분석 */}
              <div className="rounded-xl border border-bd bg-pn p-5 shadow-sm">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">공급사 점유율 분석</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      Top Supplier Dependency Matrix
                    </p>
                  </div>
                  {supplierBars.length > 0 && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900 leading-none">{maxPercent.toFixed(1)}%</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mt-1">
                        Max Concent.
                      </p>
                    </div>
                  )}
                </div>
                {supplierBars.length > 0 ? (
                  <ul className="space-y-3">
                    {supplierBars.map((bar) => (
                      <li key={bar.name} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-700 w-24 truncate" title={bar.name}>
                          {bar.name}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(2, (bar.percent / Math.max(maxPercent, 1)) * 100)}%`,
                              backgroundColor: bar.color,
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-12 text-right tabular-nums">
                          {bar.percent.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                    <Building2 className="h-8 w-8 text-slate-200" />
                    <p className="text-sm text-slate-400">공급사 데이터가 축적되면 점유율 매트릭스가 표시됩니다.</p>
                  </div>
                )}
              </div>

              {/* 우: 실시간 이상 지출 로그 */}
              <div className="rounded-xl border border-bd bg-pn p-5 shadow-sm">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">실시간 이상 지출 로그</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      Automated Risk Monitoring
                    </p>
                  </div>
                  {totalSignals > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                      </span>
                      {totalSignals} New Signals
                    </span>
                  )}
                </div>
                {anomalies.length > 0 ? (
                  <ul className="space-y-2.5">
                    {anomalies.slice(0, 4).map((a, idx) => {
                      const isHigh = a.severity === "high";
                      const accent = isHigh ? "border-l-rose-500" : "border-l-yellow-400";
                      return (
                        <li
                          key={`${a.item}-${idx}`}
                          className={`flex items-start gap-3 pl-3 py-2 border-l-[3px] ${accent}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {a.item}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{a.reason}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-400 truncate max-w-[100px]" title={a.vendor}>
                              {a.vendor || "공급사 미상"}
                            </p>
                            <p className="text-xs font-semibold text-slate-700 mt-0.5 tabular-nums">
                              {fmtCompact(a.amount)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                    <Sparkles className="h-8 w-8 text-emerald-200" />
                    <p className="text-sm text-slate-400">감지된 이상 지출 신호가 없습니다.</p>
                    <p className="text-xs text-slate-400">구매 데이터가 축적되면 자동으로 감지됩니다.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
                  <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">주의</span>
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
                            className={`h-full rounded-full transition-all ${v.pct > 50 ? "bg-yellow-400" : idx === 0 ? "bg-blue-400" : "bg-slate-300"}`}
                            style={{ width: `${Math.min(100, v.pct)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold shrink-0 text-slate-400 w-8 text-right">{v.pct}%</span>
                    </div>
                  ))}
                  {vendorConcentration > 50 && (
                    <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                      <p className="text-xs text-yellow-700 font-medium">
                        상위 1개 공급사가 전체 지출의 {vendorConcentration}%를 차지합니다. 공급 리스크 분산을 검토하세요.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* §11.244 Phase B #4b — 호영님 P0: 공급사 의존도 mockup + overlay. */
                <div className="relative h-[200px]">
                  <div className="space-y-3 opacity-40 grayscale pointer-events-none">
                    {MOCKUP_VENDOR_DATA.map((v, idx) => (
                      <div key={v.vendor} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-4 text-right shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate text-slate-700">{v.vendor}</span>
                          </div>
                          <div className="h-1.5 bg-el rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-slate-400" style={{ width: `${v.pct}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-bold shrink-0 text-slate-400 w-8 text-right">{v.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px] bg-white/40">
                    <div className="text-center px-6 max-w-md">
                      <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        복수 공급사 거래 시 특정 공급사에 대한 의존도를 분석합니다
                      </p>
                      <p className="text-xs text-slate-500 break-keep">
                        집중도가 높으면 리스크 알림을 제공합니다 · 2개 이상 공급사 거래 데이터 필요
                      </p>
                    </div>
                  </div>
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
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  이상 지출 항목
                  {anomalies.length > 0 && (
                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">{anomalies.length}</span>
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
                    <div key={i} className={`rounded-lg border ${a.severity === "high" ? "border-red-200 bg-red-50/40" : "border-yellow-200 bg-yellow-50/40"} p-3.5`}>
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
                /* §11.244 Phase B #4c + #7 — 호영님 P0: 이상 지출 빈 상태 메시지
                   강화 + mockup 안내. "쌓이면 무엇을 감지하는지" 사전 인지. */
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {recent90dCount >= 10 ? "현재 이상 지출이 감지되지 않았습니다" : "이상 지출 감지가 활성화되지 않았습니다"}
                  </p>
                  <p className="text-xs text-slate-500 max-w-md break-keep leading-relaxed">
                    과거 거래 대비 비정상적인 가격 변동, 비정상 발주 패턴을 자동으로 감지합니다.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {recent90dCount >= 10
                      ? "최근 90일 데이터 기준 정상"
                      : `데이터 ${recent90dCount}건 — 3개월 이상 데이터 축적 시 활성화 (최소 10건 필요)`}
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
                        {item.daysSinceLast >= 60 && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
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


      {/* §mobile-budgets 7b 진입점 ③ — 등록 성공 시 자체 데이터 invalidate → 활성화 2/3 즉시 전환(canonical derive) */}
      <BudgetRegisterSheet
        open={budgetSheetOpen}
        onOpenChange={setBudgetSheetOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
        }}
      />
      </div>
    </div>
  );
}

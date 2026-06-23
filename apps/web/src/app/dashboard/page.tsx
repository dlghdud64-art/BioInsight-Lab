"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
// §11.199b P0 — page-ready gate revert. 이전 §11.196/§11.199 의 store
// fetcher trigger 와 isFetching 의존 모두 제거. ExecutiveSummary 가 자체
// store fetch 처리 (이전 mount 동작 회복).
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, FileText, Search, Plus, TrendingUp, Truck, ChevronRight, Beaker, Calendar, GitCompare, CheckCircle2, Clock, ClipboardList, ShieldAlert, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
// §11.196d — recharts dead import 제거. AreaChart/Area/XAxis/YAxis/
// CartesianGrid/Tooltip/ResponsiveContainer 가 page.tsx 안에서 actual 사용 0
// (모든 chart 는 SpendTrendCard/CategoryDistributionCard 등 분리 component).
// 본 dead import 가 recharts (~150KB gzipped) 를 page chunk 에 포함시키고
// 있어 initial bundle 부담. 제거 후 recharts 는 chart component lazy chunk 만.
import { getGuestKey } from "@/lib/guest-key";
// §session-expiry-global — 대시보드 GET 을 csrfFetch 경유 → 401 시 raw fetch 우회로 인한
//   "가짜 empty-state" 폴백 대신 전역 재로그인 유도(api-client redirectToSignInOn401).
import { csrfFetch } from "@/lib/api-client";
import { useWorkbenchOverlayOpen } from "@/hooks/use-workbench-overlay-open";
// §dashboard-shifan-adopt P3a — ExecutiveSummarySection 제거(운영 KPI3=ActionInbox/Pipeline/
//   StatLine 중복 + 레거시 SystemInsightCard=NextStepBanner 중복). 컴포넌트 파일은 dormant
//   보존(rollback). import 삭제로 dead import 0.
import { NoSSR } from "@/components/ui/no-ssr";
import { COMPARE_SUBSTATUS_DEFS, RESOLUTION_PATH_LABELS, HANDOFF_STALL_LABELS } from "@/lib/work-queue/compare-queue-semantics";
import { OPS_STALL_LABELS } from "@/lib/work-queue/ops-queue-semantics";
// §11.82 #dashboard-operational-intelligence-redesign Phase 1 — AI 리포트 dialog
import { AIInsightDialog } from "@/components/dashboard/ai-insight-dialog";
// §11.374 P3.4 — 헤더 단일 문법(AppPageHeader). 대시보드 KPI 판단카드는 본문 보존(상태 카운트 그리드 미적용 — trend/risk 유지).
import { AppPageHeader } from "@/components/layout/page-header";
// §11.308a-v2 — 스마트 입고 modal import 제거.
// 진입점은 글로벌 헤더 (components/dashboard/Header.tsx) 로 승격
// (호영님 P0 2026-05-26). 대시보드 본문 button + state + modal 모두 제거.
// §11.84 + §11.85 — 시안 채택 후속 chart 2종 (Area + 카테고리 도넛)
// §11.196d — recharts code split. SpendTrendCard / CategoryDistributionCard
// 가 recharts (~150KB gzipped) 의존. KPI 4 카드 / SYSTEM INSIGHT / Quick
// Actions 는 fold 위쪽 (즉시 노출), chart 는 fold 아래라 lazy 가능.
// next/dynamic 으로 swap → initial bundle 에서 recharts 분리 → 첫 진입
// latency ↓. lazy chunk 도착 전엔 unified pageReady skeleton 의 chart
// placeholder 가 자연스럽게 cover (별도 fallback 불필요).
import dynamic_import from "next/dynamic";
const SpendTrendCard = dynamic_import(
  () =>
    import("@/components/dashboard/spend-trend-card").then((m) => ({
      default: m.SpendTrendCard,
    })),
  { ssr: false, loading: () => null },
);
// §dashboard-shifan-polish A5/B1 — CategoryDistributionCard 는 BudgetSpendCard 내부로 이관(시안
//   "예산&지출 카드 내부 통합"). 하단 분리 인스턴스 + 페이지 레벨 dynamic import 제거. recharts
//   코드분할은 budget-spend-card 내부 dynamic import 가 계승. 하단은 SpendTrend 풀폭만.
// §11.93 — 운영 바로가기 4 카드 (operator quick actions)
import { OperatorQuickActions } from "@/components/dashboard/operator-quick-actions";
// §dashboard-shifan-adopt P3b — 예산&지출 집행률 카드(시안 중단 좌). canonical summary.budget.
import { BudgetSpendCard } from "@/components/dashboard/budget-spend-card";
// §dashboard-shifan-fidelity P-fid1 — 우측 side-col 하단 최근활동 카드(시안 정합, 높이 정합).
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
// §11.308e — 스마트 입고 본문 awareness + status 카드 (호영님 P2 옵션 B).
// §main-dashboard-redesign P4-B1 — SmartReceiving 카드 → Pipeline 대체(입고 awareness 흡수).
import { Pipeline } from "@/components/dashboard/pipeline";
// §main-dashboard-redesign P3-B2 — StatLine(재무 KPI3, summary 실데이터) 상단 배선.
import { StatLine } from "@/components/dashboard/stat-line";
// §purchasing-hide — 발주/구매 표면 게이트(파이프라인 subtitle·추후 진입점).
import { getFlag } from "@/lib/feature-flags";
// §dashboard-shifan-adopt P1 — ActionInbox("오늘 처리해야 할 일") 가 레거시 우선순위 배너 대체.
import { ActionInbox, type ActionInboxItem } from "@/components/dashboard/action-inbox";
// §dashboard-shifan-adopt P2 — NextStepBanner("다음 단계 추천") 가 레거시 "시작하기 3단계" hero 대체.
import { NextStepBanner } from "@/components/dashboard/next-step-banner";
import { OperationalBriefFloatingEntry } from "@/components/operational-brief/floating-entry";
// §main-dashboard-redesign P3-B1 — GlobalEmpty(allEmpty 종합 빈) + summary 단일 진실 훅.
//   비차단 추가: 기존 stats useQuery 렌더 경로 무수정(§11.199b stuck 위험 격리).
//   GlobalEmpty 는 OnboardingHero 미표시 시에만(상호배타, 중복 0).
import { GlobalEmpty } from "@/components/dashboard/global-empty";
import { useDashboardSection } from "@/hooks/use-dashboard-section";
import type { DashboardSummary } from "@/lib/dashboard/summary-derive";

// ── Overlay 지원 경로 판별 ──
const OVERLAY_ROUTE_PATTERNS = [
  /^\/dashboard\/purchase-orders/,
  /^\/dashboard\/orders/,
];
function isOverlayCapableRoute(href: string): boolean {
  return OVERLAY_ROUTE_PATTERNS.some((re) => re.test(href));
}

// ═══════════════════════════════════════════════════════════════════
// /pricing resolver 로부터 넘어온 plan 온보딩 배너
//   onboarding=workspace → 워크스페이스 생성이 필요
//   plan=starter         → Starter 플랜 안내 (워크스페이스 없이 즉시 사용)
//   plan=team|business   → 플랜 결제 대기, 워크스페이스 생성 이후 /dashboard/settings/plans 로 유도
// ═══════════════════════════════════════════════════════════════════
// §11.304 — 티어명 등급화 (Starter→Free / Team→Basic / Business→Pro) 정합.
const PLAN_INTENT_LABELS: Record<string, string> = {
  starter: "Free",
  team: "Basic",
  business: "Pro",
  enterprise: "Enterprise",
};

function PlanOnboardingBanner() {
  const searchParams = useSearchParams();
  const onboarding = searchParams?.get("onboarding") ?? null;
  const planRaw = searchParams?.get("plan") ?? null;
  const planLabel = planRaw ? PLAN_INTENT_LABELS[planRaw] ?? planRaw : null;

  if (!onboarding && !planRaw) return null;

  if (onboarding === "workspace") {
    return (
      <div
        className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3 flex items-start gap-3 text-indigo-900"
        role="status"
      >
        <ClipboardList className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            워크스페이스 생성이 먼저 필요합니다
          </p>
          <p className="text-sm mt-0.5 leading-relaxed">
            {planLabel
              ? `${planLabel} 플랜은 워크스페이스 단위로 적용됩니다. 워크스페이스를 먼저 만드신 뒤, 플랜 설정으로 이어드립니다.`
              : "플랜은 워크스페이스 단위로 적용됩니다. 먼저 워크스페이스를 설정해 주세요."}
          </p>
        </div>
      </div>
    );
  }

  if (planRaw === "starter") {
    return (
      <div
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-3 text-emerald-900"
        role="status"
      >
        <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">Starter 플랜으로 시작합니다</p>
          <p className="text-sm mt-0.5 leading-relaxed">
            별도 결제 없이 기본 기능을 바로 사용하실 수 있습니다. 사용량 한도에 도달하면 상단 배너로 알려드립니다.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function DashboardPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const openOverlay = useWorkbenchOverlayOpen();

  // §dashboard-shifan-polish A5/B1 — §11.252b 모바일 차트 탭(트렌드/카테고리) state 제거.
  //   카테고리는 BudgetSpendCard 내부로 이관(중단 2-col 좌, 모바일도 카드 내부에 노출) →
  //   하단은 SpendTrend 단일(풀폭)이라 탭 분기 불필요. 모바일 카테고리는 예산카드에서 본다.

  // §11.308a-v2 — isSmartReceivingOpen state 제거 (호영님 P0 2026-05-26).
  // 진입점이 글로벌 헤더로 승격되어 Header.tsx 에서 state 관리.
  // 대시보드 본문에서는 어디서나 1탭 접근 불필요.

  // §11.252d-1 — OnboardingHero dismiss state + localStorage persist.
  // 호영님 spec: 사용자가 명시적으로 닫기 가능 + 페이지 새로고침 시 dismiss 상태 유지.
  // SSR hydration safe — default false + useEffect mount 시 localStorage 읽기.
  // localStorage key: "labaxis-onboarding-dismissed" (boolean string).
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("labaxis-onboarding-dismissed");
      if (stored === "true") setOnboardingDismissed(true);
    } catch {
      // localStorage 접근 실패 (private mode 등) — silent fallback, default false 유지.
    }
  }, []);
  // §dashboard-shifan-adopt P2 — dismissOnboarding 제거(시작하기 hero 폐지 → NextStepBanner).
  //   onboardingDismissed(localStorage)는 "빠른 시작" hide 조건(아래)에서 계속 읽힘 — useState/effect 유지.

  /** Link 대신 overlay를 열 수 있는 경로면 overlay를, 아니면 router.push */
  const handleNavigateOrOverlay = (href: string, origin: "dashboard" | "queue" | "card" = "dashboard") => {
    if (isOverlayCapableRoute(href)) {
      openOverlay({ routePath: href, origin, mode: "progress" });
    } else {
      router.push(href);
    }
  };

  const { data: dashboardStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const guestKey = getGuestKey();
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;
      const response = await csrfFetch("/api/dashboard/stats", { headers });
      if (!response.ok) {
        // §11.361-1b — 이전엔 return null → react-query 가 "성공(null)"으로 처리해
        //   retry 미작동 → 간헐 500(콜드스타트 Prisma transient) 1회로 stats 영구 null
        //   → KPI 0 + 온보딩 오판 + System Insight 사라짐. throw 로 바꿔 retry 가 동작.
        throw new Error(`dashboard stats ${response.status}`);
      }
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // 콜드스타트 transient 500 회복: 지수 backoff 로 따뜻한 재시도.
    // §11.366 — retry 창 단축(2*4000=~3s) — 스켈레톤 상한(6s)과 정합.
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    refetchOnWindowFocus: false,
  });

  // §main-dashboard-redesign P3-B1 — summary 단일 진실(capMs 10s 4상태). 비차단:
  //   기존 stats 렌더 게이트와 독립. state==='empty'(allEmpty) + OnboardingHero
  //   미표시 시에만 GlobalEmpty 렌더(아래). error/timeout 시 미렌더(무회귀).
  const summarySection = useDashboardSection<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    url: "/api/dashboard/summary",
    enabled: status === "authenticated",
    authLoading: status === "loading",
    isEmpty: (s) => s.derived.allEmpty,
  });

  // §11.366 → §11.375 P1 — 스켈레톤 상한 타이머. 로딩 중일 때만 활성, 회복 시 자동 reset.
  //   상한 6→10초: prod serverless cold latency(첫 진입 5~6초, 에러 아닌 느린 성공)가
  //   6초 상한에 걸려 "지연 발생" 에러 카드가 깜빡이던 것을 제거. cold 는 상한 전 회복,
  //   진짜 무한(auth hang)만 10초 후 에러 노출. (근본 절감은 Phase 2+ stats slimming.)
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    const stillLoading = status === "loading" || (statsLoading && !dashboardStats);
    if (!stillLoading) { setLoadTimedOut(false); return; }
    const t = setTimeout(() => setLoadTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [status, statsLoading, dashboardStats]);

  // §11.199b P0 — page-ready unified gate 자체 revert.
  //
  // 회귀 history:
  //   §11.196: page-level pageReady gate 도입 (fetch parallel + 동시 reveal)
  //   §11.199 P0 hot fix: ordersFetching/budgetsFetching 의존 제거
  //   §11.199b P0 (본 batch): pageReady gate 자체 제거.
  //
  // Root cause (Chrome prod 검증):
  //   §11.199 fix 후에도 prod /dashboard 진입 시 unified skeleton 영원 stuck.
  //   /api/dashboard/stats 200 OK 응답 4번 도착에도 statsLoading false 안 됨.
  //   /dashboard/inventory 는 정상 → prod 자체 정상, dashboard pageReady gate
  //   고유 이슈. react-query 의 useQuery 가 disabled→enabled transition 시
  //   isLoading 동작이 prod build 와 dev build 가 다르거나, dashboard 의 다른
  //   render path block 가 있음.
  //
  // Fix (회귀 0 path):
  //   pageReady gate 자체 제거. status === "loading" 분기만 auth skeleton 으로
  //   유지. 모든 카드는 본인 isLoading 분기로 fallback (§11.196b 에서 제거한
  //   카드별 statsLoading 분기는 별도 batch 로 복원 가능, 현재는 prod 동작
  //   우선). reveal stagger 회귀 — 그러나 stuck (dashboard 진입 0) 보다 훨씬
  //   나음. 운영자 즉시 dashboard 사용 가능.
  //
  // §11.196 series 의 dead import sweep / chunk wait / brand UX 등은 모두
  // 보존. pageReady gate 한 가지만 revert.
  // §11.361-1c — 콜드스타트 0-flash 차단: stats 가 아직 안 온 동안(첫 로드/retry backoff)
  //   온보딩·0 KPI 로 떨어지면 "데이터 없음" 거짓 상태가 ~12s 노출된다. statsLoading
  //   중(아직 data 없음)엔 온보딩 대신 로딩 스켈레톤 유지 → 거짓 표기 방지. retry 소진
  //   (최종 실패) 시 statsLoading false → 아래로 흘러 정상 fallback.
  // §11.366 — 무한/장시간 스켈레톤 상한. status "loading" 무한(auth hang) +
  //   cold retry backoff(~3s) 공통 커버. 6초 상한 후 스켈레톤 대신 에러+재시도.
  const isStillLoading = status === "loading" || (statsLoading && !dashboardStats);
  if (isStillLoading && !loadTimedOut) {
    return (
      <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4">
        {/* 제목 */}
        <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
        {/* 우선순위 배너 */}
        <div className="h-[72px] rounded-xl bg-slate-200 animate-pulse" />
        {/* KPI 4 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] md:h-[120px] rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
        {/* §11.377 — 차트 영역 placeholder (지출 트렌드 넓게 + 카테고리) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-[200px] rounded-xl bg-slate-200 animate-pulse md:h-[240px] lg:col-span-2" />
          <div className="h-[200px] rounded-xl bg-slate-200 animate-pulse md:h-[240px]" />
        </div>
        {/* §11.377 — 운영 바로가기 4카드 placeholder */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={`q${i}`} className="h-[88px] rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (isStillLoading && loadTimedOut) {
    return (
      <div className="p-4 pt-4 md:p-8 md:pt-6 flex flex-col items-center justify-center gap-3 min-h-[40vh] text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <p className="text-sm font-medium text-slate-700">대시보드를 불러오는 중 지연이 발생했습니다.</p>
        <p className="text-xs text-slate-500">네트워크 또는 로그인 상태를 확인 중입니다.</p>
        <Button
          size="sm"
          onClick={() => {
            setLoadTimedOut(false);
            if (status === "loading") window.location.reload();
            else refetchStats();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  const rawStats = dashboardStats || {};

  const stats = {
    totalInventory: rawStats.totalInventory ?? 0,
    lowStockAlerts: rawStats.lowStockAlerts ?? 0,
    monthlySpending: rawStats.thisMonthPurchaseAmount ?? 0,
    activeQuotes: rawStats.quoteStats?.pending ?? 0,
    respondedQuotes: rawStats.quoteStats?.responded ?? 0,
    monthOverMonthChange: parseFloat(rawStats.monthOverMonthChange ?? "0"),
    // §11.94 — week 단위 trend (stats endpoint 신규 metric)
    weekOverWeekChange: parseFloat(rawStats.weekOverWeekChange ?? "0"),
    // §11.107 — DashboardStatsSnapshot 기반 trend (3 KPI delta).
    // null = snapshot 부재 (cron 미실행 또는 24h 미경과) → KpiCard chip 미노출.
    trend: (rawStats.trend ?? {
      processingDelta: null,
      pendingApprovalDelta: null,
      anomalyDelta: null,
      lookupAt: null,
    }) as {
      processingDelta: number | null;
      pendingApprovalDelta: number | null;
      anomalyDelta: number | null;
      lookupAt: string | null;
    },
    monthlySpendingChart: (rawStats.monthlySpending ?? []) as Array<{ month: string; amount: number }>,
    // §11.85 — categorySpending 은 dashboard/stats endpoint 가 이미 derive
    // 하고 있던 unused field. PRODUCT_CATEGORIES 매핑은 컴포넌트 내부에서.
    categorySpending: (rawStats.categorySpending ?? []) as Array<{ category: string; amount: number }>,
    expiringItems: (rawStats.expiringItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      expiryDate: string; currentQuantity: number; unit: string; daysLeft: number;
    }>,
    lowStockItems: (rawStats.lowStockItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      currentQuantity: number; safetyStock: number; unit: string;
    }>,
    expiringCount: rawStats.expiringCount ?? 0,
    recentPurchases: (rawStats.recentPurchases ?? []) as Array<{
      id: string; itemName: string | null; vendorName: string | null;
      amount: number | null; purchasedAt: string; category: string | null;
      qty: number | null; unit: string | null;
    }>,
    undecidedCompareCount: rawStats.undecidedCompareCount ?? 0,
    compareStats: {
      slaBreachedCount: rawStats.compareStats?.slaBreachedCount ?? 0,
      inquiryFollowupCount: rawStats.compareStats?.inquiryFollowupCount ?? 0,
      substatusBreakdown: (rawStats.compareStats?.substatusBreakdown ?? {}) as Record<string, number>,
      conversionRate: rawStats.compareStats?.conversionRate ?? 0,
      avgTurnaroundDays: rawStats.compareStats?.avgTurnaroundDays ?? 0,
      resolutionPathDistribution: (rawStats.compareStats?.resolutionPathDistribution ?? {}) as Record<string, number>,
      noMovementCount: rawStats.compareStats?.noMovementCount ?? 0,
      inquiryFollowupRate: rawStats.compareStats?.inquiryFollowupRate ?? 0,
      compareToQuoteCount: rawStats.compareStats?.compareToQuoteCount ?? 0,
      quoteToPurchaseCount: rawStats.compareStats?.quoteToPurchaseCount ?? 0,
      purchaseToReceivingCount: rawStats.compareStats?.purchaseToReceivingCount ?? 0,
      receivingToInventoryCount: rawStats.compareStats?.receivingToInventoryCount ?? 0,
      handoffStallPoint: (rawStats.compareStats?.handoffStallPoint ?? "none") as string,
    },
    opsFunnel: {
      totalQuotes: rawStats.opsFunnel?.totalQuotes ?? 0,
      purchasedQuotes: rawStats.opsFunnel?.purchasedQuotes ?? 0,
      confirmedOrders: rawStats.opsFunnel?.confirmedOrders ?? 0,
      completedReceiving: rawStats.opsFunnel?.completedReceiving ?? 0,
      stallPoint: (rawStats.opsFunnel?.stallPoint ?? "none") as string,
    },
  };

  // §11.243 #1 — 호영님 P0: 온보딩 모드 vs 운영 모드 분기.
  //   "견적 등록 건수 0건" = quoteStats 합 (active + responded) === 0.
  //   isOnboardingMode 시: OnboardingHero 노출 + KPI 가이드 + AI 리포트 disabled +
  //   바로가기 건수 뱃지 + 텍스트 행동 유도형. 데이터 1건+ 시 자동 운영 모드 전환.
  const totalQuotesCount = stats.activeQuotes + stats.respondedQuotes;
  // §11.361-1 — canonical truth: 온보딩 게이트가 "견적 0"만 보면, 재고가 이미 있는
  //   운영 유저(품목 N·안전재고 미달 M)도 신규로 오판해 KPI 를 0 으로 마스킹한다
  //   (대시보드 0 vs 재고 모듈 2 = truth 충돌). 견적+재고 모두 0 일 때만 온보딩.
  //   stats.lowStockAlerts 등 실데이터가 있으면 운영 모드로 전환해 실 KPI 노출.
  const hasAnyOperationalData =
    totalQuotesCount > 0 ||
    stats.totalInventory > 0;
  const isOnboardingMode = !hasAnyOperationalData;
  // §11.243 #2 — OnboardingHero 3 step 완료 derive.
  //   step 1 (품목 등록) = totalInventory > 0
  //   step 2 (견적 요청) = activeQuotes > 0
  //   step 3 (비교 검토) = respondedQuotes > 0
  // §dashboard-shifan-adopt P2 — onboardingSteps(3단계 진행) 제거: "시작하기 3단계" hero 폐지
  //   (→ NextStepBanner). 진행 가이드는 summary 기반 NextStepBanner + GlobalEmpty가 담당.

  // ── 3상태 대시보드 판정 ──────────────────────────────────
  const processingRequiredCount = stats.lowStockAlerts + stats.expiringCount + stats.undecidedCompareCount;
  const approvalPendingCount = stats.respondedQuotes; // 견적 응답 = 검토/승인 대기
  const riskOrBlockerCount = stats.compareStats.slaBreachedCount;
  const inProgressCount = stats.activeQuotes;
  const recentActivityCount = stats.totalInventory + stats.monthlySpending + stats.activeQuotes;
  const inventoryIssueHref = "/dashboard/inventory?filter=lot_issue&tab=overview";

  // §11.362-1/2 — 호영님 도메인 결정: 위험-우선 severity rank.
  //   (구) 고정 배열순 find(count>0) → severity 무시·위험신호(만료/SLA) 누락.
  //   (신) count>0 후보 중 severityRank 최상위(작을수록 우선)를 primary 로 선정.
  //   rank: 만료 폐기(1) > SLA 지연(2) > 재고 부족(3) > 입고 처리(4) > 승인 대기(5).
  //   href 는 검증된 기존 라우트 재사용 — 신규 dead route 0.
  const dashboardPriorityActions = [
    {
      id: "expiring",
      label: "만료 폐기",
      count: stats.expiringCount,
      severityRank: 1,
      helper: "유효기간 경과 lot 우선 폐기·교체",
      href: inventoryIssueHref,
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      id: "sla",
      label: "SLA 지연",
      count: riskOrBlockerCount,
      severityRank: 2,
      helper: "응답 기한 초과 견적 즉시 처리",
      href: "/dashboard/quotes?status=RESPONDED",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      id: "inventory",
      label: "재고 부족",
      count: stats.lowStockAlerts,
      severityRank: 3,
      helper: "안전재고와 재주문 후보 확인",
      href: "/dashboard/inventory?filter=low",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    {
      id: "receiving",
      label: "입고 처리",
      count: stats.compareStats.purchaseToReceivingCount,
      severityRank: 4,
      helper: "입고 대기와 예외를 먼저 확인",
      href: inventoryIssueHref,
      icon: <Truck className="h-4 w-4" />,
    },
    {
      id: "approval",
      label: "승인 대기",
      count: approvalPendingCount,
      severityRank: 5,
      helper: "견적 응답 검토 후 발주 전환",
      href: "/dashboard/quotes?status=RESPONDED",
      icon: <ClipboardList className="h-4 w-4" />,
    },
  ];
  // §dashboard-shifan-adopt P1 — ActionInbox("오늘 처리해야 할 일") 데이터.
  //   dashboardPriorityActions(만료/SLA/재고/입고/승인) → ActionInboxItem. count>0 필터·
  //   empty 정직은 ActionInbox 내부(dead button 0). 레거시 "가장 먼저 처리" 배너와 동일
  //   소스 = awareness 공백 0. tone: severityRank 1만료/2SLA→danger, 3재고/4입고→warn, 5승인→info.
  // §dashboard-shifan-fidelity P-fid2 — 행 액션 버튼 라벨(시안 정합). id별 동선 verb.
  const ACTION_CTA: Record<string, string> = {
    expiring: "폐기 처리",
    sla: "즉시 처리",
    inventory: "재고 처리",
    receiving: "입고 처리",
    approval: "검토하기",
  };
  const actionInboxItems: ActionInboxItem[] = dashboardPriorityActions.map((a) => ({
    id: a.id,
    label: a.label,
    count: a.count,
    href: a.href,
    detail: a.helper,
    tone: a.severityRank <= 2 ? "danger" : a.severityRank <= 4 ? "warn" : "info",
    cta: ACTION_CTA[a.id] ?? "처리하기",
  }));

  const isBlocked = processingRequiredCount > 0 || approvalPendingCount > 0 || riskOrBlockerCount > 0;
  const hasOperationalFootprint = recentActivityCount > 0;
  const isZero = !isBlocked && inProgressCount === 0 && !hasOperationalFootprint;
  const dashboardState: "blocked" | "zero" | "active" = isBlocked ? "blocked" : isZero ? "zero" : "active";

  // 하위 호환
  const hasAnyData = hasOperationalFootprint;
  const hasActionItems = isBlocked;
  const actionCount = (stats.lowStockAlerts > 0 ? 1 : 0) + (stats.activeQuotes > 0 ? 1 : 0) + (stats.expiringCount > 0 ? 1 : 0) + (stats.undecidedCompareCount > 0 ? 1 : 0);


  const formatPurchaseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  // -- KPI 해석 문구 --
  const getInventoryInsight = () => {
    if (stats.totalInventory === 0) return "등록된 품목이 없어 비교·요청 이력이 아직 없습니다";
    if (stats.lowStockAlerts > 0) return `${stats.lowStockAlerts}개 품목 부족 — 발주 검토 필요`;
    return "전체 품목 정상 운영 중";
  };

  const getStockInsight = () => {
    if (stats.lowStockAlerts === 0) return "모든 품목이 안전재고 이상으로 유지되고 있습니다";
    if (stats.lowStockAlerts >= 3) return "3건 이상 부족 — 일괄 발주를 검토하세요";
    return "해당 품목의 개별 발주를 검토하세요";
  };

  const getQuoteInsight = () => {
    if (stats.activeQuotes === 0) return "진행 중인 견적이 없어 응답 대기 건이 없습니다";
    if (stats.respondedQuotes > 0) return `${stats.respondedQuotes}건 응답 수신 — 확정 또는 반려가 필요합니다`;
    return "공급사 응답 대기 중 — 평균 1~2일 소요";
  };

  // -- KPI risk level --
  const inventoryRisk = stats.lowStockAlerts > 0 ? "amber" : "none";
  const stockRisk = stats.lowStockAlerts >= 3 ? "red" : stats.lowStockAlerts > 0 ? "amber" : "none";
  const quoteRisk = stats.respondedQuotes > 0 ? "amber" : "none";

  const riskBorder = (risk: string) => {
    if (risk === "red") return "border-l-2 border-l-red-500";
    if (risk === "amber") return "border-l-2 border-l-yellow-500";
    return "";
  };

  // -- 즉시 처리 항목 생성 --
  const urgentItems: Array<{ id: string; icon: React.ReactNode; label: string; desc: string; href: string; severity: "red" | "amber" }> = [];
  if (stats.lowStockAlerts > 0) {
    urgentItems.push({
      id: "u-low",
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      label: `재고 부족 ${stats.lowStockAlerts}건`,
      desc: "안전재고 이하 품목 -- 발주 검토",
      href: "/dashboard/inventory?filter=low",
      severity: stats.lowStockAlerts >= 3 ? "red" : "amber",
    });
  }
  if (stats.respondedQuotes > 0) {
    urgentItems.push({
      id: "u-responded",
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      label: `견적 응답 ${stats.respondedQuotes}건`,
      desc: "공급사 응답 수신 -- 검토 후 확정",
      href: "/dashboard/quotes?status=RESPONDED",
      severity: "amber",
    });
  }
  if (stats.expiringCount > 0) {
    urgentItems.push({
      id: "u-expiring",
      icon: <Calendar className="h-4 w-4 text-yellow-700" />,
      label: `유통기한 임박 ${stats.expiringCount}건`,
      desc: "30일 이내 만료 예정",
      href: "/dashboard/inventory",
      severity: "amber",
    });
  }
  if (stats.undecidedCompareCount > 0) {
    urgentItems.push({
      id: "u-compare",
      icon: <GitCompare className="h-4 w-4 text-slate-400" />,
      label: `비교 판정 대기 ${stats.undecidedCompareCount}건`,
      desc: stats.compareStats.slaBreachedCount > 0 ? `SLA 초과 ${stats.compareStats.slaBreachedCount}건 포함` : "비교 결과 검토 필요",
      href: "/compare",
      severity: stats.compareStats.slaBreachedCount > 0 ? "red" : "amber",
    });
  }
  if (stats.activeQuotes > 0 && stats.respondedQuotes === 0) {
    urgentItems.push({
      id: "u-pending-quote",
      icon: <Clock className="h-4 w-4 text-yellow-700" />,
      label: `승인 대기 견적 ${stats.activeQuotes}건`,
      desc: "공급사 응답 대기 중",
      href: "/dashboard/quotes?status=PENDING",
      severity: "amber",
    });
  }

  // -- 상태 기반 추천 작업 --
  const recommendedActions: Array<{ id: string; icon: React.ReactNode; label: string; desc: string; href: string; state: "idle" | "ready" | "blocked" }> = [];

  // 품목 등록 상태
  if (stats.totalInventory === 0) {
    recommendedActions.push({ id: "r-register", icon: <Plus className="h-3.5 w-3.5 text-slate-400" />, label: "품목 등록", desc: "등록된 품목이 없어 비교·견적을 시작할 수 없습니다", href: "/dashboard/inventory", state: "blocked" });
  } else {
    recommendedActions.push({ id: "r-register", icon: <Plus className="h-3.5 w-3.5 text-emerald-700" />, label: "재고 등록", desc: `${stats.totalInventory}개 운영 중 · 추가 입고 등록`, href: "/dashboard/inventory", state: "ready" });
  }

  // 비교 상태
  if (stats.undecidedCompareCount > 0) {
    recommendedActions.push({ id: "r-compare", icon: <GitCompare className="h-3.5 w-3.5 text-yellow-700" />, label: "비교 판정", desc: `${stats.undecidedCompareCount}건 판정 대기 — 검토 후 확정하세요`, href: "/app/search", state: "ready" });
  } else if (stats.totalInventory > 0) {
    recommendedActions.push({ id: "r-compare", icon: <GitCompare className="h-3.5 w-3.5 text-slate-400" />, label: "제품 비교", desc: "비교 대기 항목 없음 — 검색에서 후보를 추가하세요", href: "/app/search", state: "idle" });
  }

  // 견적 상태
  if (stats.respondedQuotes > 0) {
    recommendedActions.push({ id: "r-quote", icon: <FileText className="h-3.5 w-3.5 text-yellow-700" />, label: "견적 검토", desc: `${stats.respondedQuotes}건 응답 수신 — 확정 대기`, href: "/dashboard/quotes?status=RESPONDED", state: "ready" });
  } else if (stats.activeQuotes > 0) {
    recommendedActions.push({ id: "r-quote", icon: <FileText className="h-3.5 w-3.5 text-slate-400" />, label: "견적 현황", desc: `${stats.activeQuotes}건 응답 대기 중`, href: "/dashboard/quotes?status=PENDING", state: "idle" });
  } else {
    recommendedActions.push({ id: "r-quote", icon: <FileText className="h-3.5 w-3.5 text-slate-400" />, label: "견적 요청", desc: "작성 대기 요청 없음 — 비교 결과에서 견적을 시작하세요", href: "/app/quote", state: "idle" });
  }

  // 발주 전환 — §11.162: /dashboard/purchases?view=conversion-ready (legacy redirect 직접 destination)
  recommendedActions.push({ id: "r-po-conversion", icon: <ClipboardList className="h-3.5 w-3.5 text-blue-700" />, label: "발주 전환", desc: "발주 전환 후보를 검토하고 승인·발송을 준비하세요", href: "/dashboard/purchases?view=conversion-ready", state: "idle" });

  // 검색
  recommendedActions.push({ id: "r-search", icon: <Search className="h-3.5 w-3.5 text-slate-400" />, label: "시약·장비 검색", desc: "주요 시약·장비에서 후보 탐색", href: "/app/search", state: "idle" });

  // -- KPI 판단 카드 렌더 (공통) --
  const renderKpiCard = (config: {
    href: string; icon: React.ReactNode; label: string; value: React.ReactNode;
    insight: string; action?: string; risk: string; className?: string;
  }) => (
    <Link href={config.href} className="block h-full">
      <Card className={`h-full flex flex-col overflow-hidden cursor-pointer transition-colors hover:bg-slate-50/80 bg-white border border-slate-200/80 rounded-xl ${riskBorder(config.risk)} ${config.className ?? ""}`}>
        <CardContent className="p-3.5 md:p-4 flex flex-col gap-1 h-full">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100/80">
              {config.icon}
            </span>
            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">{config.label}</span>
          </div>
          <div className="text-[22px] md:text-[28px] font-extrabold text-slate-900 leading-none tracking-tight">{config.value}</div>
          <p className="text-[10px] md:text-[11px] text-slate-500 leading-snug truncate">{config.insight}</p>
          {config.action && (
            /* §dashboard-mobile #9 — CTA 하단 고정(mt-auto): 같은 행 KPI 카드 높이 일치(CTA 유무 무관). */
            <p className="text-[10px] md:text-[11px] text-blue-600 font-semibold mt-auto pt-1">{config.action} →</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  return (
    // §11.252d-4 — 모바일 스크롤 ~40% 축소 (호영님 spec).
    //   AS-IS: p-4 pt-5 + space-y-5 (모바일).
    //   TO-BE: p-3 pt-4 + space-y-3 (모바일만 압축). 데스크탑 (md:p-8 md:pt-7
    //   md:space-y-6) 모두 보존 (회귀 0). overflow-x-hidden / bg-sh /
    //   min-h-screen 시그니처 보존.
    <div className="p-3 pt-4 md:p-8 md:pt-7 space-y-3 md:space-y-6 overflow-x-hidden bg-sh min-h-screen">

      {/* --- 플랜 온보딩 배너 (pricing resolver 경유 시) --- */}
      <Suspense fallback={null}>
        <PlanOnboardingBanner />
      </Suspense>

      {/* --- 페이지 헤더 --- */}
      {/* §11.82 Phase 1: 우측 상단에 "AI 리포트 생성" button 배치.
          §11.308b (호영님 Q11 = A, 2026-05-26):
            - eyebrow "Operational Intelligence Dashboard" 영문 완전 제거
              (사용자 무의미, 한국어 title 으로 충분)
            - "Live" 배지 완전 제거 (대시보드 = 원래 실시간, 별도 표기 불필요)
            - 헤더 단순화: 한국어 title + greeting 만 */}
      {/* §11.374 P3.4 — AppPageHeader 채택(인라인 헤더 제거, card-less 단일 문법).
          동적 greeting/state → description, AIInsightDialog+온보딩 툴팁 → actions render 보존.
          ⚠️ KPI 판단카드(아래 본문)는 상태 카운트 그리드 미적용 — trend/risk 정보 보존. */}
      <AppPageHeader
        title="대시보드"
        description={`${session?.user?.name ? `${session.user.name}님, ` : ""}${
          dashboardState === "blocked"
            ? `확인이 필요한 항목 ${processingRequiredCount + approvalPendingCount + riskOrBlockerCount}건이 있습니다.`
            : dashboardState === "zero"
              ? "견적 요청을 시작하면 운영 데이터가 쌓이기 시작합니다."
              : "오늘 즉시 처리할 운영 이슈가 없습니다."
        }`}
        actions={
          // §11.374 P4 — 온보딩(데이터 0)이면 리포트 entry 자체를 숨김(회색 disabled 붕뜸 제거).
          //   리포트는 완료 견적 ≥1 필요 → 데이터 없으면 헤더에 둘 이유 없음(온보딩 히어로가 안내).
          //   데이터 있으면 우측 고정 노출(AppPageHeader justify-end).
          isOnboardingMode
            ? undefined
            : [{ render: <AIInsightDialog disabled={false} /> }]
        }
      />

      {/* §dashboard-shifan-adopt P3a — 시안 단일 흐름 재배열:
          StatLine → NextStep → ActionInbox → (GlobalEmpty) → Pipeline →
          (예산&지출 + 빠른작업) → 최근활동. 운영 KPI3(ExecutiveSummary) 제거(중복 흡수). */}

      {/* §main-dashboard-redesign P3-B2 — StatLine(재무 KPI3: 이번달 지출·잔여 예산·
          확정 발주액) summary 단일 진실. summarySection 훅 재사용(신규 fetch 0) + capMs 4상태.
          §dashboard-shifan-adopt P3a 갭1 — "재무 현황" h2 제거(시안=헤더 직하 3카드, 라벨 없음). */}
      <section className="space-y-2">
        <StatLine
          state={summarySection.state}
          summary={summarySection.data}
          onRetry={summarySection.retry}
        />
      </section>

      {/* §dashboard-shifan-adopt P2 — NextStepBanner("다음 단계 추천"). summary 단일 진실
          가이드(예산 미설정→예산 설정 유도 등). 빈 계정 시작 유도는 GlobalEmpty(아래)가 담당.
          NextStepBanner는 self-gate(allEmpty/dismiss 시 미렌더). */}
      <NextStepBanner summary={summarySection.data} />

      {/* §dashboard-shifan-adopt P1 — ActionInbox("오늘 처리해야 할 일"). dashboardPriorityActions
          동일 소스(만료/SLA/재고/입고/승인) = awareness 공백 0. count>0만 렌더(dead button 0),
          §11.302 신호등 톤, 행 클릭 라우팅, empty "처리할 항목 없음" 정직. */}
      <ActionInbox items={actionInboxItems} />

      {/* §dashboard-shifan-adopt P2 — GlobalEmpty(종합 빈 첫 화면, allEmpty). summary allEmpty
          시 노출(빈 계정 시작 유도). 정직 빈 + 시작 CTA. */}
      {summarySection.state === "empty" && <GlobalEmpty />}

      {/* §main-dashboard-redesign P4-B1 — Pipeline(견적→발주→입고→재고) summary 단일 진실
          (summarySection 훅 재사용, 신규 fetch 0) + capMs 4상태. 가드③ 전이 canonical=state-machine.
          §dashboard-shifan-adopt P3a — 시안 흐름상 ActionInbox 직후로 상승(중단 차트 앞).
          상태 라벨(열린견적/미확정/미완료/재주문·이상없음·데이터없음)은 컴포넌트 내부 정직 노출(갭2). */}
      <section className="space-y-2">
        <h2 className="text-[13px] font-bold text-slate-900">
          {/* §purchasing-hide — off 시 발주 단계 라벨 제거(견적 → 입고 → 재고). 양 문자열 소스 보존. */}
          운영 파이프라인 <span className="text-slate-400 font-semibold">· {getFlag("ENABLE_PURCHASING") ? "견적 → 발주 → 입고 → 재고" : "견적 → 입고 → 재고"}</span>
        </h2>
        <Pipeline
          state={summarySection.state}
          summary={summarySection.data}
          onRetry={summarySection.retry}
        />
      </section>

      {/* §dashboard-shifan-adopt P3a — ExecutiveSummarySection(운영 KPI3 처리필요/진행발주/
          이상징후 + 레거시 SystemInsightCard) 제거. KPI3=ActionInbox/Pipeline/StatLine 중복,
          insight=NextStepBanner 중복. onboarding KPI guide banner는 NextStepBanner+GlobalEmpty 흡수
          (awareness 공백 0). 컴포넌트 파일 dormant 보존(rollback). */}

      {/* §dashboard-shifan-adopt P3b — 시안 중단 2-col: 예산&지출 집행률 카드(좌) + 빠른작업(우).
          예산집행률 = canonical summary.budget 단일 진실(미설정→"미설정" 정직, 가짜 집행률 0).
          지출 트렌드 + 카테고리 도넛은 하단으로 이동(아래, 최근활동 뒤). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <BudgetSpendCard
          state={summarySection.state}
          summary={summarySection.data}
          onRetry={summarySection.retry}
          categorySpending={stats.categorySpending}
        />
        {/* §dashboard-rightcol-rebalance(호영님) — 우측 = 운영 바로가기 단독(세로 1열, 좌측 예산+도넛
            높이까지 auto-rows-fr 로 채움). 최근활동은 2-col 아래 풀폭으로 이동(가로 확대). */}
        {/* §11.93 — 운영 바로가기(빠른작업). canonical truth: stats forward, count mutation 0. */}
        <OperatorQuickActions
          counts={{
            quotes: stats.activeQuotes,
            purchases: stats.respondedQuotes,
            receiving: stats.compareStats.purchaseToReceivingCount,
            inventory: stats.lowStockAlerts,
          }}
        />
      </div>

      {/* §dashboard-rightcol-rebalance(호영님) — 최근활동 풀폭(좁은 side-col 탈출 → 활동 로그 가로 확대·가독성↑). */}
      <RecentActivityCard />

      {/* §dashboard-shifan-adopt P3a — Pipeline은 ActionInbox 직후로 상승(위 참조). 원위치 제거.
          중단=차트(예산&지출)+빠른작업, 하단=최근활동 순(시안 흐름). */}


      {/* §dashboard-shifan-polish A5/B1 — 카테고리 비중은 BudgetSpendCard 내부로 통합(시안 "예산&지출
          카드 내부"). 하단 분리 도넛 + 모바일 차트 탭 폐지 → 하단은 지출 트렌드 단일(풀폭). 실데이터
          ₩71.6M 보유라 풀폭 정당. 빈 계정 empty 정직(§main-dashboard-redesign P1 가드 — 차트 미렌더). */}
      <SpendTrendCard monthlySpending={stats.monthlySpendingChart} />

      {/* --- 1순위: 오늘의 우선 작업 (모바일용 fallback, md 이하) --- */}
      <div className="md:hidden rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasActionItems ? (
              <>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                </span>
                <h3 className="text-[13px] font-extrabold text-slate-900">오늘의 우선 작업</h3>
              </>
            ) : (
              <>
                <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${hasAnyData ? "bg-emerald-500" : "bg-slate-300"}`} />
                <h3 className="text-[13px] font-extrabold text-slate-900">
                  {dashboardState === "active" ? "오늘 처리할 이슈 없음" : "시작 안내"}
                </h3>
              </>
            )}
          </div>
        </div>
        {hasActionItems ? (
          <div className="divide-y divide-slate-100 sm:divide-y-0 sm:grid sm:divide-x sm:divide-slate-100" style={{ gridTemplateColumns: `repeat(${actionCount}, 1fr)` }}>
            {stats.lowStockAlerts > 0 && (
              <button type="button" onClick={() => handleNavigateOrOverlay("/dashboard/inventory?filter=low", "dashboard")} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group text-left w-full">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900">{stats.lowStockAlerts}건 재고 부족</p>
                  <p className="text-[11px] text-slate-500">즉시 발주 검토 필요</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
              </button>
            )}
            {stats.activeQuotes > 0 && (
              <button type="button" onClick={() => handleNavigateOrOverlay("/dashboard/quotes?status=PENDING", "dashboard")} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group text-left w-full">
                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900">{stats.activeQuotes}건 견적 대기</p>
                  <p className="text-[11px] text-slate-500">
                    {stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 응답 수신 -- 검토 필요` : "공급사 응답 대기 중"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
              </button>
            )}
            {stats.expiringCount > 0 && (
              <button type="button" onClick={() => handleNavigateOrOverlay("/dashboard/inventory", "dashboard")} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group text-left w-full">
                <Calendar className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900">{stats.expiringCount}건 유통기한 임박</p>
                  <p className="text-[11px] text-slate-500">30일 이내 만료 예정</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
              </button>
            )}
            {stats.undecidedCompareCount > 0 && (
              <button type="button" onClick={() => handleNavigateOrOverlay("/compare", "dashboard")} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group text-left w-full">
                <GitCompare className={`h-4 w-4 flex-shrink-0 ${stats.compareStats.slaBreachedCount > 0 ? "text-red-500" : "text-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{stats.undecidedCompareCount}건 비교 판정 대기</p>
                  <p className="text-xs text-slate-500">
                    {stats.compareStats.slaBreachedCount > 0
                      ? `SLA 초과 ${stats.compareStats.slaBreachedCount}건 -- 즉시 처리 필요`
                      : "비교 결과를 검토하고 판정하세요"}
                  </p>
                  {Object.keys(stats.compareStats.substatusBreakdown).length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {Object.entries(stats.compareStats.substatusBreakdown)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => `${COMPARE_SUBSTATUS_DEFS[key]?.label ?? key} ${count}`)
                        .join(" · ")}
                    </p>
                  )}
                  {(stats.compareStats.avgTurnaroundDays > 0 || stats.compareStats.conversionRate > 0) && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {stats.compareStats.avgTurnaroundDays > 0 ? `평균 ${stats.compareStats.avgTurnaroundDays}일` : ""}
                      {stats.compareStats.avgTurnaroundDays > 0 && stats.compareStats.conversionRate > 0 ? " · " : ""}
                      {stats.compareStats.conversionRate > 0 ? `견적 전환 ${stats.compareStats.conversionRate}%` : ""}
                    </p>
                  )}
                  {Object.keys(stats.compareStats.resolutionPathDistribution).length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {Object.entries(stats.compareStats.resolutionPathDistribution)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => `${RESOLUTION_PATH_LABELS[key as keyof typeof RESOLUTION_PATH_LABELS] ?? key} ${count}`)
                        .join(" · ")}
                    </p>
                  )}
                  {stats.compareStats.noMovementCount > 0 && (
                    <p className="text-[10px] text-yellow-600 font-medium mt-0.5">
                      다음 단계 없음 {stats.compareStats.noMovementCount}건
                    </p>
                  )}
                  {stats.compareStats.compareToQuoteCount > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {"견적 "}{stats.compareStats.compareToQuoteCount}
                      {" -> 발주 "}{stats.compareStats.quoteToPurchaseCount}
                      {" -> 입고 "}{stats.compareStats.purchaseToReceivingCount}
                      {" -> 완료 "}{stats.compareStats.receivingToInventoryCount}
                      {stats.compareStats.handoffStallPoint !== "none" && (
                        <span className="text-yellow-600 ml-1">
                          ({HANDOFF_STALL_LABELS[stats.compareStats.handoffStallPoint as keyof typeof HANDOFF_STALL_LABELS]})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
              </button>
            )}
          </div>
        ) : (
          <div className="px-4 py-4">
            {hasAnyData ? (
              <p className="text-sm text-slate-500">오늘 즉시 처리할 운영 이슈가 없습니다. 수동 빠른 실행에서 업무를 시작하세요.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">견적 요청을 시작하면 운영 데이터가 쌓이기 시작합니다. 아래에서 첫 업무를 시작하세요.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/dashboard/inventory">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-slate-200">
                      <Package className="h-3.5 w-3.5" /> 품목 등록
                    </Button>
                  </Link>
                  <Link href="/app/search">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-slate-200">
                      <GitCompare className="h-3.5 w-3.5" /> 비교 시작
                    </Button>
                  </Link>
                  <Link href="/dashboard/quotes">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-slate-200">
                      <FileText className="h-3.5 w-3.5" /> 견적 요청
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======= 모바일 전용 레이아웃 ======= */}
      {/* §11.272e — 하단 FAB 클리어런스는 shell main(pb 확보)이 소유 → 섹션 중복 패딩 축소. */}
      <div className="md:hidden space-y-3 pb-2">

        {/* KPI 판단 카드 2x2
            §11.196b — statsLoading skeleton 분기 제거 (pageReady gate cover). */}
        <div className="grid grid-cols-3 gap-3">
          {renderKpiCard({
            href: "/dashboard/inventory",
            icon: <Package className="h-3 w-3 text-emerald-700" />,
            label: "등록 품목",
            value: stats.totalInventory.toLocaleString("ko-KR"),
            insight: getInventoryInsight(),
            action: stats.totalInventory === 0 ? "품목 등록 시작" : undefined,
            risk: inventoryRisk,
          })}
          {renderKpiCard({
            href: "/dashboard/inventory?filter=low",
            icon: <AlertTriangle className="h-3 w-3 text-yellow-700" />,
            label: "재고 부족",
            value: stats.lowStockAlerts,
            insight: getStockInsight(),
            action: stats.lowStockAlerts > 0 ? "부족 품목 확인" : undefined,
            risk: stockRisk,
          })}
          {renderKpiCard({
            href: "/dashboard/quotes?status=PENDING",
            icon: <FileText className="h-3 w-3 text-violet-700" />,
            label: "진행 중 견적",
            value: stats.activeQuotes,
            insight: getQuoteInsight(),
            action: stats.activeQuotes === 0 ? "견적 요청 시작" : stats.respondedQuotes > 0 ? "응답 검토" : undefined,
            risk: quoteRisk,
          })}
        </div>

        {/* 운영 패널: 즉시 처리 + 추천 작업 */}
        <Card className="bg-white border-slate-200/80 rounded-xl">
          <CardContent className="p-3 space-y-3">
            {/* 즉시 처리 */}
            {urgentItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">즉시 처리</p>
                {/* §11.266b — dashboard sidebar urgent + recommended action button
                    44x44 touch target (§11.266 P1 cluster 2/5, §11.264h family
                    cross-cutting concern 확장). min-h-[44px] 추가 → Apple HIG /
                    Material / WCAG 2.1 SC 2.5.5 표준 정합. p-2 / rounded-lg /
                    severity border / ChevronRight / handleNavigateOrOverlay 보존. */}
                {urgentItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => handleNavigateOrOverlay(item.href, "dashboard")} className={`w-full flex items-center gap-2.5 min-h-[44px] p-2 rounded-lg hover:bg-slate-50 transition-colors text-left ${item.severity === "red" ? "border-l-2 border-l-red-500" : "border-l-2 border-l-yellow-500"}`}>
                    {item.icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900">{item.label}</p>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* 상태 기반 추천 */}
            <div className="space-y-1.5">
              {urgentItems.length > 0 && <div className="border-t border-slate-200" />}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">다음 작업</p>
              <div className="space-y-1">
                {/* §11.266b — recommendedActions button 44x44 (same pattern as urgentItems). */}
                {recommendedActions.map((action) => (
                  <button key={action.id} type="button" onClick={() => handleNavigateOrOverlay(action.href, "card")} className="w-full flex items-center gap-2.5 min-h-[44px] p-2 rounded-lg hover:bg-slate-50 transition-colors text-left">
                    {action.icon}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${action.state === "blocked" ? "text-slate-400" : action.state === "ready" ? "text-slate-900" : "text-slate-500"}`}>{action.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{action.desc}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* §main-dashboard-redesign P5 — "최근 알림" 카드 제거(호영님 결정).
            상단바 NotificationCenter(header-notification-wiring)가 알림 단일 진입 →
            대시보드 중복 카드 제거(중복 0). notifications 데이터는 "최근 운영 활동"
            타임라인(중앙 패널)에서 계속 소비 — awareness 손실 0. */}

        {/* 최근 처리 이력 (축소) */}
        <Card className="bg-white border-slate-200/80 rounded-xl">
          <CardHeader className="pb-2 p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-extrabold text-slate-900">최근 처리 이력</CardTitle>
              <Link href="/dashboard/purchases"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">전체 보기</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {stats.recentPurchases.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">첫 업무가 완료되면 처리 이력이 여기에 기록됩니다</p>
            ) : (
              stats.recentPurchases.slice(0, 3).map((p, i) => (
                <div key={p.id || `p-${i}`} className="flex items-center gap-2.5 py-1.5 border-b border-slate-100 last:border-0">
                  <Beaker className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{p.itemName || "품목명 미등록"}</p>
                    <p className="text-[10px] text-slate-500">{formatPurchaseDate(p.purchasedAt)}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 flex-shrink-0">
                    {p.amount ? `₩${p.amount.toLocaleString("ko-KR")}` : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>


      {/* 모바일 하단 고정 빠른 실행 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/97 backdrop-blur-sm border-t border-slate-200/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href="/app/search" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-11 text-xs gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
              <Search className="h-3.5 w-3.5" />
              시약 검색
            </Button>
          </Link>
          <Link href="/dashboard/inventory" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-11 text-xs gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50">
              <Plus className="h-3.5 w-3.5" />
              재고 등록
            </Button>
          </Link>
          <Link href="/app/quote" className="flex-1">
            <Button size="sm" className="w-full h-11 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              견적 요청
            </Button>
          </Link>
        </div>
      </div>

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open) */}
      <OperationalBriefFloatingEntry controls="operational-brief-popup" />
    </div>
  );
}

// §11.214b Path Z — NoSSR wrapper. inventory 패턴 (dynamic + ssr: false) 정합.
// SSR HTML ≡ CSR initial render → hydration mismatch 0. fallback null
// (dashboard 진입 시 first paint 약간 늦어짐 ~수백ms, 이후 정상).
export default function DashboardPage() {
  return (
    <NoSSR>
      <DashboardPageInner />
    </NoSSR>
  );
}

/**
 * ExecutiveSummarySection — /dashboard 메인 통합 요약 영역
 *
 * 각 페이지(orders, budget, purchase-orders)에 흩어져 있는 핵심 운영 지표를
 * 같은 canvas에서 한 번에 볼 수 있도록 모은다.
 *
 * 구조:
 * - 상단: KPI 카드 3개 (예산 소진율 / 승인 대기 / AI Anomaly)
 * - 중앙: recharts LineChart — 월별 예산 소진 추이 + 예상 고갈 시점 marker
 * - 우측: ActionLedger — 최근 이벤트 타임라인
 *
 * 데이터 소스:
 * - useOrderQueueStore (canonical)
 * - useBudgetStore (canonical)
 *
 * 자체 fetch는 store hydration trigger 역할만 하고, 표시 상태는 store에서 derive.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
// §11.196e — recharts dead import 제거 (9 symbol 모두 actual JSX 사용 0).
//   ExecutiveSummary 가 사실 recharts 의존 0 인데 import 만 끌고 있어
//   chunk 에 recharts (~150KB gzipped) 강제 포함시키고 있던 root cause.
//   §11.196c (static import) 의 trade-off (initial bundle ↑) 가정이
//   spurious — dead import 제거로 자연 해소. KPI 카드 + projection
//   table 만 사용하므로 recharts 불필요.
import {
  TrendingDown,
  ClipboardList,
  ShieldAlert,
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  useOrderQueueStore,
  type OrderQueueItem,
} from "@/lib/store/order-queue-store";
import {
  useBudgetStore,
  deriveBudgetControl,
  type Budget,
} from "@/lib/store/budget-store";
import { ActionLedger } from "./action-ledger";
import { useFastTrackStore } from "@/lib/store/fast-track-store";

// ── KPI derivation (pure) ────────────────────────────────────────────

interface DashboardKpis {
  totalBudget: number;
  totalSpent: number;
  burnRate: number; // 0~100+
  burnRateRisk: "safe" | "warning" | "critical" | "over";
  pendingApprovalCount: number;
  pendingApprovalAmount: number;
  anomalyCount: number;
  anomalyDetail: string;
}

function deriveKpis(orders: OrderQueueItem[], budgets: Budget[]): DashboardKpis {
  const totalBudget = budgets.reduce((s, b) => s + (b.amount ?? 0), 0);
  const totalSpent = budgets.reduce(
    (s, b) => s + (b.usage?.totalSpent ?? 0),
    0,
  );
  const burnRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  let burnRateRisk: DashboardKpis["burnRateRisk"] = "safe";
  if (burnRate > 100) burnRateRisk = "over";
  else if (burnRate >= 80) burnRateRisk = "critical";
  else if (burnRate >= 60) burnRateRisk = "warning";

  const pendingOrders = orders.filter((o) => o.status === "pending_approval");
  const pendingApprovalCount = pendingOrders.length;
  const pendingApprovalAmount = pendingOrders.reduce(
    (s, o) => s + (o.totalAmount ?? 0),
    0,
  );

  // AI Anomaly: 예산 위험 + 고액 발주(>5M) + 예산 burn rate >80%
  const overBudgets = budgets.filter((b) => {
    const c = deriveBudgetControl(b);
    return c.risk === "critical" || c.risk === "over";
  });
  const highValueOrders = orders.filter(
    (o) =>
      o.totalAmount > 5_000_000 &&
      o.status !== "completed" &&
      o.status !== "cancelled",
  );
  const anomalyCount = overBudgets.length + highValueOrders.length;

  let anomalyDetail = "이상 신호 없음";
  if (overBudgets.length > 0 && highValueOrders.length > 0) {
    anomalyDetail = `예산 위험 ${overBudgets.length}건 · 고액 발주 ${highValueOrders.length}건`;
  } else if (overBudgets.length > 0) {
    anomalyDetail = `예산 위험 ${overBudgets.length}건 — 즉시 확인`;
  } else if (highValueOrders.length > 0) {
    anomalyDetail = `고액 발주 ${highValueOrders.length}건 검토 필요`;
  }

  return {
    totalBudget,
    totalSpent,
    burnRate,
    burnRateRisk,
    pendingApprovalCount,
    pendingApprovalAmount,
    anomalyCount,
    anomalyDetail,
  };
}

// ── Monthly burn projection ──────────────────────────────────────────

interface MonthlyPoint {
  month: string;
  cumulative: number;
  projected: number | null;
  budget: number;
}

/**
 * 월별 누적 소진 + 선형 외삽 기반 예상 고갈 시점.
 * orders.approvedAt을 월 단위로 집계해 cumulative spend를 만들고,
 * 최근 3개월 평균 burn으로 future 6개월을 외삽한다.
 */
function buildMonthlyProjection(
  orders: OrderQueueItem[],
  totalBudget: number,
  nowMs: number,
): { points: MonthlyPoint[]; depletionMonth: string | null } {
  if (totalBudget <= 0) {
    return { points: [], depletionMonth: null };
  }

  // 1. 월별 집계 (approvedAt 기준)
  const monthMap = new Map<string, number>();
  for (const o of orders) {
    if (!o.approvedAt) continue;
    const d = new Date(o.approvedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + (o.totalAmount ?? 0));
  }

  // 2. 최근 6개월 + 미래 6개월 윈도우 생성
  // §11.214 — NOW 의존 부분만 nowMs prop 으로 받음 (caller 가 useEffect mount
  // 후 set). render-path Date.now()/new Date() 직접 호출 0 → SSR-CSR
  // hydration mismatch 차단.
  const now = new Date(nowMs);
  const window: { key: string; label: string; date: Date }[] = [];
  for (let i = -5; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    window.push({ key, label: `${d.getMonth() + 1}월`, date: d });
  }

  // 3. cumulative spend
  let cumulative = 0;
  const historical: MonthlyPoint[] = [];
  let lastActualIdx = -1;
  for (let i = 0; i < window.length; i++) {
    const w = window[i]!;
    const isFuture = w.date.getTime() > now.getTime();
    if (!isFuture) {
      cumulative += monthMap.get(w.key) ?? 0;
      lastActualIdx = i;
      historical.push({
        month: w.label,
        cumulative,
        projected: null,
        budget: totalBudget,
      });
    } else {
      historical.push({
        month: w.label,
        cumulative: 0,
        projected: null,
        budget: totalBudget,
      });
    }
  }

  // 4. 최근 3개월 평균 burn으로 외삽
  const recent = historical.slice(Math.max(0, lastActualIdx - 2), lastActualIdx + 1);
  let avgBurn = 0;
  if (recent.length >= 2) {
    const first = recent[0]!.cumulative;
    const last = recent[recent.length - 1]!.cumulative;
    avgBurn = Math.max(0, (last - first) / Math.max(1, recent.length - 1));
  } else if (recent.length === 1) {
    avgBurn = recent[0]!.cumulative;
  }

  let projectedRunning = lastActualIdx >= 0 ? historical[lastActualIdx]!.cumulative : 0;
  let depletionMonth: string | null = null;
  for (let i = lastActualIdx + 1; i < historical.length; i++) {
    projectedRunning += avgBurn;
    historical[i]!.projected = projectedRunning;
    if (depletionMonth === null && projectedRunning >= totalBudget) {
      depletionMonth = historical[i]!.month;
    }
  }
  // bridge 연속성: lastActual에 projected 시작점도 박아둔다
  if (lastActualIdx >= 0) {
    historical[lastActualIdx]!.projected = historical[lastActualIdx]!.cumulative;
  }

  return { points: historical, depletionMonth };
}

// ── KPI Card ─────────────────────────────────────────────────────────

interface KpiBreakdownItem {
  label: string;
  value: string;
}

/**
 * §11.92 #dashboard-kpi-delta-chip — 카드 우측 상단 trend badge.
 * 호영님 시안 흡수 (↗ +1 / ↗ 12% / ↘ -2 형태). real data 기반만.
 * direction: chip 화살표 / tone: 색상 분기 (운영자 시야: 증가가 좋은 지표
 * vs 나쁜 지표 분기). undefined 시 chip 비노출.
 */
interface KpiDelta {
  /** 표시 문자열 (예: "+1", "12%", "-2.5%") */
  text: string;
  direction: "up" | "down" | "flat";
  /** positive=emerald(좋음) / negative=rose(나쁨) / neutral=slate */
  tone: "positive" | "negative" | "neutral";
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  risk: "none" | "warning" | "critical";
  href?: string;
  /**
   * §11.82 Phase 2 — hover Quick Data Breakdown popup.
   * 호영님 시안 visual essence 흡수 (real sub-metric only, mock 0).
   * undefined 시 popup 비노출.
   */
  breakdown?: KpiBreakdownItem[];
  /**
   * tone 강제 — risk 무관하게 색상 분기 (호영님 시안: 정상=emerald,
   * 경고=amber, 지출=blue, 위험=rose). default 는 risk 자동 매핑.
   */
  toneOverride?: "blue" | "emerald" | "amber" | "rose";
  /**
   * §11.92 — trend chip. real KPI delta 기반만 (mock 0). 데이터 부재 시
   * undefined → chip 비노출 (no fake "0%").
   */
  delta?: KpiDelta;
}

function KpiCard({ icon, label, value, hint, risk, href, breakdown, toneOverride, delta }: KpiCardProps) {
  // §11.139 — mobile breakdown collapsible (default closed).
  // §11.98 always-visible 의 카드 높이 부담 해소.
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);

  // §11.82 Phase 2: 4-tone palette (blue=지출, emerald=정상, amber=경고, rose=위험).
  const tone =
    toneOverride
    ?? (risk === "critical" ? "rose" : risk === "warning" ? "amber" : "emerald");

  // §11.206 — 시안 정합: 단순 border-l 에서 다층 shadow + 아이콘 컨테이너 +
  //   font-black tracking-tighter + glassmorphism delta + hover lift 로 upgrade.
  //   (호영님 시안: Google AI Studio LabAxis "OPERATIONAL INTELLIGENCE
  //   DASHBOARD" 4 KPI 카드 정합)
  // §11.302d-6a-3-β — tone key "amber" 보존 (caller toneOverride / risk 매핑
  //   영향 0), 값만 yellow swap. badge.tsx 패턴 정합.
  //   §11.302 신호등 정합: amber → yellow (경고 의미 유지).
  const iconContainerMap = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-yellow-50 text-yellow-600",
    rose: "bg-rose-50 text-rose-600",
  };

  const hoverBorderMap = {
    blue: "hover:border-blue-200",
    emerald: "hover:border-emerald-200",
    amber: "hover:border-yellow-200",
    rose: "hover:border-rose-200",
  };

  const progressBarMap = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    amber: "bg-yellow-500",
    rose: "bg-rose-500",
  };

  const valueColorMap = {
    blue: "text-blue-700",
    emerald: "text-slate-900",
    amber: "text-yellow-700",
    rose: "text-rose-700",
  };

  // §11.92 — delta chip 색상 매핑. §11.206 glassmorphism backdrop-blur.
  const deltaToneMap = {
    positive: "bg-emerald-50/80 text-emerald-700 border-emerald-200/60 backdrop-blur-sm",
    negative: "bg-rose-50/80 text-rose-700 border-rose-200/60 backdrop-blur-sm",
    neutral: "bg-slate-50/80 text-slate-600 border-slate-200/60 backdrop-blur-sm",
  };
  const deltaArrowMap = {
    up: "↗",
    down: "↘",
    flat: "→",
  };

  const body = (
    <div
      /* §11.364 D-3 — 데스크탑 KPI 밀도: 패딩 p-5→p-4 (폰트 24-30 유지, 높이는 패딩·여백에서). */
      className={`group relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_4px_rgba(0,0,0,0.04),_0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),_0_8px_16px_rgba(0,0,0,0.08),_0_24px_48px_rgba(0,0,0,0.12)] ${hoverBorderMap[tone]} overflow-hidden`}
    >
      {/* §11.206 — 헤더 row: 아이콘 컨테이너 + glassmorphism delta badge.
          §11.206b — delta = undefined (real data 부재) 시 fallback status
          chip 노출. fake "+0%" 가 아니라 truthful status (정상 / 주의 / 위험)
          를 tone 에 따라 표기. 시안 정합 visual 리듬 보존. */}
      {/* §11.364 D-3 — 헤더 mb-4→mb-3, 아이콘 w-12→w-10 (높이 축소). */}
      <div className="flex items-start justify-between mb-3">
        {/* §11.302d-6a-3-β — dynamic shadow class: tone === "amber" → "yellow" 으로 변환 (Tailwind class 출력). */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconContainerMap[tone]} shadow-sm shadow-${tone === "rose" ? "rose" : tone === "amber" ? "yellow" : tone === "blue" ? "blue" : "emerald"}-100 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-2deg]`}>
          {icon}
        </div>
        <div className="flex items-center gap-1.5">
          {delta ? (
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full border text-[10px] font-bold tabular-nums ${deltaToneMap[delta.tone]}`}
            >
              <span aria-hidden>{deltaArrowMap[delta.direction]}</span>
              {delta.text}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${
                tone === "rose"
                  ? "bg-rose-50/80 text-rose-700 border-rose-200/60 backdrop-blur-sm"
                  : tone === "amber"
                    ? "bg-yellow-50/80 text-yellow-700 border-yellow-200/60 backdrop-blur-sm"
                    : tone === "blue"
                      ? "bg-blue-50/80 text-blue-700 border-blue-200/60 backdrop-blur-sm"
                      : "bg-emerald-50/80 text-emerald-700 border-emerald-200/60 backdrop-blur-sm"
              }`}
            >
              <span className="relative flex h-1 w-1">
                <span className={`relative inline-flex rounded-full h-1 w-1 ${
                  tone === "rose" ? "bg-rose-500"
                    : tone === "amber" ? "bg-yellow-500"
                      : tone === "blue" ? "bg-blue-500"
                        : "bg-emerald-500"
                }`} />
              </span>
              {tone === "rose" ? "위험" : tone === "amber" ? "주의" : tone === "blue" ? "활성" : "정상"}
            </span>
          )}
          {href && (
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
          )}
        </div>
      </div>

      {/* §11.206 — label 작게, value 크게 (font-black + tracking-tighter — quant 톤) */}
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">
        {label}
      </p>
      {/* §11.364 D-3 — value 폰트 24-30 유지(text-2xl md:text-3xl), hint 여백 mt-2→mt-1.5. */}
      <p className={`text-2xl md:text-3xl font-black tracking-tighter tabular-nums leading-none ${valueColorMap[tone]}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-slate-500 break-keep leading-relaxed">{hint}</p>

      {/* §11.206 — 카드 하단 progress bar (시각 리듬 강화).
          §11.206b/c — h-1 → h-1.5 + opacity 0.65 → 1.0 + width 더 visible.
          시안 정합 (호영님 첨부 LabAxis dashboard) — bar 가 명확히 보여야
          시각 리듬 작동. */}
      {/* §11.364 D-3 — 하단 progress bar 데드스페이스 mt-5→mt-3. */}
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${progressBarMap[tone]}`}
          style={{
            width: tone === "rose" ? "100%" : tone === "amber" ? "78%" : tone === "blue" ? "62%" : "45%",
          }}
        />
      </div>

      {/* §11.82 Phase 2 — desktop hover Quick Data Breakdown popup.
          desktop only (md+), pointer-events-none 으로 hover 영역 침범 안 함.
          group-hover 시 opacity + translate-y transition. */}
      {breakdown && breakdown.length > 0 && (
        <div className="hidden md:block pointer-events-none absolute left-0 right-0 top-full mt-1 z-20 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
          <div className="rounded-lg border border-slate-700 bg-slate-900 text-white shadow-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Quick Data Breakdown
            </p>
            <div className="space-y-1.5">
              {breakdown.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="text-slate-300 break-keep">{b.label}</span>
                  <span className="font-bold tabular-nums text-white">{b.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* §11.139 #dashboard-kpi-mobile-collapsible — §11.98 always-visible 의
          카드 높이 부담 해소. default closed + toggle button.
          desktop hover popup (hidden md:block) 은 그대로. */}
      {breakdown && breakdown.length > 0 && (
        <div className="md:hidden mt-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBreakdownExpanded((prev) => !prev);
            }}
            className="w-full flex items-center justify-between gap-2 text-[10px] text-slate-500 hover:text-slate-700"
            aria-expanded={breakdownExpanded}
          >
            <span>{breakdownExpanded ? "내역 닫기" : "내역 보기"}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                breakdownExpanded && "rotate-180",
              )}
            />
          </button>
          {breakdownExpanded && (
            <div className="mt-2 space-y-1">
              {breakdown.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center justify-between gap-2 text-[10px]"
                >
                  <span className="text-slate-400 break-keep">{b.label}</span>
                  <span className="font-semibold tabular-nums text-slate-600">{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

// ── Chart Tooltip ────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-md">
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[11px] text-slate-700 tabular-nums">
          <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: p.color }} />
          {p.name}: {p.value.toLocaleString()}원
        </p>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

/**
 * §11.92 + §11.94 — 외부에서 전달되는 trend 데이터.
 * dashboard/page.tsx 의 stats 객체에 있는 real delta 만 prop forward.
 * 다른 KPI 의 trend 는 backend snapshot DB 또는 status_history schema
 * 추가 후 별도 트랙 — Phase 1 framework 만 정형화 (`processingDelta`,
 * `pendingApprovalDelta`, `anomalyDelta` interface 정의), 데이터 source
 * 추가 시 자동 활성. 현재 dashboard/stats endpoint 가 derive 가능한 것은
 * monthOverMonthChange + weekOverWeekChange (recentPurchaseRecords 기반).
 */
interface ExecutiveSummaryDeltas {
  /** 전월 대비 누적 지출 변화율 (예: 12.4 → "12.4%", -4.2 → "-4.2%"). */
  monthOverMonthChange?: number;
  /** 전주 대비 누적 지출 변화율 (§11.94 Phase 1 — 최근 7일 vs 그 이전 7일). */
  weekOverWeekChange?: number;
  /** §11.94 Phase 2 deferred — store/snapshot history 추가 후 활성. */
  processingDelta?: { value: number; period: "day" | "week" };
  pendingApprovalDelta?: { value: number; period: "day" | "week" };
  anomalyDelta?: { value: number; period: "day" | "week" };
}

/** §11.243 #3 — 호영님 P0: 온보딩 모드 시 KPI 가이드.
 *  onboardingMode=true 시 KPI grid 위에 안내 banner + KPI 카드 dim
 *  (opacity-60 + pointer-events-none + grayscale). 가이드 메시지로 운영
 *  데이터 부재를 명확히 전달, 사용자가 OnboardingHero 로 시선 이동 유도.
 *  canonical truth lock: KPI 자체 derive 로직 변경 0 — display only. */
export function ExecutiveSummarySection({
  deltas,
  onboardingMode = false,
  reorderReviewCount = 0,
}: {
  deltas?: ExecutiveSummaryDeltas;
  onboardingMode?: boolean;
  /** §11.361-2b — 재고 부족(안전재고 미달) 건수. "처리 필요 항목" KPI 가 발주/예산만
   *  집계해 재고 부족을 누락하던 truth 불일치 정정 — page.tsx stats.lowStockAlerts 전달. */
  reorderReviewCount?: number;
} = {}) {
  // store hydration
  const orders = useOrderQueueStore((s) => s.orders);
  const ordersFetching = useOrderQueueStore((s) => s.isFetching);
  const fetchOrders = useOrderQueueStore((s) => s.fetchOrders);

  const budgets = useBudgetStore((s) => s.budgets);
  const budgetsFetching = useBudgetStore((s) => s.isFetching);
  const fetchBudgets = useBudgetStore((s) => s.fetchBudgets);

  // Fast-Track 수락 이력 — ActionLedger 에 한 줄씩 "⚡ ... 수락" 이벤트로 노출
  const fastTrackAcceptances = useFastTrackStore((s) => s.acceptanceLog);

  useEffect(() => {
    if (orders.length === 0 && ordersFetching) {
      fetchOrders();
    }
    if (budgets.length === 0 && budgetsFetching) {
      fetchBudgets();
    }
    // realtime 구독은 각 도메인 페이지에서 관리. 여기서는 read-only.
  }, [orders.length, budgets.length, ordersFetching, budgetsFetching, fetchOrders, fetchBudgets]);

  const kpis = useMemo(() => deriveKpis(orders, budgets), [orders, budgets]);

  // §11.214 — buildMonthlyProjection 가 NOW 의존 (window 6개월 ± 6개월).
  // SSR-CSR hydration mismatch 차단 위해 nowMs 를 useEffect mount 후 set.
  // null 동안은 projection { points: [], depletionMonth: null } fallback.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  const projection = useMemo(
    () =>
      nowMs === null
        ? { points: [], depletionMonth: null }
        : buildMonthlyProjection(orders, kpis.totalBudget, nowMs),
    [orders, kpis.totalBudget, nowMs],
  );

  const isLoading = ordersFetching || budgetsFetching;

  return (
    <section className="space-y-4">
      {/* §11.243 #3 — 호영님 P0: 온보딩 모드 KPI 가이드 banner.
          데이터 부재 시 KPI 카드가 0/-/0건 으로만 채워지므로 사용자에게
          맥락 없음. banner 로 "운영 데이터 누적 후 활성화" 명시 + KPI grid
          opacity 분기로 시각적 dim. */}
      {onboardingMode && (
        <div
          data-onboarding-kpi-guide
          className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-start gap-2"
        >
          <AlertCircle className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-0.5">
              운영 데이터가 쌓이면 KPI 지표가 활성화됩니다
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              위 시작하기 단계를 완료하면 처리 필요 항목 · 진행 중 발주 · 예산 소진율 · 이상 신호 KPI 가 실시간으로 채워집니다.
            </p>
          </div>
        </div>
      )}

      {/* §11.362-3 — 호영님: System Insight(종합 판단)를 KPI(개별 액션) 위로.
          종합 판단 → 개별 액션 순. real signal — 진행 중 발주 / 이상 신호 /
          예산 burn rate 기반 한 줄 운영 시그니처 자동 derive. fake 0.
          §11.243b #3 — onboardingMode 시 hide(KPI guide banner 와 상호배타).
          dismiss + sessionStorage 유지. */}
      {!onboardingMode && (
        <SystemInsightCard kpis={kpis} ordersCount={orders.length} />
      )}

      {/* ── KPI Row ─────────────────────────────────────── */}
      {/* §11.82 #dashboard-operational-intelligence-redesign Phase 2.
          호영님 시안의 4-card visual essence 흡수 — hover Quick Data
          Breakdown popup 추가 + tone 4분류 (정상=emerald, 경고=amber,
          지출=blue, 위험=rose). breakdown 데이터는 모두 real Prisma
          drived store 에서 derive — mock 0 / fake 0. */}
      <div
        className={
          onboardingMode
            ? "grid grid-cols-2 gap-3 sm:grid-cols-4 opacity-60 grayscale pointer-events-none"
            : "grid grid-cols-2 gap-3 sm:grid-cols-4"
        }
      >
        <KpiCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="처리 필요 항목"
          /* §11.361-2b — 재고 부족(reorderReviewCount) 포함. 이전엔 발주/예산(승인+이상)만
             집계해 재고 부족 2건이 있어도 "0건"으로 표기 = 대시보드 processingRequiredCount
             (재고 포함)와 truth 불일치. 재고를 더해 정합. */
          value={`${kpis.pendingApprovalCount + kpis.anomalyCount + reorderReviewCount}건`}
          hint={
            (kpis.pendingApprovalCount + kpis.anomalyCount + reorderReviewCount) > 0
              ? "즉시 처리가 필요한 항목 건수"
              : "현재 즉시 처리할 항목 없음"
          }
          risk={(kpis.pendingApprovalCount + kpis.anomalyCount + reorderReviewCount) > 0 ? "warning" : "none"}
          toneOverride={
            kpis.pendingApprovalCount + kpis.anomalyCount + reorderReviewCount === 0 ? "emerald" : "amber"
          }
          href="/dashboard/purchase-orders"
          breakdown={[
            { label: "승인 대기", value: `${kpis.pendingApprovalCount}건` },
            { label: "이상 신호", value: `${kpis.anomalyCount}건` },
            { label: "재고 부족", value: `${reorderReviewCount}건` },
          ]}
          /* §11.107/§11.108 — processingDelta chip (snapshot 24h 비교).
             증가 = negative tone (운영 부담 ↑). 감소 = positive (해소). */
          delta={
            deltas?.processingDelta && deltas.processingDelta.value !== 0
              ? {
                  text: `${deltas.processingDelta.value > 0 ? "+" : ""}${deltas.processingDelta.value}건`,
                  direction: deltas.processingDelta.value > 0 ? "up" : "down",
                  tone: deltas.processingDelta.value > 0 ? "negative" : "positive",
                }
              : undefined
          }
        />
        <KpiCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="진행 중 발주"
          value={`${kpis.pendingApprovalCount}건`}
          hint={
            kpis.pendingApprovalCount > 0
              ? `총 ${kpis.pendingApprovalAmount.toLocaleString()}원`
              : "대기 중인 발주가 없습니다"
          }
          risk={kpis.pendingApprovalCount >= 3 ? "warning" : "none"}
          toneOverride="blue"
          href="/dashboard/purchase-orders"
          breakdown={[
            { label: "총 금액", value: `₩${kpis.pendingApprovalAmount.toLocaleString("ko-KR")}` },
            {
              label: "건당 평균",
              value:
                kpis.pendingApprovalCount > 0
                  ? `₩${Math.round(kpis.pendingApprovalAmount / kpis.pendingApprovalCount).toLocaleString("ko-KR")}`
                  : "—",
            },
          ]}
          /* §11.107/§11.108 — pendingApprovalDelta chip (snapshot 24h 비교).
             증가 = negative (운영자 처리 부담 ↑). 감소 = positive (해소). */
          delta={
            deltas?.pendingApprovalDelta && deltas.pendingApprovalDelta.value !== 0
              ? {
                  text: `${deltas.pendingApprovalDelta.value > 0 ? "+" : ""}${deltas.pendingApprovalDelta.value}건`,
                  direction: deltas.pendingApprovalDelta.value > 0 ? "up" : "down",
                  tone: deltas.pendingApprovalDelta.value > 0 ? "negative" : "positive",
                }
              : undefined
          }
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="누적 지출"
          value={`₩${(kpis.totalSpent / 1_000_000).toFixed(1)}M`}
          hint={
            kpis.totalBudget > 0
              ? `예산 대비 ${kpis.burnRate.toFixed(0)}% 소진`
              : "예산 미설정"
          }
          risk={kpis.burnRateRisk === "over" || kpis.burnRateRisk === "critical" ? "critical" : kpis.burnRateRisk === "warning" ? "warning" : "none"}
          toneOverride={
            kpis.burnRateRisk === "over" || kpis.burnRateRisk === "critical"
              ? "rose"
              : kpis.burnRateRisk === "warning"
                ? "amber"
                : "blue"
          }
          href="/dashboard/budget"
          breakdown={[
            { label: "총 예산", value: `₩${kpis.totalBudget.toLocaleString("ko-KR")}` },
            { label: "누적 소진", value: `₩${kpis.totalSpent.toLocaleString("ko-KR")}` },
            { label: "소진율", value: `${kpis.burnRate.toFixed(1)}%` },
          ]}
          /* §11.92 + §11.94 — week 우선, month fallback delta forward.
             week 데이터가 더 최신/정밀. 지출 증가는 negative tone (운영
             비용 ↑ = 나쁨), 감소는 positive. */
          delta={(() => {
            const weekly = deltas?.weekOverWeekChange;
            const monthly = deltas?.monthOverMonthChange;
            const value = weekly !== undefined && Math.abs(weekly) > 0.1
              ? weekly
              : monthly !== undefined && Math.abs(monthly) > 0.1
                ? monthly
                : undefined;
            if (value === undefined) return undefined;
            const isWeek = weekly !== undefined && Math.abs(weekly) > 0.1;
            return {
              text: `${value > 0 ? "+" : ""}${value.toFixed(1)}% ${isWeek ? "주" : "월"}`,
              direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
              tone: value > 0 ? "negative" : value < 0 ? "positive" : "neutral",
            };
          })()}
        />
        <KpiCard
          icon={<ShieldAlert className="h-5 w-5" />}
          label="신규 이상 징후"
          value={`${kpis.anomalyCount}건`}
          hint={kpis.anomalyDetail}
          risk={
            kpis.anomalyCount >= 3
              ? "critical"
              : kpis.anomalyCount > 0
                ? "warning"
                : "none"
          }
          toneOverride={
            kpis.anomalyCount >= 3
              ? "rose"
              : kpis.anomalyCount > 0
                ? "amber"
                : "emerald"
          }
          href="/dashboard/purchase-orders"
          breakdown={[
            { label: "예산 위험", value: kpis.anomalyDetail.includes("예산") ? kpis.anomalyDetail : "0건" },
            {
              label: "고액 발주(>500만)",
              value: `${orders.filter((o) => o.totalAmount > 5_000_000 && o.status !== "completed" && o.status !== "cancelled").length}건`,
            },
          ]}
          /* §11.107/§11.108 — anomalyDelta chip (snapshot 24h 비교).
             증가 = negative (위험 신호 ↑). 감소 = positive (해소). */
          delta={
            deltas?.anomalyDelta && deltas.anomalyDelta.value !== 0
              ? {
                  text: `${deltas.anomalyDelta.value > 0 ? "+" : ""}${deltas.anomalyDelta.value}건`,
                  direction: deltas.anomalyDelta.value > 0 ? "up" : "down",
                  tone: deltas.anomalyDelta.value > 0 ? "negative" : "positive",
                }
              : undefined
          }
        />
      </div>

      {/* 차트/활동 피드는 대시보드에서 제거.
          월별 추이는 지출 분석 페이지로 이관.
          활동 피드는 3상태 중앙 패널 우측 카드가 대체. */}
    </section>
  );
}

// ── §11.82 Phase 3: SYSTEM INSIGHT card ─────────────────────────────
// 호영님 시안의 다크 accent insight card visual essence 흡수.
// real KPI 기반으로 운영 시그니처 메시지 derive — burnRate / anomaly /
// pending order 의 조합으로 short message 결정. AI 호출은 별도 dialog
// (AIInsightDialog) 가 수행 — 이 카드는 항상 표시되는 ambient signal.

/** §11.243b #3 — 호영님 P0: SystemInsightCard dismiss + sessionStorage.
 *  사용자가 X button 으로 dismiss 시 sessionStorage 'systemInsightDismissed'
 *  에 저장 → 같은 세션 내 hide. 새 세션 시작 시 자동 다시 노출 (운영자가
 *  매일 한 번은 시그니처 확인 + 당일 작업 중 noise 제거).
 *  canonical truth lock: kpis derive 로직 변경 0 — visibility state only. */
function SystemInsightCard({
  kpis,
  ordersCount,
}: {
  kpis: DashboardKpis;
  ordersCount: number;
}) {
  // §11.243b #3 — dismiss state + sessionStorage hydration (CSR-safe).
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem("systemInsightDismissed");
      if (stored === "true") setDismissed(true);
    } catch {
      // sessionStorage 차단 환경 — 기본 false 유지
    }
  }, []);
  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem("systemInsightDismissed", "true");
    } catch {
      // sessionStorage 차단 환경 — state 만 set (refresh 시 재노출 허용)
    }
  };
  if (dismissed) return null;

  // signal derivation — risk 우선순위로 message 선정
  let title = "운영 흐름이 안정적입니다";
  let detail = "현재 즉시 조치가 필요한 운영 이슈가 없습니다.";
  let accent: "emerald" | "amber" | "rose" | "indigo" = "indigo";

  if (kpis.burnRateRisk === "over") {
    title = "예산 한도를 초과했습니다";
    detail = `누적 소진 ${kpis.burnRate.toFixed(0)}% — 즉시 추가 발주를 보류하고 예산 관리자와 정렬하세요.`;
    accent = "rose";
  } else if (kpis.burnRateRisk === "critical") {
    title = "예산 burn rate 가 임계치에 도달했습니다";
    detail = `누적 소진 ${kpis.burnRate.toFixed(0)}% — 남은 기간 발주 우선순위를 재검토하세요.`;
    accent = "amber";
  } else if (kpis.anomalyCount >= 3) {
    title = "이상 신호 다발";
    detail = `${kpis.anomalyDetail} — 위험/차단 카드에서 즉시 확인하세요.`;
    accent = "rose";
  } else if (kpis.anomalyCount > 0) {
    title = "이상 신호 감지";
    detail = `${kpis.anomalyDetail}.`;
    accent = "amber";
  } else if (kpis.pendingApprovalCount >= 3) {
    title = "승인 대기가 누적되고 있습니다";
    detail = `${kpis.pendingApprovalCount}건 (₩${kpis.pendingApprovalAmount.toLocaleString("ko-KR")}) — 빠른 검토가 필요합니다.`;
    accent = "amber";
  } else if (ordersCount === 0 && kpis.totalBudget === 0) {
    title = "운영 데이터 수집을 시작하세요";
    detail = "예산 등록과 첫 견적 요청을 통해 운영 시그니처를 누적할 수 있습니다.";
    accent = "indigo";
  } else if (kpis.totalBudget > 0 && kpis.burnRateRisk === "safe") {
    title = "예산 운영이 정상 범위에 있습니다";
    detail = `누적 소진 ${kpis.burnRate.toFixed(0)}% · 진행 중 발주 ${kpis.pendingApprovalCount}건 — 안정적입니다.`;
    accent = "emerald";
  }

  // §11.302d-6a-3-β — gradient/dotMap amber key 보존, value yellow swap.
  //   dark accent gradient 매핑 (호영님 시안 보라/그라데이션 톤 흡수).
  const gradientMap = {
    emerald: "from-emerald-700 to-emerald-900",
    amber: "from-yellow-700 to-yellow-900",
    rose: "from-rose-700 to-rose-900",
    indigo: "from-indigo-700 to-purple-800",
  };

  const dotMap = {
    emerald: "bg-emerald-400",
    amber: "bg-yellow-400",
    rose: "bg-rose-400",
    indigo: "bg-indigo-300",
  };

  return (
    // §11.252d-3 — 모바일 padding 압축 (p-4 → p-3, md:p-5 보존). 헤더 mb-1.5 →
    //   mb-1 미세 축소. 시각 hierarchy (gradient + animate-ping + icon) +
    //   §11.243b #3 dismiss button + sessionStorage 모두 보존. canonical
    //   truth (kpis derive 6 분기 message) 변경 0.
    <div
      className={`relative rounded-xl border border-slate-700/50 bg-gradient-to-br ${gradientMap[accent]} text-white shadow-md p-3 md:p-5`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${dotMap[accent]} opacity-50 animate-ping`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotMap[accent]}`} />
          </div>
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
            System Insight
          </p>
          <p className="text-sm md:text-base font-bold text-white break-keep">{title}</p>
          <p className="text-[12px] md:text-[13px] text-white/80 mt-1 break-keep leading-relaxed">
            {detail}
          </p>
        </div>
        {/* §11.243b #3 — 호영님 P0: dismiss button + sessionStorage. */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="System Insight 카드 닫기"
          title="이번 세션에서 숨기기"
          className="absolute top-3 right-3 inline-flex items-center justify-center h-6 w-6 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

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

import { useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  TrendingDown,
  ClipboardList,
  ShieldAlert,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
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
  const now = new Date();
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
}

function KpiCard({ icon, label, value, hint, risk, href, breakdown, toneOverride }: KpiCardProps) {
  // §11.82 Phase 2: 4-tone palette (blue=지출, emerald=정상, amber=경고, rose=위험).
  const tone =
    toneOverride
    ?? (risk === "critical" ? "rose" : risk === "warning" ? "amber" : "emerald");

  const accentMap = {
    blue: "border-l-2 border-l-blue-500",
    emerald: "border-l-2 border-l-emerald-500",
    amber: "border-l-2 border-l-amber-500",
    rose: "border-l-2 border-l-rose-500",
  };

  const valueColorMap = {
    blue: "text-blue-700",
    emerald: "text-slate-900",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };

  const body = (
    <div
      className={`group relative rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md hover:border-slate-300 ${accentMap[tone]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {icon}
          <span>{label}</span>
        </div>
        {href && (
          <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
        )}
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${valueColorMap[tone]}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 break-keep">{hint}</p>

      {/* §11.82 Phase 2 — hover Quick Data Breakdown popup.
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

export function ExecutiveSummarySection() {
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
  const projection = useMemo(
    () => buildMonthlyProjection(orders, kpis.totalBudget),
    [orders, kpis.totalBudget],
  );

  const isLoading = ordersFetching || budgetsFetching;

  return (
    <section className="space-y-4">
      {/* ── KPI Row ─────────────────────────────────────── */}
      {/* §11.82 #dashboard-operational-intelligence-redesign Phase 2.
          호영님 시안의 4-card visual essence 흡수 — hover Quick Data
          Breakdown popup 추가 + tone 4분류 (정상=emerald, 경고=amber,
          지출=blue, 위험=rose). breakdown 데이터는 모두 real Prisma
          drived store 에서 derive — mock 0 / fake 0. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          label="처리 필요 항목"
          value={`${kpis.pendingApprovalCount + kpis.anomalyCount}건`}
          hint={
            (kpis.pendingApprovalCount + kpis.anomalyCount) > 0
              ? "즉시 처리가 필요한 항목 건수"
              : "현재 즉시 처리할 항목 없음"
          }
          risk={(kpis.pendingApprovalCount + kpis.anomalyCount) > 0 ? "warning" : "none"}
          toneOverride={
            kpis.pendingApprovalCount + kpis.anomalyCount === 0 ? "emerald" : "amber"
          }
          href="/dashboard/purchase-orders"
          breakdown={[
            { label: "승인 대기", value: `${kpis.pendingApprovalCount}건` },
            { label: "이상 신호", value: `${kpis.anomalyCount}건` },
          ]}
        />
        <KpiCard
          icon={<ClipboardList className="h-3.5 w-3.5" />}
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
        />
        <KpiCard
          icon={<TrendingDown className="h-3.5 w-3.5" />}
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
        />
        <KpiCard
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
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
        />
      </div>

      {/* §11.82 #dashboard-operational-intelligence-redesign Phase 3.
          호영님 시안의 SYSTEM INSIGHT 다크 accent card 흡수.
          real signal — 진행 중 발주 / 이상 신호 / 예산 burn rate 기반으로
          한 줄짜리 운영 시그니처 메시지 자동 derive. fake percentage 0,
          marketing decorative 0. */}
      <SystemInsightCard kpis={kpis} ordersCount={orders.length} />

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

function SystemInsightCard({
  kpis,
  ordersCount,
}: {
  kpis: DashboardKpis;
  ordersCount: number;
}) {
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

  // dark accent gradient 매핑 (호영님 시안 보라/그라데이션 톤 흡수)
  const gradientMap = {
    emerald: "from-emerald-700 to-emerald-900",
    amber: "from-amber-700 to-amber-900",
    rose: "from-rose-700 to-rose-900",
    indigo: "from-indigo-700 to-purple-800",
  };

  const dotMap = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    indigo: "bg-indigo-300",
  };

  return (
    <div
      className={`rounded-xl border border-slate-700/50 bg-gradient-to-br ${gradientMap[accent]} text-white shadow-md p-4 md:p-5`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full ${dotMap[accent]} opacity-50 animate-ping`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotMap[accent]}`} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1.5">
            System Insight
          </p>
          <p className="text-sm md:text-base font-bold text-white break-keep">{title}</p>
          <p className="text-[12px] md:text-[13px] text-white/80 mt-1 break-keep leading-relaxed">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

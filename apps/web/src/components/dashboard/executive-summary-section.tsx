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

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  risk: "none" | "warning" | "critical";
  href?: string;
}

function KpiCard({ icon, label, value, hint, risk, href }: KpiCardProps) {
  const accent =
    risk === "critical"
      ? "border-l-2 border-l-rose-500"
      : risk === "warning"
        ? "border-l-2 border-l-amber-500"
        : "border-l-2 border-l-slate-200";

  const valueColor =
    risk === "critical"
      ? "text-rose-600"
      : risk === "warning"
        ? "text-amber-600"
        : "text-slate-900";

  const body = (
    <div
      className={`group rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-slate-50 ${accent}`}
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
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="총 예산 소진율"
          value={`${kpis.burnRate.toFixed(1)}%`}
          hint={
            kpis.totalBudget > 0
              ? `${kpis.totalSpent.toLocaleString()} / ${kpis.totalBudget.toLocaleString()}원`
              : "등록된 예산이 없습니다"
          }
          risk={
            kpis.burnRateRisk === "over" || kpis.burnRateRisk === "critical"
              ? "critical"
              : kpis.burnRateRisk === "warning"
                ? "warning"
                : "none"
          }
          href="/dashboard/budget"
        />
        <KpiCard
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          label="승인 대기"
          value={`${kpis.pendingApprovalCount}건`}
          hint={
            kpis.pendingApprovalCount > 0
              ? `총 ${kpis.pendingApprovalAmount.toLocaleString()}원`
              : "대기 중인 발주가 없습니다"
          }
          risk={kpis.pendingApprovalCount >= 3 ? "warning" : "none"}
          href="/dashboard/purchase-orders"
        />
        <KpiCard
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          label="AI 감지 위험"
          value={`${kpis.anomalyCount}건`}
          hint={kpis.anomalyDetail}
          risk={
            kpis.anomalyCount >= 3
              ? "critical"
              : kpis.anomalyCount > 0
                ? "warning"
                : "none"
          }
          href="/dashboard/purchase-orders"
        />
      </div>

      {/* ── Chart + Ledger Row ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 차트: 2/3 */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                월별 예산 소진 추이
              </h3>
              <p className="text-[11px] text-slate-500">
                {projection.depletionMonth
                  ? `예상 고갈 시점: ${projection.depletionMonth}`
                  : kpis.totalBudget > 0
                    ? "현재 추이로는 예산 잔여가 충분합니다"
                    : "예산 데이터가 없어 추이를 표시할 수 없습니다"}
              </p>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              실적 + 외삽
            </span>
          </div>
          <div className="p-3">
            {projection.points.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center">
                <p className="text-xs text-slate-400">
                  표시할 데이터가 부족합니다
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={projection.points} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1_000).toFixed(0)}K`
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="line"
                    wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  />
                  <ReferenceLine
                    y={kpis.totalBudget}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    label={{
                      value: "총 예산",
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "#f43f5e",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="누적 소진"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name="예상 추이"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 우측 피드: 1/3 */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">최근 운영 활동</h3>
            <p className="text-[11px] text-slate-500">발주 · 승인 · 예산 이벤트 타임라인</p>
          </div>
          <div className="px-4 py-3">
            <ActionLedger
              orders={orders}
              budgets={budgets}
              fastTrackAcceptances={fastTrackAcceptances}
              limit={8}
              loading={isLoading && orders.length === 0 && budgets.length === 0}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

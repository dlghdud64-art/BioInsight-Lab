"use client";

/**
 * StrategicAnalytics — Phase 4 전략적 분석 대시보드
 *
 * 예산 소진율, 위험 재고, 월간 처리량 KPI + What-if 시뮬레이션 UI.
 * Recharts 기반 시각화.
 *
 * 규칙:
 * 1. Ontology store 데이터 직접 사용 (CRUD 호출 없음)
 * 2. 시뮬레이션은 read-only projection — 실제 데이터 변경 없음
 * 3. center=분석, rail=시뮬레이션, 운영형 workbench 톤 유지
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, Legend,
} from "recharts";
import {
  simulateBudgetImpact,
  type BudgetSimulationInput,
  type BudgetSimulationResult,
  type BudgetRiskCategory,
} from "@/lib/ontology/simulation/what-if-engine";

// ══════════════════════════════════════════════
// KPI Data Types
// ══════════════════════════════════════════════

export interface StrategicKPIs {
  /** 예산 요약 */
  budgets: BudgetKPI[];
  /** 재고 위험 요약 */
  inventoryRisks: InventoryRiskKPI[];
  /** 월간 처리량 */
  monthlyVolume: MonthlyVolumeKPI[];
  /** 발주 상태 분포 */
  orderStatusDistribution: StatusDistributionKPI[];
}

export interface BudgetKPI {
  budgetId: string;
  budgetName: string;
  totalAmount: number;
  totalSpent: number;
  committed: number;
  available: number;
  burnRate: number;
  periodEnd: string;
  riskLevel: BudgetRiskCategory;
}

export interface InventoryRiskKPI {
  itemId: string;
  itemName: string;
  stockStatus: string;
  daysUntilDepletion: number | null;
  quantity: number;
  reorderPoint: number | null;
}

export interface MonthlyVolumeKPI {
  month: string;
  orderCount: number;
  totalAmount: number;
  avgProcessingDays: number;
}

export interface StatusDistributionKPI {
  status: string;
  label: string;
  count: number;
  color: string;
}

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface StrategicAnalyticsProps {
  kpis: StrategicKPIs;
  className?: string;
}

// ══════════════════════════════════════════════
// Risk Colors
// ══════════════════════════════════════════════

const RISK_COLORS: Record<BudgetRiskCategory, string> = {
  safe: "#10b981",
  caution: "#f59e0b",
  warning: "#f97316",
  critical: "#ef4444",
  over_budget: "#dc2626",
};

const RISK_LABELS: Record<BudgetRiskCategory, string> = {
  safe: "안전",
  caution: "주의",
  warning: "경고",
  critical: "위험",
  over_budget: "초과",
};

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function StrategicAnalytics({ kpis, className }: StrategicAnalyticsProps) {
  // What-if simulation state
  const [simBudgetId, setSimBudgetId] = React.useState<string | null>(null);
  const [simAmount, setSimAmount] = React.useState<string>("");
  const [simResult, setSimResult] = React.useState<BudgetSimulationResult | null>(null);

  const selectedBudget = kpis.budgets.find(b => b.budgetId === simBudgetId);

  function runSimulation() {
    if (!selectedBudget || !simAmount) return;
    const amount = parseInt(simAmount.replace(/,/g, ""), 10);
    if (isNaN(amount) || amount <= 0) return;

    const input: BudgetSimulationInput = {
      currentBudget: {
        budgetId: selectedBudget.budgetId,
        budgetName: selectedBudget.budgetName,
        totalAmount: selectedBudget.totalAmount,
        totalSpent: selectedBudget.totalSpent,
        committed: selectedBudget.committed,
        available: selectedBudget.available,
        burnRate: selectedBudget.burnRate,
        periodEnd: selectedBudget.periodEnd,
      },
      proposedOrderAmount: amount,
    };

    setSimResult(simulateBudgetImpact(input));
  }

  // Budget chart data — 시뮬레이션 결과 반영
  const budgetChartData = kpis.budgets.map(b => {
    const isSimTarget = simResult && b.budgetId === simBudgetId;
    return {
      name: b.budgetName.length > 8 ? b.budgetName.slice(0, 8) + "…" : b.budgetName,
      소진율: isSimTarget ? simResult!.after.burnRate : b.burnRate,
      기존소진율: isSimTarget ? b.burnRate : undefined,
      fill: RISK_COLORS[isSimTarget ? simResult!.after.riskLevel : b.riskLevel],
    };
  });

  return (
    <div className={cn("space-y-6", className)}>
      {/* ═══ KPI Summary Cards ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="총 예산"
          value={`${(kpis.budgets.reduce((s, b) => s + b.totalAmount, 0) / 10000).toLocaleString()}만원`}
          sub={`${kpis.budgets.length}개 예산`}
          color="blue"
        />
        <KPICard
          label="위험 재고"
          value={`${kpis.inventoryRisks.filter(r => r.stockStatus === "low_stock" || r.stockStatus === "out_of_stock").length}건`}
          sub={`전체 ${kpis.inventoryRisks.length}개 품목`}
          color={kpis.inventoryRisks.some(r => r.stockStatus === "out_of_stock") ? "red" : "amber"}
        />
        <KPICard
          label="이번달 발주"
          value={`${kpis.monthlyVolume[kpis.monthlyVolume.length - 1]?.orderCount ?? 0}건`}
          sub={`${((kpis.monthlyVolume[kpis.monthlyVolume.length - 1]?.totalAmount ?? 0) / 10000).toLocaleString()}만원`}
          color="emerald"
        />
        <KPICard
          label="평균 처리일"
          value={`${kpis.monthlyVolume[kpis.monthlyVolume.length - 1]?.avgProcessingDays ?? 0}일`}
          sub="발주 → 수령"
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* ═══ Budget Burn Rate Chart ═══ */}
        <div className="col-span-2 rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
            예산 소진율
            {simResult && <span className="text-blue-400 ml-2">(시뮬레이션 적용 중)</span>}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetChartData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              {simResult && (
                <Bar dataKey="기존소진율" fill="#334155" radius={[4, 4, 0, 0]} />
              )}
              <Bar dataKey="소진율" radius={[4, 4, 0, 0]}>
                {budgetChartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ═══ Order Status Distribution ═══ */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">발주 상태 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={kpis.orderStatusDistribution}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={40}
                paddingAngle={2}
              >
                {kpis.orderStatusDistribution.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {kpis.orderStatusDistribution.map(s => (
              <div key={s.status} className="flex items-center gap-2 text-[10px]">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-500">{s.label}</span>
                <span className="text-slate-400 ml-auto tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ What-if Simulation Panel ═══ */}
      <div className={cn(
        "rounded border p-4 transition-all duration-300",
        simResult
          ? "border-blue-500/30 bg-blue-950/20 ring-1 ring-blue-500/10"
          : "border-slate-800 bg-slate-900/50"
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            예산 영향 시뮬레이션
          </h3>
          {simResult && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              시뮬레이션 모드
            </span>
          )}
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-[10px] text-slate-500 block mb-1">대상 예산</label>
            <select
              value={simBudgetId || ""}
              onChange={e => { setSimBudgetId(e.target.value || null); setSimResult(null); }}
              className={cn(
                "w-full rounded border px-2 py-1.5 text-xs focus:outline-none transition-colors",
                simBudgetId
                  ? "border-blue-500/30 bg-slate-800 text-slate-200 focus:border-blue-400"
                  : "border-slate-700 bg-slate-800 text-slate-300 focus:border-blue-500"
              )}
            >
              <option value="">선택하세요</option>
              {kpis.budgets.map(b => (
                <option key={b.budgetId} value={b.budgetId}>
                  {b.budgetName} ({RISK_LABELS[b.riskLevel]} · {b.burnRate.toFixed(0)}%)
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <label className="text-[10px] text-slate-500 block mb-1">예상 발주 금액 (원)</label>
            <input
              type="text"
              value={simAmount}
              onChange={e => { setSimAmount(e.target.value); setSimResult(null); }}
              placeholder="예: 500000"
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none tabular-nums"
            />
          </div>
          <button
            onClick={runSimulation}
            disabled={!simBudgetId || !simAmount}
            className={cn(
              "rounded px-4 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-40",
              simResult
                ? "bg-slate-600 hover:bg-slate-500"
                : "bg-blue-600 hover:bg-blue-500"
            )}
          >
            {simResult ? "재실행" : "시뮬레이션 실행"}
          </button>
          {simResult && (
            <button
              onClick={() => { setSimResult(null); setSimBudgetId(null); setSimAmount(""); }}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors"
            >
              초기화
            </button>
          )}
        </div>

        {/* Simulation Result */}
        {simResult && (
          <div className="mt-4 grid grid-cols-3 gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <SimResultCard
              label="잔여 예산 변화"
              before={`${simResult.before.available.toLocaleString()}원`}
              after={`${simResult.after.available.toLocaleString()}원`}
              delta={`${simResult.delta.availableChange.toLocaleString()}원`}
              severity={simResult.after.available < 0 ? "critical" : simResult.delta.riskLevelChanged ? "warning" : "info"}
            />
            <SimResultCard
              label="소진율 변화"
              before={`${simResult.before.burnRate}%`}
              after={`${simResult.after.burnRate}%`}
              delta={`+${simResult.delta.burnRateChange}%p`}
              severity={simResult.after.burnRate > 90 ? "critical" : simResult.after.burnRate > 75 ? "warning" : "info"}
            />
            <SimResultCard
              label="위험 등급"
              before={RISK_LABELS[simResult.before.riskLevel]}
              after={RISK_LABELS[simResult.after.riskLevel]}
              delta={simResult.delta.riskLevelChanged ? "등급 변경" : "유지"}
              severity={simResult.delta.riskLevelChanged ? "warning" : "info"}
            />
            {simResult.warnings.length > 0 && (
              <div className="col-span-3 space-y-1">
                {simResult.warnings.map((w, i) => (
                  <div key={i} className={cn("text-[10px] flex items-center gap-1.5",
                    w.severity === "critical" ? "text-red-400" : w.severity === "warning" ? "text-amber-400" : "text-slate-500"
                  )}>
                    <span className="shrink-0">{w.severity === "critical" ? "✕" : w.severity === "warning" ? "△" : "ℹ"}</span>
                    {w.message}
                  </div>
                ))}
              </div>
            )}
            <div className="col-span-3 flex items-center gap-3 text-[10px] text-slate-600 pt-1 border-t border-slate-800/50">
              <span className="flex items-center gap-1">
                신뢰도:
                <span className={cn("font-medium",
                  simResult.confidence >= 0.8 ? "text-emerald-400" :
                  simResult.confidence >= 0.5 ? "text-amber-400" : "text-red-400"
                )}>
                  {Math.round(simResult.confidence * 100)}%
                </span>
              </span>
              {simResult.after.projectedExhaustionDate && (
                <span>예상 소진일: <span className="text-slate-400">{simResult.after.projectedExhaustionDate}</span></span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Monthly Throughput Trend ═══ */}
      {kpis.monthlyVolume.length > 1 && (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
            월간 발주 처리 추이
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={kpis.monthlyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#64748b" }}
                label={{ value: "건", position: "insideTopLeft", offset: -5, fill: "#64748b", fontSize: 10 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "#64748b" }}
                label={{ value: "일", position: "insideTopRight", offset: -5, fill: "#64748b", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value: number, name: string) => {
                  if (name === "발주 건수") return [`${value}건`, name];
                  if (name === "총 금액") return [`${(value / 10000).toLocaleString()}만원`, name];
                  if (name === "평균 처리일") return [`${value}일`, name];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#64748b" }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="orderCount"
                name="발주 건수"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgProcessingDays"
                name="평균 처리일"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: "#a78bfa" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ Inventory Risk Table ═══ */}
      {kpis.inventoryRisks.filter(r => r.stockStatus !== "in_stock").length > 0 && (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">위험 재고 품목</h3>
          <div className="space-y-1">
            {kpis.inventoryRisks
              .filter(r => r.stockStatus !== "in_stock")
              .sort((a, b) => (a.daysUntilDepletion ?? 999) - (b.daysUntilDepletion ?? 999))
              .map(item => (
                <div key={item.itemId} className="flex items-center gap-3 text-xs py-1 border-b border-slate-800/50 last:border-0">
                  <span className={cn("h-2 w-2 rounded-full shrink-0",
                    item.stockStatus === "out_of_stock" ? "bg-red-500" :
                    item.stockStatus === "low_stock" ? "bg-amber-500" :
                    item.stockStatus === "expired" ? "bg-red-400" : "bg-slate-600"
                  )} />
                  <span className="text-slate-400 flex-1">{item.itemName}</span>
                  <span className="text-slate-600 text-[10px]">{item.stockStatus.replace(/_/g, " ")}</span>
                  <span className="text-slate-500 tabular-nums text-[10px]">
                    {item.daysUntilDepletion !== null ? `${item.daysUntilDepletion}일` : "—"}
                  </span>
                  <span className="text-slate-600 tabular-nums text-[10px]">{item.quantity}개</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ═══ Ontology Roadmap — Technology Evolution ═══ */}
      <OntologyRoadmap />
    </div>
  );
}

// ══════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════

function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/20 bg-blue-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    red: "border-red-500/20 bg-red-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
  };
  const textMap: Record<string, string> = {
    blue: "text-blue-400",
    amber: "text-amber-400",
    red: "text-red-400",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
  };

  return (
    <div className={cn("rounded border p-3", colorMap[color] || colorMap.blue)}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums mt-0.5", textMap[color] || textMap.blue)}>{value}</p>
      <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function SimResultCard({
  label, before, after, delta, severity,
}: {
  label: string; before: string; after: string; delta: string;
  severity: "info" | "warning" | "critical";
}) {
  const borderColor = severity === "critical" ? "border-red-500/20" : severity === "warning" ? "border-amber-500/20" : "border-slate-700";
  const deltaColor = severity === "critical" ? "text-red-400" : severity === "warning" ? "text-amber-400" : "text-slate-500";

  return (
    <div className={cn("rounded border bg-slate-900/50 p-3", borderColor)}>
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-slate-600 line-through">{before}</span>
        <span className="text-xs font-medium text-slate-300">{after}</span>
      </div>
      <p className={cn("text-[10px] mt-0.5", deltaColor)}>{delta}</p>
    </div>
  );
}

// ══════════════════════════════════════════════
// Ontology Roadmap — Phase 4~7
// ══════════════════════════════════════════════

const ROADMAP_PHASES = [
  {
    phase: 4,
    title: "Strategic Analytics",
    status: "active" as const,
    description: "예산 소진 예측, 위험 재고 시각화, What-if 시뮬레이션",
    milestones: ["KPI 대시보드", "예산 영향 시뮬레이션", "재고 위험 분석"],
    color: "blue",
  },
  {
    phase: 5,
    title: "Real-time Automation",
    status: "active" as const,
    description: "Supabase Realtime 구독, Link Graph 인터랙션, AI 복합 명령 분해",
    milestones: ["실시간 데이터 동기화", "온톨로지 시각화 확장", "자연어 실행 계획"],
    color: "violet",
  },
  {
    phase: 6,
    title: "Governance & Prediction",
    status: "planned" as const,
    description: "불변 감사 추적(Action Ledger), AI 재고 고갈 예측, 프롬프트 고도화",
    milestones: ["Immutable Action Ledger", "Predictive Stock-out", "NL Command 정교화"],
    color: "amber",
  },
  {
    phase: 7,
    title: "Autonomous Multi-Agent",
    status: "planned" as const,
    description: "인간 개입 없는 자율 발주, 에이전트 간 협상, 외부 ERP/API 직접 연동",
    milestones: ["Zero-Touch Purchasing", "Multi-Agent Debate", "External API Binding"],
    color: "emerald",
  },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "활성", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  planned: { label: "계획", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  completed: { label: "완료", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const PHASE_LINE_COLOR: Record<string, string> = {
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
};

const PHASE_DOT_RING: Record<string, string> = {
  blue: "ring-blue-500/30",
  violet: "ring-violet-500/30",
  amber: "ring-amber-500/30",
  emerald: "ring-emerald-500/30",
};

const PHASE_TEXT: Record<string, string> = {
  blue: "text-blue-400",
  violet: "text-violet-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
};

function OntologyRoadmap() {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">
        기술 고도화 로드맵
      </h3>

      {/* Timeline */}
      <div className="relative">
        {ROADMAP_PHASES.map((p, idx) => {
          const badge = STATUS_BADGE[p.status];
          const isLast = idx === ROADMAP_PHASES.length - 1;

          return (
            <div key={p.phase} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center shrink-0 w-6">
                <div className={cn(
                  "h-3 w-3 rounded-full ring-4 shrink-0",
                  PHASE_LINE_COLOR[p.color],
                  PHASE_DOT_RING[p.color],
                  p.status === "active" && "animate-pulse"
                )} />
                {!isLast && (
                  <div className="w-px flex-1 bg-slate-800 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 -mt-0.5 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-xs font-semibold", PHASE_TEXT[p.color])}>
                    Phase {p.phase}
                  </span>
                  <span className="text-xs font-medium text-slate-300">{p.title}</span>
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-medium",
                    badge.className
                  )}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-1.5 leading-relaxed">{p.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.milestones.map(m => (
                    <span
                      key={m}
                      className="inline-flex items-center rounded border border-slate-700/60 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-500"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase 7 detail highlight */}
      <div className="mt-4 rounded border border-emerald-500/15 bg-emerald-950/20 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Phase 7 비전
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-300">Zero-Touch Purchasing</p>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              승인 정책 + 예산 한도 내 자동 발주. 인간 개입 최소화.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-300">Multi-Agent Debate</p>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              재고/예산/구매 에이전트 간 협상으로 최적 의사결정 도출.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-300">External API Binding</p>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              공급사 ERP, Amazon Business 등 외부 API 직접 연동.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildModuleHeaderStats,
  buildModulePriorityQueue,
  buildModuleLandingItems,
  buildModuleBuckets,
  buildModuleDownstream,
  MODULE_ORIENTATION,
  MODULE_HEADER_STAT_META,
  BUCKET_COLORS,
  type ModuleBucketKey,
  type ModuleLandingItem,
} from "@/lib/ops-console/module-landing-adapter";
import {
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Clock,
  Shield,
  Zap,
  Sparkles,
  Loader2,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { buildDetailHref } from "@/lib/ops-console/navigation-context";

// ── Bucket tab config (PO-specific labels) ────────────────────────
const PO_BUCKET_TABS: { key: ModuleBucketKey; label: string }[] = [
  { key: "ready", label: "발행 가능" },
  { key: "needs_review", label: "승인/검토" },
  { key: "waiting_external", label: "공급사 대기" },
  { key: "handoff", label: "입고 인계" },
];

// ── Priority badge color ──────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  p0: "bg-red-500",
  p1: "bg-amber-500",
  p2: "bg-blue-500",
  p3: "bg-slate-500",
};

// ── Stat key → filter mapping ─────────────────────────────────────
const STAT_FILTER_MAP: Record<string, string> = {
  openActionable: "all",
  blocked: "blocked",
  overdue: "overdue",
  waitingExternal: "waiting_external",
  readyToExecute: "ready",
};

// ── Component ─────────────────────────────────────────────────────
export default function PurchaseOrderLandingPage() {
  const router = useRouter();
  const { unifiedInboxItems } = useOpsStore();
  const [activeTab, setActiveTab] = useState<ModuleBucketKey>("ready");

  // Header stats
  const headerStats = useMemo(
    () => buildModuleHeaderStats(unifiedInboxItems, "po"),
    [unifiedInboxItems],
  );

  // Priority queue (top 6)
  const priorityQueue = useMemo(
    () => buildModulePriorityQueue(unifiedInboxItems, "po", 6),
    [unifiedInboxItems],
  );

  // All landing items → buckets
  const allItems = useMemo(
    () => buildModuleLandingItems(unifiedInboxItems, "po"),
    [unifiedInboxItems],
  );

  const buckets = useMemo(() => buildModuleBuckets(allItems), [allItems]);

  // Downstream handoff
  const downstream = useMemo(
    () => buildModuleDownstream("po", unifiedInboxItems),
    [unifiedInboxItems],
  );

  // Active bucket items
  const activeBucketItems = buckets[activeTab] ?? [];

  // Bucket counts for tab badges
  const bucketCounts = useMemo(() => {
    const counts: Record<ModuleBucketKey, number> = {
      ready: 0,
      blocked: 0,
      needs_review: 0,
      waiting_external: 0,
      handoff: 0,
    };
    for (const item of allItems) {
      counts[item.bucketKey]++;
    }
    return counts;
  }, [allItems]);

  const orientation = MODULE_ORIENTATION.po;
  const isEmpty = allItems.length === 0;
  const onlyWaiting =
    allItems.length > 0 &&
    allItems.every((i) => i.bucketKey === "waiting_external");

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 space-y-5">
      {/* ── 1. Header ──────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">발주 관리</h1>
            <p className="text-xs text-slate-500 mt-0.5">{orientation.role}</p>
          </div>
          <p className="text-xs text-slate-400 max-w-xs text-right">
            {headerStats.nextActionSummary}
          </p>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(
            Object.keys(MODULE_HEADER_STAT_META) as Array<
              keyof typeof MODULE_HEADER_STAT_META
            >
          ).map((key) => {
            const value = headerStats[key];
            const meta = MODULE_HEADER_STAT_META[key];
            const filterKey = STAT_FILTER_MAP[key] ?? key;
            return (
              <Link
                key={key}
                href={`/dashboard/inbox?module=po&filter=${filterKey}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/60 border border-slate-700/50 text-xs hover:border-slate-600 transition-colors"
              >
                <span className="text-slate-500">{meta.label}</span>
                <span className="font-mono font-medium text-slate-700 tabular-nums">
                  {value}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Fallback: Empty ────────────────────────────────────────── */}
      {isEmpty && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-sm text-slate-400">
            현재 진행 중인 발주가 없습니다 — 견적에서 발주를 생성하세요
          </p>
          <Link
            href="/dashboard/quotes"
            className="inline-flex items-center gap-1 mt-3 text-xs text-blue-400 hover:text-blue-300"
          >
            견적 관리로 이동 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* ── Fallback: Only waiting ─────────────────────────────────── */}
      {onlyWaiting && (
        <div className="bg-slate-900 border border-blue-900/40 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            공급사 확인 대기 중 — 응답이 도착하면 처리 항목이 표시됩니다
          </p>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* ── 2. Priority Queue ───────────────────────────────────── */}
          {priorityQueue.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                우선 처리
              </h2>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {priorityQueue.map((item) => (
                  <PriorityCard
                    key={item.entityId}
                    item={item}
                    onClick={() => router.push(buildDetailHref(item.targetRoute, { type: 'list', route: '/dashboard/purchase-orders', summary: item.title, returnLabel: '발주 목록으로' }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── 3. State-Split Tabs ────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              상태별 분류
            </h2>
            <div className="flex gap-1 border-b border-slate-800 mb-3">
              {PO_BUCKET_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-300"
                      : "border-transparent text-slate-500 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                  {bucketCounts[tab.key] > 0 && (
                    <span className="ml-1.5 tabular-nums text-slate-600">
                      {bucketCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── 4. Actionable Queue (bucket items) ───────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              {activeBucketItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-600">
                  이 분류에 해당하는 항목이 없습니다
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {activeBucketItems.map((item) => (
                    <ActionableRow
                      key={item.entityId}
                      item={item}
                      onClick={() =>
                        router.push(
                          `/dashboard/purchase-orders/${item.entityId}`,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Downstream ──────────────────────────────────────── */}
          {downstream.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                다운스트림 인계
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {downstream.map((ds) => (
                  <Link
                    key={ds.label}
                    href={ds.targetRoute}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {ds.label}
                      </span>
                      <span className="text-xs font-mono text-teal-400 tabular-nums">
                        {ds.count}건
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ds.description}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
                      이동 <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Priority Card ─────────────────────────────────────────────────
function PriorityCard({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: () => void;
}) {
  const borderClass = item.dueState.isOverdue
    ? "border-l-red-500"
    : item.blockerSummary
      ? "border-l-amber-500"
      : "border-l-slate-700";

  return (
    <button
      onClick={onClick}
      className={`text-left bg-slate-900 border border-slate-800 border-l-2 ${borderClass} rounded-lg p-3 hover:bg-slate-800/60 transition-colors w-full`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.p3}`}
        />
        <span className="text-xs font-mono text-slate-600 truncate">
          {item.title}
        </span>
      </div>
      <p className="text-xs text-slate-500 line-clamp-1">{item.summary}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {item.currentOwnerName && (
            <span className="text-xs text-slate-600">
              {item.currentOwnerName}
            </span>
          )}
          <DueStateBadge dueState={item.dueState} />
        </div>
        {item.blockerSummary && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            차단
          </span>
        )}
        {item.readySummary && !item.blockerSummary && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            실행 가능
          </span>
        )}
      </div>
      {/* AI 분석 패널 */}
      <AiAnalysisPanel item={item} />
    </button>
  );
}

// ── Actionable Row ────────────────────────────────────────────────
function ActionableRow({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: () => void;
}) {
  const borderClass = item.dueState.isOverdue
    ? "border-l-2 border-l-red-500"
    : item.blockerSummary
      ? "border-l-2 border-l-amber-500"
      : "";

  return (
    <div className={`w-full text-left px-4 py-2.5 hover:bg-slate-800/40 transition-colors ${borderClass}`}>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.p3}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 font-mono truncate">
              {item.title}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${BUCKET_COLORS[item.bucketKey]}`}
            >
              {item.nextAction}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {item.summary}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {item.currentOwnerName && (
            <span className="text-xs text-slate-600">
              {item.currentOwnerName}
            </span>
          )}
          <DueStateBadge dueState={item.dueState} />
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        </div>
      </button>
      <AiAnalysisPanel item={item} />
    </div>
  );
}

// ── Due State Badge ───────────────────────────────────────────────
function DueStateBadge({
  dueState,
}: {
  dueState: ModuleLandingItem["dueState"];
}) {
  if (dueState.tone === "normal") return null;

  const cls =
    dueState.tone === "overdue"
      ? "text-red-400"
      : "text-amber-400";

  return (
    <span className={`text-xs flex items-center gap-0.5 ${cls}`}>
      <Clock className="h-3 w-3" />
      {dueState.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════
// AI 분석 패널 — Budget Anomaly + Safety Check
// ══════════════════════════════════════════════════════════════════

interface BudgetAnomalyResult {
  isAnomaly: boolean;
  anomalyReason: string;
  anomalySeverity: "NORMAL" | "WARNING" | "CRITICAL";
  remainingAfterOrder: number;
  remainingPercent: number;
  predictedDepletionDate: string;
  burnRateStatus: "SAFE" | "WARNING" | "CRITICAL";
  burnRateDetail: string;
  recommendation: string;
}

interface SafetyCheckResult {
  isHazardous: boolean;
  hazardClass: string;
  ghs_pictograms: string[];
  requiredPPE: string[];
  storageRequirements: string;
  regulatoryWarnings: string[];
  handlingPrecautions: string;
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NONE:     { bg: "bg-slate-800/40",  text: "text-slate-400",   border: "border-slate-700" },
  LOW:      { bg: "bg-blue-900/30",   text: "text-blue-300",    border: "border-blue-800" },
  MEDIUM:   { bg: "bg-amber-900/30",  text: "text-amber-300",   border: "border-amber-800" },
  HIGH:     { bg: "bg-orange-900/30", text: "text-orange-300",  border: "border-orange-800" },
  CRITICAL: { bg: "bg-red-900/30",    text: "text-red-300",     border: "border-red-800" },
};

const BURN_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  SAFE:     { bg: "bg-emerald-900/30", text: "text-emerald-300", icon: "text-emerald-400" },
  WARNING:  { bg: "bg-amber-900/30",   text: "text-amber-300",   icon: "text-amber-400" },
  CRITICAL: { bg: "bg-red-900/30",     text: "text-red-300",     icon: "text-red-400" },
  NORMAL:   { bg: "bg-slate-800/40",   text: "text-slate-400",   icon: "text-slate-500" },
};

function AiAnalysisPanel({ item }: { item: ModuleLandingItem }) {
  const [isLoading, setIsLoading] = useState(false);
  const [budgetResult, setBudgetResult] = useState<BudgetAnomalyResult | null>(null);
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [budgetRes, safetyRes] = await Promise.allSettled([
        fetch("/api/ai/budget-anomaly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: item.title || "발주 품목",
            orderAmount: 350000,
            budgetTotal: 50000000,
            budgetCurrent: 28000000,
            budgetName: "연구비",
            budgetPeriod: "2026년 상반기",
          }),
        }).then((r) => r.json()),
        fetch("/api/ai/safety-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: item.title || "품목",
            category: "REAGENT",
          }),
        }).then((r) => r.json()),
      ]);

      if (budgetRes.status === "fulfilled" && budgetRes.value.success) {
        setBudgetResult(budgetRes.value.data);
      }
      if (safetyRes.status === "fulfilled" && safetyRes.value.success) {
        setSafetyResult(safetyRes.value.data);
      }
      if (
        (budgetRes.status === "rejected" || !budgetRes.value?.success) &&
        (safetyRes.status === "rejected" || !safetyRes.value?.success)
      ) {
        setError("AI 분석에 실패했습니다.");
      }
    } catch {
      setError("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [item.title]);

  const hasResults = budgetResult || safetyResult;

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      {!hasResults && !isLoading && (
        <button
          onClick={runAnalysis}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/20 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          AI 분석
        </button>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-800/60 border border-slate-700/50 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          예산 이상 탐지 + 안전 규제 검토 중...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-900/20 border border-red-800/40 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
          {budgetResult && (
            <div className="rounded border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <DollarSign className="h-3 w-3 text-blue-400" />
                Budget & Anomaly
              </div>

              <div className={`rounded px-2 py-1.5 ${BURN_COLORS[budgetResult.anomalySeverity]?.bg ?? "bg-slate-800/40"}`}>
                <div className="flex items-center gap-1.5">
                  {budgetResult.isAnomaly ? (
                    <AlertTriangle className={`h-3 w-3 ${BURN_COLORS[budgetResult.anomalySeverity]?.icon ?? "text-slate-500"}`} />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  )}
                  <span className={`text-xs ${BURN_COLORS[budgetResult.anomalySeverity]?.text ?? "text-slate-400"}`}>
                    {budgetResult.anomalyReason}
                  </span>
                </div>
              </div>

              <div className={`rounded px-2 py-1.5 ${BURN_COLORS[budgetResult.burnRateStatus]?.bg ?? "bg-slate-800/40"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${BURN_COLORS[budgetResult.burnRateStatus]?.text ?? "text-slate-400"}`}>
                    잔여 {budgetResult.remainingPercent}%
                  </span>
                  <span className="text-[10px] text-slate-500">{budgetResult.predictedDepletionDate}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{budgetResult.burnRateDetail}</p>
              </div>

              <p className="text-[10px] text-slate-500">{budgetResult.recommendation}</p>
            </div>
          )}

          {safetyResult && (
            <div className="rounded border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <FlaskConical className="h-3 w-3 text-amber-400" />
                Safety & Compliance
              </div>

              <div className={`rounded px-2 py-1.5 border ${RISK_COLORS[safetyResult.riskLevel]?.bg ?? "bg-slate-800/40"} ${RISK_COLORS[safetyResult.riskLevel]?.border ?? "border-slate-700"}`}>
                <div className="flex items-center gap-1.5">
                  {safetyResult.isHazardous ? (
                    <ShieldAlert className={`h-3 w-3 ${RISK_COLORS[safetyResult.riskLevel]?.text ?? "text-slate-400"}`} />
                  ) : (
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  )}
                  <span className={`text-xs ${RISK_COLORS[safetyResult.riskLevel]?.text ?? "text-slate-400"}`}>
                    {safetyResult.hazardClass}
                  </span>
                </div>
              </div>

              {safetyResult.requiredPPE.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {safetyResult.requiredPPE.map((ppe, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-800/50">
                      {ppe}
                    </span>
                  ))}
                </div>
              )}

              {safetyResult.regulatoryWarnings.length > 0 && (
                <div className="space-y-0.5">
                  {safetyResult.regulatoryWarnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1 text-[10px] text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {safetyResult.storageRequirements && safetyResult.riskLevel !== "NONE" && (
                <p className="text-[10px] text-slate-500">
                  <span className="text-slate-400">보관: </span>{safetyResult.storageRequirements}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

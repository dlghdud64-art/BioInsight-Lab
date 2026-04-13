"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
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
import { buildStockRiskCommandSurface } from "@/lib/ops-console/command-adapters";
import { OperationalCommandBar } from "../_components/operational-command-bar";
import { buildStockRiskOwnership } from "@/lib/ops-console/ownership-adapter";
import { OwnershipStrip } from "../_components/ownership-display";
import { buildStockRiskBlockers } from "@/lib/ops-console/blocker-adapter";
import { AggregatedBlockerStrip } from "../_components/blocker-display";
import {
  buildStockRiskReentryContext,
  buildExpiryReentryContext,
} from "@/lib/ops-console/reentry-context";
import { buildDetailHref } from "@/lib/ops-console/navigation-context";
import { ReentryActionButton } from "../_components/reentry-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  AlertCircle,
  AlertTriangle,
  Clock,
  TrendingDown,
  Ban,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Zap,
} from "lucide-react";

// ── Bucket tab config (Stock Risk-specific labels) ──────────────
const SR_BUCKET_TABS: { key: ModuleBucketKey; label: string }[] = [
  { key: "ready", label: "재주문 가능" },
  { key: "blocked", label: "차단" },
  { key: "needs_review", label: "만료 조치" },
  { key: "handoff", label: "재진입 필요" },
];

// ── Priority badge color ────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  p0: "bg-red-500",
  p1: "bg-amber-500",
  p2: "bg-blue-500",
  p3: "bg-slate-500",
};

// ── Stat key -> filter mapping ──────────────────────────────────
const STAT_FILTER_MAP: Record<string, string> = {
  openActionable: "all",
  blocked: "blocked",
  overdue: "overdue",
  waitingExternal: "waiting_external",
  readyToExecute: "ready",
};

// ── Domain-specific configs (kept for detail tables below) ──────
type RiskStatus = "healthy" | "watch" | "reorder_due" | "critical_shortage" | "expiry_risk" | "quarantine_constrained" | "blocked";

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  healthy: { label: "안전", className: "bg-green-900/40 text-green-300 border-green-700" },
  watch: { label: "관찰", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  reorder_due: { label: "재주문 필요", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  critical_shortage: { label: "긴급", className: "bg-red-900/40 text-red-300 border-red-700" },
  expiry_risk: { label: "만료 위험", className: "bg-orange-900/40 text-orange-300 border-orange-700" },
  quarantine_constrained: { label: "격리", className: "bg-purple-900/40 text-purple-300 border-purple-700" },
  blocked: { label: "차단", className: "bg-red-900/40 text-red-300 border-red-700" },
};

const URGENCY_BADGE: Record<string, { label: string; className: string }> = {
  low: { label: "낮음", className: "bg-slate-700/60 text-slate-600 border-slate-600" },
  medium: { label: "보통", className: "bg-blue-900/40 text-blue-300 border-blue-700" },
  high: { label: "높음", className: "bg-amber-900/40 text-amber-300 border-amber-700" },
  critical: { label: "긴급", className: "bg-red-900/40 text-red-300 border-red-700" },
  urgent: { label: "긴급", className: "bg-red-900/40 text-red-300 border-red-700" },
};

const EXPIRY_ACTION_LABEL: Record<string, string> = {
  consume_first: "우선 사용",
  discount_transfer: "할인 이전",
  dispose: "폐기",
  extend_review: "연장 검토",
};

// ── Component ───────────────────────────────────────────────────
export default function StockRiskPage() {
  const router = useRouter();
  const store = useOpsStore();
  const { unifiedInboxItems } = store;
  const [activeTab, setActiveTab] = useState<ModuleBucketKey>("ready");
  const [detailTab, setDetailTab] = useState<"health" | "reorder" | "expiry">("health");
  const [search, setSearch] = useState("");

  // ── Module Hub: Header Stats ──────────────────────────────────
  const headerStats = useMemo(
    () => buildModuleHeaderStats(unifiedInboxItems, "stock_risk"),
    [unifiedInboxItems],
  );

  // ── Module Hub: Priority Queue (top 6) ────────────────────────
  const priorityQueue = useMemo(
    () => buildModulePriorityQueue(unifiedInboxItems, "stock_risk", 6),
    [unifiedInboxItems],
  );

  // ── Module Hub: All landing items + buckets ───────────────────
  const allItems = useMemo(
    () => buildModuleLandingItems(unifiedInboxItems, "stock_risk"),
    [unifiedInboxItems],
  );

  const buckets = useMemo(() => buildModuleBuckets(allItems), [allItems]);

  // ── Module Hub: Downstream ────────────────────────────────────
  const downstream = useMemo(
    () => buildModuleDownstream("stock_risk", unifiedInboxItems),
    [unifiedInboxItems],
  );

  const activeBucketItems = buckets[activeTab] ?? [];

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

  const orientation = MODULE_ORIENTATION.stock_risk;

  // ── Domain Data (existing ops-store) ──────────────────────────
  const stockPositions = store.stockPositions;
  const reorderRecommendations = store.reorderRecommendations;
  const expiryActions = store.expiryActions;

  // Filtered domain data
  const filteredHealth = useMemo(() => {
    if (!search.trim()) return stockPositions;
    const q = search.toLowerCase();
    return stockPositions.filter((s) =>
      s.inventoryItemId.toLowerCase().includes(q) ||
      (s.locationId ?? "").toLowerCase().includes(q),
    );
  }, [stockPositions, search]);

  const filteredReorder = useMemo(() => {
    if (!search.trim()) return reorderRecommendations;
    const q = search.toLowerCase();
    return reorderRecommendations.filter((r) =>
      r.inventoryItemId.toLowerCase().includes(q),
    );
  }, [reorderRecommendations, search]);

  const filteredExpiry = useMemo(() => {
    if (!search.trim()) return expiryActions;
    const q = search.toLowerCase();
    return expiryActions.filter((e) =>
      e.inventoryItemId.toLowerCase().includes(q) ||
      e.lotNumber.toLowerCase().includes(q),
    );
  }, [expiryActions, search]);

  // Domain handlers
  const handleCreateQuote = (reorderId: string) => {
    store.createQuoteFromReorder(reorderId);
  };

  const handleCompleteExpiry = (expiryId: string) => {
    store.completeExpiryAction(expiryId);
  };

  const handleResolveBlocker = (reorderId: string) => {
    store.resolveReorderBlocker(reorderId);
  };

  // Command surface
  const commandSurface = useMemo(
    () =>
      buildStockRiskCommandSurface({
        stockPositions,
        reorderRecommendations,
        expiryActions,
        onCreateQuoteFromReorder: handleCreateQuote,
        onCompleteExpiryAction: handleCompleteExpiry,
        onResolveReorderBlocker: handleResolveBlocker,
      }),
    [stockPositions, reorderRecommendations, expiryActions],
  );

  // Ownership
  const ownership = useMemo(
    () => buildStockRiskOwnership(stockPositions, reorderRecommendations),
    [stockPositions, reorderRecommendations],
  );

  // Blocker view
  const blockerView = useMemo(
    () => buildStockRiskBlockers(stockPositions, reorderRecommendations, expiryActions),
    [stockPositions, reorderRecommendations, expiryActions],
  );

  const isHubEmpty = allItems.length === 0;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 space-y-5">
      {/* ── 1. Module Header ─────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">재고 위험 관리</h1>
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
                href={`/dashboard/inbox?module=stock_risk&filter=${filterKey}`}
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

        {/* Orientation strip */}
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
          {orientation.upstream && (
            <>
              <Link
                href={`/dashboard/${orientation.upstream === '입고' ? 'receiving' : 'purchase-orders'}`}
                className="hover:text-slate-400 transition-colors"
              >
                {orientation.upstream}
              </Link>
              <ArrowRight className="h-3 w-3" />
            </>
          )}
          <span className="text-slate-600 font-medium">{orientation.stages}</span>
        </div>
      </div>

      {/* ── Fallback: Empty hub ───────────────────────────────────── */}
      {isHubEmpty && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-sm text-slate-400">
            현재 운영 큐에 활성 재고 위험 항목이 없습니다 — 아래 상세 테이블에서 전체 현황을 확인하세요
          </p>
        </div>
      )}

      {!isHubEmpty && (
        <>
          {/* ── 2. Priority Queue ─────────────────────────────────── */}
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
                    onClick={() => router.push(buildDetailHref(item.targetRoute, { type: 'list', route: '/dashboard/stock-risk', summary: item.title, returnLabel: '재고 위험으로' }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── 3. State-Split Tabs ──────────────────────────────── */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              상태별 분류
            </h2>
            <div className="flex gap-1 border-b border-slate-800 mb-3">
              {SR_BUCKET_TABS.map((tab) => (
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

            {/* Actionable Queue (bucket items) */}
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
                      onClick={() => router.push(buildDetailHref(item.targetRoute, { type: 'list', route: '/dashboard/stock-risk', summary: item.title, returnLabel: '재고 위험으로' }))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 4. Downstream ────────────────────────────────────── */}
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

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── Domain Detail Tables (existing 3-tab structure) ──────── */}
      {/* ════════════════════════════════════════════════════════════ */}

      <div className="border-t border-slate-800 pt-5 space-y-4">
        <div className="flex items-start justify-between">
          <h2 className="text-sm font-semibold text-slate-600">상세 재고 현황</h2>
        </div>

        {/* Ownership strip */}
        <div className="rounded border border-slate-800 bg-slate-900/50 px-4 py-2">
          <OwnershipStrip ownership={ownership} />
        </div>

        {/* Blocker strip */}
        {blockerView.totalCount > 0 && (
          <AggregatedBlockerStrip blockerView={blockerView} />
        )}

        {/* Detail Tabs */}
        <div className="flex gap-1 border-b border-slate-800">
          {(
            [
              { key: "health", label: "재고 현황" },
              { key: "reorder", label: "재주문 추천" },
              { key: "expiry", label: "만료 조치" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                detailTab === tab.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="품목명, 위치, Lot 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700 text-sm"
          />
        </div>

        {/* Main layout: content + command bar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <div className="min-w-0 space-y-4">
            {/* ── Stock Health Tab ── */}
            {detailTab === "health" && (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/50">
                        <th className="text-left px-4 py-3 font-medium text-slate-400">품목</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">위치</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-400">가용</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-400">보유</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-400">커버리지</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">위험</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHealth.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-500">
                            조건에 맞는 품목이 없습니다
                          </td>
                        </tr>
                      )}
                      {filteredHealth.map((sp) => {
                        const rBadge = RISK_BADGE[sp.riskStatus] ?? RISK_BADGE.healthy;
                        const threshold = sp.onHandQuantity > 0 ? Math.ceil(sp.onHandQuantity * 0.3) : 5;
                        const ratio = threshold > 0 ? sp.availableQuantity / threshold : 0;
                        const coverageDays = sp.coverageDays ?? 0;
                        return (
                          <tr
                            key={sp.id}
                            className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-700">{sp.inventoryItemId}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{sp.locationId ?? "-"}</td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-mono ${
                                  ratio < 0.5 ? "text-red-400" : ratio < 1 ? "text-amber-400" : "text-slate-700"
                                }`}
                              >
                                {sp.availableQuantity}
                              </span>
                              <span className="text-slate-500 ml-1">{sp.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 font-mono">
                              {sp.onHandQuantity} {sp.unit}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-mono ${
                                  coverageDays <= 7
                                    ? "text-red-400"
                                    : coverageDays <= 21
                                      ? "text-amber-400"
                                      : "text-slate-600"
                                }`}
                              >
                                {coverageDays}일
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`text-xs ${rBadge.className}`}>
                                {rBadge.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Reorder Tab ── */}
            {detailTab === "reorder" && (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/50">
                        <th className="text-left px-4 py-3 font-medium text-slate-400">품목</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">유형</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">긴급도</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">추천 수량</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">공급사</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-400">예산 영향</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-400">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReorder.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500">
                            재주문 추천이 없습니다
                          </td>
                        </tr>
                      )}
                      {filteredReorder.map((rr) => {
                        const uBadge = URGENCY_BADGE[rr.urgency] ?? URGENCY_BADGE.medium;
                        const isBlocked = rr.status === "blocked";
                        const isConverted = rr.status === "converted_to_quote" || rr.status === "converted_to_po";
                        return (
                          <tr
                            key={rr.id}
                            className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-700">{rr.inventoryItemId}</td>
                            <td className="px-4 py-3 text-slate-400">{rr.recommendationType.replace(/_/g, " ")}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={`text-xs ${uBadge.className}`}>
                                {uBadge.label}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {rr.recommendedOrderQuantity} {rr.recommendedUnit}
                            </td>
                            <td className="px-4 py-3 text-slate-400">{rr.preferredVendorId ?? "-"}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                              {rr.budgetImpactEstimate
                                ? `₩${rr.budgetImpactEstimate.amount.toLocaleString("ko-KR")}`
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="space-y-1">
                                <Button
                                  size="sm"
                                  variant={isBlocked ? "ghost" : "outline"}
                                  onClick={() => isBlocked ? handleResolveBlocker(rr.id) : handleCreateQuote(rr.id)}
                                  disabled={isConverted}
                                  className="text-xs h-7 px-2 gap-1 border-slate-700"
                                >
                                  {isConverted ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3" />
                                      전환 완료
                                    </>
                                  ) : isBlocked ? (
                                    <>차단 해소</>
                                  ) : (
                                    <>
                                      <ArrowRight className="h-3 w-3" />
                                      견적 요청
                                    </>
                                  )}
                                </Button>
                                {!isConverted && !isBlocked && (
                                  <Link href={`/app/search?q=${encodeURIComponent((rr as any).productName || rr.inventoryItemId)}&source=reorder&qty=${rr.recommendedOrderQuantity}`}>
                                    <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2 text-blue-400 hover:text-blue-300 gap-1">
                                      <Search className="h-3 w-3" />소싱
                                    </Button>
                                  </Link>
                                )}
                                {isBlocked && rr.blockedReasons.length > 0 && (
                                  <div className="text-left">
                                    {rr.blockedReasons.map((reason, i) => (
                                      <p key={i} className="text-xs text-red-400">
                                        {reason}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {!isConverted && !isBlocked && (
                                  <div className="mt-1">
                                    <ReentryActionButton
                                      context={buildStockRiskReentryContext(rr, stockPositions.find((s) => s.inventoryItemId === rr.inventoryItemId))}
                                      compact
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Expiry Tab ── */}
            {detailTab === "expiry" && (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/50">
                        <th className="text-left px-4 py-3 font-medium text-slate-400">품목</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">Lot</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">조치 유형</th>
                        <th className="text-right px-4 py-3 font-medium text-slate-400">만료까지</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">영향 수량</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-400">상태</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-400">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpiry.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500">
                            만료 조치 항목이 없습니다
                          </td>
                        </tr>
                      )}
                      {filteredExpiry.map((ea) => {
                        const expiryTone =
                          (ea.daysToExpiry ?? 0) <= 7
                            ? "text-red-400"
                            : (ea.daysToExpiry ?? 0) <= 30
                              ? "text-orange-400"
                              : "text-amber-400";
                        const isCompleted = ea.status === "completed";
                        return (
                          <tr
                            key={ea.id}
                            className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-700">{ea.inventoryItemId}</td>
                            <td className="px-4 py-3 font-mono text-slate-400">{ea.lotNumber}</td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  ea.actionType === "dispose"
                                    ? "bg-red-900/30 text-red-300 border-red-700"
                                    : ea.actionType === "consume_first"
                                      ? "bg-amber-900/30 text-amber-300 border-amber-700"
                                      : "bg-blue-900/30 text-blue-300 border-blue-700"
                                }`}
                              >
                                {EXPIRY_ACTION_LABEL[ea.actionType] ?? ea.actionType}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-mono font-medium ${expiryTone}`}>
                                {ea.daysToExpiry}일
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {ea.affectedQuantity} {ea.unit}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  ea.status === "completed"
                                    ? "bg-green-900/40 text-green-300 border-green-700"
                                    : ea.status === "in_progress"
                                      ? "bg-amber-900/40 text-amber-300 border-amber-700"
                                      : "bg-slate-700/60 text-slate-600 border-slate-600"
                                }`}
                              >
                                {ea.status === "completed"
                                  ? "완료"
                                  : ea.status === "in_progress"
                                    ? "진행 중"
                                    : "대기"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCompleteExpiry(ea.id)}
                                disabled={isCompleted}
                                className="text-xs h-7 px-2"
                              >
                                {isCompleted ? "완료됨" : "조치 완료"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Command Bar Sidebar */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <OperationalCommandBar surface={commandSurface} ownership={ownership} blockerView={blockerView} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Priority Card ───────────────────────────────────────────────
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
    </button>
  );
}

// ── Actionable Row ──────────────────────────────────────────────
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
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 hover:bg-slate-800/40 transition-colors flex items-center gap-3 ${borderClass}`}
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
  );
}

// ── Due State Badge ─────────────────────────────────────────────
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

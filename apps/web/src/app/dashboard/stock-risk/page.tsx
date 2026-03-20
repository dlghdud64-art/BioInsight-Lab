"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  AlertTriangle,
  ShieldAlert,
  Clock,
  TrendingDown,
  Ban,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { buildStockRiskCommandSurface } from "@/lib/ops-console/command-adapters";
import { OperationalCommandBar } from "../_components/operational-command-bar";

// ── Status config ──────────────────────────────────────────────────
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
  low: { label: "낮음", className: "bg-slate-700/60 text-slate-300 border-slate-600" },
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

// ── Snapshot pills ─────────────────────────────────────────────────
const SNAPSHOT_DEFS: {
  key: string;
  label: string;
  icon: typeof AlertTriangle;
  className: string;
}[] = [
  {
    key: "shortage",
    label: "부족 품목",
    icon: TrendingDown,
    className: "border-amber-800/50 bg-amber-900/20",
  },
  {
    key: "critical",
    label: "긴급 부족",
    icon: AlertTriangle,
    className: "border-red-800/50 bg-red-900/20",
  },
  {
    key: "expiry",
    label: "만료 임박",
    icon: Clock,
    className: "border-orange-800/50 bg-orange-900/20",
  },
  {
    key: "quarantine",
    label: "격리 제약",
    icon: Ban,
    className: "border-purple-800/50 bg-purple-900/20",
  },
];

// ── Component ──────────────────────────────────────────────────────
export default function StockRiskPage() {
  const router = useRouter();
  const store = useOpsStore();
  const [activeTab, setActiveTab] = useState<"health" | "reorder" | "expiry">("health");
  const [search, setSearch] = useState("");

  // Data from ops-store
  const stockPositions = store.stockPositions;
  const reorderRecommendations = store.reorderRecommendations;
  const expiryActions = store.expiryActions;

  // Snapshot counts
  const snapshotValues = useMemo(() => ({
    shortage: stockPositions.filter((s) => s.riskStatus === "reorder_due" || s.riskStatus === "critical_shortage").length,
    critical: stockPositions.filter((s) => s.riskStatus === "critical_shortage").length,
    expiry: stockPositions.filter((s) => s.riskStatus === "expiry_risk").length,
    quarantine: stockPositions.filter((s) => s.riskStatus === "quarantine_constrained").length,
  }), [stockPositions]);

  // Filtered data
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

  // Handlers
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

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">재고 위험 관리</h1>
        <p className="text-sm text-slate-400 mt-1">
          부족, 만료, 격리 위험을 감지하고 재주문 및 조치를 관리합니다
        </p>
      </div>

      {/* Risk Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SNAPSHOT_DEFS.map((snap) => {
          const Icon = snap.icon;
          const value = snapshotValues[snap.key as keyof typeof snapshotValues] ?? 0;
          return (
            <div
              key={snap.key}
              className={`flex items-center gap-3 px-4 py-3 border rounded-xl ${snap.className}`}
            >
              <Icon className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">{snap.label}</div>
                <div className="text-lg font-bold text-slate-100 tabular-nums">{value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
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
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
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
          {activeTab === "health" && (
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
                      const threshold = sp.onHandQuantity > 0 ? Math.ceil(sp.onHandQuantity * 0.3) : 5; // derived threshold
                      const ratio = threshold > 0 ? sp.availableQuantity / threshold : 0;
                      const coverageDays = sp.coverageDays ?? 0;
                      return (
                        <tr
                          key={sp.id}
                          className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-200">{sp.inventoryItemId}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{sp.locationId ?? "-"}</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-mono ${
                                ratio < 0.5 ? "text-red-400" : ratio < 1 ? "text-amber-400" : "text-slate-200"
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
                                    : "text-slate-300"
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
          {activeTab === "reorder" && (
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
                          <td className="px-4 py-3 text-slate-200">{rr.inventoryItemId}</td>
                          <td className="px-4 py-3 text-slate-400">{rr.recommendationType.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs ${uBadge.className}`}>
                              {uBadge.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {rr.recommendedOrderQuantity} {rr.recommendedUnit}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{rr.preferredVendorId ?? "-"}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
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
                              {isBlocked && rr.blockedReasons.length > 0 && (
                                <div className="text-left">
                                  {rr.blockedReasons.map((reason, i) => (
                                    <p key={i} className="text-xs text-red-400">
                                      {reason}
                                    </p>
                                  ))}
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
          {activeTab === "expiry" && (
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
                        ea.daysToExpiry <= 7
                          ? "text-red-400"
                          : ea.daysToExpiry <= 30
                            ? "text-orange-400"
                            : "text-amber-400";
                      const isCompleted = ea.status === "completed";
                      return (
                        <tr
                          key={ea.id}
                          className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-200">{ea.inventoryItemId}</td>
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
                          <td className="px-4 py-3 text-slate-300">
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
                                    : "bg-slate-700/60 text-slate-300 border-slate-600"
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
          <OperationalCommandBar surface={commandSurface} />
        </div>
      </div>
    </div>
  );
}

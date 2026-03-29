"use client";

/**
 * Reorder Decision Governance Workbench — 재주문 판단 governance UI
 *
 * released 기준 gap → supply context → line-level reorder decision → procurement re-entry handoff
 *
 * center = gap summary + supply indicators + line-level reorder delta table + loss accounting
 * rail = coverage/lead time/safety stock context + chain linkage + loss lineage
 * dock = evaluate / watch / recommend / require / expedite / re-entry / cancel
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  ReorderDecisionGovernanceState,
  ReorderDecisionGovSurface,
} from "@/lib/ai/reorder-decision-governance-engine";

// ══════════════════════════════════════════════
// ReorderDecisionGovernanceWorkbench
// ══════════════════════════════════════════════

export interface ReorderDecisionGovernanceWorkbenchProps {
  state: ReorderDecisionGovernanceState;
  surface: ReorderDecisionGovSurface;
  onStartEvaluation?: () => void;
  onEvaluateLine?: (lineId: string) => void;
  onSetWatch?: () => void;
  onRecommendReorder?: () => void;
  onRequireReorder?: () => void;
  onExpedite?: () => void;
  onMarkNoAction?: () => void;
  onProcurementReentry?: () => void;
  onCancel?: () => void;
  onReopenStockRelease?: () => void;
  className?: string;
}

const STATUS_BG: Record<string, string> = {
  slate: "border-slate-600/20 bg-slate-800/50",
  blue: "border-blue-500/20 bg-blue-500/5",
  amber: "border-amber-500/20 bg-amber-500/5",
  emerald: "border-emerald-500/20 bg-emerald-500/5",
  red: "border-red-500/20 bg-red-500/5",
  orange: "border-orange-500/20 bg-orange-500/5",
};

const STATUS_DOT: Record<string, string> = {
  slate: "bg-slate-500",
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  red: "bg-red-400 animate-pulse",
  orange: "bg-orange-400 animate-pulse",
};

const DECISION_COLOR: Record<string, string> = {
  reorder: "text-red-400",
  watch: "text-amber-400",
  no_action: "text-emerald-400",
  return_claim: "text-blue-400",
  substitute: "text-purple-400",
  pending: "text-slate-500",
};

const DECISION_LABEL: Record<string, string> = {
  reorder: "재주문",
  watch: "감시",
  no_action: "불필요",
  return_claim: "반품클레임",
  substitute: "대체품",
  pending: "미판단",
};

const URGENCY_COLOR: Record<string, string> = {
  immediate: "text-red-400",
  normal: "text-amber-400",
  watch: "text-blue-400",
  none: "text-slate-500",
};

export function ReorderDecisionGovernanceWorkbench({
  state, surface,
  onStartEvaluation, onEvaluateLine, onSetWatch, onRecommendReorder,
  onRequireReorder, onExpedite, onMarkNoAction, onProcurementReentry,
  onCancel, onReopenStockRelease,
  className,
}: ReorderDecisionGovernanceWorkbenchProps) {
  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ── Center ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded border", STATUS_BG[surface.statusColor])}>
          <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[surface.statusColor])} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">{surface.primaryMessage}</p>
            <p className="text-xs text-slate-500 mt-0.5">{surface.nextAction}</p>
          </div>
        </div>

        {/* Gap + supply indicators */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-slate-100">{surface.originalOrdered}</p>
            <p className="text-[10px] text-slate-500">주문</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-center">
            <p className="text-lg font-bold tabular-nums text-emerald-400">{surface.released}</p>
            <p className="text-[10px] text-slate-500">릴리즈</p>
          </div>
          <div className={cn("rounded border p-3 text-center", surface.hasGap ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5")}>
            <p className={cn("text-lg font-bold tabular-nums", surface.hasGap ? "text-red-400" : "text-emerald-400")}>{surface.gap}</p>
            <p className="text-[10px] text-slate-500">Gap</p>
          </div>
          <div className={cn("rounded border p-3 text-center", surface.totalReorderQty > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-slate-800 bg-slate-900/50")}>
            <p className={cn("text-lg font-bold tabular-nums", surface.totalReorderQty > 0 ? "text-amber-400" : "text-slate-400")}>{surface.totalReorderQty}</p>
            <p className="text-[10px] text-slate-500">재주문</p>
          </div>
        </div>

        {/* Supply context warnings */}
        {(surface.leadTimeBreached || surface.safetyStockBreached) && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-1">
            <h4 className="text-[10px] font-medium text-red-400 uppercase tracking-wider">공급 위험</h4>
            {surface.leadTimeBreached && <p className="text-xs text-red-300">리드타임 초과 — 현재 커버리지가 공급사 리드타임 미달</p>}
            {surface.safetyStockBreached && <p className="text-xs text-red-300">안전재고 미달 — 가용 재고가 안전 수준 하회</p>}
          </div>
        )}

        {/* Line-level reorder delta */}
        {surface.lineDecisions.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">품목</th>
                  <th className="px-3 py-2 text-right font-medium">주문</th>
                  <th className="px-3 py-2 text-right font-medium">릴리즈</th>
                  <th className="px-3 py-2 text-right font-medium">Gap</th>
                  <th className="px-3 py-2 text-center font-medium">판단</th>
                  <th className="px-3 py-2 text-right font-medium">재주문</th>
                  <th className="px-3 py-2 text-center font-medium">긴급도</th>
                  <th className="px-3 py-2 text-left font-medium">경로</th>
                  {!surface.isTerminal && <th className="px-3 py-2 text-center font-medium w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {surface.lineDecisions.map(line => (
                  <tr key={line.lineId} className="border-b border-slate-800/50">
                    <td className="px-3 py-1.5 text-slate-200">{line.itemName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{line.ordered}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-400">{line.released}</td>
                    <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium", line.gap > 0 ? "text-red-400" : "text-slate-400")}>{line.gap}</td>
                    <td className={cn("px-3 py-1.5 text-center font-medium", DECISION_COLOR[line.decision])}>{DECISION_LABEL[line.decision]}</td>
                    <td className={cn("px-3 py-1.5 text-right tabular-nums", line.reorderQty > 0 ? "text-amber-400 font-medium" : "text-slate-600")}>{line.reorderQty}</td>
                    <td className={cn("px-3 py-1.5 text-center text-[10px]", URGENCY_COLOR[line.urgency])}>{line.urgency}</td>
                    <td className="px-3 py-1.5 text-slate-500 text-[10px]">{line.supplierPath.replace(/_/g, " ")}</td>
                    {!surface.isTerminal && (
                      <td className="px-3 py-1.5 text-center">
                        {line.decision === "pending" && (
                          <button onClick={() => onEvaluateLine?.(line.lineId)} className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300 transition-colors">판단</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Loss accounting */}
        {surface.totalLoss > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
            <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">손실 내역</h4>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">반품 <span className="text-red-400 tabular-nums font-medium">{state.lossAccounting.totalReturned}개</span></span>
              <span className="text-slate-400">폐기 <span className="text-red-400 tabular-nums font-medium">{state.lossAccounting.totalDestroyed}개</span></span>
              <span className="text-slate-400">보류 <span className="text-amber-400 tabular-nums font-medium">{state.lossAccounting.totalHeld}개</span></span>
              <span className="text-slate-500 ml-auto">손실률 <span className="text-amber-400 font-medium">{surface.lossPercentage}%</span></span>
            </div>
            {surface.hasSupplierClaim && <p className="text-[10px] text-blue-400">공급사 클레임 대상 존재</p>}
          </div>
        )}
      </div>

      {/* ── Rail ── */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Decision summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">판단 요약</h4>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">재주문</span><p className="text-red-400 tabular-nums font-medium">{surface.reorderCount}건</p></div>
            <div><span className="text-slate-500">감시</span><p className="text-amber-400 tabular-nums">{surface.watchCount}건</p></div>
            <div><span className="text-slate-500">불필요</span><p className="text-emerald-400 tabular-nums">{surface.noActionCount}건</p></div>
            <div><span className="text-slate-500">미판단</span><p className="text-slate-400 tabular-nums">{surface.pendingCount}건</p></div>
          </div>
        </div>

        {/* Coverage status */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">공급 상태</h4>
          {state.supplyContext ? (
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">가용</span><span className="text-slate-200 tabular-nums">{state.supplyContext.currentAvailableStock}개</span></div>
              <div className="flex justify-between"><span className="text-slate-500">예상 수요</span><span className="text-slate-200 tabular-nums">{state.supplyContext.projectedDemand}개</span></div>
              <div className="flex justify-between"><span className="text-slate-500">입고 대기</span><span className="text-slate-200 tabular-nums">{state.supplyContext.openInboundQuantity}개</span></div>
              <div className="flex justify-between"><span className="text-slate-500">안전재고</span><span className="text-slate-200 tabular-nums">{state.supplyContext.safetyStockLevel}개</span></div>
              <div className="flex justify-between"><span className="text-slate-500">리드타임</span><span className="text-slate-200">{state.supplyContext.supplierLeadTimeDays}일</span></div>
              <div className="flex justify-between"><span className="text-slate-500">커버리지</span><span className={cn("tabular-nums font-medium", state.coverageStatus === "critical" ? "text-red-400" : state.coverageStatus === "low" ? "text-amber-400" : "text-emerald-400")}>{state.supplyContext.daysOfCoverageRemaining}일</span></div>
            </div>
          ) : (
            <p className="text-slate-500">Supply context 미입력</p>
          )}
        </div>

        {/* Re-entry path */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">재진입 경로</h4>
          <p className={cn("font-medium", state.reentryPath !== "not_determined" ? "text-slate-200" : "text-slate-500")}>
            {state.reentryPath === "same_supplier" ? "동일 공급사" : state.reentryPath === "alternate_supplier" ? "대체 공급사" : state.reentryPath === "substitute" ? "대체품" : state.reentryPath === "mixed" ? "혼합 경로" : "미결정"}
          </p>
        </div>

        {/* Chain linkage */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">체인 연결</h4>
          <div className="flex justify-between"><span className="text-slate-500">PO</span><span className="text-slate-400 font-mono">{state.poNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">릴리즈</span><span className="text-slate-400 font-mono truncate ml-2">{state.stockReleaseGovernanceId}</span></div>
        </div>
      </div>

      {/* ── Dock ── */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{surface.nextAction}</span>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {surface.canCancel && (
              <button onClick={onCancel} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors">취소</button>
            )}
            {surface.canReopenStockRelease && (
              <button onClick={onReopenStockRelease} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition-colors">Stock Release 재열기</button>
            )}
            {surface.canSetWatch && (
              <button onClick={onSetWatch} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition-colors">모니터링</button>
            )}
            {surface.canMarkNoAction && (
              <button onClick={onMarkNoAction} className="rounded border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300 transition-colors">조치 불필요</button>
            )}
            {surface.canRecommendReorder && (
              <button onClick={onRecommendReorder} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition-colors">재주문 권고</button>
            )}
            {surface.canRequireReorder && (
              <button onClick={onRequireReorder} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs text-red-300 transition-colors">재주문 확정</button>
            )}
            {surface.canExpedite && (
              <button onClick={onExpedite} className="rounded border border-orange-500/20 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 text-xs text-orange-300 transition-colors">긴급 발주</button>
            )}
            {surface.canEvaluate && (
              <button onClick={onStartEvaluation} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">재주문 평가 시작</button>
            )}
            {surface.canProcurementReentry && (
              <button onClick={onProcurementReentry} className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">구매 재진입</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

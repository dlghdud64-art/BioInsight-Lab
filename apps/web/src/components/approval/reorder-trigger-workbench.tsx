"use client";

/**
 * ReorderTriggerWorkbench — 재주문 평가 center/rail/dock workbench
 *
 * Tier 1 — 평가 자체는 승인 불필요, 실제 재구매는 별도 승인.
 * center = inventory snapshot + reorder evaluation result
 * rail = safety stock / lead time / demand context
 * dock = reorder action (procurement re-entry 연결)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, PolicyMessageStack, NextActionHint } from "./index";
import { useWorkspacePolicySurface } from "@/hooks/use-approval-policy";
import type { ActorContext } from "@/lib/ai/dispatch-v2-permission-policy-engine";

export interface ReorderTriggerWorkbenchProps {
  caseId: string;
  actor: ActorContext;
  // Inventory data
  totalAvailableQty: number;
  safetyStockQty: number;
  reorderPointQty: number;
  averageDailyUsage: number;
  leadTimeDays: number;
  daysOfSupply: number;
  // Evaluation result
  evaluationResult: "no_reorder_needed" | "reorder_recommended" | "reorder_urgent" | "procurement_reentry_required" | "monitoring";
  evaluationReason: string;
  procurementReentryRecommended: boolean;
  // Handlers
  onInitiateReorder?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const RESULT_CONFIG: Record<string, { label: string; color: string; badge: "allowed" | "approval_needed" | "blocked" }> = {
  no_reorder_needed: { label: "재주문 불필요", color: "text-emerald-400", badge: "allowed" },
  monitoring: { label: "모니터링", color: "text-blue-400", badge: "allowed" },
  reorder_recommended: { label: "재주문 권장", color: "text-amber-400", badge: "approval_needed" },
  reorder_urgent: { label: "긴급 재주문", color: "text-red-400", badge: "blocked" },
  procurement_reentry_required: { label: "즉시 재구매 필요", color: "text-red-400", badge: "blocked" },
};

export function ReorderTriggerWorkbench({
  caseId,
  actor,
  totalAvailableQty,
  safetyStockQty,
  reorderPointQty,
  averageDailyUsage,
  leadTimeDays,
  daysOfSupply,
  evaluationResult,
  evaluationReason,
  procurementReentryRecommended,
  onInitiateReorder,
  onDismiss,
  className,
}: ReorderTriggerWorkbenchProps) {
  const { data: policySurface } = useWorkspacePolicySurface("reorder_trigger", actor, caseId);
  const guidance = policySurface?.inlineGuidance;
  const config = RESULT_CONFIG[evaluationResult] || RESULT_CONFIG.monitoring;

  const vsSafety = totalAvailableQty - safetyStockQty;
  const vsReorderPoint = totalAvailableQty - reorderPointQty;

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {guidance && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
            <PolicyStatusBadge status={guidance.statusBadge} />
            <PolicyMessageStack primaryMessage={guidance.primaryMessage} compact />
          </div>
        )}

        {/* Evaluation result */}
        <div className={cn(
          "rounded border p-4 space-y-2",
          evaluationResult === "procurement_reentry_required" || evaluationResult === "reorder_urgent"
            ? "border-red-500/20 bg-red-500/5"
            : evaluationResult === "reorder_recommended"
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-slate-800 bg-slate-900/50"
        )}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">재주문 평가 결과</h3>
            <span className={cn("text-sm font-semibold", config.color)}>{config.label}</span>
          </div>
          <p className="text-sm text-slate-600">{evaluationReason}</p>
        </div>

        {/* Inventory metrics */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">재고 현황</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs">가용 재고</span>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{totalAvailableQty}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">안전 재고</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{safetyStockQty}</p>
              <p className={cn("text-xs tabular-nums", vsSafety >= 0 ? "text-emerald-400" : "text-red-400")}>
                {vsSafety >= 0 ? `+${vsSafety}` : vsSafety}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">재주문점</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{reorderPointQty}</p>
              <p className={cn("text-xs tabular-nums", vsReorderPoint >= 0 ? "text-emerald-400" : "text-amber-400")}>
                {vsReorderPoint >= 0 ? `+${vsReorderPoint}` : vsReorderPoint}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">공급 지표</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">일평균 사용량</span>
              <span className="text-slate-700 tabular-nums">{averageDailyUsage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">리드타임</span>
              <span className="text-slate-700 tabular-nums">{leadTimeDays}일</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">공급 일수</span>
              <span className={cn("tabular-nums font-medium",
                daysOfSupply < leadTimeDays ? "text-red-400" : daysOfSupply < leadTimeDays * 1.5 ? "text-amber-400" : "text-emerald-400"
              )}>
                {daysOfSupply}일
              </span>
            </div>
          </div>
        </div>

        {procurementReentryRecommended && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-400 font-medium">재구매 진입 권장</p>
            <p className="text-xs text-amber-400/70 mt-0.5">Procurement re-entry 단계로 이동하여 재구매를 시작하세요.</p>
          </div>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <NextActionHint
            message={procurementReentryRecommended ? "재구매 진입 권장 — procurement re-entry로 이동" : evaluationResult === "monitoring" ? "모니터링 유지" : "재주문 불필요 — 현재 재고 충분"}
            variant={procurementReentryRecommended ? "urgent" : "default"}
          />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onDismiss && !procurementReentryRecommended && (
              <button onClick={onDismiss} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
                확인
              </button>
            )}
            {onInitiateReorder && procurementReentryRecommended && (
              <button onClick={onInitiateReorder} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">
                재구매 진입
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Eye, ShieldAlert, TrendingDown, Clock } from "lucide-react";
import { type ReorderDecisionState, type ReorderDecisionObject, type ItemReorderDecision, type ReorderCandidateType, createInitialReorderDecisionState, buildReorderRiskAssessment, buildReorderDecisionPlan, validateReorderDecisionBeforeRecord, buildReorderDecisionObject, buildProcurementReentryHandoff } from "@/lib/ai/reorder-decision-engine";
import type { ReorderDecisionHandoff } from "@/lib/ai/stock-release-engine";

const DECISION_LABELS: Record<ReorderCandidateType, { label: string; color: string }> = {
  reorder_candidate: { label: "재주문", color: "text-blue-400" },
  watch_only: { label: "Watch", color: "text-amber-400" },
  blocked_from_reorder: { label: "차단", color: "text-red-400" },
  requires_followup: { label: "확인 필요", color: "text-orange-400" },
};

interface ReorderDecisionWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ReorderDecisionHandoff | null;
  onDecisionRecorded: (obj: ReorderDecisionObject) => void;
  onProcurementReentryHandoff: () => void;
  onReturnToStockRelease: () => void;
}

export function ReorderDecisionWorkbench({ open, onClose, handoff, onDecisionRecorded, onProcurementReentryHandoff, onReturnToStockRelease }: ReorderDecisionWorkbenchProps) {
  const [decisionState, setDecisionState] = useState<ReorderDecisionState | null>(null);
  const [decisionObject, setDecisionObject] = useState<ReorderDecisionObject | null>(null);

  useMemo(() => { if (open && handoff && !decisionState) setDecisionState(createInitialReorderDecisionState(handoff)); }, [open, handoff]); // eslint-disable-line

  const riskAssessment = useMemo(() => decisionState ? buildReorderRiskAssessment(decisionState) : null, [decisionState]);
  const decisionPlan = useMemo(() => decisionState ? buildReorderDecisionPlan(decisionState.candidateDecisions) : null, [decisionState]);
  const validation = useMemo(() => decisionState ? validateReorderDecisionBeforeRecord(decisionState) : null, [decisionState]);

  const simulateReorderDecision = useCallback(() => {
    const demoDecisions: ItemReorderDecision[] = [
      { itemId: "item_1", itemName: "시약 A", decisionType: "reorder_candidate", reorderQty: 10, urgency: "normal", rationale: "커버리지 30일 미만" },
      { itemId: "item_2", itemName: "시약 B", decisionType: "watch_only", reorderQty: 0, urgency: "watch", rationale: "현재 재고 충분, 유효기한 여유" },
    ];
    setDecisionState(prev => prev ? { ...prev, candidateDecisions: demoDecisions, coverageRiskStatus: "low", expiryRiskStatus: "warning", reorderCandidateQtySummary: "10개", watchCandidateQtySummary: "1개", substatus: "ready_for_procurement_reentry" } : prev);
  }, []);

  const recordDecision = useCallback(() => {
    if (!decisionState || !validation?.canRecordReorderDecision) return;
    const obj = buildReorderDecisionObject(decisionState);
    setDecisionObject(obj); onDecisionRecorded(obj);
    setDecisionState(prev => prev ? { ...prev, reorderDecisionStatus: "reorder_decision_recorded", reorderDecisionObjectId: obj.id } : prev);
  }, [decisionState, validation, onDecisionRecorded]);

  if (!open || !decisionState || !handoff) return null;
  const isRecorded = !!decisionObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-blue-600/15 border-blue-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-blue-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Reorder Decision 완료" : "Reorder Decision"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Reorder <span className="text-blue-300 font-medium">{decisionPlan?.reorderCandidateItemIds.length || 0}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Watch <span className="text-amber-300 font-medium">{decisionPlan?.watchOnlyItemIds.length || 0}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Coverage <span className={decisionState.coverageRiskStatus === "critical" ? "text-red-300" : decisionState.coverageRiskStatus === "low" ? "text-amber-300" : "text-emerald-300"}>{decisionState.coverageRiskStatus}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Stock release basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Stock Release 근거</span>
            <span className="text-[10px] text-blue-200">Releasable: {handoff.releasableQtySummary} · Hold: {handoff.holdRemainingQtySummary} · {handoff.releaseDecisionSummary}</span>
          </div>

          {/* Risk summary */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">리스크 평가</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${decisionState.coverageRiskStatus === "critical" ? "border-red-500/20 bg-red-600/[0.03]" : decisionState.coverageRiskStatus === "low" ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-emerald-500/20 bg-emerald-600/[0.03]"}`}>
                <div className="flex items-center gap-1.5 mb-0.5"><TrendingDown className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">커버리지</span></div>
                <span className={`text-[11px] font-medium ${decisionState.coverageRiskStatus === "critical" ? "text-red-300" : decisionState.coverageRiskStatus === "low" ? "text-amber-300" : "text-emerald-300"}`}>{decisionState.coverageRiskStatus === "critical" ? "위험" : decisionState.coverageRiskStatus === "low" ? "낮음" : "충분"}</span>
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${decisionState.expiryRiskStatus === "critical" ? "border-red-500/20 bg-red-600/[0.03]" : decisionState.expiryRiskStatus === "warning" ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-emerald-500/20 bg-emerald-600/[0.03]"}`}>
                <div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">유효기한</span></div>
                <span className={`text-[11px] font-medium ${decisionState.expiryRiskStatus === "critical" ? "text-red-300" : decisionState.expiryRiskStatus === "warning" ? "text-amber-300" : "text-emerald-300"}`}>{decisionState.expiryRiskStatus === "critical" ? "위험" : decisionState.expiryRiskStatus === "warning" ? "주의" : "양호"}</span>
              </div>
            </div>
          </div>

          {riskAssessment && (riskAssessment.blockingIssues.length > 0 || riskAssessment.warnings.length > 0) && (
            <div className="space-y-1">
              {riskAssessment.blockingIssues.map((b, i) => <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><ShieldAlert className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
              {riskAssessment.warnings.map((w, i) => <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>)}
            </div>
          )}

          {/* Candidate decisions */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">품목별 결정</span>
            {decisionState.candidateDecisions.length === 0 ? (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateReorderDecision}>Reorder 결정 시뮬레이션</Button>
            ) : (
              <div className="mt-2 space-y-1.5">
                {decisionState.candidateDecisions.map(cd => {
                  const dl = DECISION_LABELS[cd.decisionType];
                  return (
                    <div key={cd.itemId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${cd.decisionType === "reorder_candidate" ? "border-blue-500/20 bg-blue-600/[0.03]" : cd.decisionType === "watch_only" ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-red-500/15 bg-red-600/[0.03]"}`}>
                      {cd.decisionType === "reorder_candidate" ? <RefreshCw className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : <Eye className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-slate-200 font-medium block">{cd.itemName}</span>
                        <span className="text-[9px] text-slate-500">{cd.rationale}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cd.reorderQty > 0 && <span className="text-[10px] tabular-nums text-slate-300 font-medium">{cd.reorderQty}개</span>}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${dl.color} ${cd.decisionType === "reorder_candidate" ? "bg-blue-600/10" : cd.decisionType === "watch_only" ? "bg-amber-600/10" : "bg-red-600/10"}`}>{dl.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Reorder Decision 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Procurement Re-entry로 소싱 흐름에 재진입할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Reorder <span className="text-blue-300 font-medium">{decisionPlan?.reorderCandidateItemIds.length || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Watch <span className="text-amber-300 font-medium">{decisionPlan?.watchOnlyItemIds.length || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToStockRelease}><ArrowLeft className="h-3 w-3 mr-1" />Stock Release</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={recordDecision} disabled={!validation?.canRecordReorderDecision}><RefreshCw className="h-3 w-3 mr-1" />Reorder Decision 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenProcurementReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onProcurementReentryHandoff} disabled={!validation?.canOpenProcurementReentry}>
                <RefreshCw className="h-3 w-3 mr-1" />Procurement Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Eye, TrendingDown, Clock } from "lucide-react";
import { type ReorderDecisionReentryState, type ReorderDecisionReentryObject, type ReorderReentryItemDecision, createInitialReorderDecisionReentryState, validateReorderDecisionReentryBeforeRecord, buildReorderDecisionReentryObject, buildProcurementReentryReopenHandoff } from "@/lib/ai/reorder-decision-reentry-engine";
import type { ReorderDecisionReentryHandoff } from "@/lib/ai/stock-release-reentry-engine";

interface Props { open: boolean; onClose: () => void; handoff: ReorderDecisionReentryHandoff | null; onDecisionRecorded: (obj: ReorderDecisionReentryObject) => void; onProcurementReentryReopenHandoff: () => void; onReturnToStockReleaseReentry: () => void; }

export function ReorderDecisionReentryWorkbench({ open, onClose, handoff, onDecisionRecorded, onProcurementReentryReopenHandoff, onReturnToStockReleaseReentry }: Props) {
  const [state, setState] = useState<ReorderDecisionReentryState | null>(null);
  const [obj, setObj] = useState<ReorderDecisionReentryObject | null>(null);
  useMemo(() => { if (open && handoff && !state) setState(createInitialReorderDecisionReentryState(handoff)); }, [open, handoff]); // eslint-disable-line
  const validation = useMemo(() => state ? validateReorderDecisionReentryBeforeRecord(state) : null, [state]);
  const simulateDecision = useCallback(() => {
    const demo: ReorderReentryItemDecision[] = [{ itemId: "item_re_1", itemName: "시약 A (재)", decisionType: "reorder_candidate", reorderQty: 5, urgency: "normal", rationale: "커버리지 부족" }, { itemId: "item_re_2", itemName: "시약 B (재)", decisionType: "watch_only", reorderQty: 0, urgency: "watch", rationale: "현재 충분" }];
    setState(prev => prev ? { ...prev, candidateDecisions: demo, coverageRiskStatus: "low", expiryRiskStatus: "warning", reorderCandidateQtySummary: "5개", watchCandidateQtySummary: "1개", missingDecisionCount: 0, substatus: "ready_for_procurement_reentry_reopen" } : prev);
  }, []);
  const recordDecision = useCallback(() => { if (!state || !validation?.canRecordReorderDecisionReentry) return; const o = buildReorderDecisionReentryObject(state); setObj(o); onDecisionRecorded(o); setState(prev => prev ? { ...prev, reorderDecisionReentryStatus: "reorder_decision_reentry_recorded", reorderDecisionReentryObjectId: o.id } : prev); }, [state, validation, onDecisionRecorded]);
  if (!open || !state || !handoff) return null;
  const isRecorded = !!obj;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3"><div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-blue-600/15 border-blue-500/25"}`}>{isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-blue-400" />}</div><div><h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Reorder Re-entry 완료" : "Reorder Decision Re-entry"}</h2><div className="flex items-center gap-2 text-[10px] mt-0.5"><span className="text-slate-400">Coverage <span className={state.coverageRiskStatus === "critical" ? "text-red-300" : state.coverageRiskStatus === "low" ? "text-amber-300" : "text-emerald-300"}>{state.coverageRiskStatus}</span></span><span className="text-slate-600">·</span><span className="text-slate-400">Expiry <span className={state.expiryRiskStatus === "critical" ? "text-red-300" : state.expiryRiskStatus === "warning" ? "text-amber-300" : "text-emerald-300"}>{state.expiryRiskStatus}</span></span></div></div></div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15"><span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Stock Release Re-entry 근거</span><span className="text-[10px] text-blue-200">Releasable: {handoff.releasableQtySummary} · Hold: {handoff.holdRemainingQtySummary} · Gate: {handoff.releaseGateSummary}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`px-3 py-2.5 rounded-md border ${state.coverageRiskStatus === "critical" ? "border-red-500/20 bg-red-600/[0.03]" : state.coverageRiskStatus === "low" ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-emerald-500/20 bg-emerald-600/[0.03]"}`}><div className="flex items-center gap-1.5 mb-0.5"><TrendingDown className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">커버리지</span></div><span className={`text-[11px] font-medium ${state.coverageRiskStatus === "critical" ? "text-red-300" : state.coverageRiskStatus === "low" ? "text-amber-300" : "text-emerald-300"}`}>{state.coverageRiskStatus}</span></div>
            <div className={`px-3 py-2.5 rounded-md border ${state.expiryRiskStatus === "critical" ? "border-red-500/20 bg-red-600/[0.03]" : state.expiryRiskStatus === "warning" ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-emerald-500/20 bg-emerald-600/[0.03]"}`}><div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">유효기한</span></div><span className={`text-[11px] font-medium ${state.expiryRiskStatus === "critical" ? "text-red-300" : state.expiryRiskStatus === "warning" ? "text-amber-300" : "text-emerald-300"}`}>{state.expiryRiskStatus}</span></div>
          </div>
          <div><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">품목별 결정</span>
            {state.candidateDecisions.length === 0 ? <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateDecision}>Reorder 결정 시뮬레이션</Button> : <div className="mt-2 space-y-1.5">{state.candidateDecisions.map(cd => <div key={cd.itemId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${cd.decisionType === "reorder_candidate" ? "border-blue-500/20 bg-blue-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>{cd.decisionType === "reorder_candidate" ? <RefreshCw className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : <Eye className="h-3.5 w-3.5 text-amber-400 shrink-0" />}<div className="flex-1 min-w-0"><span className="text-[11px] text-slate-200 font-medium block">{cd.itemName}</span><span className="text-[9px] text-slate-500">{cd.rationale}</span></div>{cd.reorderQty > 0 && <span className="text-[10px] tabular-nums text-slate-300 font-medium shrink-0">{cd.reorderQty}개</span>}<span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${cd.decisionType === "reorder_candidate" ? "text-blue-400 bg-blue-600/10" : "text-amber-400 bg-amber-600/10"}`}>{cd.decisionType === "reorder_candidate" ? "재주문" : "Watch"}</span></div>)}</div>}
          </div>
          {isRecorded && <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Reorder Decision Re-entry 저장 완료</span></div><span className="text-[10px] text-slate-400 block mt-1">Procurement Re-entry Reopen으로 진행하여 소싱 흐름에 재진입할 수 있습니다. 이후 전체 procurement cycle이 다시 이어집니다.</span></div>}
        </div>
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5"><span className="text-slate-500">{validation?.recommendedNextAction || ""}</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToStockReleaseReentry}><ArrowLeft className="h-3 w-3 mr-1" />Stock Release Re</Button>
            {!isRecorded ? <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={recordDecision} disabled={!validation?.canRecordReorderDecisionReentry}><RefreshCw className="h-3 w-3 mr-1" />Reorder Re-entry 저장</Button> : <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenProcurementReentryReopen ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onProcurementReentryReopenHandoff} disabled={!validation?.canOpenProcurementReentryReopen}><RefreshCw className="h-3 w-3 mr-1" />Procurement Re-entry Reopen<ArrowRight className="h-3 w-3 ml-1" /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

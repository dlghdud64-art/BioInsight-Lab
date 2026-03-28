"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, GitCompare, Trash2, RotateCcw } from "lucide-react";
import { type QuoteNormalizationReentryState, type QuoteNormalizationReentryObject, type NormReentryQuoteDecision, type NormReentryClassification, createInitialQuoteNormalizationReentryState, buildQuoteReentryNormalizationPlan, validateQuoteNormalizationReentryBeforeRecord, buildQuoteNormalizationReentryObject } from "@/lib/ai/quote-normalization-reentry-engine";
import type { QuoteNormalizationReentryHandoff } from "@/lib/ai/quote-management-reentry-engine";

const CLASS_CONFIG: Record<NormReentryClassification, { label: string; color: string }> = {
  stale: { label: "Stale", color: "text-slate-500" },
  retained: { label: "유지", color: "text-emerald-400" },
  remapped: { label: "Remap", color: "text-blue-400" },
  waiting_new: { label: "신규 대기", color: "text-amber-400" },
  blocked_delta_mismatch: { label: "Delta 차단", color: "text-red-400" },
};

interface QuoteNormalizationReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: QuoteNormalizationReentryHandoff | null;
  onReentryRecorded: (obj: QuoteNormalizationReentryObject) => void;
  onCompareReentryHandoff: () => void;
  onReturnToManagementReentry: () => void;
}

export function QuoteNormalizationReentryWorkbench({ open, onClose, handoff, onReentryRecorded, onCompareReentryHandoff, onReturnToManagementReentry }: QuoteNormalizationReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<QuoteNormalizationReentryState | null>(null);
  const [reentryObject, setReentryObject] = useState<QuoteNormalizationReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialQuoteNormalizationReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const plan = useMemo(() => reentryState ? buildQuoteReentryNormalizationPlan(reentryState.quoteDecisions) : null, [reentryState]);
  const validation = useMemo(() => reentryState ? validateQuoteNormalizationReentryBeforeRecord(reentryState) : null, [reentryState]);

  const simulateDecisions = useCallback(() => {
    const demo: NormReentryQuoteDecision[] = [
      { quoteId: "q1", vendorName: "Sigma-Aldrich", classification: "retained", lineDeltaImpact: false, remapRequired: false, rationale: "기존 견적 유효" },
      { quoteId: "q2", vendorName: "TCI", classification: "remapped", lineDeltaImpact: true, remapRequired: true, rationale: "수량 변경으로 remap 필요" },
      { quoteId: "q3", vendorName: "Alfa Aesar", classification: "stale", lineDeltaImpact: false, remapRequired: false, rationale: "이전 요청 기반 — stale 처리" },
    ];
    setReentryState(prev => prev ? { ...prev, quoteDecisions: demo, retainedQuoteIds: ["q1"], remappedQuoteIds: ["q2"], staleQuoteIds: ["q3"], missingDecisionCount: 0, substatus: "ready_for_compare_reentry", requestLineDeltaNormalizationSummary: "1개 remap, 1개 유지, 1개 stale" } : prev);
  }, []);

  const recordReentry = useCallback(() => {
    if (!reentryState || !validation?.canRecordQuoteNormalizationReentry) return;
    const obj = buildQuoteNormalizationReentryObject(reentryState);
    setReentryObject(obj); onReentryRecorded(obj);
    setReentryState(prev => prev ? { ...prev, quoteNormalizationReentryStatus: "quote_normalization_reentry_recorded", quoteNormalizationReentryObjectId: obj.id } : prev);
  }, [reentryState, validation, onReentryRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!reentryObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-orange-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Normalization Re-entry 완료" : "Quote Normalization Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Retained <span className="text-emerald-300 font-medium">{plan?.retainedQuoteIds.length || 0}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Remap <span className="text-blue-300 font-medium">{plan?.remappedQuoteIds.length || 0}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Stale <span className="text-slate-500 font-medium">{plan?.staleQuoteIds.length || 0}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Management re-entry basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Quote Management Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Candidates: {handoff.normalizationReentryCandidateIds.length}개 · {handoff.priorQuoteReconciliationSummary}</span>
          </div>

          {/* Classification summary */}
          {plan && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Quote 분류</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Retained</span><span className="text-lg font-bold text-emerald-400">{plan.retainedQuoteIds.length}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-blue-500/20 bg-blue-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Remap</span><span className="text-lg font-bold text-blue-400">{plan.remappedQuoteIds.length}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729] text-center"><span className="text-[9px] text-slate-500 block">Stale</span><span className="text-lg font-bold text-slate-500">{plan.staleQuoteIds.length}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-red-500/15 bg-red-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Blocked</span><span className="text-lg font-bold text-red-400">{plan.blockedQuoteIds.length}</span></div>
              </div>
            </div>
          )}

          {/* Quote decisions */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Quote 결정</span>
            {reentryState.quoteDecisions.length === 0 ? (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateDecisions}>분류 시뮬레이션</Button>
            ) : (
              <div className="mt-2 space-y-1.5">
                {reentryState.quoteDecisions.map(qd => {
                  const config = CLASS_CONFIG[qd.classification];
                  return (
                    <div key={qd.quoteId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${qd.classification === "retained" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : qd.classification === "remapped" ? "border-blue-500/20 bg-blue-600/[0.03]" : qd.classification === "stale" ? "border-bd/40 bg-[#252729] opacity-60" : "border-red-500/15 bg-red-600/[0.03]"}`}>
                      {qd.classification === "retained" ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : qd.classification === "remapped" ? <RotateCcw className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : <Trash2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-slate-200 font-medium block truncate">{qd.vendorName}</span>
                        <span className="text-[9px] text-slate-500">{qd.rationale}</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${config.color} ${qd.classification === "retained" ? "bg-emerald-600/10" : qd.classification === "remapped" ? "bg-blue-600/10" : qd.classification === "stale" ? "bg-slate-700/30" : "bg-red-600/10"}`}>{config.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compare readiness */}
          <div className={`px-3 py-2.5 rounded-md border ${validation?.canOpenQuoteCompareReentry ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Compare Re-entry Readiness</span>
            {validation?.canOpenQuoteCompareReentry ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능 ({(plan?.retainedQuoteIds.length || 0) + (plan?.remappedQuoteIds.length || 0)}개 compare 후보)</span></div> : <span className="text-[10px] text-slate-500">{validation?.recommendedNextAction || "대기 중"}</span>}
          </div>

          {plan && plan.warnings.length > 0 && !isRecorded && plan.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Normalization Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Quote Compare Re-entry로 진행하여 견적 비교를 재개할 수 있습니다. 이후 PO → 입고 → 재고 → 재주문 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Retained <span className="text-emerald-300 font-medium">{plan?.retainedQuoteIds.length || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Remap <span className="text-blue-300 font-medium">{plan?.remappedQuoteIds.length || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToManagementReentry}><ArrowLeft className="h-3 w-3 mr-1" />Quote Mgmt Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-medium" onClick={recordReentry} disabled={!validation?.canRecordQuoteNormalizationReentry}><RefreshCw className="h-3 w-3 mr-1" />Normalization Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenQuoteCompareReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onCompareReentryHandoff} disabled={!validation?.canOpenQuoteCompareReentry}>
                <GitCompare className="h-3 w-3 mr-1" />Quote Compare Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

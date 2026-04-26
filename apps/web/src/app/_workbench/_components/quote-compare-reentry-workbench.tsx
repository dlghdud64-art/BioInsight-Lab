"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, ArrowLeft, GitCompare, TrendingDown, Clock, Package, ShieldCheck } from "lucide-react";
import { type QuoteCompareReentryState, type QuoteCompareReentryDecisionSnapshot, createInitialQuoteCompareReentryState, buildQuoteCompareReentryDifferenceSummary, buildQuoteCompareReentryDecisionPlan, validateQuoteCompareReentryBeforeRecord, buildQuoteCompareReentryDecisionSnapshot, buildApprovalReentryHandoff } from "@/lib/ai/quote-compare-reentry-engine";
import type { QuoteCompareReentryFromNormHandoff } from "@/lib/ai/quote-normalization-reentry-engine";

interface QuoteCompareReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: QuoteCompareReentryFromNormHandoff | null;
  onDecisionRecorded: (snapshot: QuoteCompareReentryDecisionSnapshot) => void;
  onApprovalReentryHandoff: () => void;
  onReturnToNormReentry: () => void;
}

export function QuoteCompareReentryWorkbench({ open, onClose, handoff, onDecisionRecorded, onApprovalReentryHandoff, onReturnToNormReentry }: QuoteCompareReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<QuoteCompareReentryState | null>(null);
  const [snapshot, setSnapshot] = useState<QuoteCompareReentryDecisionSnapshot | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialQuoteCompareReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const diffSummary = useMemo(() => reentryState ? buildQuoteCompareReentryDifferenceSummary(reentryState.compareReentryCandidateIds.length, reentryState.retainedQuoteIds.length, reentryState.remappedQuoteIds.length) : null, [reentryState]);
  const plan = useMemo(() => reentryState ? buildQuoteCompareReentryDecisionPlan(reentryState) : null, [reentryState]);
  const validation = useMemo(() => reentryState ? validateQuoteCompareReentryBeforeRecord(reentryState) : null, [reentryState]);

  const toggleShortlist = useCallback((id: string) => { setReentryState(prev => { if (!prev) return prev; const has = prev.shortlistQuoteIds.includes(id); return { ...prev, shortlistQuoteIds: has ? prev.shortlistQuoteIds.filter(x => x !== id) : [...prev.shortlistQuoteIds, id], excludedQuoteIds: prev.excludedQuoteIds.filter(x => x !== id) }; }); }, []);
  const toggleExclude = useCallback((id: string) => { setReentryState(prev => { if (!prev) return prev; const has = prev.excludedQuoteIds.includes(id); return { ...prev, excludedQuoteIds: has ? prev.excludedQuoteIds.filter(x => x !== id) : [...prev.excludedQuoteIds, id], shortlistQuoteIds: prev.shortlistQuoteIds.filter(x => x !== id), approvalCandidateIds: prev.approvalCandidateIds.filter(x => x !== id) }; }); }, []);
  const toggleApproval = useCallback((id: string) => { setReentryState(prev => { if (!prev) return prev; const has = prev.approvalCandidateIds.includes(id); return { ...prev, approvalCandidateIds: has ? prev.approvalCandidateIds.filter(x => x !== id) : [...prev.approvalCandidateIds, id], excludedQuoteIds: prev.excludedQuoteIds.filter(x => x !== id) }; }); }, []);

  const recordDecision = useCallback(() => {
    if (!reentryState || !validation?.canRecordQuoteCompareReentryDecision) return;
    const s = buildQuoteCompareReentryDecisionSnapshot(reentryState);
    setSnapshot(s); onDecisionRecorded(s);
    setReentryState(prev => prev ? { ...prev, quoteCompareReentryStatus: "quote_compare_reentry_decision_recorded", quoteCompareReentryDecisionSnapshotId: s.id, substatus: "ready_for_approval_reentry" } : prev);
  }, [reentryState, validation, onDecisionRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!snapshot;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-violet-600/15 border-violet-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <GitCompare className="h-4 w-4 text-violet-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Compare Re-entry 완료" : "Quote Compare Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Candidates <span className="text-slate-200 font-medium">{reentryState.compareReentryCandidateIds.length}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">SL <span className="text-emerald-300 font-medium">{reentryState.shortlistQuoteIds.length}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Approval <span className="text-blue-300 font-medium">{reentryState.approvalCandidateIds.length}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Normalization basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Normalization Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Retained: {handoff.retainedQuoteIds.length} · Remapped: {handoff.remappedQuoteIds.length} · Compare: {handoff.compareReentryCandidateIds.length}개 · Delta: {handoff.requestLineDeltaNormalizationSummary}</span>
          </div>

          {/* Difference summary */}
          {diffSummary && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">핵심 차이</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><div className="flex items-center gap-1.5 mb-0.5"><TrendingDown className="h-3 w-3 text-emerald-400" /><span className="text-[9px] text-slate-500">가격</span></div><span className="text-[10px] text-slate-200">{diffSummary.priceDeltaSummary}</span></div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-blue-400" /><span className="text-[9px] text-slate-500">납기</span></div><span className="text-[10px] text-slate-200">{diffSummary.leadTimeDeltaSummary}</span></div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-400" /><span className="text-[9px] text-slate-500">규격</span></div><span className="text-[10px] text-slate-200">{diffSummary.specDeltaSummary}</span></div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><div className="flex items-center gap-1.5 mb-0.5"><ShieldCheck className="h-3 w-3 text-slate-400" /><span className="text-[9px] text-slate-500">Approval Risk</span></div><span className="text-[10px] text-slate-200">{diffSummary.approvalRiskSummary}</span></div>
              </div>
            </div>
          )}

          {/* Quote decisions */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Quote 판단</span>
            <div className="mt-2 space-y-1.5">
              {reentryState.compareReentryCandidateIds.map(id => {
                const isSl = reentryState.shortlistQuoteIds.includes(id);
                const isEx = reentryState.excludedQuoteIds.includes(id);
                const isAp = reentryState.approvalCandidateIds.includes(id);
                const isRetained = reentryState.retainedQuoteIds.includes(id);
                return (
                  <div key={id} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${isAp ? "border-blue-500/20 bg-blue-600/[0.03]" : isSl ? "border-emerald-500/20 bg-emerald-600/[0.03]" : isEx ? "border-bd/40 bg-[#252A33] opacity-50" : "border-bd/40 bg-[#252A33]"}`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-200 font-medium block">{id}</span>
                      <span className="text-[9px] text-slate-500">{isRetained ? "Retained" : "Remapped"}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant={isSl ? "default" : "ghost"} className={`h-6 px-2 text-[9px] ${isSl ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/25" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleShortlist(id)} disabled={isRecorded}><Check className="h-3 w-3 mr-0.5" />SL</Button>
                      <Button size="sm" variant={isAp ? "default" : "ghost"} className={`h-6 px-2 text-[9px] ${isAp ? "bg-blue-600/15 text-blue-400 border border-blue-500/25" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleApproval(id)} disabled={isRecorded}><ShieldCheck className="h-3 w-3 mr-0.5" />AP</Button>
                      <Button size="sm" variant="ghost" className={`h-6 px-2 text-[9px] ${isEx ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleExclude(id)} disabled={isRecorded}><Minus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {plan && plan.blockingIssues.length > 0 && !isRecorded && plan.blockingIssues.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Compare Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Approval Re-entry로 진행하여 승인 검토를 재개할 수 있습니다. 이후 PO Conversion → 입고 → 재고 → 재주문 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">SL <span className="text-emerald-300 font-medium">{reentryState.shortlistQuoteIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">AP <span className="text-blue-300 font-medium">{reentryState.approvalCandidateIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToNormReentry}><ArrowLeft className="h-3 w-3 mr-1" />Norm Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-violet-600 hover:bg-violet-500 text-white font-medium" onClick={recordDecision} disabled={!validation?.canRecordQuoteCompareReentryDecision}><GitCompare className="h-3 w-3 mr-1" />Compare Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenApprovalReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onApprovalReentryHandoff} disabled={!validation?.canOpenApprovalReentry}>
                <ShieldCheck className="h-3 w-3 mr-1" />Approval Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

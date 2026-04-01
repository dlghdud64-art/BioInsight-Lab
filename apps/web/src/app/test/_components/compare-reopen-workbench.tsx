"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, Minus, AlertTriangle, ArrowRight, ArrowLeft, GitCompare, TrendingDown, Clock, Package, FileText } from "lucide-react";
import { type CompareReopenState, type CompareReopenDecisionSnapshot, createInitialCompareReopenState, buildCompareBaselineReuseDecision, buildCompareReopenDifferenceSummary, validateCompareReopenBeforeRecord, buildCompareReopenDecisionSnapshot, buildRequestReopenFromCompareHandoff, buildCompareEligibilityPlanV2 } from "@/lib/ai/compare-reopen-engine";
import type { CompareReopenHandoff } from "@/lib/ai/sourcing-result-review-engine";

interface CompareReopenWorkbenchProps {
  open: boolean; onClose: () => void; handoff: CompareReopenHandoff | null;
  onDecisionRecorded: (snapshot: CompareReopenDecisionSnapshot) => void;
  onRequestReopenHandoff: () => void;
  onReturnToResultReview: () => void;
}

export function CompareReopenWorkbench({ open, onClose, handoff, onDecisionRecorded, onRequestReopenHandoff, onReturnToResultReview }: CompareReopenWorkbenchProps) {
  const [reopenState, setReopenState] = useState<CompareReopenState | null>(null);
  const [decisionSnapshot, setDecisionSnapshot] = useState<CompareReopenDecisionSnapshot | null>(null);

  useMemo(() => { if (open && handoff && !reopenState) setReopenState(createInitialCompareReopenState(handoff)); }, [open, handoff]); // eslint-disable-line

  const baselineDecision = useMemo(() => reopenState ? buildCompareBaselineReuseDecision(reopenState) : null, [reopenState]);
  const diffSummary = useMemo(() => reopenState ? buildCompareReopenDifferenceSummary(reopenState.compareCandidateIds.length) : null, [reopenState]);
  const validation = useMemo(() => reopenState ? validateCompareReopenBeforeRecord(reopenState) : null, [reopenState]);

  const toggleShortlist = useCallback((id: string) => {
    setReopenState(prev => { if (!prev) return prev; const inSl = prev.shortlistIds.includes(id); return { ...prev, shortlistIds: inSl ? prev.shortlistIds.filter(x => x !== id) : [...prev.shortlistIds, id], excludedIds: prev.excludedIds.filter(x => x !== id) }; });
  }, []);
  const toggleExclude = useCallback((id: string) => {
    setReopenState(prev => { if (!prev) return prev; const inEx = prev.excludedIds.includes(id); return { ...prev, excludedIds: inEx ? prev.excludedIds.filter(x => x !== id) : [...prev.excludedIds, id], shortlistIds: prev.shortlistIds.filter(x => x !== id), requestCandidateIds: prev.requestCandidateIds.filter(x => x !== id) }; });
  }, []);
  const toggleRequestCandidate = useCallback((id: string) => {
    setReopenState(prev => { if (!prev) return prev; const inRc = prev.requestCandidateIds.includes(id); return { ...prev, requestCandidateIds: inRc ? prev.requestCandidateIds.filter(x => x !== id) : [...prev.requestCandidateIds, id], excludedIds: prev.excludedIds.filter(x => x !== id) }; });
  }, []);

  const recordDecision = useCallback(() => {
    if (!reopenState || !validation?.canRecordCompareReopenDecision) return;
    const snapshot = buildCompareReopenDecisionSnapshot(reopenState);
    setDecisionSnapshot(snapshot); onDecisionRecorded(snapshot);
    setReopenState(prev => prev ? { ...prev, compareReopenStatus: "compare_reopen_decision_recorded", compareReopenDecisionSnapshotId: snapshot.id, substatus: "ready_for_request_reopen" } : prev);
  }, [reopenState, validation, onDecisionRecorded]);

  if (!open || !reopenState || !handoff) return null;
  const isRecorded = !!decisionSnapshot;

  return (
    <div className="flex flex-col h-full bg-[#1e2024]">
      {/* ── Decision Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729] shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-blue-600/15 border-blue-500/25"}`}>
            {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <GitCompare className="h-4 w-4 text-blue-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Compare Reopen 완료" : "Compare Reopen"}</h2>
            <div className="flex items-center gap-2 text-[10px] mt-0.5">
              <span className="text-slate-400">후보 <span className="text-slate-200 font-medium">{reopenState.compareCandidateIds.length}개</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Shortlist <span className="text-emerald-300 font-medium">{reopenState.shortlistIds.length}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Request <span className="text-blue-300 font-medium">{reopenState.requestCandidateIds.length}</span></span>
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Result basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Result Review 근거</span>
            <span className="text-[10px] text-blue-200">Query: {handoff.querySeedSummary} · Candidates: {handoff.compareCandidateIds.length}개 · Baseline: {handoff.baselineReuseSummary}</span>
          </div>

          {/* Baseline reuse */}
          {baselineDecision && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Baseline Reuse</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "비교 축", reuse: baselineDecision.reuseCompareAxis },
                  { label: "Shortlist 로직", reuse: baselineDecision.reuseShortlistLogic },
                  { label: "제외 로직", reuse: baselineDecision.reuseExclusionLogic },
                ].map(item => (
                  <div key={item.label} className={`px-3 py-2 rounded-md border text-center ${item.reuse ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
                    <span className="text-[9px] text-slate-500 block">{item.label}</span>
                    <span className={`text-[10px] font-medium ${item.reuse ? "text-emerald-300" : "text-slate-500"}`}>{item.reuse ? "재사용" : "초기화"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compare Eligibility Summary (V2) */}
          {(() => {
            const eligibility = buildCompareEligibilityPlanV2(reopenState.compareCandidateIds, "");
            return (
              <div>
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Compare Eligibility</span>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <div className="px-3 py-2 rounded-md border border-blue-500/20 bg-blue-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Exact</span><span className="text-lg font-bold text-blue-400">{eligibility.exactComparableIds.length}</span></div>
                  <div className="px-3 py-2 rounded-md border border-violet-500/20 bg-violet-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Equivalent</span><span className="text-lg font-bold text-violet-400">{eligibility.equivalentComparableIds.length}</span></div>
                  <div className="px-3 py-2 rounded-md border border-amber-500/20 bg-amber-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Sub Hold</span><span className="text-lg font-bold text-amber-400">{eligibility.substituteHoldIds.length}</span></div>
                  <div className="px-3 py-2 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Direct Bypass</span><span className="text-lg font-bold text-emerald-400">{eligibility.requestDirectBypassIds.length}</span></div>
                </div>
              </div>
            );
          })()}

          {/* Difference summary */}
          {diffSummary && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">핵심 차이</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]"><div className="flex items-center gap-1.5 mb-0.5"><TrendingDown className="h-3 w-3 text-emerald-400" /><span className="text-[9px] text-slate-500">가격</span></div><span className="text-[10px] text-slate-200">{diffSummary.priceDeltaSummary}</span></div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]"><div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-blue-400" /><span className="text-[9px] text-slate-500">납기</span></div><span className="text-[10px] text-slate-200">{diffSummary.leadTimeDeltaSummary}</span></div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]"><div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-400" /><span className="text-[9px] text-slate-500">규격</span></div><span className="text-[10px] text-slate-200">{diffSummary.specFitDeltaSummary}</span></div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]"><div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-400" /><span className="text-[9px] text-slate-500">재고</span></div><span className="text-[10px] text-slate-200">{diffSummary.availabilityDeltaSummary}</span></div>
              </div>
            </div>
          )}

          {/* Candidate decisions */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">후보 판단</span>
            <div className="mt-2 space-y-1.5">
              {reopenState.compareCandidateIds.map(id => {
                const isSl = reopenState.shortlistIds.includes(id);
                const isEx = reopenState.excludedIds.includes(id);
                const isRc = reopenState.requestCandidateIds.includes(id);
                return (
                  <div key={id} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${isSl ? "border-emerald-500/20 bg-emerald-600/[0.03]" : isEx ? "border-bd/40 bg-[#252729] opacity-50" : isRc ? "border-blue-500/20 bg-blue-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
                    <span className="text-[11px] text-slate-200 font-medium flex-1">{id}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant={isSl ? "default" : "ghost"} className={`h-6 px-2 text-[9px] ${isSl ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/25" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleShortlist(id)} disabled={isRecorded}><Check className="h-3 w-3 mr-0.5" />SL</Button>
                      <Button size="sm" variant={isRc ? "default" : "ghost"} className={`h-6 px-2 text-[9px] ${isRc ? "bg-blue-600/15 text-blue-400 border border-blue-500/25" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleRequestCandidate(id)} disabled={isRecorded}><FileText className="h-3 w-3 mr-0.5" />RQ</Button>
                      <Button size="sm" variant="ghost" className={`h-6 px-2 text-[9px] ${isEx ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleExclude(id)} disabled={isRecorded}><Minus className="h-3 w-3 mr-0.5" />제외</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {validation && validation.blockingIssues.length > 0 && !isRecorded && validation.blockingIssues.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Compare Reopen 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Request Reopen으로 진행하여 견적 요청을 다시 구성할 수 있습니다.</span>
            </div>
          )}
        </div>

      {/* ── Sticky Dock ── */}
      <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f] shrink-0">
        <div className="flex items-center gap-3 text-[10px] mb-2.5">
          <span className="text-slate-500">SL <span className="text-emerald-300 font-medium">{reopenState.shortlistIds.length}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">RQ <span className="text-blue-300 font-medium">{reopenState.requestCandidateIds.length}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToResultReview}><ArrowLeft className="h-3 w-3 mr-1" />Result Review</Button>
          {!isRecorded ? (
            <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={recordDecision} disabled={!validation?.canRecordCompareReopenDecision}><GitCompare className="h-3 w-3 mr-1" />Compare Reopen 저장</Button>
          ) : (
            <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenRequestReopen ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onRequestReopenHandoff} disabled={!validation?.canOpenRequestReopen}>
              <FileText className="h-3 w-3 mr-1" />Request Reopen<ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

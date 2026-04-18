"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, ArrowRight, ArrowLeft, Search, GitCompare, FileText, Eye, Minus } from "lucide-react";
import { type SourcingResultReviewState, type SourcingResultReviewObject, type ResultCandidateDecision, type CandidateDecisionType, createInitialSourcingResultReviewState, buildSourcingResultTriage, buildSourcingCandidateAssemblyPlan, validateSourcingResultReviewBeforeRecord, buildSourcingResultReviewObject, buildSourcingResultGroupPlan, buildSourcingCompareDeltaSummary } from "@/lib/ai/sourcing-result-review-engine";
import type { SourcingSearchResultHandoff } from "@/lib/ai/sourcing-search-reopen-engine";

const DECISION_CONFIG: Record<CandidateDecisionType, { label: string; color: string; bg: string }> = {
  compare_candidate: { label: "비교 후보", color: "text-blue-400", bg: "bg-blue-600/10" },
  request_direct: { label: "요청 직행", color: "text-emerald-400", bg: "bg-emerald-600/10" },
  excluded: { label: "제외", color: "text-slate-500", bg: "bg-slate-700/30" },
  held: { label: "보류", color: "text-amber-400", bg: "bg-amber-600/10" },
  blocked: { label: "차단", color: "text-red-400", bg: "bg-red-600/10" },
};

interface SourcingResultReviewWorkbenchProps {
  open: boolean; onClose: () => void; handoff: SourcingSearchResultHandoff | null;
  onReviewRecorded: (obj: SourcingResultReviewObject) => void;
  onCompareReopenHandoff: () => void;
  onRequestReopenHandoff: () => void;
  onReturnToSearchReopen: () => void;
}

export function SourcingResultReviewWorkbench({ open, onClose, handoff, onReviewRecorded, onCompareReopenHandoff, onRequestReopenHandoff, onReturnToSearchReopen }: SourcingResultReviewWorkbenchProps) {
  const [reviewState, setReviewState] = useState<SourcingResultReviewState | null>(null);
  const [reviewObject, setReviewObject] = useState<SourcingResultReviewObject | null>(null);

  useMemo(() => { if (open && handoff && !reviewState) setReviewState(createInitialSourcingResultReviewState(handoff)); }, [open, handoff]); // eslint-disable-line

  const triage = useMemo(() => reviewState ? buildSourcingResultTriage(reviewState.candidateDecisions) : null, [reviewState]);
  const plan = useMemo(() => reviewState ? buildSourcingCandidateAssemblyPlan(reviewState.candidateDecisions) : null, [reviewState]);
  const validation = useMemo(() => reviewState ? validateSourcingResultReviewBeforeRecord(reviewState) : null, [reviewState]);

  const recordReview = useCallback(() => {
    if (!reviewState || !validation?.canRecordSourcingResultReview) return;
    const obj = buildSourcingResultReviewObject(reviewState);
    setReviewObject(obj); onReviewRecorded(obj);
    setReviewState(prev => prev ? { ...prev, sourcingResultReviewStatus: "sourcing_result_review_recorded", sourcingResultReviewObjectId: obj.id } : prev);
  }, [reviewState, validation, onReviewRecorded]);

  if (!open || !reviewState || !handoff) return null;
  const isRecorded = !!reviewObject;

  return (
    <div className="flex flex-col h-full bg-[#1C2028]">
      {/* ── Decision Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33] shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-violet-600/15 border-violet-500/25"}`}>
            {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Search className="h-4 w-4 text-violet-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Result Review 완료" : "Sourcing Result Review"}</h2>
            <div className="flex items-center gap-2 text-[10px] mt-0.5">
              <span className="text-slate-400">Compare <span className="text-blue-300 font-medium">{plan?.compareCandidateIds.length || 0}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Request <span className="text-emerald-300 font-medium">{plan?.requestDirectCandidateIds.length || 0}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Excluded <span className="text-slate-500 font-medium">{plan?.excludedCandidateIds.length || 0}</span></span>
              {reviewState.baselineBiasFlag && <><span className="text-slate-600">·</span><span className="text-amber-400">Bias</span></>}
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Search basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Search Reopen 근거</span>
            <span className="text-[10px] text-blue-200">Query: {handoff.querySeedSummary} · Filter: {handoff.filterSeedSummary} · Baseline: {handoff.baselineReuseSummary}</span>
          </div>

          {/* Triage summary */}
          {triage && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Triage 요약</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">High Fit</span><span className="text-lg font-bold text-emerald-400">{triage.highFitCount}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-amber-500/20 bg-amber-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Medium</span><span className="text-lg font-bold text-amber-400">{triage.mediumFitCount}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">Excluded</span><span className="text-lg font-bold text-slate-500">{triage.excludedCount}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-amber-500/20 bg-amber-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Bias</span><span className="text-lg font-bold text-amber-400">{triage.baselineBiasCount}</span></div>
              </div>
            </div>
          )}

          {/* Candidate Group Summary (V2) */}
          {reviewState.candidateDecisions.length > 0 && (() => {
            const groupPlan = buildSourcingResultGroupPlan(reviewState.candidateDecisions, "");
            return (
              <div>
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Candidate Group</span>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <div className="px-3 py-2.5 rounded-md border border-blue-500/20 bg-blue-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Exact Match</span><span className="text-lg font-bold text-blue-400">{groupPlan.exactMatchCandidateIds.length}</span></div>
                  <div className="px-3 py-2.5 rounded-md border border-violet-500/20 bg-violet-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Equivalent</span><span className="text-lg font-bold text-violet-400">{groupPlan.equivalentCandidateIds.length}</span></div>
                  <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Substitute</span><span className="text-lg font-bold text-emerald-400">{groupPlan.substituteCandidateIds.length}</span></div>
                  <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">Blocked</span><span className="text-lg font-bold text-slate-500">{groupPlan.blockedCandidateIds.length}</span></div>
                </div>
              </div>
            );
          })()}

          {/* Delta-First Compare Summary (V2) */}
          {(() => {
            const compareCandidates = reviewState.candidateDecisions.filter(d => d.decisionType === "compare_candidate");
            if (compareCandidates.length < 2) return null;
            const deltaSummary = buildSourcingCompareDeltaSummary(compareCandidates.length);
            return (
              <div>
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Delta-First Compare</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">가격</span><span className="text-[10px] text-slate-200">{deltaSummary.priceDeltaSummary}</span></div>
                  <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">납기</span><span className="text-[10px] text-slate-200">{deltaSummary.leadTimeDeltaSummary}</span></div>
                  <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">규격</span><span className="text-[10px] text-slate-200">{deltaSummary.specFitDeltaSummary}</span></div>
                </div>
              </div>
            );
          })()}

          {/* Candidate list */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">후보 검토</span>
            {reviewState.candidateDecisions.length === 0 ? (
              <div className="px-3 py-3 rounded-md bg-slate-700/20 border border-bd/30 text-center">
                <span className="text-[10px] text-slate-500">후보 데이터가 handoff를 통해 전달됩니다.</span>
              </div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {reviewState.candidateDecisions.map(cd => {
                  const config = DECISION_CONFIG[cd.decisionType];
                  return (
                    <div key={cd.candidateId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${cd.decisionType === "compare_candidate" ? "border-blue-500/20 bg-blue-600/[0.03]" : cd.decisionType === "request_direct" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : cd.decisionType === "excluded" ? "border-bd/40 bg-[#252A33] opacity-60" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                      {cd.decisionType === "compare_candidate" ? <GitCompare className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : cd.decisionType === "request_direct" ? <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : cd.decisionType === "excluded" ? <Minus className="h-3.5 w-3.5 text-slate-500 shrink-0" /> : <Eye className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-slate-200 font-medium block truncate">{cd.candidateName}</span>
                        <span className="text-[9px] text-slate-500">{cd.vendorName} · {cd.rationale}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${cd.fitScore === "high" ? "bg-emerald-600/10 text-emerald-400" : cd.fitScore === "medium" ? "bg-amber-600/10 text-amber-400" : "bg-slate-700/30 text-slate-500"}`}>{cd.fitScore}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${config.color} ${config.bg}`}>{config.label}</span>
                        {cd.baselineBiasFlag && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assembly summary */}
          {plan && (plan.compareCandidateIds.length > 0 || plan.requestDirectCandidateIds.length > 0) && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${plan.compareCandidateIds.length >= 2 ? "border-blue-500/20 bg-blue-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Compare Reopen</span>
                <span className={`text-[10px] font-medium ${plan.compareCandidateIds.length >= 2 ? "text-blue-300" : "text-slate-500"}`}>{plan.compareCandidateIds.length}개 후보 {plan.compareCandidateIds.length >= 2 ? "— 준비됨" : "— 부족"}</span>
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${plan.requestDirectCandidateIds.length > 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Request Reopen</span>
                <span className={`text-[10px] font-medium ${plan.requestDirectCandidateIds.length > 0 ? "text-emerald-300" : "text-slate-500"}`}>{plan.requestDirectCandidateIds.length}개 후보 {plan.requestDirectCandidateIds.length > 0 ? "— 준비됨" : "— 없음"}</span>
              </div>
            </div>
          )}

          {/* Validation */}
          {triage && triage.warnings.length > 0 && !isRecorded && triage.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Result Review 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Compare Reopen 또는 Request Reopen으로 진행하여 조달 흐름을 재개할 수 있습니다.</span>
            </div>
          )}
        </div>

      {/* ── Sticky Dock ── */}
      <div className="px-5 py-3 border-t border-bd bg-[#181E28] shrink-0">
        <div className="flex items-center gap-3 text-[10px] mb-2.5">
          <span className="text-slate-500">Compare <span className="text-blue-300 font-medium">{plan?.compareCandidateIds.length || 0}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">Request <span className="text-emerald-300 font-medium">{plan?.requestDirectCandidateIds.length || 0}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToSearchReopen}><ArrowLeft className="h-3 w-3 mr-1" />Search Reopen</Button>
          {!isRecorded ? (
            <Button size="sm" className="flex-1 h-8 text-[10px] bg-violet-600 hover:bg-violet-500 text-white font-medium" onClick={recordReview} disabled={!validation?.canRecordSourcingResultReview}><Search className="h-3 w-3 mr-1" />Result Review 저장</Button>
          ) : (
            <div className="flex gap-1.5 flex-1">
              {validation?.canOpenCompareReopen && (
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={onCompareReopenHandoff}><GitCompare className="h-3 w-3 mr-1" />Compare Reopen<ArrowRight className="h-3 w-3 ml-1" /></Button>
              )}
              {validation?.canOpenRequestReopen && (
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onRequestReopenHandoff}><FileText className="h-3 w-3 mr-1" />Request Reopen<ArrowRight className="h-3 w-3 ml-1" /></Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

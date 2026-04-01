"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, ArrowLeft, ShieldCheck, TrendingDown, Scale, CreditCard } from "lucide-react";
import { type ApprovalReentryState, type ApprovalReentryDecisionObject, createInitialApprovalReentryState, buildApprovalReentryDeltaReview, buildApprovalReentryDecisionPlan, validateApprovalReentryBeforeRecord, buildApprovalReentryDecisionObject, buildPoConversionReentryHandoff } from "@/lib/ai/approval-reentry-engine";
import type { ApprovalReentryHandoff } from "@/lib/ai/quote-compare-reentry-engine";

interface ApprovalReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ApprovalReentryHandoff | null;
  onDecisionRecorded: (obj: ApprovalReentryDecisionObject) => void;
  onPoConversionReentryHandoff: () => void;
  onReturnToCompareReentry: () => void;
}

export function ApprovalReentryWorkbench({ open, onClose, handoff, onDecisionRecorded, onPoConversionReentryHandoff, onReturnToCompareReentry }: ApprovalReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<ApprovalReentryState | null>(null);
  const [decisionObj, setDecisionObj] = useState<ApprovalReentryDecisionObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialApprovalReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const deltaReview = useMemo(() => reentryState ? buildApprovalReentryDeltaReview(reentryState) : null, [reentryState]);
  const plan = useMemo(() => reentryState ? buildApprovalReentryDecisionPlan(reentryState) : null, [reentryState]);
  const validation = useMemo(() => reentryState ? validateApprovalReentryBeforeRecord(reentryState) : null, [reentryState]);

  const simulateApproval = useCallback(() => {
    setReentryState(prev => prev ? { ...prev, commercialDeltaStatus: "reviewed", governanceDeltaStatus: "reviewed", budgetDeltaStatus: "reviewed", approvedCandidateIds: prev.approvalCandidateIds.slice(0, 1), substatus: "ready_for_po_conversion_reentry" } : prev);
  }, []);

  const toggleApproved = useCallback((id: string) => { setReentryState(prev => { if (!prev) return prev; const has = prev.approvedCandidateIds.includes(id); return { ...prev, approvedCandidateIds: has ? prev.approvedCandidateIds.filter(x => x !== id) : [...prev.approvedCandidateIds, id], blockedApprovalCandidateIds: prev.blockedApprovalCandidateIds.filter(x => x !== id) }; }); }, []);
  const toggleBlocked = useCallback((id: string) => { setReentryState(prev => { if (!prev) return prev; const has = prev.blockedApprovalCandidateIds.includes(id); return { ...prev, blockedApprovalCandidateIds: has ? prev.blockedApprovalCandidateIds.filter(x => x !== id) : [...prev.blockedApprovalCandidateIds, id], approvedCandidateIds: prev.approvedCandidateIds.filter(x => x !== id) }; }); }, []);

  const recordDecision = useCallback(() => {
    if (!reentryState || !validation?.canRecordApprovalReentryDecision) return;
    const obj = buildApprovalReentryDecisionObject(reentryState);
    setDecisionObj(obj); onDecisionRecorded(obj);
    setReentryState(prev => prev ? { ...prev, approvalReentryStatus: "approval_reentry_decision_recorded", approvalReentryDecisionObjectId: obj.id } : prev);
  }, [reentryState, validation, onDecisionRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!decisionObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-amber-600/15 border-amber-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <ShieldCheck className="h-4 w-4 text-amber-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Approval Re-entry 완료" : "Approval Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">SL <span className="text-slate-200 font-medium">{reentryState.shortlistQuoteIds.length}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Approved <span className="text-emerald-300 font-medium">{reentryState.approvedCandidateIds.length}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Blocked <span className="text-red-300 font-medium">{reentryState.blockedApprovalCandidateIds.length}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Compare basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Compare Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">SL: {handoff.shortlistQuoteIds.length}개 · AP: {handoff.approvalCandidateIds.length}개 · Basis: {handoff.compareBasisSummary}</span>
          </div>

          {/* Delta review */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Delta 재검토</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: "Commercial", status: reentryState.commercialDeltaStatus, icon: TrendingDown },
                { label: "Governance", status: reentryState.governanceDeltaStatus, icon: Scale },
                { label: "Budget", status: reentryState.budgetDeltaStatus, icon: CreditCard },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`px-3 py-2.5 rounded-md border text-center ${item.status === "reviewed" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : item.status === "blocked" ? "border-red-500/15 bg-red-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                    <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${item.status === "reviewed" ? "text-emerald-400" : item.status === "blocked" ? "text-red-400" : "text-amber-400"}`} />
                    <span className="text-[9px] text-slate-500 block">{item.label}</span>
                    <span className={`text-[10px] font-medium ${item.status === "reviewed" ? "text-emerald-300" : item.status === "blocked" ? "text-red-300" : "text-amber-300"}`}>{item.status === "reviewed" ? "검토 완료" : item.status === "blocked" ? "차단" : "미검토"}</span>
                  </div>
                );
              })}
            </div>
            {reentryState.commercialDeltaStatus === "pending" && (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateApproval}>Delta 검토 + 승인 시뮬레이션</Button>
            )}
          </div>

          {/* Candidate decisions */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">승인 판단</span>
            <div className="mt-2 space-y-1.5">
              {reentryState.approvalCandidateIds.map(id => {
                const isApproved = reentryState.approvedCandidateIds.includes(id);
                const isBlocked = reentryState.blockedApprovalCandidateIds.includes(id);
                return (
                  <div key={id} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${isApproved ? "border-emerald-500/20 bg-emerald-600/[0.03]" : isBlocked ? "border-red-500/15 bg-red-600/[0.03] opacity-60" : "border-bd/40 bg-[#252A33]"}`}>
                    <span className="text-[11px] text-slate-200 font-medium flex-1">{id}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant={isApproved ? "default" : "ghost"} className={`h-6 px-2 text-[9px] ${isApproved ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/25" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleApproved(id)} disabled={isRecorded}><Check className="h-3 w-3 mr-0.5" />승인</Button>
                      <Button size="sm" variant="ghost" className={`h-6 px-2 text-[9px] ${isBlocked ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 border border-bd/30"}`} onClick={() => toggleBlocked(id)} disabled={isRecorded}><Minus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {deltaReview && deltaReview.warnings.length > 0 && !isRecorded && deltaReview.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Approval Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">PO Conversion Re-entry로 진행하여 발주 전환을 재개할 수 있습니다. 이후 PO → Dispatch → 입고 → 재고 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Approved <span className="text-emerald-300 font-medium">{reentryState.approvedCandidateIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Blocked <span className="text-red-300 font-medium">{reentryState.blockedApprovalCandidateIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToCompareReentry}><ArrowLeft className="h-3 w-3 mr-1" />Compare Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-medium" onClick={recordDecision} disabled={!validation?.canRecordApprovalReentryDecision}><ShieldCheck className="h-3 w-3 mr-1" />Approval Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenPoConversionReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onPoConversionReentryHandoff} disabled={!validation?.canOpenPoConversionReentry}>
                <ShieldCheck className="h-3 w-3 mr-1" />PO Conversion Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

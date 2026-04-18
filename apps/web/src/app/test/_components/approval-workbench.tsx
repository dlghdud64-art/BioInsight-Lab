"use client";
import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, ShieldCheck, RotateCcw, Ban } from "lucide-react";
import { type ApprovalWorkbenchState, type ApprovalDecisionMode, type ApprovalReasonCode, type ReturnReasonCode, type RejectReasonCode, createInitialApprovalWorkbenchState, validateApprovalWorkbenchDecision, buildApprovalDecisionRecord, buildPoConversionEntryHandoffPackageV2 } from "@/lib/ai/approval-workbench-engine";
import type { CanonicalApprovalHandoffPackage } from "@/lib/ai/approval-handoff-gate-engine";

const APPROVAL_REASONS: { code: ApprovalReasonCode; label: string }[] = [{ code: "budget_ok", label: "예산 적합" }, { code: "policy_fit", label: "정책 부합" }, { code: "preferred_vendor", label: "선호 공급사" }, { code: "operational_urgency", label: "운영 긴급" }, { code: "spec_validated", label: "규격 검증" }, { code: "prior_performance", label: "거래 이력" }];
const RETURN_REASONS: { code: ReturnReasonCode; label: string }[] = [{ code: "missing_context", label: "맥락 부족" }, { code: "insufficient_rationale", label: "근거 부족" }, { code: "budget_issue", label: "예산 이슈" }, { code: "quote_stale", label: "견적 만료" }, { code: "vendor_risk_needs_review", label: "공급사 리스크" }];
const REJECT_REASONS: { code: RejectReasonCode; label: string }[] = [{ code: "policy_violation", label: "정책 위반" }, { code: "budget_rejected", label: "예산 거부" }, { code: "invalid_vendor_selection", label: "부적절 공급사" }, { code: "duplicate_request", label: "중복 요청" }];

interface Props { open: boolean; onClose: () => void; handoffPackage: CanonicalApprovalHandoffPackage | null; onApproved: () => void; onReturned: () => void; onRejected: () => void; }

export function ApprovalWorkbench({ open, onClose, handoffPackage, onApproved, onReturned, onRejected }: Props) {
  const [state, setState] = useState<ApprovalWorkbenchState | null>(null);
  const [isDecided, setIsDecided] = useState(false);
  useMemo(() => { if (open && handoffPackage && !state) setState(createInitialApprovalWorkbenchState(handoffPackage)); }, [open, handoffPackage]); // eslint-disable-line
  const validation = useMemo(() => state ? validateApprovalWorkbenchDecision(state) : null, [state]);

  const setDecisionMode = useCallback((mode: ApprovalDecisionMode) => { setState(prev => prev ? { ...prev, decisionMode: mode } : prev); }, []);
  const toggleReason = useCallback((code: string, type: "approve" | "return" | "reject") => {
    setState(prev => { if (!prev) return prev; if (type === "approve") { const has = prev.approvalReasonCodes.includes(code as ApprovalReasonCode); return { ...prev, approvalReasonCodes: has ? prev.approvalReasonCodes.filter(c => c !== code) : [...prev.approvalReasonCodes, code as ApprovalReasonCode] }; } if (type === "return") { const has = prev.returnReasonCodes.includes(code as ReturnReasonCode); return { ...prev, returnReasonCodes: has ? prev.returnReasonCodes.filter(c => c !== code) : [...prev.returnReasonCodes, code as ReturnReasonCode] }; } const has = prev.rejectReasonCodes.includes(code as RejectReasonCode); return { ...prev, rejectReasonCodes: has ? prev.rejectReasonCodes.filter(c => c !== code) : [...prev.rejectReasonCodes, code as RejectReasonCode] }; });
  }, []);

  const confirmDecision = useCallback(() => {
    if (!state || !handoffPackage) return;
    const record = buildApprovalDecisionRecord(state);
    setState(prev => prev ? { ...prev, approvalCaseStatus: state.decisionMode === "approve" ? "approved" : state.decisionMode === "return_for_revision" ? "returned_for_revision" : "rejected", approvalDecisionRecordId: record.id, nextDestination: record.nextDestination } : prev);
    setIsDecided(true);
    if (state.decisionMode === "approve") onApproved();
    else if (state.decisionMode === "return_for_revision") onReturned();
    else onRejected();
  }, [state, handoffPackage, onApproved, onReturned, onRejected]);

  if (!open || !state || !handoffPackage) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3"><div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isDecided ? "bg-emerald-600/15 border-emerald-500/25" : "bg-amber-600/15 border-amber-500/25"}`}>{isDecided ? <Check className="h-4 w-4 text-emerald-400" /> : <ShieldCheck className="h-4 w-4 text-amber-400" />}</div><div><h2 className="text-sm font-semibold text-slate-100">{isDecided ? "승인 판단 완료" : "Approval Workbench"}</h2><span className="text-[10px] text-slate-500">{state.requestReference} · {state.selectedVendor}</span></div></div>
          <button type="button" onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* A. Decision Header */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15"><span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Handoff Package</span><span className="text-[10px] text-blue-200">Vendor: {handoffPackage.selectedVendorId} · Items: {handoffPackage.selectedOptionIds.length}개 · Rationale: {handoffPackage.selectionReasonCodes.join(", ") || "미입력"}</span></div>
          {/* B. Decision Mode */}
          <div><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">결정 모드</span><div className="mt-2 flex gap-2">
            {([["approve", "승인", ShieldCheck, "emerald"], ["return_for_revision", "보완 요청", RotateCcw, "amber"], ["reject", "반려", Ban, "red"]] as const).map(([mode, label, Icon, color]) => { const isActive = state.decisionMode === mode; return <button key={mode} type="button" onClick={() => !isDecided && setDecisionMode(mode)} disabled={isDecided} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border text-[10px] font-medium transition-all ${isActive ? `border-${color}-500/30 bg-${color}-600/[0.06] text-${color === "emerald" ? "emerald" : color}-400` : "border-bd/40 text-slate-500"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; })}
          </div></div>
          {/* C. Reason Codes */}
          {state.decisionMode === "approve" && <div><span className="text-[9px] text-slate-500 block mb-1">승인 이유</span><div className="flex flex-wrap gap-1">{APPROVAL_REASONS.map(r => { const isActive = state.approvalReasonCodes.includes(r.code); return <button key={r.code} type="button" disabled={isDecided} onClick={() => toggleReason(r.code, "approve")} className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isActive ? "bg-emerald-600/15 border-emerald-500/30 text-emerald-400" : "border-bd/40 text-slate-500"}`}>{r.label}</button>; })}</div></div>}
          {state.decisionMode === "return_for_revision" && <div><span className="text-[9px] text-slate-500 block mb-1">보완 요청 이유</span><div className="flex flex-wrap gap-1">{RETURN_REASONS.map(r => { const isActive = state.returnReasonCodes.includes(r.code); return <button key={r.code} type="button" disabled={isDecided} onClick={() => toggleReason(r.code, "return")} className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isActive ? "bg-amber-600/15 border-amber-500/30 text-amber-400" : "border-bd/40 text-slate-500"}`}>{r.label}</button>; })}</div></div>}
          {state.decisionMode === "reject" && <div><span className="text-[9px] text-slate-500 block mb-1">반려 이유</span><div className="flex flex-wrap gap-1">{REJECT_REASONS.map(r => { const isActive = state.rejectReasonCodes.includes(r.code); return <button key={r.code} type="button" disabled={isDecided} onClick={() => toggleReason(r.code, "reject")} className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isActive ? "bg-red-600/10 border-red-500/20 text-red-400" : "border-bd/40 text-slate-500"}`}>{r.label}</button>; })}</div></div>}
          {/* D. Impact Preview */}
          {state.decisionMode && <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block mb-0.5">다음 단계 예고</span><span className="text-[10px] text-slate-300">{state.decisionMode === "approve" ? "PO Conversion Entry로 이동" : state.decisionMode === "return_for_revision" ? "Compare Review / Request Reopen으로 복귀" : "승인 chain 종료"}</span></div>}
          {validation && validation.blockingIssues.length > 0 && !isDecided && validation.blockingIssues.map((b, i) => <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
          {isDecided && <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">승인 판단 완료 — {state.decisionMode === "approve" ? "승인됨" : state.decisionMode === "return_for_revision" ? "보완 요청됨" : "반려됨"}</span></div></div>}
        </div>
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5"><span className="text-slate-500">{validation?.recommendedNextAction || ""}</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}><ArrowLeft className="h-3 w-3 mr-1" />닫기</Button>
            {!isDecided ? <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${state.decisionMode === "approve" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : state.decisionMode === "return_for_revision" ? "bg-amber-600 hover:bg-amber-500 text-white" : state.decisionMode === "reject" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={confirmDecision} disabled={!state.decisionMode || (state.decisionMode === "approve" && !validation?.canApprove) || (state.decisionMode === "return_for_revision" && !validation?.canReturn) || (state.decisionMode === "reject" && !validation?.canReject)}>{state.decisionMode === "approve" ? <><ShieldCheck className="h-3 w-3 mr-1" />승인 확정</> : state.decisionMode === "return_for_revision" ? <><RotateCcw className="h-3 w-3 mr-1" />보완 요청</> : state.decisionMode === "reject" ? <><Ban className="h-3 w-3 mr-1" />반려</> : "결정 모드 선택"}</Button> : <div className="flex-1 text-center text-[10px] text-emerald-400 py-2">판단 완료 — {state.nextDestination}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

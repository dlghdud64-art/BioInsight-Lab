"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, ArrowRight, ArrowLeft, FileText, Building2, RefreshCw, Pencil } from "lucide-react";
import { type RequestReopenState, type RequestReopenObject, createInitialRequestReopenState, buildRequestReopenVendorTargetPlan, buildRequestReopenLinePlan, validateRequestReopenBeforeRecord, buildRequestReopenObject } from "@/lib/ai/request-reopen-engine";
import type { RequestReopenFromCompareHandoff } from "@/lib/ai/compare-reopen-engine";

interface RequestReopenWorkbenchProps {
  open: boolean; onClose: () => void; handoff: RequestReopenFromCompareHandoff | null;
  onReopenRecorded: (obj: RequestReopenObject) => void;
  onRequestSubmissionReopenHandoff: () => void;
  onReturnToCompareReopen: () => void;
}

export function RequestReopenWorkbench({ open, onClose, handoff, onReopenRecorded, onRequestSubmissionReopenHandoff, onReturnToCompareReopen }: RequestReopenWorkbenchProps) {
  const [reopenState, setReopenState] = useState<RequestReopenState | null>(null);
  const [reopenObject, setReopenObject] = useState<RequestReopenObject | null>(null);

  useMemo(() => { if (open && handoff && !reopenState) setReopenState(createInitialRequestReopenState(handoff)); }, [open, handoff]); // eslint-disable-line

  const vendorPlan = useMemo(() => reopenState ? buildRequestReopenVendorTargetPlan(reopenState) : null, [reopenState]);
  const linePlan = useMemo(() => reopenState ? buildRequestReopenLinePlan(reopenState) : null, [reopenState]);
  const validation = useMemo(() => reopenState ? validateRequestReopenBeforeRecord(reopenState) : null, [reopenState]);

  // handoff 기반 vendor carry-forward 초안 자동 적용
  useMemo(() => {
    if (reopenState && handoff && reopenState.reusedVendorTargetIds.length === 0 && reopenState.addedVendorTargetIds.length === 0 && handoff.requestCandidateIds.length > 0) {
      setReopenState(prev => prev ? {
        ...prev,
        reusedVendorTargetIds: handoff.requestCandidateIds.slice(0, Math.min(handoff.requestCandidateIds.length, 3)),
        reusedRequestLineIds: handoff.requestCandidateIds,
        missingDecisionCount: 0,
        substatus: "awaiting_condition_delta_review",
      } : prev);
    }
  }, [reopenState?.requestReopenStatus, handoff]); // eslint-disable-line

  const recordReopen = useCallback(() => {
    if (!reopenState || !validation?.canRecordRequestReopen) return;
    const obj = buildRequestReopenObject(reopenState);
    setReopenObject(obj); onReopenRecorded(obj);
    setReopenState(prev => prev ? { ...prev, requestReopenStatus: "request_reopen_recorded", requestReopenObjectId: obj.id } : prev);
  }, [reopenState, validation, onReopenRecorded]);

  if (!open || !reopenState || !handoff) return null;
  const isRecorded = !!reopenObject;
  const totalVendors = reopenState.reusedVendorTargetIds.length + reopenState.addedVendorTargetIds.length;
  const totalLines = reopenState.reusedRequestLineIds.length + reopenState.rewrittenRequestLineIds.length;

  return (
    <div className="flex flex-col h-full bg-[#1C2028]">
      {/* ── Decision Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33] shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-emerald-600/15 border-emerald-500/25"}`}>
            {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <FileText className="h-4 w-4 text-emerald-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Request Reopen 완료" : "Request Reopen"}</h2>
            <div className="flex items-center gap-2 text-[10px] mt-0.5">
              <span className="text-slate-400">Vendor <span className="text-slate-200 font-medium">{totalVendors || "—"}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Lines <span className="text-slate-200 font-medium">{totalLines || "—"}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Candidates <span className="text-blue-300 font-medium">{reopenState.requestCandidateIds.length}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Center Decision Surface ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Compare basis */}
        <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
          <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Compare Reopen 근거</span>
          <span className="text-[10px] text-blue-200">Shortlist: {handoff.shortlistIds.length}개 · Request: {handoff.requestCandidateIds.length}개 · Baseline: {handoff.baselineReuseSummary}</span>
        </div>

        {/* Vendor target */}
        <div>
          <div className="flex items-center gap-1.5 mb-2"><Building2 className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Vendor Target Reopen</span></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">재사용</span><span className="text-lg font-bold text-emerald-400">{reopenState.reusedVendorTargetIds.length}</span></div>
            <div className="px-3 py-2.5 rounded-md border border-blue-500/20 bg-blue-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">추가</span><span className="text-lg font-bold text-blue-400">{reopenState.addedVendorTargetIds.length}</span></div>
            <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">제외</span><span className="text-lg font-bold text-slate-500">{reopenState.excludedVendorTargetIds.length}</span></div>
          </div>
        </div>

        {/* Request line */}
        <div>
          <div className="flex items-center gap-1.5 mb-2"><Pencil className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Request Line Reuse / Rewrite</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`px-3 py-2.5 rounded-md border ${reopenState.reusedRequestLineIds.length > 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"} text-center`}><span className="text-[9px] text-slate-500 block">재사용</span><span className={`text-lg font-bold ${reopenState.reusedRequestLineIds.length > 0 ? "text-emerald-400" : "text-slate-600"}`}>{reopenState.reusedRequestLineIds.length}</span></div>
            <div className={`px-3 py-2.5 rounded-md border ${reopenState.rewrittenRequestLineIds.length > 0 ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-bd/40 bg-[#252A33]"} text-center`}><span className="text-[9px] text-slate-500 block">재작성</span><span className={`text-lg font-bold ${reopenState.rewrittenRequestLineIds.length > 0 ? "text-amber-400" : "text-slate-600"}`}>{reopenState.rewrittenRequestLineIds.length}</span></div>
          </div>
        </div>

        {/* Condition delta */}
        <div>
          <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Condition Delta</span>
          <div className="mt-2 px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
            <span className="text-[10px] text-slate-300">{reopenState.requestConditionDeltaSummary || "미정의 — 조건 변경 사항을 지정하세요"}</span>
          </div>
        </div>

        {/* Blocker summary */}
        {vendorPlan && vendorPlan.blockingIssues.length > 0 && !isRecorded && vendorPlan.blockingIssues.map((b, i) => (
          <div key={`vb-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
        ))}
        {linePlan && linePlan.blockingIssues.length > 0 && !isRecorded && linePlan.blockingIssues.map((b, i) => (
          <div key={`lb-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
        ))}

        {isRecorded && (
          <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
            <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Request Reopen 저장 완료</span></div>
            <span className="text-[10px] text-slate-400 block mt-1">Request Submission Reopen으로 진행하여 요청을 다시 제출할 수 있습니다.</span>
          </div>
        )}
      </div>

      {/* ── Sticky Dock ── */}
      <div className="px-5 py-3 border-t border-bd bg-[#181E28] shrink-0">
        <div className="flex items-center gap-3 text-[10px] mb-2.5">
          <span className="text-slate-500">Vendor <span className="text-slate-300 font-medium">{totalVendors}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">Lines <span className="text-slate-300 font-medium">{totalLines}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToCompareReopen}><ArrowLeft className="h-3 w-3 mr-1" />Compare Reopen</Button>
          {!isRecorded ? (
            <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={recordReopen} disabled={!validation?.canRecordRequestReopen}><FileText className="h-3 w-3 mr-1" />Request Reopen 저장</Button>
          ) : (
            <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenRequestSubmissionReopen ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onRequestSubmissionReopenHandoff} disabled={!validation?.canOpenRequestSubmissionReopen}>
              <RefreshCw className="h-3 w-3 mr-1" />Request Submission Reopen<ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

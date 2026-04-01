"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, ArrowRight, ArrowLeft, Send, Building2, FileText, RefreshCw, ShieldAlert } from "lucide-react";
import { type RequestSubmissionReopenState, type RequestResubmissionEvent, createInitialRequestSubmissionReopenState, evaluateRequestResubmissionGuards, validateRequestSubmissionReopenBeforeRecord, buildRequestResubmissionEvent, buildQuoteManagementReentryHandoff } from "@/lib/ai/request-submission-reopen-engine";
import type { RequestSubmissionReopenHandoff } from "@/lib/ai/request-reopen-engine";

interface RequestSubmissionReopenWorkbenchProps {
  open: boolean; onClose: () => void; handoff: RequestSubmissionReopenHandoff | null;
  onResubmissionRecorded: (event: RequestResubmissionEvent) => void;
  onQuoteManagementReentryHandoff: () => void;
  onReturnToRequestReopen: () => void;
}

export function RequestSubmissionReopenWorkbench({ open, onClose, handoff, onResubmissionRecorded, onQuoteManagementReentryHandoff, onReturnToRequestReopen }: RequestSubmissionReopenWorkbenchProps) {
  const [reopenState, setReopenState] = useState<RequestSubmissionReopenState | null>(null);
  const [resubmissionEvent, setResubmissionEvent] = useState<RequestResubmissionEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => { if (open && handoff && !reopenState) setReopenState(createInitialRequestSubmissionReopenState(handoff)); }, [open, handoff]); // eslint-disable-line

  const guards = useMemo(() => reopenState ? evaluateRequestResubmissionGuards(reopenState) : null, [reopenState]);
  const validation = useMemo(() => reopenState && handoff ? validateRequestSubmissionReopenBeforeRecord(reopenState, handoff) : null, [reopenState, handoff]);

  const executeResubmission = useCallback(() => {
    if (!reopenState || !handoff || !validation?.canRecordRequestResubmission) return;
    setIsSubmitting(true);
    const event = buildRequestResubmissionEvent(reopenState, handoff);
    setResubmissionEvent(event); onResubmissionRecorded(event);
    setReopenState(prev => prev ? { ...prev, requestSubmissionReopenStatus: "request_resubmission_recorded", substatus: "ready_for_quote_management_reentry", requestResubmissionEventId: event.id } : prev);
    setIsSubmitting(false);
  }, [reopenState, handoff, validation, onResubmissionRecorded]);

  if (!open || !reopenState || !handoff) return null;
  const isRecorded = !!resubmissionEvent;

  return (
    <div className="flex flex-col h-full bg-[#1C2028]">
      {/* ── Decision Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33] shrink-0">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
            {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Send className="h-4 w-4 text-orange-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Resubmission 완료" : "Request Submission Reopen"}</h2>
            <div className="flex items-center gap-2 text-[10px] mt-0.5">
              <span className="text-slate-400">Vendor <span className="text-slate-200 font-medium">{reopenState.finalVendorTargetCount}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Lines <span className="text-slate-200 font-medium">{reopenState.reusedRequestLineCount + reopenState.rewrittenRequestLineCount}</span></span>
              <span className="text-slate-600">·</span>
              {isRecorded ? <span className="text-emerald-400 font-medium">재제출 완료</span> : validation?.canRecordRequestResubmission ? <span className="text-blue-400 font-medium">재제출 가능</span> : <span className="text-red-400 font-medium">차단됨</span>}
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Reopen basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Request Reopen 근거</span>
            <span className="text-[10px] text-blue-200">Vendor: 재사용 {handoff.reusedVendorTargetIds.length} + 추가 {handoff.addedVendorTargetIds.length} · Lines: 재사용 {handoff.reusedRequestLineIds.length} + 재작성 {handoff.rewrittenRequestLineIds.length}</span>
          </div>

          {/* Final vendor */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Building2 className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Final Vendor Target</span></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">재사용</span><span className="text-lg font-bold text-emerald-400">{handoff.reusedVendorTargetIds.length}</span></div>
              <div className="px-3 py-2.5 rounded-md border border-blue-500/20 bg-blue-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">추가</span><span className="text-lg font-bold text-blue-400">{handoff.addedVendorTargetIds.length}</span></div>
            </div>
          </div>

          {/* Final line delta */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><FileText className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Final Line Delta</span></div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${handoff.reusedRequestLineIds.length > 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"} text-center`}><span className="text-[9px] text-slate-500 block">재사용</span><span className={`text-lg font-bold ${handoff.reusedRequestLineIds.length > 0 ? "text-emerald-400" : "text-slate-600"}`}>{handoff.reusedRequestLineIds.length}</span></div>
              <div className={`px-3 py-2.5 rounded-md border ${handoff.rewrittenRequestLineIds.length > 0 ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-bd/40 bg-[#252A33]"} text-center`}><span className="text-[9px] text-slate-500 block">재작성</span><span className={`text-lg font-bold ${handoff.rewrittenRequestLineIds.length > 0 ? "text-amber-400" : "text-slate-600"}`}>{handoff.rewrittenRequestLineIds.length}</span></div>
            </div>
          </div>

          {/* Condition delta */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Condition Delta</span>
            <div className="mt-2 px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
              <span className="text-[10px] text-slate-300">{handoff.requestConditionDeltaSummary || "Delta 없음"}</span>
            </div>
          </div>

          {/* Guards */}
          {guards && (guards.blockingIssues.length > 0 || guards.warnings.length > 0) && !isRecorded && (
            <div className="space-y-1">
              {guards.blockingIssues.map((b, i) => <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><ShieldAlert className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
              {guards.warnings.map((w, i) => <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>)}
            </div>
          )}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Request Resubmission 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Quote Management Re-entry로 진행하여 견적 응답 관리를 다시 시작할 수 있습니다. 이후 견적 정리 → 비교 → PO → 입고 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

      {/* ── Sticky Dock ── */}
      <div className="px-5 py-3 border-t border-bd bg-[#181E28] shrink-0">
        <div className="flex items-center gap-3 text-[10px] mb-2.5">
          <span className="text-slate-500">Vendor <span className="text-slate-300 font-medium">{reopenState.finalVendorTargetCount}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">Lines <span className="text-slate-300 font-medium">{reopenState.reusedRequestLineCount + reopenState.rewrittenRequestLineCount}</span></span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
        </div>
        <div className="flex gap-2">
          {!isRecorded ? (
            <>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToRequestReopen}><ArrowLeft className="h-3 w-3 mr-1" />Request Reopen</Button>
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-medium" onClick={executeResubmission} disabled={!validation?.canRecordRequestResubmission || isSubmitting}>
                {isSubmitting ? "재제출 중..." : <><Send className="h-3 w-3 mr-1" />Request Resubmission</>}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToRequestReopen}><ArrowLeft className="h-3 w-3 mr-1" />Request Reopen</Button>
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onQuoteManagementReentryHandoff}>
                <RefreshCw className="h-3 w-3 mr-1" />Quote Management Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

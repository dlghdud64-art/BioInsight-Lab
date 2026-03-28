"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Send, Mail, Paperclip, ShieldAlert } from "lucide-react";
import { type SendConfirmationReentryState, type DispatchReexecutionEvent, createInitialSendConfirmationReentryState, evaluateSendConfirmationReentryGuards, validateSendConfirmationReentryBeforeRecord, buildDispatchReexecutionEvent, buildPoSentReentryTrackingHandoff } from "@/lib/ai/send-confirmation-reentry-engine";
import type { SendConfirmationReentryHandoff } from "@/lib/ai/dispatch-preparation-reentry-engine";

interface SendConfirmationReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: SendConfirmationReentryHandoff | null;
  onReexecutionRecorded: (event: DispatchReexecutionEvent) => void;
  onPoSentReentryTrackingHandoff: () => void;
  onReturnToDispatchPrepReentry: () => void;
}

export function SendConfirmationReentryWorkbench({ open, onClose, handoff, onReexecutionRecorded, onPoSentReentryTrackingHandoff, onReturnToDispatchPrepReentry }: SendConfirmationReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<SendConfirmationReentryState | null>(null);
  const [reexecEvent, setReexecEvent] = useState<DispatchReexecutionEvent | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialSendConfirmationReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const guards = useMemo(() => reentryState ? evaluateSendConfirmationReentryGuards(reentryState) : null, [reentryState]);
  const validation = useMemo(() => reentryState ? validateSendConfirmationReentryBeforeRecord(reentryState) : null, [reentryState]);

  const executeResend = useCallback(() => {
    if (!reentryState || !validation?.canRecordDispatchReexecution) return;
    setIsExecuting(true);
    const event = buildDispatchReexecutionEvent(reentryState);
    setReexecEvent(event); onReexecutionRecorded(event);
    setReentryState(prev => prev ? { ...prev, sendConfirmationReentryStatus: "dispatch_reexecution_recorded", substatus: "ready_for_sent_reentry_tracking", dispatchReexecutionEventId: event.id } : prev);
    setIsExecuting(false);
  }, [reentryState, validation, onReexecutionRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!reexecEvent;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Send className="h-4 w-4 text-orange-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "재발송 완료" : "Send Confirmation Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Recipient <span className="text-slate-200 font-medium">{reentryState.finalRecipient || "미지정"}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Channel <span className="text-slate-200 font-medium">{reentryState.finalChannel}</span></span>
                <span className="text-slate-600">·</span>
                {isRecorded ? <span className="text-emerald-400">재발송됨</span> : validation?.canRecordDispatchReexecution ? <span className="text-blue-400">발송 가능</span> : <span className="text-red-400">차단됨</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Dispatch prep basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Dispatch Prep Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Recipient: {handoff.recipientRevalidationSummary} · Payload: {handoff.outboundPayloadDeltaSummary} · Bridge: {handoff.sendCriticalBridgeSummary}</span>
          </div>

          {/* Final recipient */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Mail className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Final Recipient</span></div>
            <div className={`px-3 py-2.5 rounded-md border ${reentryState.finalRecipient ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
              <span className="text-[11px] text-slate-200 font-medium">{reentryState.finalRecipient || "미지정"}</span>
              <span className="text-[9px] text-slate-500 block">채널: {reentryState.finalChannel}</span>
            </div>
          </div>

          {/* Payload + Attachment */}
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
              <span className="text-[9px] text-slate-500 block mb-0.5">Payload</span>
              <span className="text-[10px] text-slate-300">{reentryState.finalPayloadSummary || "—"}</span>
            </div>
            <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
              <div className="flex items-center gap-1 mb-0.5"><Paperclip className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">첨부</span></div>
              <span className="text-[10px] text-slate-200 font-medium">{reentryState.attachmentBundleCount}개</span>
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
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Dispatch Re-execution 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">PO Sent Re-entry Tracking으로 진행하여 공급사 응답을 다시 추적할 수 있습니다. 이후 Supplier Confirmation → Receiving → 재고 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Recipient <span className="text-slate-300 font-medium">{reentryState.finalRecipient || "—"}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            {!isRecorded ? (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToDispatchPrepReentry}><ArrowLeft className="h-3 w-3 mr-1" />Dispatch Prep Re</Button>
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-medium" onClick={executeResend} disabled={!validation?.canRecordDispatchReexecution || isExecuting}>
                  {isExecuting ? "재발송 중..." : <><Send className="h-3 w-3 mr-1" />Dispatch Re-execution</>}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>닫기</Button>
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onPoSentReentryTrackingHandoff}>
                  <Mail className="h-3 w-3 mr-1" />PO Sent Re-entry Tracking<ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

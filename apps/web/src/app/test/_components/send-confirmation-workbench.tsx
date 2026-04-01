"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Send, Mail, Paperclip, Shield, Building2 } from "lucide-react";
import { type SendConfirmationState, type DispatchExecutionEvent, type PoSentDetailHandoff, createInitialSendConfirmationState, evaluateDispatchExecutionGuards, validateDispatchExecutionBeforeRecord, buildDispatchExecutionEvent, buildPoSentDetailHandoff } from "@/lib/ai/send-confirmation-engine";
import type { SendConfirmationHandoff } from "@/lib/ai/dispatch-preparation-engine";

interface SendConfirmationWorkbenchProps {
  open: boolean; onClose: () => void; handoff: SendConfirmationHandoff | null;
  onExecutionRecorded: (event: DispatchExecutionEvent) => void;
  onPoSentDetailHandoff: (h: PoSentDetailHandoff) => void;
  onReturnToPreparation: () => void;
}

export function SendConfirmationWorkbench({ open, onClose, handoff, onExecutionRecorded, onPoSentDetailHandoff, onReturnToPreparation }: SendConfirmationWorkbenchProps) {
  const [confirmState, setConfirmState] = useState<SendConfirmationState | null>(null);
  const [executionEvent, setExecutionEvent] = useState<DispatchExecutionEvent | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useMemo(() => { if (open && handoff && !confirmState) setConfirmState(createInitialSendConfirmationState(handoff)); }, [open, handoff]); // eslint-disable-line

  const guards = useMemo(() => confirmState ? evaluateDispatchExecutionGuards(confirmState) : null, [confirmState]);
  const validation = useMemo(() => confirmState ? validateDispatchExecutionBeforeRecord(confirmState) : null, [confirmState]);

  const executeDispatch = useCallback(async () => {
    if (!confirmState || !validation?.canRecordDispatchExecution) return;
    setIsExecuting(true);
    const event = buildDispatchExecutionEvent(confirmState);
    setExecutionEvent(event); onExecutionRecorded(event);
    setConfirmState(prev => prev ? { ...prev, sendConfirmationStatus: "dispatch_executed_recorded", substatus: "sent_to_tracking_handoff_ready", dispatchExecutionEventId: event.id } : prev);
    setIsExecuting(false);
  }, [confirmState, validation, onExecutionRecorded]);

  const handleSentDetail = useCallback(() => { if (executionEvent) onPoSentDetailHandoff(buildPoSentDetailHandoff(executionEvent)); }, [executionEvent, onPoSentDetailHandoff]);

  if (!open || !confirmState || !handoff) return null;
  const isExecuted = !!executionEvent;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isExecuted ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
              {isExecuted ? <Check className="h-4 w-4 text-emerald-400" /> : <Send className="h-4 w-4 text-orange-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isExecuted ? "발송 완료" : "Send Confirmation"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">수신자: <span className="text-slate-200 font-medium">{confirmState.primaryRecipient}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">채널: <span className="text-slate-200 font-medium">{confirmState.sendChannel}</span></span>
                <span className="text-slate-600">·</span>
                {isExecuted ? <span className="text-emerald-400 font-medium">발송됨</span> : validation?.canRecordDispatchExecution ? <span className="text-blue-400 font-medium">발송 가능</span> : <span className="text-red-400 font-medium">차단됨</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Final Recipient */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">최종 수신자 확인</span>
            <div className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03]">
              <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <div className="flex-1"><span className="text-[11px] text-slate-200 font-medium">{confirmState.primaryRecipient}</span><span className="text-[9px] text-slate-500 block">채널: {confirmState.sendChannel}</span></div>
              <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            </div>
          </div>

          {/* Final Payload */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">최종 Payload 확인</span>
            <div className="mt-2 px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33]">
              <span className="text-[9px] text-slate-500 block mb-0.5">발송 내용 요약</span>
              <span className="text-[10px] text-slate-200">{confirmState.outboundSummary || "—"}</span>
            </div>
          </div>

          {/* Attachment */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">첨부 확인</span>
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
              <Paperclip className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] text-slate-300">{confirmState.attachmentBundleSummary}</span>
            </div>
          </div>

          {/* Guards */}
          {guards && (guards.blockingIssues.length > 0 || guards.warnings.length > 0) && !isExecuted && (
            <div className="space-y-1">
              {guards.blockingIssues.map((b, i) => <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
              {guards.warnings.map((w, i) => <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>)}
            </div>
          )}

          {isExecuted && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15 space-y-1">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">PO가 공급사에 발송되었습니다</span></div>
              <span className="text-[10px] text-slate-400">PO Sent Detail에서 공급사 확인 상태를 추적할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">수신자 <span className="text-slate-300 font-medium">{confirmState.primaryRecipient}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            {!isExecuted ? (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToPreparation}><ArrowLeft className="h-3 w-3 mr-1" />Dispatch Prep로</Button>
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-medium" onClick={executeDispatch} disabled={!validation?.canRecordDispatchExecution || isExecuting}>
                  {isExecuting ? "발송 중..." : <><Send className="h-3 w-3 mr-1" />발송 실행</>}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>닫기</Button>
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={handleSentDetail}><Mail className="h-3 w-3 mr-1" />PO Sent Detail<ArrowRight className="h-3 w-3 ml-1" /></Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

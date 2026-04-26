"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Mail, Clock, Building2, Shield, RefreshCw, Package } from "lucide-react";
import { type PoSentTrackingState, type SupplierAcknowledgmentObject, createInitialPoSentTrackingState, evaluateSupplierAcknowledgmentState, evaluateSentNextStepReadiness, validateSupplierAcknowledgmentBeforeRecord, buildSupplierAcknowledgmentObject, buildSupplierConfirmationHandoff } from "@/lib/ai/po-sent-tracking-engine";
import type { PoSentDetailHandoff } from "@/lib/ai/send-confirmation-engine";
import type { AcknowledgmentStatus } from "@/lib/ai/po-sent-tracking-engine";

const ACK_LABELS: Record<AcknowledgmentStatus, { label: string; color: string }> = {
  no_response: { label: "응답 없음", color: "text-slate-500" },
  acknowledgment_received: { label: "확인 완료", color: "text-emerald-400" },
  partial_acknowledgment: { label: "부분 확인", color: "text-amber-400" },
  clarification_required: { label: "확인 필요", color: "text-orange-400" },
  issue_raised: { label: "이슈 제기", color: "text-red-400" },
  resend_suggested: { label: "재발송 권장", color: "text-red-400" },
};

interface PoSentTrackingWorkbenchProps {
  open: boolean; onClose: () => void; handoff: PoSentDetailHandoff | null;
  onAcknowledgmentRecorded: (obj: SupplierAcknowledgmentObject) => void;
  onSupplierConfirmation: () => void;
  onReturnToSendConfirmation: () => void;
}

export function PoSentTrackingWorkbench({ open, onClose, handoff, onAcknowledgmentRecorded, onSupplierConfirmation, onReturnToSendConfirmation }: PoSentTrackingWorkbenchProps) {
  const [trackingState, setTrackingState] = useState<PoSentTrackingState | null>(null);
  const [ackObject, setAckObject] = useState<SupplierAcknowledgmentObject | null>(null);

  useMemo(() => { if (open && handoff && !trackingState) setTrackingState(createInitialPoSentTrackingState(handoff)); }, [open, handoff]); // eslint-disable-line

  const ackEval = useMemo(() => trackingState ? evaluateSupplierAcknowledgmentState(trackingState) : null, [trackingState]);
  const nextStep = useMemo(() => trackingState ? evaluateSentNextStepReadiness(trackingState) : null, [trackingState]);
  const validation = useMemo(() => trackingState ? validateSupplierAcknowledgmentBeforeRecord(trackingState) : null, [trackingState]);

  const simulateAck = useCallback(() => {
    setTrackingState(prev => prev ? { ...prev, acknowledgmentStatus: "acknowledgment_received", followupRequiredFlag: false, missingResponseCount: 0, substatus: "ready_for_supplier_confirmation" } : prev);
  }, []);

  const recordAck = useCallback(() => {
    if (!trackingState || !validation?.canRecordAcknowledgment) return;
    const obj = buildSupplierAcknowledgmentObject(trackingState);
    setAckObject(obj); onAcknowledgmentRecorded(obj);
    setTrackingState(prev => prev ? { ...prev, poSentTrackingStatus: "supplier_acknowledgment_recorded", supplierAcknowledgmentObjectId: obj.id } : prev);
  }, [trackingState, validation, onAcknowledgmentRecorded]);

  if (!open || !trackingState || !handoff) return null;
  const isRecorded = !!ackObject;
  const ackLabel = ACK_LABELS[trackingState.acknowledgmentStatus];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-sky-600/15 border-sky-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Mail className="h-4 w-4 text-sky-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Acknowledgment 저장됨" : "PO Sent Tracking"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">수신자: <span className="text-slate-200 font-medium">{trackingState.primaryRecipient}</span></span>
                <span className="text-slate-600">·</span>
                <span className={ackLabel.color}>{ackLabel.label}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Dispatch execution basis */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">발송 실행 요약</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">수신자</span><span className="text-[11px] text-slate-200 font-medium">{trackingState.primaryRecipient}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">채널</span><span className="text-[11px] text-slate-200 font-medium">{trackingState.sentChannel}</span></div>
            </div>
          </div>

          {/* Acknowledgment status */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">공급사 확인 상태</span>
            <div className={`mt-2 flex items-center gap-3 px-3 py-3 rounded-md border ${trackingState.acknowledgmentStatus === "acknowledgment_received" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : trackingState.acknowledgmentStatus === "no_response" ? "border-slate-700/40 bg-[#252A33]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${trackingState.acknowledgmentStatus === "acknowledgment_received" ? "bg-emerald-400" : trackingState.acknowledgmentStatus === "no_response" ? "bg-slate-500" : "bg-amber-400"}`} />
              <div className="flex-1">
                <span className={`text-[12px] font-semibold ${ackLabel.color}`}>{ackLabel.label}</span>
                {trackingState.followupRequiredFlag && <span className="text-[10px] text-amber-400 block mt-0.5">Follow-up 필요</span>}
              </div>
              {trackingState.acknowledgmentStatus === "no_response" && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20" onClick={simulateAck}>확인 시뮬레이션</Button>
              )}
            </div>
          </div>

          {/* Guards/warnings */}
          {ackEval && (ackEval.blockingIssues.length > 0 || ackEval.warnings.length > 0) && (
            <div className="space-y-1">
              {ackEval.blockingIssues.map((b, i) => <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
              {ackEval.warnings.map((w, i) => <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>)}
            </div>
          )}

          {/* Next step readiness */}
          {nextStep && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${nextStep.canOpenSupplierConfirmation ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Supplier Confirmation</span>
                {nextStep.canOpenSupplierConfirmation ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">대기 중</span>}
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${nextStep.canOpenReceivingPreparation ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Receiving Preparation</span>
                {nextStep.canOpenReceivingPreparation ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">대기 중</span>}
              </div>
            </div>
          )}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Supplier Acknowledgment 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Supplier Confirmation 또는 Receiving Preparation으로 진행할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className={ackLabel.color}>{ackLabel.label}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || nextStep?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToSendConfirmation}><ArrowLeft className="h-3 w-3 mr-1" />Send Confirmation</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-medium" onClick={recordAck} disabled={!validation?.canRecordAcknowledgment}><Shield className="h-3 w-3 mr-1" />Acknowledgment 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${nextStep?.canOpenSupplierConfirmation ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onSupplierConfirmation} disabled={!nextStep?.canOpenSupplierConfirmation}>
                <Package className="h-3 w-3 mr-1" />Supplier Confirmation<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

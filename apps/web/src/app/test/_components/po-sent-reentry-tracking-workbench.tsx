"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Mail, Clock, Shield, HelpCircle } from "lucide-react";
import { type PoSentReentryTrackingState, type SupplierAcknowledgmentReentryObject, type AckReentryStatus, createInitialPoSentReentryTrackingState, validateSupplierAcknowledgmentReentryBeforeRecord, buildSupplierAcknowledgmentReentryObject, buildSupplierConfirmationReentryHandoff } from "@/lib/ai/po-sent-reentry-tracking-engine";
import type { PoSentReentryTrackingHandoff } from "@/lib/ai/send-confirmation-reentry-engine";

const ACK_LABELS: Record<AckReentryStatus, { label: string; color: string }> = {
  no_response: { label: "응답 없음", color: "text-slate-500" },
  acknowledged: { label: "확인 완료", color: "text-emerald-400" },
  partial: { label: "부분 확인", color: "text-amber-400" },
  clarification_required: { label: "확인 필요", color: "text-orange-400" },
  issue_raised: { label: "이슈 제기", color: "text-red-400" },
};

interface PoSentReentryTrackingWorkbenchProps {
  open: boolean; onClose: () => void; handoff: PoSentReentryTrackingHandoff | null;
  onAcknowledgmentReentryRecorded: (obj: SupplierAcknowledgmentReentryObject) => void;
  onSupplierConfirmationReentryHandoff: () => void;
  onReturnToSendConfirmReentry: () => void;
}

export function PoSentReentryTrackingWorkbench({ open, onClose, handoff, onAcknowledgmentReentryRecorded, onSupplierConfirmationReentryHandoff, onReturnToSendConfirmReentry }: PoSentReentryTrackingWorkbenchProps) {
  const [trackingState, setTrackingState] = useState<PoSentReentryTrackingState | null>(null);
  const [ackObj, setAckObj] = useState<SupplierAcknowledgmentReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !trackingState) setTrackingState(createInitialPoSentReentryTrackingState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => trackingState ? validateSupplierAcknowledgmentReentryBeforeRecord(trackingState) : null, [trackingState]);

  const simulateAck = useCallback(() => {
    setTrackingState(prev => prev ? { ...prev, acknowledgmentReentryStatus: "acknowledged", followupRequiredFlag: false, responseFreshnessStatus: "fresh", missingDecisionCount: 0, substatus: "ready_for_supplier_confirmation_reentry" } : prev);
  }, []);

  const recordAck = useCallback(() => {
    if (!trackingState || !validation?.canRecordSupplierAcknowledgmentReentry) return;
    const obj = buildSupplierAcknowledgmentReentryObject(trackingState);
    setAckObj(obj); onAcknowledgmentReentryRecorded(obj);
    setTrackingState(prev => prev ? { ...prev, poSentReentryStatus: "supplier_acknowledgment_reentry_recorded", supplierAcknowledgmentReentryObjectId: obj.id } : prev);
  }, [trackingState, validation, onAcknowledgmentReentryRecorded]);

  if (!open || !trackingState || !handoff) return null;
  const isRecorded = !!ackObj;
  const ackLabel = ACK_LABELS[trackingState.acknowledgmentReentryStatus];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-sky-600/15 border-sky-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Mail className="h-4 w-4 text-sky-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Ack Re-entry 완료" : "PO Sent Re-entry Tracking"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Recipient: <span className="text-slate-200 font-medium">{handoff.finalRecipientSummary}</span></span>
                <span className="text-slate-600">·</span>
                <span className={ackLabel.color}>{ackLabel.label}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Re-execution basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Dispatch Re-execution 근거</span>
            <span className="text-[10px] text-blue-200">Recipient: {handoff.finalRecipientSummary} · Payload: {handoff.finalPayloadSummary} · Guard: {handoff.resendGuardSummary}</span>
          </div>

          {/* Acknowledgment status */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Acknowledgment 상태</span>
            <div className={`mt-2 flex items-center gap-3 px-3 py-3 rounded-md border ${trackingState.acknowledgmentReentryStatus === "acknowledged" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : trackingState.acknowledgmentReentryStatus === "no_response" ? "border-slate-700/40 bg-[#252729]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${trackingState.acknowledgmentReentryStatus === "acknowledged" ? "bg-emerald-400" : trackingState.acknowledgmentReentryStatus === "no_response" ? "bg-slate-500" : "bg-amber-400"}`} />
              <div className="flex-1">
                <span className={`text-[12px] font-semibold ${ackLabel.color}`}>{ackLabel.label}</span>
                {trackingState.followupRequiredFlag && <span className="text-[10px] text-amber-400 block mt-0.5">Follow-up 필요</span>}
                {trackingState.clarificationRequiredFlag && <span className="text-[10px] text-orange-400 block mt-0.5">Clarification 필요</span>}
              </div>
              {trackingState.acknowledgmentReentryStatus === "no_response" && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20" onClick={simulateAck}>확인 시뮬레이션</Button>
              )}
            </div>
          </div>

          {/* Prior overlap */}
          {(trackingState.priorSentOverlapCount > 0 || trackingState.priorAcknowledgmentConflictCount > 0) && (
            <div className="space-y-1">
              {trackingState.priorSentOverlapCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">이전 발송 overlap {trackingState.priorSentOverlapCount}건</span></div>}
              {trackingState.priorAcknowledgmentConflictCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><HelpCircle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">이전 acknowledgment 충돌 {trackingState.priorAcknowledgmentConflictCount}건</span></div>}
            </div>
          )}

          {/* Supplier Confirmation readiness */}
          <div className={`px-3 py-2.5 rounded-md border ${validation?.canOpenSupplierConfirmationReentry ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Supplier Confirmation Re-entry Readiness</span>
            {validation?.canOpenSupplierConfirmationReentry ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">{validation?.recommendedNextAction || "대기 중"}</span>}
          </div>

          {validation && validation.warnings.length > 0 && !isRecorded && validation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Supplier Acknowledgment Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Supplier Confirmation Re-entry로 진행하여 공급 조건 재확인을 시작할 수 있습니다. 이후 Receiving → 재고 → 재주문 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className={ackLabel.color}>{ackLabel.label}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToSendConfirmReentry}><ArrowLeft className="h-3 w-3 mr-1" />Send Confirm Re</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-medium" onClick={recordAck} disabled={!validation?.canRecordSupplierAcknowledgmentReentry}><Shield className="h-3 w-3 mr-1" />Ack Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenSupplierConfirmationReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onSupplierConfirmationReentryHandoff} disabled={!validation?.canOpenSupplierConfirmationReentry}>
                <Shield className="h-3 w-3 mr-1" />Supplier Confirm Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Truck, Mail, Paperclip, Shield } from "lucide-react";
import { type DispatchPreparationReentryState, type DispatchPreparationReentryObject, createInitialDispatchPrepReentryState, validateDispatchPrepReentryBeforeRecord, buildDispatchPreparationReentryObject, buildSendConfirmationReentryHandoff } from "@/lib/ai/dispatch-preparation-reentry-engine";
import type { DispatchPreparationReentryHandoff } from "@/lib/ai/po-created-reentry-engine";

interface DispatchPrepReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: DispatchPreparationReentryHandoff | null;
  onPrepRecorded: (obj: DispatchPreparationReentryObject) => void;
  onSendConfirmationReentryHandoff: () => void;
  onReturnToCreatedReentry: () => void;
}

export function DispatchPreparationReentryWorkbench({ open, onClose, handoff, onPrepRecorded, onSendConfirmationReentryHandoff, onReturnToCreatedReentry }: DispatchPrepReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<DispatchPreparationReentryState | null>(null);
  const [prepObj, setPrepObj] = useState<DispatchPreparationReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialDispatchPrepReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => reentryState ? validateDispatchPrepReentryBeforeRecord(reentryState) : null, [reentryState]);

  const simulateSetup = useCallback(() => {
    setReentryState(prev => prev ? { ...prev, primaryRecipient: "vendor@supplier.com", channelStatus: "confirmed", payloadDeltaStatus: "reviewed", sendCriticalFieldStatus: "ready", recipientCount: 1, missingDecisionCount: 0, substatus: "ready_for_send_confirmation_reentry" } : prev);
  }, []);

  const recordPrep = useCallback(() => {
    if (!reentryState || !validation?.canRecordDispatchPreparationReentry) return;
    const obj = buildDispatchPreparationReentryObject(reentryState);
    setPrepObj(obj); onPrepRecorded(obj);
    setReentryState(prev => prev ? { ...prev, dispatchPreparationReentryStatus: "dispatch_preparation_reentry_recorded", dispatchPreparationReentryObjectId: obj.id } : prev);
  }, [reentryState, validation, onPrepRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!prepObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-cyan-600/15 border-cyan-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Truck className="h-4 w-4 text-cyan-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Dispatch Prep Re-entry 완료" : "Dispatch Preparation Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Recipient <span className="text-slate-200 font-medium">{reentryState.recipientCount || "—"}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Channel <span className="text-slate-200 font-medium">{reentryState.channelStatus}</span></span>
                <span className="text-slate-600">·</span>
                {reentryState.sendCriticalFieldStatus === "ready" ? <span className="text-emerald-400">Send 준비</span> : <span className="text-amber-400">미완료</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Created re-entry basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">PO Created Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Line Delta: {handoff.createdLineDeltaSummary} · Operational: {handoff.createdOperationalDeltaSummary} · Bridge: {handoff.sendCriticalBridgeSummary}</span>
          </div>

          {/* Recipient */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Mail className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Recipient Revalidation</span></div>
            <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33]">
              <label className="text-[10px] text-slate-400 block mb-1">Primary Recipient</label>
              <Input placeholder="이메일 주소" value={reentryState.primaryRecipient} onChange={e => setReentryState(prev => prev ? { ...prev, primaryRecipient: e.target.value, recipientCount: e.target.value ? 1 : 0 } : prev)} className="h-7 text-[10px] bg-[#1C2028] border-bd/40" disabled={isRecorded} />
            </div>
          </div>

          {/* Payload & Attachment */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`px-3 py-2.5 rounded-md border ${reentryState.payloadDeltaStatus === "reviewed" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"} text-center`}>
              <span className="text-[9px] text-slate-500 block">Payload Delta</span>
              <span className={`text-[10px] font-medium ${reentryState.payloadDeltaStatus === "reviewed" ? "text-emerald-300" : "text-amber-300"}`}>{reentryState.payloadDeltaStatus === "reviewed" ? "검토 완료" : "미검토"}</span>
            </div>
            <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33] text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5"><Paperclip className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">첨부</span></div>
              <span className="text-[10px] text-slate-200 font-medium">{reentryState.attachmentBundleCount}개</span>
            </div>
          </div>

          {/* Send-critical bridge */}
          <div className={`px-3 py-2.5 rounded-md border ${reentryState.sendCriticalFieldStatus === "ready" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
            <div className="flex items-center gap-1.5 mb-0.5"><Shield className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">Send-Critical Bridge</span></div>
            {reentryState.sendCriticalFieldStatus === "ready" ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">Send 준비 완료</span></div> : <span className="text-[10px] text-amber-300">필드 완료 필요</span>}
          </div>

          {!reentryState.primaryRecipient && !isRecorded && (
            <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20" onClick={simulateSetup}>수신자 + 검토 시뮬레이션</Button>
          )}

          {validation && validation.warnings.length > 0 && !isRecorded && validation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Dispatch Preparation Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Send Confirmation Re-entry로 진행하여 재발송을 실행할 수 있습니다. 이후 Tracking → 입고 → 재고 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Recipient <span className="text-slate-300 font-medium">{reentryState.recipientCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToCreatedReentry}><ArrowLeft className="h-3 w-3 mr-1" />PO Created Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white font-medium" onClick={recordPrep} disabled={!validation?.canRecordDispatchPreparationReentry}><Truck className="h-3 w-3 mr-1" />Dispatch Prep Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenSendConfirmationReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onSendConfirmationReentryHandoff} disabled={!validation?.canOpenSendConfirmationReentry}>
                <Mail className="h-3 w-3 mr-1" />Send Confirmation Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

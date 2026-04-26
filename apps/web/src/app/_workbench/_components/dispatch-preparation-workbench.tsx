"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Truck, Mail, Paperclip, Building2, FileText } from "lucide-react";
import { type DispatchPreparationState, type DispatchPreparationObject, type SendConfirmationHandoff, createInitialDispatchPrepState, buildDispatchPrepReadiness, validateDispatchPrepBeforeRecord, buildDispatchPreparationObject, buildSendConfirmationHandoff } from "@/lib/ai/dispatch-preparation-engine";
import type { DispatchPreparationHandoff } from "@/lib/ai/po-created-engine";

interface DispatchPreparationWorkbenchProps {
  open: boolean; onClose: () => void; handoff: DispatchPreparationHandoff | null;
  onPrepRecorded: (obj: DispatchPreparationObject) => void;
  onSendConfirmationHandoff: (h: SendConfirmationHandoff) => void;
  onReturnToCreated: () => void;
}

export function DispatchPreparationWorkbench({ open, onClose, handoff, onPrepRecorded, onSendConfirmationHandoff, onReturnToCreated }: DispatchPreparationWorkbenchProps) {
  const [prepState, setPrepState] = useState<DispatchPreparationState | null>(null);
  const [prepObject, setPrepObject] = useState<DispatchPreparationObject | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [supplierNote, setSupplierNote] = useState("");

  useMemo(() => { if (open && handoff && !prepState) setPrepState(createInitialDispatchPrepState(handoff)); }, [open, handoff]); // eslint-disable-line

  const currentState = useMemo<DispatchPreparationState | null>(() => {
    if (!prepState) return null;
    const updated = { ...prepState, recipients: prepState.recipients.map((r, i) => i === 0 ? { ...r, email: recipientEmail, isValid: !!recipientEmail } : r), outboundPackage: { ...prepState.outboundPackage, supplierFacingNote: supplierNote } };
    return updated;
  }, [prepState, recipientEmail, supplierNote]);

  const readiness = useMemo(() => currentState ? buildDispatchPrepReadiness(currentState) : null, [currentState]);
  const validation = useMemo(() => currentState ? validateDispatchPrepBeforeRecord(currentState) : null, [currentState]);

  const recordPrep = useCallback(() => {
    if (!currentState || !validation?.canRecordDispatchPreparation) return;
    const obj = buildDispatchPreparationObject(currentState);
    setPrepObject(obj); onPrepRecorded(obj);
    setPrepState(prev => prev ? { ...prev, dispatchPreparationStatus: "dispatch_preparation_recorded", substatus: "ready_for_send_confirmation", dispatchPreparationObjectId: obj.id } : prev);
  }, [currentState, validation, onPrepRecorded]);

  const handleSendConfirm = useCallback(() => {
    if (!prepObject) return;
    onSendConfirmationHandoff(buildSendConfirmationHandoff(prepObject));
  }, [prepObject, onSendConfirmationHandoff]);

  if (!open || !prepState || !handoff) return null;
  const isRecorded = !!prepObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-cyan-600/15 border-cyan-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Truck className="h-4 w-4 text-cyan-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Dispatch 준비 완료" : "Dispatch Preparation"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">수신자 <span className="text-slate-200 font-medium">{prepState.recipients.length}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">첨부 <span className="text-slate-200 font-medium">{prepState.attachmentBundle.filter(a => a.included).length}</span></span>
                <span className="text-slate-600">·</span>
                {readiness?.isSendReady ? <span className="text-emerald-400 font-medium">Send 준비 완료</span> : <span className="text-amber-400">누락 {readiness?.sendCriticalMissing.length || 0}</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Recipient */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Mail className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">수신자</span></div>
            {prepState.recipients.map((r, i) => (
              <div key={r.recipientId} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33] mb-1">
                <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-slate-200 font-medium block">{r.displayName}</span>
                  <Input placeholder="이메일 주소" value={i === 0 ? recipientEmail : ""} onChange={e => i === 0 && setRecipientEmail(e.target.value)} className="mt-1 h-7 text-[10px] bg-[#1C2028] border-bd/40" disabled={isRecorded} />
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${recipientEmail ? "bg-emerald-600/10 text-emerald-400" : "bg-slate-700/50 text-slate-500"}`}>{recipientEmail ? "유효" : "미입력"}</span>
              </div>
            ))}
          </div>

          {/* Outbound */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><FileText className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">발송 내용</span></div>
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] mb-2">
              <span className="text-[9px] text-slate-500 block mb-0.5">PO 요약</span>
              <span className="text-[10px] text-slate-300">{prepState.outboundPackage.poSummary || "—"}</span>
            </div>
            <Input placeholder="공급사 전달 메모" value={supplierNote} onChange={e => setSupplierNote(e.target.value)} className="h-8 text-[11px] bg-[#1C2028] border-bd/40" disabled={isRecorded} />
          </div>

          {/* Attachment */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Paperclip className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">첨부</span></div>
            {prepState.attachmentBundle.map(att => (
              <div key={att.attachmentId} className={`flex items-center gap-3 px-3 py-2 rounded-md border mb-1 ${att.included ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                <Check className={`h-3 w-3 shrink-0 ${att.included ? "text-emerald-400" : "text-slate-600"}`} />
                <span className="text-[10px] text-slate-200">{att.name}</span>
                <span className="text-[9px] text-slate-500">{att.type === "po_document" ? "필수" : "선택"}</span>
              </div>
            ))}
          </div>

          {/* Readiness */}
          {readiness && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${readiness.sendCriticalMissing.length === 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-red-500/15 bg-red-600/[0.03]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Send-Critical</span>
                {readiness.sendCriticalMissing.length === 0 ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">완료</span></div> : <span className="text-[10px] text-red-300">누락: {readiness.sendCriticalMissing.join(", ")}</span>}
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${readiness.nonCriticalMissing.length === 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Non-Critical</span>
                {readiness.nonCriticalMissing.length === 0 ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">완료</span></div> : <span className="text-[10px] text-amber-300">선택: {readiness.nonCriticalMissing.join(", ")}</span>}
              </div>
            </div>
          )}

          {validation && validation.blockingIssues.length > 0 && !isRecorded && validation.blockingIssues.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Dispatch Preparation 저장 완료</span></div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">수신자 <span className="text-slate-300 font-medium">{prepState.recipients.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToCreated}><ArrowLeft className="h-3 w-3 mr-1" />PO Created로</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white font-medium" onClick={recordPrep} disabled={!validation?.canRecordDispatchPreparation}><Truck className="h-3 w-3 mr-1" />Dispatch Preparation 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenSendConfirmation ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={handleSendConfirm} disabled={!validation?.canOpenSendConfirmation}><Mail className="h-3 w-3 mr-1" />Send Confirmation<ArrowRight className="h-3 w-3 ml-1" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

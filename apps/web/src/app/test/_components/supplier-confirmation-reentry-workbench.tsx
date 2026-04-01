"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Shield, Clock, Package, HelpCircle } from "lucide-react";
import { type SupplierConfirmationReentryState, type SupplierConfirmationReentryObject, type ConfReentryFieldStatus, createInitialSupplierConfirmationReentryState, validateSupplierConfirmationReentryBeforeRecord, buildSupplierConfirmationReentryObject, buildReceivingPreparationReentryHandoff } from "@/lib/ai/supplier-confirmation-reentry-engine";
import type { SupplierConfirmationReentryHandoff } from "@/lib/ai/po-sent-reentry-tracking-engine";

const FIELD_LABELS: Record<ConfReentryFieldStatus, { label: string; color: string }> = { confirmed: { label: "확정", color: "text-emerald-400" }, partial: { label: "부분", color: "text-amber-400" }, unclear: { label: "미확인", color: "text-slate-500" }, not_available: { label: "불가", color: "text-red-400" } };

interface SupplierConfirmationReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: SupplierConfirmationReentryHandoff | null;
  onConfirmationRecorded: (obj: SupplierConfirmationReentryObject) => void;
  onReceivingPrepReentryHandoff: () => void;
  onReturnToSentTrackingReentry: () => void;
}

export function SupplierConfirmationReentryWorkbench({ open, onClose, handoff, onConfirmationRecorded, onReceivingPrepReentryHandoff, onReturnToSentTrackingReentry }: SupplierConfirmationReentryWorkbenchProps) {
  const [confState, setConfState] = useState<SupplierConfirmationReentryState | null>(null);
  const [confObj, setConfObj] = useState<SupplierConfirmationReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !confState) setConfState(createInitialSupplierConfirmationReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => confState ? validateSupplierConfirmationReentryBeforeRecord(confState) : null, [confState]);

  const simulateConfirm = useCallback(() => {
    setConfState(prev => prev ? { ...prev, confirmedQtyReentryStatus: "confirmed", confirmedEtaReentryStatus: "confirmed", confirmedCommercialReentryStatus: "confirmed", clarificationOpenCount: 0, missingDecisionCount: 0, substatus: "ready_for_receiving_preparation_reentry" } : prev);
  }, []);

  const recordConfirmation = useCallback(() => {
    if (!confState || !validation?.canRecordSupplierConfirmationReentry) return;
    const obj = buildSupplierConfirmationReentryObject(confState);
    setConfObj(obj); onConfirmationRecorded(obj);
    setConfState(prev => prev ? { ...prev, supplierConfirmationReentryStatus: "supplier_confirmation_reentry_recorded", supplierConfirmationReentryObjectId: obj.id } : prev);
  }, [confState, validation, onConfirmationRecorded]);

  if (!open || !confState || !handoff) return null;
  const isRecorded = !!confObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-purple-600/15 border-purple-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Shield className="h-4 w-4 text-purple-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Supplier Confirm Re-entry 완료" : "Supplier Confirmation Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Qty: <span className={FIELD_LABELS[confState.confirmedQtyReentryStatus].color}>{FIELD_LABELS[confState.confirmedQtyReentryStatus].label}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">ETA: <span className={FIELD_LABELS[confState.confirmedEtaReentryStatus].color}>{FIELD_LABELS[confState.confirmedEtaReentryStatus].label}</span></span>
                <span className="text-slate-600">·</span>
                {confState.clarificationOpenCount > 0 ? <span className="text-amber-400">Clarification {confState.clarificationOpenCount}</span> : <span className="text-emerald-400">해결됨</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Ack re-entry basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Ack Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Status: {handoff.acknowledgmentReentryStatus} · Follow-up: {handoff.followupRequiredSummary} · Freshness: {handoff.responseFreshnessSummary}</span>
          </div>

          {/* Confirmed terms */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">공급 조건 재확인</span>
            <div className="mt-2 space-y-1.5">
              {([
                { label: "수량", status: confState.confirmedQtyReentryStatus, icon: Package },
                { label: "납기 (ETA)", status: confState.confirmedEtaReentryStatus, icon: Clock },
                { label: "상업 조건", status: confState.confirmedCommercialReentryStatus, icon: Shield },
              ] as const).map(item => {
                const Icon = item.icon;
                const fl = FIELD_LABELS[item.status];
                return (
                  <div key={item.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${item.status === "confirmed" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : item.status === "not_available" ? "border-red-500/15 bg-red-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${fl.color}`} />
                    <div className="flex-1"><span className="text-[9px] text-slate-500 block">{item.label}</span><span className={`text-[11px] font-medium ${fl.color}`}>{fl.label}</span></div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.status === "confirmed" ? "bg-emerald-600/10 text-emerald-400" : item.status === "not_available" ? "bg-red-600/10 text-red-400" : "bg-slate-700/50 text-slate-500"}`}>{fl.label}</span>
                  </div>
                );
              })}
              {confState.confirmedQtyReentryStatus === "unclear" && (
                <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-1" onClick={simulateConfirm}>전량 확정 시뮬레이션</Button>
              )}
            </div>
          </div>

          {/* Overlap / clarification */}
          {(confState.priorConfirmationOverlapCount > 0 || confState.clarificationOpenCount > 0) && (
            <div className="space-y-1">
              {confState.priorConfirmationOverlapCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">이전 Confirmation overlap {confState.priorConfirmationOverlapCount}건</span></div>}
              {confState.clarificationOpenCount > 0 && <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><HelpCircle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">Clarification 미해결 {confState.clarificationOpenCount}건</span></div>}
            </div>
          )}

          {/* Receiving readiness */}
          <div className={`px-3 py-2.5 rounded-md border ${validation?.canOpenReceivingPreparationReentry ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Receiving Preparation Re-entry Readiness</span>
            {validation?.canOpenReceivingPreparationReentry ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">{validation?.recommendedNextAction || "대기 중"}</span>}
          </div>

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Supplier Confirmation Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Receiving Preparation Re-entry로 진행할 수 있습니다. 이후 Receiving Execution → Inventory Intake → Stock Release → Reorder Decision 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Qty <span className={FIELD_LABELS[confState.confirmedQtyReentryStatus].color}>{FIELD_LABELS[confState.confirmedQtyReentryStatus].label}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">ETA <span className={FIELD_LABELS[confState.confirmedEtaReentryStatus].color}>{FIELD_LABELS[confState.confirmedEtaReentryStatus].label}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToSentTrackingReentry}><ArrowLeft className="h-3 w-3 mr-1" />Sent Tracking Re</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-medium" onClick={recordConfirmation} disabled={!validation?.canRecordSupplierConfirmationReentry}><Shield className="h-3 w-3 mr-1" />Supplier Confirm Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenReceivingPreparationReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onReceivingPrepReentryHandoff} disabled={!validation?.canOpenReceivingPreparationReentry}>
                <Package className="h-3 w-3 mr-1" />Receiving Prep Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

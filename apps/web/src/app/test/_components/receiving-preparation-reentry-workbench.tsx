"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, Clock, MapPin, FileText } from "lucide-react";
import { type ReceivingPreparationReentryState, type ReceivingPreparationReentryObject, createInitialReceivingPrepReentryState, validateReceivingPrepReentryBeforeRecord, buildReceivingPreparationReentryObject, buildReceivingExecutionReentryHandoff } from "@/lib/ai/receiving-preparation-reentry-engine";
import type { ReceivingPreparationReentryHandoff } from "@/lib/ai/supplier-confirmation-reentry-engine";

interface ReceivingPrepReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ReceivingPreparationReentryHandoff | null;
  onPrepRecorded: (obj: ReceivingPreparationReentryObject) => void;
  onReceivingExecReentryHandoff: () => void;
  onReturnToSupplierConfirmReentry: () => void;
}

export function ReceivingPreparationReentryWorkbench({ open, onClose, handoff, onPrepRecorded, onReceivingExecReentryHandoff, onReturnToSupplierConfirmReentry }: ReceivingPrepReentryWorkbenchProps) {
  const [prepState, setPrepState] = useState<ReceivingPreparationReentryState | null>(null);
  const [prepObj, setPrepObj] = useState<ReceivingPreparationReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !prepState) setPrepState(createInitialReceivingPrepReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => prepState ? validateReceivingPrepReentryBeforeRecord(prepState) : null, [prepState]);

  const simulateReady = useCallback(() => {
    setPrepState(prev => prev ? { ...prev, expectedInboundWindowStatus: "confirmed", partialReceivingReentryStatus: "full", lotExpiryStorageReadinessStatus: "ready", documentReadinessStatus: "ready", confirmedLineCount: 2, missingDecisionCount: 0, substatus: "ready_for_receiving_execution_reentry" } : prev);
  }, []);

  const recordPrep = useCallback(() => {
    if (!prepState || !validation?.canRecordReceivingPreparationReentry) return;
    const obj = buildReceivingPreparationReentryObject(prepState);
    setPrepObj(obj); onPrepRecorded(obj);
    setPrepState(prev => prev ? { ...prev, receivingPreparationReentryStatus: "receiving_preparation_reentry_recorded", receivingPreparationReentryObjectId: obj.id } : prev);
  }, [prepState, validation, onPrepRecorded]);

  if (!open || !prepState || !handoff) return null;
  const isRecorded = !!prepObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-indigo-600/15 border-indigo-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-indigo-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Rcv Prep Re-entry 완료" : "Receiving Preparation Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Lines <span className="text-slate-200 font-medium">{prepState.confirmedLineCount}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Inbound <span className={prepState.expectedInboundWindowStatus === "confirmed" ? "text-emerald-300" : "text-amber-300"}>{prepState.expectedInboundWindowStatus}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Readiness <span className={prepState.lotExpiryStorageReadinessStatus === "ready" ? "text-emerald-300" : "text-amber-300"}>{prepState.lotExpiryStorageReadinessStatus}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Confirmation re-entry basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Supplier Confirm Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Qty: {handoff.confirmedQtyReentrySummary} · ETA: {handoff.confirmedEtaWindowSummary} · Commercial: {handoff.confirmedCommercialReentrySummary}</span>
          </div>

          {/* Inbound expectation */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Inbound Expectation</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className={`px-3 py-2 rounded-md border ${prepState.expectedInboundWindowStatus === "confirmed" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                <div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">Inbound Window</span></div>
                <span className={`text-[10px] font-medium ${prepState.expectedInboundWindowStatus === "confirmed" ? "text-emerald-300" : "text-amber-300"}`}>{prepState.expectedInboundWindowStatus}</span>
              </div>
              <div className={`px-3 py-2 rounded-md border ${prepState.partialReceivingReentryStatus === "full" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                <div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">Partial Receiving</span></div>
                <span className="text-[10px] font-medium text-slate-200">{prepState.partialReceivingReentryStatus}</span>
              </div>
            </div>
          </div>

          {/* Readiness checklist */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Readiness Checklist</span>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "Lot/Expiry/Storage", status: prepState.lotExpiryStorageReadinessStatus, icon: MapPin },
                { label: "입고 문서", status: prepState.documentReadinessStatus, icon: FileText },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`flex items-center gap-3 px-3 py-2 rounded-md border ${item.status === "ready" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : item.status === "blocked" ? "border-red-500/15 bg-red-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${item.status === "ready" ? "text-emerald-400" : item.status === "blocked" ? "text-red-400" : "text-amber-400"}`} />
                    <span className="text-[10px] text-slate-200 flex-1">{item.label}</span>
                    <span className={`text-[9px] ${item.status === "ready" ? "text-emerald-400" : item.status === "blocked" ? "text-red-400" : "text-amber-400"}`}>{item.status === "ready" ? "완료" : item.status === "blocked" ? "차단" : "미완료"}</span>
                  </div>
                );
              })}
              {prepState.lotExpiryStorageReadinessStatus !== "ready" && (
                <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-1" onClick={simulateReady}>준비 완료 시뮬레이션</Button>
              )}
            </div>
          </div>

          {/* Overlap */}
          {prepState.priorPreparationOverlapCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">이전 Preparation overlap {prepState.priorPreparationOverlapCount}건</span></div>
          )}

          {validation && validation.warnings.length > 0 && !isRecorded && validation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Receiving Preparation Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Receiving Execution Re-entry로 진행할 수 있습니다. 이후 Inventory Intake → Stock Release → Reorder Decision 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Inbound <span className={prepState.expectedInboundWindowStatus === "confirmed" ? "text-emerald-300" : "text-amber-300"}>{prepState.expectedInboundWindowStatus}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToSupplierConfirmReentry}><ArrowLeft className="h-3 w-3 mr-1" />Supplier Confirm Re</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium" onClick={recordPrep} disabled={!validation?.canRecordReceivingPreparationReentry}><Package className="h-3 w-3 mr-1" />Rcv Prep Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenReceivingExecutionReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onReceivingExecReentryHandoff} disabled={!validation?.canOpenReceivingExecutionReentry}>
                <Package className="h-3 w-3 mr-1" />Rcv Execution Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

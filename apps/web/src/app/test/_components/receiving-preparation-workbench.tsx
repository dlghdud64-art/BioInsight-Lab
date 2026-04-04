"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, Clock, MapPin } from "lucide-react";
import { type ReceivingPreparationState, type ReceivingPreparationObject, createInitialReceivingPreparationState, validateReceivingPreparationBeforeRecord, buildReceivingPreparationObject, buildReceivingExecutionHandoff } from "@/lib/ai/receiving-preparation-engine";
import type { ReceivingPrepFromConfirmationHandoff } from "@/lib/ai/supplier-confirmation-engine";

interface ReceivingPreparationWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ReceivingPrepFromConfirmationHandoff | null;
  onPrepRecorded: (obj: ReceivingPreparationObject) => void;
  onExecutionHandoff: () => void;
  onReturnToConfirmation: () => void;
}

export function ReceivingPreparationWorkbench({ open, onClose, handoff, onPrepRecorded, onExecutionHandoff, onReturnToConfirmation }: ReceivingPreparationWorkbenchProps) {
  const [prepState, setPrepState] = useState<ReceivingPreparationState | null>(null);
  const [prepObject, setPrepObject] = useState<ReceivingPreparationObject | null>(null);

  useMemo(() => { if (open && handoff && !prepState) setPrepState(createInitialReceivingPreparationState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => prepState ? validateReceivingPreparationBeforeRecord(prepState) : null, [prepState]);

  const simulateReady = useCallback(() => {
    setPrepState(prev => prev ? { ...prev, lotStorageReadiness: { ...prev.lotStorageReadiness, storageLocationAssigned: true, receivingDocReady: true }, substatus: "ready_for_receiving_execution" } : prev);
  }, []);

  const recordPrep = useCallback(() => {
    if (!prepState || !validation?.canRecordReceivingPreparation) return;
    const obj = buildReceivingPreparationObject(prepState);
    setPrepObject(obj); onPrepRecorded(obj);
    setPrepState(prev => prev ? { ...prev, receivingPreparationStatus: "receiving_preparation_recorded", receivingPreparationObjectId: obj.id } : prev);
  }, [prepState, validation, onPrepRecorded]);

  if (!open || !prepState || !handoff) return null;
  const isRecorded = !!prepObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-indigo-600/15 border-indigo-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-indigo-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Receiving Preparation 완료" : "Receiving Preparation"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">납기: <span className="text-slate-200 font-medium">{prepState.confirmedEtaWindow || "미확정"}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Qty: <span className="text-slate-200 font-medium">{prepState.confirmedQtySummary || "미확정"}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Expected inbound */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">예상 입고</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">도착 예정</span></div><span className="text-[11px] text-slate-200 font-medium">{prepState.confirmedEtaWindow || "미확정"}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">수량</span></div><span className="text-[11px] text-slate-200 font-medium">{prepState.confirmedQtySummary || "미확정"}</span></div>
            </div>
          </div>

          {/* Lot/Storage readiness */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">입고 준비 상태</span>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "Lot 추적", ready: true, icon: Package },
                { label: "유효기한 추적", ready: true, icon: Clock },
                { label: "보관 위치 지정", ready: prepState.lotStorageReadiness.storageLocationAssigned, icon: MapPin },
                { label: "입고 문서 준비", ready: prepState.lotStorageReadiness.receivingDocReady, icon: Package },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`flex items-center gap-3 px-3 py-2 rounded-md border ${item.ready ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${item.ready ? "text-emerald-400" : "text-amber-400"}`} />
                    <span className="text-[10px] text-slate-200 flex-1">{item.label}</span>
                    <span className={`text-[9px] ${item.ready ? "text-emerald-400" : "text-amber-400"}`}>{item.ready ? "완료" : "미완료"}</span>
                  </div>
                );
              })}
              {!prepState.lotStorageReadiness.storageLocationAssigned && (
                <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-1" onClick={simulateReady}>준비 완료 시뮬레이션</Button>
              )}
            </div>
          </div>

          {validation && validation.blockingIssues.length > 0 && !isRecorded && validation.blockingIssues.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Receiving Preparation 저장 완료</span></div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5"><span className="text-slate-500">{validation?.recommendedNextAction || ""}</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToConfirmation}><ArrowLeft className="h-3 w-3 mr-1" />Supplier Confirmation</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium" onClick={recordPrep} disabled={!validation?.canRecordReceivingPreparation}><Package className="h-3 w-3 mr-1" />Receiving Preparation 저장</Button>
            ) : (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onExecutionHandoff}><Package className="h-3 w-3 mr-1" />Receiving Execution<ArrowRight className="h-3 w-3 ml-1" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

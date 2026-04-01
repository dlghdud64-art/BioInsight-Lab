"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Clipboard, Package, Clock } from "lucide-react";
import { type ReceivingExecutionReentryState, type ReceivingExecutionReentryObject, createInitialReceivingExecReentryState, validateReceivingExecReentryBeforeRecord, buildReceivingExecutionReentryObject, buildInventoryIntakeReentryHandoff } from "@/lib/ai/receiving-execution-reentry-engine";
import type { ReceivingExecutionReentryHandoff } from "@/lib/ai/receiving-preparation-reentry-engine";

interface ReceivingExecReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ReceivingExecutionReentryHandoff | null;
  onExecRecorded: (obj: ReceivingExecutionReentryObject) => void;
  onInventoryIntakeReentryHandoff: () => void;
  onReturnToReceivingPrepReentry: () => void;
}

export function ReceivingExecutionReentryWorkbench({ open, onClose, handoff, onExecRecorded, onInventoryIntakeReentryHandoff, onReturnToReceivingPrepReentry }: ReceivingExecReentryWorkbenchProps) {
  const [execState, setExecState] = useState<ReceivingExecutionReentryState | null>(null);
  const [execObj, setExecObj] = useState<ReceivingExecutionReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !execState) setExecState(createInitialReceivingExecReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => execState ? validateReceivingExecReentryBeforeRecord(execState) : null, [execState]);

  const simulateReceipt = useCallback(() => {
    setExecState(prev => prev ? { ...prev, actualRereceiptQtySummary: "전량 재입고", actualReceivedLineCount: 2, expectedLineCount: 2, recaptureCompletenessStatus: "complete", missingDecisionCount: 0, substatus: "ready_for_inventory_intake_reentry" } : prev);
  }, []);

  const recordExec = useCallback(() => {
    if (!execState || !validation?.canRecordReceivingExecutionReentry) return;
    const obj = buildReceivingExecutionReentryObject(execState);
    setExecObj(obj); onExecRecorded(obj);
    setExecState(prev => prev ? { ...prev, receivingExecutionReentryStatus: "receiving_execution_reentry_recorded", receivingExecutionReentryObjectId: obj.id } : prev);
  }, [execState, validation, onExecRecorded]);

  if (!open || !execState || !handoff) return null;
  const isRecorded = !!execObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-rose-600/15 border-rose-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4 text-rose-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Rcv Exec Re-entry 완료" : "Receiving Execution Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Lines <span className="text-slate-200 font-medium">{execState.actualReceivedLineCount}/{execState.expectedLineCount}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Capture <span className={execState.recaptureCompletenessStatus === "complete" ? "text-emerald-300" : "text-amber-300"}>{execState.recaptureCompletenessStatus}</span></span>
                <span className="text-slate-600">·</span>
                {execState.partialRereceiptFlag ? <span className="text-amber-400">부분 입고</span> : execState.actualRereceiptQtySummary ? <span className="text-emerald-400">전량 입고</span> : <span className="text-slate-500">대기</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Prep re-entry basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Rcv Prep Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Inbound: {handoff.refreshedInboundExpectationSummary} · Partial: {handoff.partialReceivingRevalidationSummary} · Readiness: {handoff.lotExpiryStorageReadinessSummary}</span>
          </div>

          {/* Actual rereceipt */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Actual Rereceipt</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">입고 시점</span><span className={`text-[10px] font-medium ${execState.actualRereceiptQtySummary ? "text-slate-200" : "text-slate-600"}`}>{execState.actualRereceiptQtySummary ? "기록됨" : "미기록"}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">수량</span><span className={`text-[10px] font-medium ${execState.actualRereceiptQtySummary ? "text-slate-200" : "text-slate-600"}`}>{execState.actualRereceiptQtySummary || "미기록"}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">라인</span><span className="text-[10px] font-medium text-slate-200">{execState.actualReceivedLineCount}/{execState.expectedLineCount}</span></div>
            </div>
            {!execState.actualRereceiptQtySummary && (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateReceipt}>전량 재입고 시뮬레이션</Button>
            )}
          </div>

          {/* Recapture status */}
          <div className={`px-3 py-2.5 rounded-md border ${execState.recaptureCompletenessStatus === "complete" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Lot/Expiry/Storage/Document Recapture</span>
            {execState.recaptureCompletenessStatus === "complete" ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">전체 Capture 완료</span></div> : <span className="text-[10px] text-amber-300">Capture 미완료</span>}
          </div>

          {/* Overlap */}
          {execState.priorExecutionOverlapCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">이전 Execution overlap {execState.priorExecutionOverlapCount}건</span></div>
          )}

          {validation && validation.warnings.length > 0 && !isRecorded && validation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {/* Inventory Intake readiness */}
          <div className={`px-3 py-2.5 rounded-md border ${validation?.canOpenInventoryIntakeReentry ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Inventory Intake Re-entry Readiness</span>
            {validation?.canOpenInventoryIntakeReentry ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">{validation?.recommendedNextAction || "대기 중"}</span>}
          </div>

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Receiving Execution Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Inventory Intake Re-entry로 진행할 수 있습니다. 이후 Stock Release → Reorder Decision 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Lines <span className="text-slate-300 font-medium">{execState.actualReceivedLineCount}/{execState.expectedLineCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToReceivingPrepReentry}><ArrowLeft className="h-3 w-3 mr-1" />Rcv Prep Re</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-medium" onClick={recordExec} disabled={!validation?.canRecordReceivingExecutionReentry}><Clipboard className="h-3 w-3 mr-1" />Rcv Exec Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenInventoryIntakeReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onInventoryIntakeReentryHandoff} disabled={!validation?.canOpenInventoryIntakeReentry}>
                <Package className="h-3 w-3 mr-1" />Inventory Intake Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

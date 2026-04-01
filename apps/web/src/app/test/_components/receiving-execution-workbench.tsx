"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, Clock, Clipboard, ShieldAlert } from "lucide-react";
import { type ReceivingExecutionState, type ReceivingExecutionObject, type LineReceiptCapture, createInitialReceivingExecutionState, evaluateReceivingExecutionDiscrepancy, evaluateReceivingCaptureChecklist, validateReceivingExecutionBeforeRecord, buildReceivingExecutionObject, buildInventoryIntakeHandoff } from "@/lib/ai/receiving-execution-engine";
import type { ReceivingExecutionHandoff } from "@/lib/ai/receiving-preparation-engine";

interface ReceivingExecutionWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ReceivingExecutionHandoff | null;
  onExecutionRecorded: (obj: ReceivingExecutionObject) => void;
  onInventoryIntakeHandoff: () => void;
  onReturnToPreparation: () => void;
}

export function ReceivingExecutionWorkbench({ open, onClose, handoff, onExecutionRecorded, onInventoryIntakeHandoff, onReturnToPreparation }: ReceivingExecutionWorkbenchProps) {
  const [execState, setExecState] = useState<ReceivingExecutionState | null>(null);
  const [execObject, setExecObject] = useState<ReceivingExecutionObject | null>(null);

  useMemo(() => { if (open && handoff && !execState) setExecState(createInitialReceivingExecutionState(handoff)); }, [open, handoff]); // eslint-disable-line

  const discrepancy = useMemo(() => execState ? evaluateReceivingExecutionDiscrepancy(execState) : null, [execState]);
  const captureCheck = useMemo(() => execState ? evaluateReceivingCaptureChecklist(execState) : null, [execState]);
  const validation = useMemo(() => execState ? validateReceivingExecutionBeforeRecord(execState) : null, [execState]);

  const simulateFullReceipt = useCallback(() => {
    const now = new Date().toISOString();
    const demoLines: LineReceiptCapture[] = [
      { lineId: "line_1", expectedQty: 10, receivedQty: 10, receiptStatus: "full", shortFlag: false, overFlag: false, missingFlag: false, damagedFlag: false, substituteFlag: false, lineNote: "" },
      { lineId: "line_2", expectedQty: 5, receivedQty: 5, receiptStatus: "full", shortFlag: false, overFlag: false, missingFlag: false, damagedFlag: false, substituteFlag: false, lineNote: "" },
    ];
    setExecState(prev => prev ? {
      ...prev,
      actualReceiptTimestamp: now,
      actualReceivedQtySummary: "전량 입고",
      receivedLineCount: 2,
      expectedLineCount: 2,
      lineReceipts: demoLines,
      substatus: "awaiting_lot_expiry_storage_capture",
      captureChecklist: { ...prev.captureChecklist, lotCaptureStatus: "captured", lotNumber: "LOT-2026-001", expiryCaptureStatus: "captured", expiryDate: "2027-06-30", storageCaptureStatus: "captured", storageLocation: "냉장고 A-3", receivingDocStatus: "captured", receivingDocReference: "RCV-2026-0042", damageCaptureStatus: "not_required", damageNote: "", quarantineFlag: false },
    } : prev);
  }, []);

  const recordExecution = useCallback(() => {
    if (!execState || !validation?.canRecordReceivingExecution) return;
    const obj = buildReceivingExecutionObject(execState);
    setExecObject(obj); onExecutionRecorded(obj);
    setExecState(prev => prev ? { ...prev, receivingExecutionStatus: "receiving_execution_recorded", receivingExecutionObjectId: obj.id, substatus: "ready_for_inventory_intake" } : prev);
  }, [execState, validation, onExecutionRecorded]);

  if (!open || !execState || !handoff) return null;
  const isRecorded = !!execObject;
  const cl = execState.captureChecklist;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-rose-600/15 border-rose-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4 text-rose-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Receiving Execution 완료" : "Receiving Execution"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">수신 <span className="text-slate-200 font-medium">{execState.receivedLineCount}/{execState.expectedLineCount}</span> 라인</span>
                <span className="text-slate-600">·</span>
                {execState.partialReceiptFlag ? <span className="text-amber-400">부분 입고</span> : execState.actualReceiptTimestamp ? <span className="text-emerald-400">전량 입고</span> : <span className="text-slate-500">입고 대기</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Preparation basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">입고 준비 근거</span>
            <span className="text-[10px] text-blue-200">ETA: {handoff.confirmedEtaWindow || "미확정"} · Qty: {handoff.confirmedQtySummary || "미확정"}</span>
          </div>

          {/* Actual receipt summary */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">실제 입고</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">입고 시점</span><span className={`text-[10px] font-medium ${execState.actualReceiptTimestamp ? "text-slate-200" : "text-slate-600"}`}>{execState.actualReceiptTimestamp ? "기록됨" : "미기록"}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">수량</span><span className={`text-[10px] font-medium ${execState.actualReceivedQtySummary ? "text-slate-200" : "text-slate-600"}`}>{execState.actualReceivedQtySummary || "미기록"}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center"><span className="text-[9px] text-slate-500 block">라인</span><span className="text-[10px] font-medium text-slate-200">{execState.receivedLineCount}/{execState.expectedLineCount}</span></div>
            </div>
            {!execState.actualReceiptTimestamp && (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateFullReceipt}>전량 입고 시뮬레이션</Button>
            )}
          </div>

          {/* Line receipts */}
          {execState.lineReceipts.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">라인별 입고</span>
              <div className="mt-2 border border-bd/40 rounded-md overflow-hidden">
                {execState.lineReceipts.map((lr, i) => (
                  <div key={lr.lineId} className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? "border-t border-bd/20" : ""}`}>
                    <span className="text-[10px] text-slate-300 flex-1">{lr.lineId}</span>
                    <span className="text-[10px] tabular-nums text-slate-200">{lr.receivedQty}/{lr.expectedQty}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${lr.receiptStatus === "full" ? "bg-emerald-600/10 text-emerald-400" : lr.receiptStatus === "partial" ? "bg-amber-600/10 text-amber-400" : "bg-red-600/10 text-red-400"}`}>{lr.receiptStatus}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capture checklist */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">캡처 체크리스트</span>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {[
                { label: "Lot", status: cl.lotCaptureStatus, value: cl.lotNumber },
                { label: "유효기한", status: cl.expiryCaptureStatus, value: cl.expiryDate },
                { label: "보관 위치", status: cl.storageCaptureStatus, value: cl.storageLocation },
                { label: "입고 문서", status: cl.receivingDocStatus, value: cl.receivingDocReference },
              ].map(item => (
                <div key={item.label} className={`px-3 py-2 rounded-md border ${item.status === "captured" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : item.status === "blocked" ? "border-red-500/15 bg-red-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                  <span className="text-[9px] text-slate-500 block">{item.label}</span>
                  <span className={`text-[10px] font-medium ${item.status === "captured" ? "text-emerald-300" : item.status === "blocked" ? "text-red-300" : "text-slate-500"}`}>{item.value || (item.status === "captured" ? "기록됨" : item.status === "not_required" ? "불필요" : "미기록")}</span>
                </div>
              ))}
            </div>
            {cl.quarantineFlag && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><ShieldAlert className="h-3 w-3 text-red-400" /><span className="text-[10px] text-red-300">검역 대상</span></div>
            )}
          </div>

          {/* Discrepancy */}
          {discrepancy && (discrepancy.blockingIssues.length > 0 || discrepancy.warnings.length > 0) && (
            <div className="space-y-1">
              {discrepancy.blockingIssues.map((b, i) => <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
              {discrepancy.warnings.map((w, i) => <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>)}
            </div>
          )}

          {/* Inventory readiness */}
          <div className={`px-3 py-2.5 rounded-md border ${validation?.canOpenInventoryIntake ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Inventory Intake Readiness</span>
            {validation?.canOpenInventoryIntake ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">{validation?.recommendedNextAction || "대기 중"}</span>}
          </div>

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Receiving Execution 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Inventory Intake로 진행할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">수신 <span className="text-slate-300 font-medium">{execState.receivedLineCount}/{execState.expectedLineCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToPreparation}><ArrowLeft className="h-3 w-3 mr-1" />Receiving Prep</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-medium" onClick={recordExecution} disabled={!validation?.canRecordReceivingExecution}><Clipboard className="h-3 w-3 mr-1" />Receiving Execution 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenInventoryIntake ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onInventoryIntakeHandoff} disabled={!validation?.canOpenInventoryIntake}>
                <Package className="h-3 w-3 mr-1" />Inventory Intake<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

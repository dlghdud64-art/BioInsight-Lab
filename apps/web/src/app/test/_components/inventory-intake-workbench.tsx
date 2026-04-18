"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, Archive, ShieldAlert, Clipboard, MapPin } from "lucide-react";
import { type InventoryIntakeState, type InventoryIntakeObject, type LineDisposition, type DispositionType, createInitialInventoryIntakeState, buildInventoryDispositionPlan, validateInventoryIntakeBeforeRecord, buildInventoryIntakeObject, buildAvailableStockReleaseHandoff } from "@/lib/ai/inventory-intake-engine";
import type { InventoryIntakeHandoff } from "@/lib/ai/receiving-execution-engine";

const DISPOSITION_LABELS: Record<DispositionType, { label: string; color: string }> = {
  stockable_now: { label: "재고 편입", color: "text-emerald-400" },
  inspection_hold: { label: "검수 보류", color: "text-amber-400" },
  quarantine_hold: { label: "검역 보류", color: "text-orange-400" },
  damaged_retained: { label: "손상 보유", color: "text-red-400" },
  discard_pending: { label: "폐기 대기", color: "text-red-400" },
  unresolved: { label: "미결정", color: "text-slate-500" },
};

interface InventoryIntakeWorkbenchProps {
  open: boolean; onClose: () => void; handoff: InventoryIntakeHandoff | null;
  onIntakeRecorded: (obj: InventoryIntakeObject) => void;
  onStockReleaseHandoff: () => void;
  onReturnToExecution: () => void;
}

export function InventoryIntakeWorkbench({ open, onClose, handoff, onIntakeRecorded, onStockReleaseHandoff, onReturnToExecution }: InventoryIntakeWorkbenchProps) {
  const [intakeState, setIntakeState] = useState<InventoryIntakeState | null>(null);
  const [intakeObject, setIntakeObject] = useState<InventoryIntakeObject | null>(null);

  useMemo(() => { if (open && handoff && !intakeState) setIntakeState(createInitialInventoryIntakeState(handoff)); }, [open, handoff]); // eslint-disable-line

  const dispositionPlan = useMemo(() => intakeState ? buildInventoryDispositionPlan(intakeState.lineDispositions) : null, [intakeState]);
  const validation = useMemo(() => intakeState ? validateInventoryIntakeBeforeRecord(intakeState) : null, [intakeState]);

  const simulateFullStockable = useCallback(() => {
    const demoDispositions: LineDisposition[] = [
      { lineId: "line_1", disposition: "stockable_now", qty: 10, lotNumber: "LOT-2026-001", expiryDate: "2027-06-30", storageLocation: "냉장고 A-3", note: "" },
      { lineId: "line_2", disposition: "stockable_now", qty: 5, lotNumber: "LOT-2026-002", expiryDate: "2027-12-31", storageLocation: "냉장고 B-1", note: "" },
    ];
    setIntakeState(prev => prev ? { ...prev, lineDispositions: demoDispositions, receivedLineCount: 2, stockableLineCount: 2, stockableQtySummary: "전량 stockable", substatus: "ready_for_stock_release" } : prev);
  }, []);

  const recordIntake = useCallback(() => {
    if (!intakeState || !validation?.canRecordInventoryIntake) return;
    const obj = buildInventoryIntakeObject(intakeState);
    setIntakeObject(obj); onIntakeRecorded(obj);
    setIntakeState(prev => prev ? { ...prev, inventoryIntakeStatus: "inventory_intake_recorded", inventoryIntakeObjectId: obj.id } : prev);
  }, [intakeState, validation, onIntakeRecorded]);

  if (!open || !intakeState || !handoff) return null;
  const isRecorded = !!intakeObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-amber-600/15 border-amber-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Archive className="h-4 w-4 text-amber-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Inventory Intake 완료" : "Inventory Intake"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Stockable <span className="text-emerald-300 font-medium">{dispositionPlan?.stockableLineIds.length || 0}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Hold <span className="text-amber-300 font-medium">{(dispositionPlan?.holdLineIds.length || 0) + (dispositionPlan?.quarantineLineIds.length || 0)}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Damaged <span className="text-red-300 font-medium">{dispositionPlan?.damagedLineIds.length || 0}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Receipt basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">입고 실행 근거</span>
            <span className="text-[10px] text-blue-200">수량: {handoff.actualReceivedQtySummary || "—"} · 입고: {handoff.actualReceiptTimestamp ? "기록됨" : "—"} · {handoff.lineReceiptSummary || "—"}</span>
          </div>

          {/* Stockable allocation summary */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">재고 편입 분류</span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Stockable</span><span className="text-lg font-bold tabular-nums text-emerald-400">{dispositionPlan?.stockableLineIds.length || 0}</span></div>
              <div className="px-3 py-2.5 rounded-md border border-amber-500/20 bg-amber-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Hold</span><span className="text-lg font-bold tabular-nums text-amber-400">{dispositionPlan?.holdLineIds.length || 0}</span></div>
              <div className="px-3 py-2.5 rounded-md border border-orange-500/20 bg-orange-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Quarantine</span><span className="text-lg font-bold tabular-nums text-orange-400">{dispositionPlan?.quarantineLineIds.length || 0}</span></div>
              <div className="px-3 py-2.5 rounded-md border border-red-500/15 bg-red-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Damaged</span><span className="text-lg font-bold tabular-nums text-red-400">{dispositionPlan?.damagedLineIds.length || 0}</span></div>
            </div>
            {intakeState.lineDispositions.length === 0 && (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateFullStockable}>전량 Stockable 시뮬레이션</Button>
            )}
          </div>

          {/* Line dispositions */}
          {intakeState.lineDispositions.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">라인별 Disposition</span>
              <div className="mt-2 space-y-1">
                {intakeState.lineDispositions.map(ld => {
                  const dl = DISPOSITION_LABELS[ld.disposition];
                  return (
                    <div key={ld.lineId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${ld.disposition === "stockable_now" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : ld.disposition === "damaged_retained" || ld.disposition === "discard_pending" ? "border-red-500/15 bg-red-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-slate-200 font-medium block">{ld.lineId}</span>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-0.5">
                          <span>Qty: {ld.qty}</span>
                          {ld.lotNumber && <><span>·</span><span>Lot: {ld.lotNumber}</span></>}
                          {ld.storageLocation && <><span>·</span><MapPin className="h-2.5 w-2.5 inline" /><span>{ld.storageLocation}</span></>}
                        </div>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${dl.color} ${ld.disposition === "stockable_now" ? "bg-emerald-600/10" : ld.disposition.includes("damaged") || ld.disposition.includes("discard") ? "bg-red-600/10" : "bg-amber-600/10"}`}>{dl.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && !isRecorded && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
              {validation.warnings.map((w, i) => <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>)}
            </div>
          )}

          {/* Stock release readiness */}
          <div className={`px-3 py-2.5 rounded-md border ${validation?.canOpenStockRelease ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
            <span className="text-[9px] text-slate-500 block mb-0.5">Stock Release Readiness</span>
            {validation?.canOpenStockRelease ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">진입 가능</span></div> : <span className="text-[10px] text-slate-500">{validation?.recommendedNextAction || "대기 중"}</span>}
          </div>

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Inventory Intake 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Stock Release로 진행할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Stockable <span className="text-emerald-300 font-medium">{dispositionPlan?.stockableLineIds.length || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Hold <span className="text-amber-300 font-medium">{(dispositionPlan?.holdLineIds.length || 0) + (dispositionPlan?.quarantineLineIds.length || 0)}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToExecution}><ArrowLeft className="h-3 w-3 mr-1" />Receiving Execution</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-medium" onClick={recordIntake} disabled={!validation?.canRecordInventoryIntake}><Archive className="h-3 w-3 mr-1" />Inventory Intake 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenStockRelease ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onStockReleaseHandoff} disabled={!validation?.canOpenStockRelease}>
                <Package className="h-3 w-3 mr-1" />Stock Release<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

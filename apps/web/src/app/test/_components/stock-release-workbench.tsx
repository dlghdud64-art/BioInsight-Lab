"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, ShieldAlert } from "lucide-react";
import { type StockReleaseState, type StockReleaseObject, createInitialStockReleaseState, validateStockReleaseBeforeRecord, buildStockReleaseObject, buildReorderDecisionHandoff } from "@/lib/ai/stock-release-engine";
import type { AvailableStockReleaseHandoff } from "@/lib/ai/inventory-intake-engine";

interface StockReleaseWorkbenchProps {
  open: boolean; onClose: () => void; handoff: AvailableStockReleaseHandoff | null;
  onReleaseRecorded: (obj: StockReleaseObject) => void;
  onReorderDecisionHandoff: () => void;
  onReturnToIntake: () => void;
}

export function StockReleaseWorkbench({ open, onClose, handoff, onReleaseRecorded, onReorderDecisionHandoff, onReturnToIntake }: StockReleaseWorkbenchProps) {
  const [releaseState, setReleaseState] = useState<StockReleaseState | null>(null);
  const [releaseObject, setReleaseObject] = useState<StockReleaseObject | null>(null);

  useMemo(() => { if (open && handoff && !releaseState) setReleaseState(createInitialStockReleaseState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => releaseState ? validateStockReleaseBeforeRecord(releaseState) : null, [releaseState]);

  const recordRelease = useCallback(() => {
    if (!releaseState || !validation?.canRecordStockRelease) return;
    const obj = buildStockReleaseObject(releaseState);
    setReleaseObject(obj); onReleaseRecorded(obj);
    setReleaseState(prev => prev ? { ...prev, stockReleaseStatus: "stock_release_recorded", substatus: "ready_for_reorder_decision", stockReleaseObjectId: obj.id } : prev);
  }, [releaseState, validation, onReleaseRecorded]);

  if (!open || !releaseState || !handoff) return null;
  const isRecorded = !!releaseObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-green-600/15 border-green-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-green-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Stock Release 완료" : "Available Stock Release"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Releasable: <span className="text-emerald-300 font-medium">{releaseState.releasableQtySummary || "—"}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Hold: <span className="text-amber-300 font-medium">{releaseState.holdRemainingQtySummary || "0"}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Releasable</span><span className="text-lg font-bold text-emerald-400">{releaseState.releasableQtySummary || "—"}</span></div>
            <div className="px-3 py-2.5 rounded-md border border-amber-500/20 bg-amber-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Hold</span><span className="text-lg font-bold text-amber-400">{releaseState.holdRemainingQtySummary || "0"}</span></div>
            <div className="px-3 py-2.5 rounded-md border border-orange-500/20 bg-orange-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">Quarantine</span><span className="text-lg font-bold text-orange-400">{releaseState.quarantineRemainingQtySummary || "0"}</span></div>
          </div>

          {validation && validation.warnings.length > 0 && validation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><ShieldAlert className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Stock Release 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Reorder Decision으로 진행할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5"><span className="text-slate-500">{validation?.recommendedNextAction || ""}</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToIntake}><ArrowLeft className="h-3 w-3 mr-1" />Inventory Intake</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-green-600 hover:bg-green-500 text-white font-medium" onClick={recordRelease} disabled={!validation?.canRecordStockRelease}><Package className="h-3 w-3 mr-1" />Stock Release 저장</Button>
            ) : (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onReorderDecisionHandoff}><AlertTriangle className="h-3 w-3 mr-1" />Reorder Decision<ArrowRight className="h-3 w-3 ml-1" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

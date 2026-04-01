"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Lock, Package, CreditCard, MapPin, Truck } from "lucide-react";
import { type PoConversionReentryState, type PoConversionReentryDraftObject, createInitialPoConversionReentryState, buildPoConversionReentryFieldPlan, validatePoConversionReentryBeforeRecord, buildPoConversionReentryDraftObject, buildPoCreatedReentryHandoff } from "@/lib/ai/po-conversion-reentry-engine";
import type { PoConversionReentryHandoff } from "@/lib/ai/approval-reentry-engine";

interface PoConversionReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: PoConversionReentryHandoff | null;
  onDraftRecorded: (obj: PoConversionReentryDraftObject) => void;
  onPoCreatedReentryHandoff: () => void;
  onReturnToApprovalReentry: () => void;
}

export function PoConversionReentryWorkbench({ open, onClose, handoff, onDraftRecorded, onPoCreatedReentryHandoff, onReturnToApprovalReentry }: PoConversionReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<PoConversionReentryState | null>(null);
  const [draftObj, setDraftObj] = useState<PoConversionReentryDraftObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialPoConversionReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const currentState = useMemo<PoConversionReentryState | null>(() => reentryState, [reentryState]);
  const fieldPlan = useMemo(() => currentState ? buildPoConversionReentryFieldPlan(currentState) : null, [currentState]);
  const validation = useMemo(() => currentState ? validatePoConversionReentryBeforeRecord(currentState) : null, [currentState]);

  const updateField = useCallback((field: string, value: string) => {
    setReentryState(prev => prev ? { ...prev, [field]: value } as any : prev);
  }, []);

  const recordDraft = useCallback(() => {
    if (!currentState || !validation?.canRecordPoConversionReentry) return;
    const obj = buildPoConversionReentryDraftObject(currentState);
    setDraftObj(obj); onDraftRecorded(obj);
    setReentryState(prev => prev ? { ...prev, poConversionReentryStatus: "po_conversion_reentry_recorded", poConversionReentryDraftObjectId: obj.id, substatus: "ready_for_po_created_reentry" } : prev);
  }, [currentState, validation, onDraftRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!draftObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-teal-600/15 border-teal-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-teal-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "PO Conv Re-entry 완료" : "PO Conversion Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Approved <span className="text-emerald-300 font-medium">{reentryState.approvedCandidateIds.length}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Locked <span className="text-slate-200 font-medium">{reentryState.lockedApprovalFieldCount}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Editable <span className="text-blue-300 font-medium">{reentryState.editableOperationalFieldCount}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Approval basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Approval Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Approved: {handoff.approvedCandidateIds.length}개 · Commercial: {handoff.commercialDeltaSummary} · Governance: {handoff.governanceDeltaSummary}</span>
          </div>

          {/* Locked fields */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Lock className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Locked Approval Fields</span></div>
            <div className="grid grid-cols-2 gap-1.5">
              {["Vendor Identity", "Quote Lineage", "Line Coverage", "Qty/Pack Basis", "Price Basis"].map(f => (
                <div key={f} className="px-3 py-1.5 rounded-md border border-bd/40 bg-[#252A33] flex items-center gap-2"><Lock className="h-3 w-3 text-slate-600 shrink-0" /><span className="text-[10px] text-slate-400">{f}</span></div>
              ))}
            </div>
          </div>

          {/* Editable operational fields */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Editable Operational Fields</span>
            <div className="mt-2 space-y-2">
              {[
                { key: "paymentTerm", label: "결제 조건", icon: CreditCard, critical: true },
                { key: "billingReference", label: "청구 참조", icon: CreditCard, critical: false },
                { key: "deliveryTarget", label: "납품 요청일", icon: Truck, critical: true },
                { key: "shipToReference", label: "배송지", icon: MapPin, critical: true },
                { key: "receivingInstruction", label: "입고 지시", icon: Package, critical: true },
              ].map(item => {
                const Icon = item.icon;
                const value = (reentryState as any)[item.key] || "";
                return (
                  <div key={item.key}>
                    <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1"><Icon className="h-3 w-3" />{item.label}{item.critical ? " *" : ""}</label>
                    <Input placeholder={item.label} value={value} onChange={e => updateField(item.key, e.target.value)} className="h-8 text-[11px] bg-[#1C2028] border-bd/40" disabled={isRecorded} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warnings */}
          {fieldPlan && fieldPlan.warnings.length > 0 && !isRecorded && fieldPlan.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">PO Conversion Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">PO Created Re-entry로 진행하여 발주 객체를 다시 확정할 수 있습니다. 이후 Dispatch → 입고 → 재고 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Locked <span className="text-slate-300 font-medium">{reentryState.lockedApprovalFieldCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToApprovalReentry}><ArrowLeft className="h-3 w-3 mr-1" />Approval Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-medium" onClick={recordDraft} disabled={!validation?.canRecordPoConversionReentry}><Package className="h-3 w-3 mr-1" />PO Conv Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenPoCreatedReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onPoCreatedReentryHandoff} disabled={!validation?.canOpenPoCreatedReentry}>
                <Package className="h-3 w-3 mr-1" />PO Created Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

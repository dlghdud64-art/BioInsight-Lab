"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Lock, Package, Truck, Building2, FileText, CreditCard, MapPin } from "lucide-react";
import {
  type PoCreatedState,
  type PoCreatedObject,
  type DispatchPreparationHandoff,
  createInitialPoCreatedState,
  buildPoCreatedReadinessSummary,
  validatePoCreatedBeforeDispatchPrep,
  buildPoCreatedObject,
  buildDispatchPreparationHandoff,
} from "@/lib/ai/po-created-engine";
import type { PoConversionDraftObject, PoCreatedHandoff } from "@/lib/ai/po-conversion-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface PoCreatedDetailWorkbenchProps {
  open: boolean;
  onClose: () => void;
  createdHandoff: PoCreatedHandoff | null;
  conversionDraft: PoConversionDraftObject | null;
  onCreatedRecorded: (obj: PoCreatedObject) => void;
  onDispatchPrepHandoff: (handoff: DispatchPreparationHandoff) => void;
  onReturnToConversion: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function PoCreatedDetailWorkbench({
  open,
  onClose,
  createdHandoff,
  conversionDraft,
  onCreatedRecorded,
  onDispatchPrepHandoff,
  onReturnToConversion,
}: PoCreatedDetailWorkbenchProps) {
  const [createdState, setCreatedState] = useState<PoCreatedState | null>(null);
  const [createdObject, setCreatedObject] = useState<PoCreatedObject | null>(null);

  // ── Init ──
  useMemo(() => {
    if (open && createdHandoff && conversionDraft && !createdState) {
      setCreatedState(createInitialPoCreatedState(createdHandoff, conversionDraft));
    }
  }, [open, createdHandoff, conversionDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const readiness = useMemo(() =>
    createdState ? buildPoCreatedReadinessSummary(createdState.createdBasis) : null,
    [createdState],
  );
  const validation = useMemo(() =>
    createdState ? validatePoCreatedBeforeDispatchPrep(createdState) : null,
    [createdState],
  );

  // ── Actions ──
  const recordCreated = useCallback(() => {
    if (!createdState || !validation?.canRecordPoCreated) return;
    const obj = buildPoCreatedObject(createdState);
    setCreatedObject(obj);
    onCreatedRecorded(obj);
    setCreatedState((prev) => prev ? {
      ...prev,
      poCreatedStatus: "po_created_recorded",
      substatus: readiness?.isSendReady ? "ready_for_dispatch_preparation" : "missing_operational_completion",
      poCreatedObjectId: obj.id,
    } : prev);
  }, [createdState, validation, readiness, onCreatedRecorded]);

  const handleDispatchPrep = useCallback(() => {
    if (!createdObject) return;
    onDispatchPrepHandoff(buildDispatchPreparationHandoff(createdObject));
  }, [createdObject, onDispatchPrepHandoff]);

  if (!open || !createdState || !createdHandoff) return null;

  const isRecorded = !!createdObject;
  const basis = createdState.createdBasis;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* ═══ Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-teal-600/15 border-teal-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-teal-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "PO Created 완료" : "PO Created 검토"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">공급사 <span className="text-slate-200 font-medium">{createdState.createdVendorCount}개</span></span>
                <span className="text-slate-600">·</span>
                {readiness?.isSendReady ? (
                  <span className="text-emerald-400 font-medium">Dispatch 준비 완료</span>
                ) : (
                  <span className="text-amber-400">누락 {readiness?.sendCriticalMissing.length || 0}</span>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ═══ A. Created Basis Summary ═══ */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-1">승인 → 전환 근거</span>
            <span className="text-[10px] text-blue-200">{basis.lineCoverageSummary}</span>
          </div>

          {/* ═══ B. PO Header / Identity ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">PO 헤더</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
                <div className="flex items-center gap-1.5 mb-0.5"><Building2 className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">공급사</span></div>
                <span className="text-[11px] text-slate-200 font-medium">{basis.vendorIds.join(", ") || "—"}</span>
              </div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
                <div className="flex items-center gap-1.5 mb-0.5"><Lock className="h-3 w-3 text-slate-600" /><span className="text-[9px] text-slate-500">PO ID</span></div>
                <span className="text-[11px] text-slate-200 font-medium">{createdState.poCreatedObjectId || createdState.poConversionDraftObjectId}</span>
              </div>
            </div>
          </div>

          {/* ═══ C. Commercial / Operational Summary ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">상업 · 운영 조건</span>
            <div className="mt-2 space-y-1.5">
              {[
                { icon: CreditCard, label: "결제 조건", value: basis.paymentTerm, critical: true },
                { icon: FileText, label: "청구 참조", value: basis.billingReference, critical: false },
                { icon: Truck, label: "납품 요청일", value: basis.deliveryTarget, critical: true },
                { icon: MapPin, label: "배송지", value: basis.shipToReference, critical: true },
                { icon: Package, label: "입고 지시", value: basis.receivingInstruction, critical: true },
              ].map((item) => {
                const Icon = item.icon;
                const isMissing = !item.value;
                return (
                  <div key={item.label} className={`flex items-center gap-3 px-3 py-2 rounded-md border ${isMissing && item.critical ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isMissing ? "text-amber-400" : "text-slate-500"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-slate-500 block">{item.label}{item.critical ? " *" : ""}</span>
                      <span className={`text-[11px] font-medium ${isMissing ? "text-amber-400" : "text-slate-200"}`}>{item.value || "미입력"}</span>
                    </div>
                    {isMissing && item.critical && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                  </div>
                );
              })}
              {/* Notes (non-critical) */}
              {(basis.internalNote || basis.supplierNote) && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {basis.internalNote && (
                    <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
                      <span className="text-[9px] text-slate-500 block">내부 메모</span>
                      <span className="text-[10px] text-slate-300">{basis.internalNote}</span>
                    </div>
                  )}
                  {basis.supplierNote && (
                    <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
                      <span className="text-[9px] text-slate-500 block">공급사 전달 메모</span>
                      <span className="text-[10px] text-slate-300">{basis.supplierNote}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ═══ D. Readiness Summary ═══ */}
          {readiness && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${readiness.sendCriticalMissing.length === 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-red-500/15 bg-red-600/[0.03]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Send-Critical</span>
                {readiness.sendCriticalMissing.length === 0 ? (
                  <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">전부 완료</span></div>
                ) : (
                  <span className="text-[10px] text-red-300">누락: {readiness.sendCriticalMissing.join(", ")}</span>
                )}
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${readiness.nonCriticalMissing.length === 0 ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Non-Critical</span>
                {readiness.nonCriticalMissing.length === 0 ? (
                  <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">전부 완료</span></div>
                ) : (
                  <span className="text-[10px] text-amber-300">선택: {readiness.nonCriticalMissing.join(", ")}</span>
                )}
              </div>
            </div>
          )}

          {/* ═══ Validation ═══ */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && !isRecorded && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ Success ═══ */}
          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15 space-y-1">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">PO Created가 저장되었습니다</span></div>
              <span className="text-[10px] text-slate-400">
                {readiness?.isSendReady ? "Dispatch Preparation으로 보내 발주를 발송할 수 있습니다." : "누락 필드를 보완 후 Dispatch Preparation으로 보낼 수 있습니다."}
              </span>
            </div>
          )}
        </div>

        {/* ═══ Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">공급사 <span className="text-slate-300 font-medium">{createdState.createdVendorCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">누락 <span className="text-slate-300 font-medium">{readiness?.sendCriticalMissing.length || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToConversion}>
              <ArrowLeft className="h-3 w-3 mr-1" />전환으로 돌아가기
            </Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-medium"
                onClick={recordCreated} disabled={!validation?.canRecordPoCreated}>
                <Package className="h-3 w-3 mr-1" />PO Created 저장
              </Button>
            ) : (
              <Button size="sm"
                className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenDispatchPreparation ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400 cursor-not-allowed"}`}
                onClick={handleDispatchPrep}
                disabled={!validation?.canOpenDispatchPreparation}>
                <Truck className="h-3 w-3 mr-1" />Dispatch Preparation<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * @deprecated Legacy test playground workbench.
 *
 * 본 컴포넌트는 `po-created-reentry-engine.ts` (소문자 Po*) 기반의 구버전이며,
 * production 경로에서는 더 이상 사용되지 않는다.
 *
 * 새 governance grammar 진입점:
 *   - components/approval/po-created-reentry-surface.tsx (POCreatedReentrySurface)
 *   - components/approval/dispatch-prep-workbench.tsx (DispatchPrepWorkbench)
 *   - components/approval/quote-chain-workbenches.tsx (QuoteChainWorkbench orchestrator)
 *   - app/dashboard/purchase-orders/[poId]/dispatch/page.tsx (실 mount point)
 *
 * 본 파일은 app/test/search/page.tsx playground 에서만 import 되어 있으며,
 * 해당 1923라인 playground 가 신 orchestrator 로 마이그레이션되는 시점에 함께 제거된다.
 * 신규 코드는 본 파일을 import 하지 말 것.
 */

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, Truck, Shield } from "lucide-react";
import { type PoCreatedReentryState, type PoCreatedReentryObject, createInitialPoCreatedReentryState, validatePoCreatedReentryBeforeRecord, buildPoCreatedReentryObject, buildDispatchPreparationReentryHandoff } from "@/lib/ai/po-created-reentry-engine";
import type { PoCreatedReentryHandoff } from "@/lib/ai/po-conversion-reentry-engine";

interface PoCreatedReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: PoCreatedReentryHandoff | null;
  onCreatedRecorded: (obj: PoCreatedReentryObject) => void;
  onDispatchPrepReentryHandoff: () => void;
  onReturnToConversionReentry: () => void;
}

export function PoCreatedReentryWorkbench({ open, onClose, handoff, onCreatedRecorded, onDispatchPrepReentryHandoff, onReturnToConversionReentry }: PoCreatedReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<PoCreatedReentryState | null>(null);
  const [createdObj, setCreatedObj] = useState<PoCreatedReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialPoCreatedReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const validation = useMemo(() => reentryState ? validatePoCreatedReentryBeforeRecord(reentryState) : null, [reentryState]);

  const simulateReview = useCallback(() => {
    setReentryState(prev => prev ? { ...prev, createdHeaderDeltaStatus: "reviewed", createdLineDeltaStatus: "reviewed", operationalCarryForwardStatus: "reviewed", sendCriticalReadinessStatus: "ready", missingDecisionCount: 0, substatus: "ready_for_dispatch_preparation_reentry" } : prev);
  }, []);

  const recordCreated = useCallback(() => {
    if (!reentryState || !validation?.canRecordPoCreatedReentry) return;
    const obj = buildPoCreatedReentryObject(reentryState);
    setCreatedObj(obj); onCreatedRecorded(obj);
    setReentryState(prev => prev ? { ...prev, poCreatedReentryStatus: "po_created_reentry_recorded", poCreatedReentryObjectId: obj.id } : prev);
  }, [reentryState, validation, onCreatedRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!createdObj;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-teal-600/15 border-teal-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-teal-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "PO Created Re-entry 완료" : "PO Created Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">PO <span className="text-slate-200 font-medium">{reentryState.regeneratedPoId}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Approved <span className="text-emerald-300 font-medium">{reentryState.approvedCandidateIds.length}</span></span>
                <span className="text-slate-600">·</span>
                {reentryState.sendCriticalReadinessStatus === "ready" ? <span className="text-emerald-400">Dispatch 준비</span> : <span className="text-amber-400">미완료</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Conversion basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">PO Conversion Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Approved: {handoff.approvedCandidateIds.length}개 · Locked: {handoff.lockedApprovalFieldSummary} · Delta: {handoff.operationalDeltaSummary}</span>
          </div>

          {/* Regenerated PO identity */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Regenerated PO</span>
            <div className="mt-2 px-3 py-2.5 rounded-md border border-bd/40 bg-[#252A33]">
              <span className="text-[11px] text-slate-200 font-medium block">{reentryState.regeneratedPoId}</span>
              <span className="text-[9px] text-slate-500">Approved Candidates: {reentryState.approvedCandidateIds.join(", ") || "—"}</span>
            </div>
          </div>

          {/* Delta review status */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Delta 검토 상태</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: "Header Delta", status: reentryState.createdHeaderDeltaStatus },
                { label: "Line Delta", status: reentryState.createdLineDeltaStatus },
                { label: "Operational", status: reentryState.operationalCarryForwardStatus },
              ].map(item => (
                <div key={item.label} className={`px-3 py-2.5 rounded-md border text-center ${item.status === "reviewed" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : item.status === "blocked" ? "border-red-500/15 bg-red-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                  <span className="text-[9px] text-slate-500 block">{item.label}</span>
                  <span className={`text-[10px] font-medium ${item.status === "reviewed" ? "text-emerald-300" : item.status === "blocked" ? "text-red-300" : "text-amber-300"}`}>{item.status === "reviewed" ? "검토 완료" : item.status === "blocked" ? "차단" : "미검토"}</span>
                </div>
              ))}
            </div>
            {reentryState.createdHeaderDeltaStatus === "pending" && (
              <Button size="sm" variant="ghost" className="w-full h-7 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20 mt-2" onClick={simulateReview}>전체 검토 시뮬레이션</Button>
            )}
          </div>

          {/* Send-critical bridge */}
          <div className={`px-3 py-2.5 rounded-md border ${reentryState.sendCriticalReadinessStatus === "ready" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
            <div className="flex items-center gap-1.5 mb-0.5"><Shield className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">Send-Critical Bridge</span></div>
            {reentryState.sendCriticalReadinessStatus === "ready" ? <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">Dispatch 준비 완료</span></div> : <span className="text-[10px] text-amber-300">필드 검토 완료 후 준비됨</span>}
          </div>

          {/* Overlap */}
          {reentryState.previousCreatedOverlapCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">이전 Created Object {reentryState.previousCreatedOverlapCount}개 overlap</span></div>
          )}

          {validation && validation.warnings.length > 0 && !isRecorded && validation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">PO Created Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Dispatch Preparation Re-entry로 진행하여 발송을 재개할 수 있습니다. 이후 Send → 입고 → 재고 → 재주문 흐름이 다시 이어집니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">PO <span className="text-slate-300 font-medium">{reentryState.regeneratedPoId}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToConversionReentry}><ArrowLeft className="h-3 w-3 mr-1" />PO Conv Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-teal-600 hover:bg-teal-500 text-white font-medium" onClick={recordCreated} disabled={!validation?.canRecordPoCreatedReentry}><Package className="h-3 w-3 mr-1" />PO Created Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenDispatchPreparationReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onDispatchPrepReentryHandoff} disabled={!validation?.canOpenDispatchPreparationReentry}>
                <Truck className="h-3 w-3 mr-1" />Dispatch Prep Re-entry<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

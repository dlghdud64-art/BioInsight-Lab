"use client";

/**
 * DispatchPreparationWorkbench — PO 발송 준비 center/rail/dock
 *
 * center = supplier-facing payload + blockers + confirmation checklist
 * rail = approval rationale + snapshot validity + supplier profile
 * dock = send now / schedule / request correction / reopen conversion / cancel
 *
 * ready_to_send ≠ sent. sent는 실제 action 이후에만.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, PolicyMessageStack, NextActionHint } from "./index";
import type { DispatchPreparationGovernanceState, DispatchPolicySurface, ConfirmationItem } from "@/lib/ai/po-dispatch-governance-engine";

export interface DispatchPrepWorkbenchProps {
  state: DispatchPreparationGovernanceState;
  surface: DispatchPolicySurface;
  // Evidence
  vendorName: string;
  totalAmount: number;
  poNumber: string;
  // Handlers
  onSendNow?: () => void;
  onScheduleSend?: (date: string) => void;
  onRequestCorrection?: (reason: string) => void;
  onReopenConversion?: () => void;
  onCancelPrep?: () => void;
  className?: string;
}

export function DispatchPrepWorkbench({
  state, surface, vendorName, totalAmount, poNumber,
  onSendNow, onScheduleSend, onRequestCorrection, onReopenConversion, onCancelPrep,
  className,
}: DispatchPrepWorkbenchProps) {
  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Policy strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={surface.statusBadge} pulse={surface.statusBadge === "blocked" || surface.statusBadge === "reapproval_needed"} />
          <PolicyMessageStack primaryMessage={surface.primaryMessage} blockerMessages={surface.blockerMessages} warningMessages={surface.warningMessages} nextActionMessage={surface.nextAction} compact />
        </div>

        {/* PO summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">발송 대상</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">PO 번호</span><p className="text-slate-700 font-mono">{poNumber}</p></div>
            <div><span className="text-slate-500 text-xs">공급사</span><p className="text-slate-700">{vendorName}</p></div>
            <div><span className="text-slate-500 text-xs">금액</span><p className="text-sm font-semibold tabular-nums text-slate-900">{totalAmount.toLocaleString()}원</p></div>
          </div>
        </div>

        {/* Blockers */}
        {state.hardBlockers.length > 0 && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-4 space-y-2">
            <h4 className="text-xs font-medium text-red-300">발송 차단 사유</h4>
            {state.hardBlockers.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                <div>
                  <span className="text-red-300">{b.detail}</span>
                  <span className="text-red-400/70 ml-2">→ {b.remediationAction}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Soft blockers / warnings */}
        {state.softBlockers.length > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <h4 className="text-xs font-medium text-amber-300">검토 권장 사항</h4>
            {state.softBlockers.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-amber-400 shrink-0 mt-0.5">△</span>
                <div>
                  <span className="text-amber-300">{b.detail}</span>
                  <span className="text-amber-400/70 ml-2">→ {b.remediationAction}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmation checklist */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">발송 전 확인</h4>
            <span className="text-[10px] text-slate-400">{surface.checklistProgress}</span>
          </div>
          <div className="space-y-1">
            {state.confirmationChecklist.map(item => (
              <div key={item.key} className="flex items-center gap-2 text-xs">
                <span className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center text-[9px]",
                  item.confirmed ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : item.required ? "border-red-500/30 text-red-400" : "border-slate-700 text-slate-500"
                )}>
                  {item.confirmed ? "✓" : item.required ? "!" : "·"}
                </span>
                <span className={item.confirmed ? "text-slate-600" : item.required ? "text-red-300" : "text-slate-500"}>
                  {item.label}
                </span>
                {item.required && !item.confirmed && <span className="text-[9px] text-red-400/70">필수</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Locked vs Editable fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">잠긴 필드 ({state.lockedFields.length})</h5>
            <div className="flex flex-wrap gap-1">
              {state.lockedFields.map(f => <span key={f} className="text-[9px] bg-slate-800 text-slate-500 rounded px-1 py-0.5">{f}</span>)}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">수정 가능 ({state.editableFields.length})</h5>
            <div className="flex flex-wrap gap-1">
              {state.editableFields.map(f => <span key={f} className="text-[9px] bg-blue-500/10 text-blue-400 rounded px-1 py-0.5">{f}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Snapshot validity */}
        <div className={cn("rounded border p-3 text-xs",
          state.approvalSnapshotValid && state.conversionSnapshotValid ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
        )}>
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Snapshot 유효성</h5>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">견적 승인</span>
              <span className={state.approvalSnapshotValid ? "text-emerald-400" : "text-red-400"}>{state.approvalSnapshotValid ? "유효" : "무효"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PO 전환</span>
              <span className={state.conversionSnapshotValid ? "text-emerald-400" : "text-red-400"}>{state.conversionSnapshotValid ? "유효" : "무효"}</span>
            </div>
          </div>
          {state.snapshotInvalidationReason && <p className="text-red-400/70 text-[10px] mt-1">{state.snapshotInvalidationReason}</p>}
        </div>

        {/* Delta since approval */}
        {state.supplierFacingPayloadDelta.length > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <h5 className="text-[10px] font-medium text-amber-400 mb-1">승인 이후 변경</h5>
            {state.supplierFacingPayloadDelta.map((d, i) => (
              <p key={i} className="text-[10px] text-amber-300">{d}</p>
            ))}
          </div>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <NextActionHint message={surface.nextAction} variant={surface.statusBadge === "blocked" ? "blocked" : surface.statusBadge === "reapproval_needed" ? "urgent" : "default"} />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onCancelPrep && <button onClick={onCancelPrep} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors">취소</button>}
            {onReopenConversion && <button onClick={onReopenConversion} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">PO 전환 재열기</button>}
            {onRequestCorrection && state.readiness === "blocked" && (
              <button onClick={() => onRequestCorrection(state.hardBlockers[0]?.remediationAction || "")} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">보정 요청</button>
            )}
            {onScheduleSend && state.readiness === "ready_to_send" && state.allConfirmed && (
              <button onClick={() => onScheduleSend("")} className="rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors">예약 발송</button>
            )}
            {onSendNow && state.readiness === "ready_to_send" && (
              <button onClick={onSendNow} disabled={!state.allConfirmed} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40">발송 실행</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

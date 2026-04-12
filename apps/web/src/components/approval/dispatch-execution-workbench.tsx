"use client";

/**
 * DispatchExecutionWorkbench — 발송 실행/추적 center/rail/dock
 *
 * center = execution timeline + status + payload snapshot summary
 * rail = snapshot linkage + failure detail + retry info
 * dock = send now / retry / cancel
 *
 * RULE: dispatch prep (governance) → execution (this) → sent (terminal)
 * ready_to_send는 이 workbench 이전 단계. 여기서는 실제 실행 상태만.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, NextActionHint } from "./index";
import type {
  OutboundExecutionState,
  ExecutionSurface,
  OutboundPayloadSnapshot,
} from "@/lib/ai/dispatch-execution-engine";

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface DispatchExecutionWorkbenchProps {
  state: OutboundExecutionState;
  surface: ExecutionSurface;
  payloadSnapshot: OutboundPayloadSnapshot | null;
  // Evidence
  vendorName: string;
  totalAmount: number;
  poNumber: string;
  // Handlers
  onSendNow?: () => void;
  onScheduleSend?: (date: string) => void;
  onRetry?: () => void;
  onCancel?: (reason: string) => void;
  onReopenDispatchPrep?: () => void;
  className?: string;
}

// ══════════════════════════════════════════════
// Timeline component
// ══════════════════════════════════════════════

function ExecutionTimeline({ timeline }: { timeline: ExecutionSurface["timeline"] }) {
  return (
    <div className="space-y-1">
      {timeline.map((step, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <span className={cn("h-2 w-2 rounded-full shrink-0",
            step.status === "completed" ? "bg-emerald-400" :
            step.status === "current" ? "bg-blue-400 animate-pulse" :
            step.status === "failed" ? "bg-red-400" :
            "bg-slate-600"
          )} />
          <span className={cn(
            step.status === "completed" ? "text-slate-400" :
            step.status === "current" ? "text-blue-300 font-medium" :
            step.status === "failed" ? "text-red-300" :
            "text-slate-600"
          )}>{step.label}</span>
          {step.timestamp && (
            <span className="text-[10px] text-slate-600 tabular-nums ml-auto">
              {new Date(step.timestamp).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// Status badge mapping
// ══════════════════════════════════════════════

const SURFACE_TO_BADGE: Record<string, "allowed" | "approval_needed" | "blocked"> = {
  emerald: "allowed",
  blue: "approval_needed",
  amber: "approval_needed",
  red: "blocked",
  slate: "blocked",
};

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function DispatchExecutionWorkbench({
  state, surface, payloadSnapshot,
  vendorName, totalAmount, poNumber,
  onSendNow, onScheduleSend, onRetry, onCancel, onReopenDispatchPrep,
  className,
}: DispatchExecutionWorkbenchProps) {
  const [railOpen, setRailOpen] = React.useState(false);

  return (
    <div className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:pb-0 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded border",
          `bg-${surface.statusColor}-500/5 border-${surface.statusColor}-500/20`
        )}>
          <PolicyStatusBadge
            status={SURFACE_TO_BADGE[surface.statusColor] || "blocked"}
            pulse={surface.status === "sending" || surface.status === "queued_to_send"}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">{surface.primaryMessage}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{surface.statusLabel}</p>
          </div>
        </div>

        {/* Execution timeline */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">발송 실행 경과</h3>
          <ExecutionTimeline timeline={surface.timeline} />
        </div>

        {/* Payload snapshot summary (frozen at send time) */}
        {payloadSnapshot && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">발송 Payload (고정본)</h3>
              <span className="text-[10px] text-slate-600">
                {new Date(payloadSnapshot.frozenAt).toLocaleString("ko-KR")} 고정
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs">PO 번호</span>
                <p className="text-slate-700 font-mono">{payloadSnapshot.poNumber}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">공급사</span>
                <p className="text-slate-700">{payloadSnapshot.vendorName}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">금액</span>
                <p className="text-sm font-semibold tabular-nums text-slate-900">{payloadSnapshot.totalAmount.toLocaleString()}원</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 text-xs text-slate-400">
              <div>
                <span className="text-slate-500">결제 조건</span>
                <p>{payloadSnapshot.paymentTerms}</p>
              </div>
              <div>
                <span className="text-slate-500">납품 조건</span>
                <p>{payloadSnapshot.deliveryTerms}</p>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              품목 {payloadSnapshot.lineItems.length}건 · 첨부 {payloadSnapshot.attachedDocumentIds.length}건
            </div>
          </div>
        )}

        {/* PO summary (when no snapshot yet) */}
        {!payloadSnapshot && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">발송 대상</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs">PO 번호</span>
                <p className="text-slate-700 font-mono">{poNumber}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">공급사</span>
                <p className="text-slate-700">{vendorName}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">금액</span>
                <p className="text-sm font-semibold tabular-nums text-slate-900">{totalAmount.toLocaleString()}원</p>
              </div>
            </div>
          </div>
        )}

        {/* Failure detail */}
        {state.status === "send_failed" && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-4 space-y-2">
            <h4 className="text-xs font-medium text-red-300">발송 실패</h4>
            <p className="text-xs text-red-300/80">{state.failureReason}</p>
            <div className="flex items-center gap-3 text-[10px] text-red-400/60">
              <span>시도 횟수: {state.retryCount}/{state.maxRetries}</span>
              {state.failureOccurredAt && (
                <span>실패 시각: {new Date(state.failureOccurredAt).toLocaleString("ko-KR")}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="mt-3 md:mt-0 md:w-64 lg:w-72 shrink-0">
        <button
          className="flex items-center justify-between w-full py-2 px-3 text-xs text-slate-500 md:hidden rounded border border-slate-800 bg-slate-900/50"
          onClick={() => setRailOpen(!railOpen)}
        >
          연결 정보 {railOpen ? "▲" : "▼"}
        </button>
        <div className={cn("overflow-hidden transition-all duration-200 md:max-h-none md:opacity-100", railOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
          <div className="space-y-3 md:space-y-3 mt-3 md:mt-0">
        {/* Snapshot linkage */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1.5">
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">연결 정보</h5>
          <div className="flex justify-between">
            <span className="text-slate-500">실행 ID</span>
            <span className="text-slate-600 font-mono text-[10px]">{state.executionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Dispatch Prep</span>
            <span className="text-slate-600 font-mono text-[10px]">{state.dispatchPreparationStateId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PO Created</span>
            <span className="text-slate-600 font-mono text-[10px]">{state.poCreatedObjectId}</span>
          </div>
          {state.payloadSnapshotId && (
            <div className="flex justify-between">
              <span className="text-slate-500">Payload Snapshot</span>
              <span className="text-emerald-400 font-mono text-[10px]">{state.payloadSnapshotId}</span>
            </div>
          )}
        </div>

        {/* Retry info (when failed) */}
        {state.status === "send_failed" && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-xs">
            <h5 className="text-[10px] font-medium text-red-400 mb-1">재시도 정보</h5>
            <div className="flex justify-between">
              <span className="text-red-400/70">남은 재시도</span>
              <span className="text-red-300">{state.maxRetries - state.retryCount}회</span>
            </div>
            {state.retryCount >= state.maxRetries && (
              <p className="text-red-400/70 mt-1">최대 재시도 횟수 초과 — 수동 처리 필요</p>
            )}
          </div>
        )}

            {/* Schedule info */}
            {state.scheduledSendAt && state.status === "scheduled" && (
              <div className="rounded border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
                <h5 className="text-[10px] font-medium text-blue-400 mb-1">예약 발송</h5>
                <p className="text-blue-300">
                  {new Date(state.scheduledSendAt).toLocaleString("ko-KR")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:absolute md:bottom-auto border-t border-slate-800 bg-slate-950 px-3 md:px-4 py-2 md:py-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <NextActionHint
            message={surface.nextAction}
            variant={surface.status === "send_failed" ? "blocked" : surface.status === "sent" ? "default" : "default"}
          />
          <div className="flex flex-wrap gap-2 w-full md:w-auto md:shrink-0 md:ml-4">
            {/* Cancel — 비종료 상태에서만 */}
            {onCancel && surface.canCancel && (
              <button onClick={() => onCancel("")} className="min-h-[40px] flex-1 md:flex-none rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors">
                발송 취소
              </button>
            )}
            {/* Reopen dispatch prep — cancelled 상태에서 */}
            {onReopenDispatchPrep && state.status === "cancelled" && (
              <button onClick={onReopenDispatchPrep} className="min-h-[40px] flex-1 md:flex-none rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">
                Dispatch Prep 재열기
              </button>
            )}
            {/* Retry — send_failed에서만 */}
            {onRetry && surface.canRetry && (
              <button onClick={onRetry} className="min-h-[40px] flex-1 md:flex-none rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors">
                재시도 ({state.maxRetries - state.retryCount}회 남음)
              </button>
            )}
            {/* Schedule — draft에서만 */}
            {onScheduleSend && surface.canSchedule && (
              <button onClick={() => onScheduleSend("")} className="min-h-[40px] flex-1 md:flex-none rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors">
                예약 발송
              </button>
            )}
            {/* Send now — draft 또는 scheduled에서 */}
            {onSendNow && surface.canSendNow && (
              <button onClick={onSendNow} className="min-h-[40px] flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 active:scale-95 px-4 py-1.5 text-xs font-medium text-white transition-colors">
                즉시 발송
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

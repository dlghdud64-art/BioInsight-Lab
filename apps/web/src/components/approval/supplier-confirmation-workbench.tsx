"use client";

/**
 * SupplierConfirmationWorkbench — 공급사 응답 검토 center/rail/dock
 *
 * center = supplier response delta-first (가격/수량/ETA/조건 변경 비교)
 * rail = sent payload snapshot / original approval basis / supplier profile
 * dock = accept / request correction / reopen approval / reopen conversion / cancel
 *
 * RULE: supplier response는 internal truth를 바로 덮지 않음.
 * operator review 후에만 downstream truth로 반영.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, NextActionHint } from "./index";
import type {
  SupplierConfirmationGovernanceState,
  ConfirmationGovernanceSurface,
  ResponseDelta,
  LineDelta,
  SupplierProposedChange,
} from "@/lib/ai/supplier-confirmation-governance-engine";

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface SupplierConfirmationWorkbenchProps {
  state: SupplierConfirmationGovernanceState;
  surface: ConfirmationGovernanceSurface;
  // Evidence
  vendorName: string;
  totalAmount: number;
  poNumber: string;
  // Handlers
  onAccept?: (withModifications: boolean, notes: string) => void;
  onRequestCorrection?: (notes: string) => void;
  onReopenApproval?: () => void;
  onReopenConversion?: () => void;
  onCancel?: (reason: string) => void;
  className?: string;
}

// ══════════════════════════════════════════════
// Delta display components
// ══════════════════════════════════════════════

function LineDeltaRow({ delta }: { delta: LineDelta }) {
  const directionColors: Record<string, string> = {
    increased: "text-red-300",
    decreased: "text-amber-300",
    changed: "text-amber-300",
    rejected: "text-red-400",
  };

  const directionLabels: Record<string, string> = {
    increased: "증가",
    decreased: "감소",
    changed: "변경",
    rejected: "거부",
  };

  const fieldLabels: Record<string, string> = {
    quantity: "수량",
    price: "단가",
    acceptance: "수락",
  };

  return (
    <div className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-800/50 last:border-0">
      <span className="text-slate-400 w-24 truncate">{delta.itemName}</span>
      <span className="text-slate-500 w-12">{fieldLabels[delta.field]}</span>
      <span className="text-slate-500 tabular-nums">{delta.original}</span>
      <span className="text-slate-600">→</span>
      <span className={cn("tabular-nums font-medium", directionColors[delta.direction])}>
        {delta.confirmed}
      </span>
      <span className={cn("text-[10px] ml-auto", directionColors[delta.direction])}>
        {directionLabels[delta.direction]}
      </span>
    </div>
  );
}

function TermChangeRow({ change }: { change: SupplierProposedChange }) {
  const severityColors: Record<string, string> = {
    minor: "border-slate-700 bg-slate-800",
    major: "border-amber-500/20 bg-amber-500/5",
    critical: "border-red-500/20 bg-red-500/5",
  };

  return (
    <div className={cn("rounded border p-2 text-xs", severityColors[change.severity])}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 font-medium">{change.field}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded",
          change.severity === "critical" ? "bg-red-500/20 text-red-300" :
          change.severity === "major" ? "bg-amber-500/20 text-amber-300" :
          "bg-slate-700 text-slate-400"
        )}>{change.severity}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-slate-500">{change.originalValue}</span>
        <span className="text-slate-600">→</span>
        <span className="text-slate-700">{change.proposedValue}</span>
      </div>
      {change.changeReason && (
        <p className="text-[10px] text-slate-500 mt-1">{change.changeReason}</p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function SupplierConfirmationWorkbench({
  state, surface, vendorName, totalAmount, poNumber,
  onAccept, onRequestCorrection, onReopenApproval, onReopenConversion, onCancel,
  className,
}: SupplierConfirmationWorkbenchProps) {
  const [notes, setNotes] = React.useState("");
  const [railOpen, setRailOpen] = React.useState(false);

  return (
    <div className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:pb-0 h-full", className)}>
      {/* ═══ CENTER — delta-first ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge
            status={surface.statusColor === "emerald" ? "allowed" : surface.statusColor === "red" ? "blocked" : "approval_needed"}
            pulse={surface.status === "awaiting_response"}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">{surface.primaryMessage}</p>
            {surface.deadlineMessage && (
              <p className={cn("text-[10px] mt-0.5", surface.isOverdue ? "text-red-400" : "text-slate-500")}>
                {surface.deadlineMessage}
              </p>
            )}
          </div>
        </div>

        {/* Delta summary — 가장 중요한 영역 */}
        {surface.delta && surface.delta.totalDeltaCount > 0 && (
          <div className={cn("rounded border p-3 md:p-4 space-y-3",
            surface.delta.hasCriticalDelta ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">공급사 응답 변경 사항</h3>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded",
                surface.delta.hasCriticalDelta ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"
              )}>
                {surface.delta.summaryMessage}
              </span>
            </div>

            {/* Line deltas */}
            {surface.delta.lineDeltas.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-slate-500 mb-1">품목 변경</h4>
                {surface.delta.lineDeltas.map((d, i) => (
                  <LineDeltaRow key={i} delta={d} />
                ))}
              </div>
            )}

            {/* Term changes */}
            {surface.delta.termDeltas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-medium text-slate-500">조건 변경</h4>
                {surface.delta.termDeltas.map((c, i) => (
                  <TermChangeRow key={i} change={c} />
                ))}
              </div>
            )}

            {/* Delivery date delta */}
            {surface.delta.deliveryDelta && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">납기</span>
                <span className="text-slate-400">{surface.delta.deliveryDelta.original || "미설정"}</span>
                <span className="text-slate-600">→</span>
                <span className="text-amber-300 font-medium">{surface.delta.deliveryDelta.confirmed || "미설정"}</span>
              </div>
            )}
          </div>
        )}

        {/* No changes — clean confirmation */}
        {surface.delta && surface.delta.totalDeltaCount === 0 && state.status !== "awaiting_response" && (
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm text-emerald-300 font-medium">변경 없음 — 공급사 원안 수락</p>
          </div>
        )}

        {/* Awaiting state */}
        {state.status === "awaiting_response" && (
          <div className="rounded border border-blue-500/20 bg-blue-500/5 p-4 text-center">
            <p className="text-sm text-blue-300">공급사 응답 대기 중</p>
            <p className="text-[10px] text-slate-500 mt-1">PO {poNumber} · {vendorName}</p>
          </div>
        )}

        {/* Supplier message */}
        {state.responseSnapshot?.supplierMessage && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">공급사 메시지</h4>
            <p className="text-xs text-slate-600">{state.responseSnapshot.supplierMessage}</p>
          </div>
        )}

        {/* Operator notes input */}
        {(surface.canAccept || surface.canRequestCorrection) && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">검토 의견</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="수락/보정 사유..."
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-700 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="mt-3 md:mt-0 md:w-64 lg:w-72 shrink-0">
        <button
          className="flex items-center justify-between w-full py-2 px-3 text-xs text-slate-500 md:hidden rounded border border-slate-800 bg-slate-900/50"
          onClick={() => setRailOpen(!railOpen)}
        >
          발송 기준 {railOpen ? "▲" : "▼"}
        </button>
        <div className={cn("overflow-hidden transition-all duration-200 md:max-h-none md:opacity-100", railOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
          <div className="space-y-3 mt-3 md:mt-0">
        {/* Sent payload snapshot reference */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1.5">
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">발송 기준</h5>
          <div className="flex justify-between">
            <span className="text-slate-500">PO 번호</span>
            <span className="text-slate-600 font-mono">{poNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">공급사</span>
            <span className="text-slate-600">{vendorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">발송 금액</span>
            <span className="text-slate-600 tabular-nums">{totalAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payload Snapshot</span>
            <span className="text-slate-400 font-mono text-[10px]">{state.payloadSnapshotId}</span>
          </div>
        </div>

        {/* Chain linkage */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1.5">
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">체인 연결</h5>
          <div className="flex justify-between">
            <span className="text-slate-500">Execution</span>
            <span className="text-slate-400 font-mono text-[10px]">{state.executionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PO Created</span>
            <span className="text-slate-400 font-mono text-[10px]">{state.poCreatedObjectId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Approval</span>
            <span className="text-slate-400 font-mono text-[10px]">{state.approvalDecisionObjectId}</span>
          </div>
        </div>

        {/* Response info */}
        {state.responseSnapshot && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1.5">
            <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">응답 정보</h5>
            <div className="flex justify-between">
              <span className="text-slate-500">응답자</span>
              <span className="text-slate-600">{state.responseSnapshot.respondedBy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">채널</span>
              <span className="text-slate-600">{state.responseSnapshot.responseChannel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">수신 시각</span>
              <span className="text-slate-600 text-[10px]">
                {new Date(state.responseSnapshot.receivedAt).toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        )}

            {/* Operator review status */}
            <div className={cn("rounded border p-3 text-xs",
              state.operatorReviewStatus === "completed" ? "border-emerald-500/20 bg-emerald-500/5" : "border-slate-800 bg-slate-900/50"
            )}>
              <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">검토 상태</h5>
              <p className={state.operatorReviewStatus === "completed" ? "text-emerald-400" : "text-slate-400"}>
                {state.operatorReviewStatus === "not_started" ? "검토 미시작" :
                 state.operatorReviewStatus === "in_progress" ? "검토 진행 중" : "검토 완료"}
              </p>
              {state.operatorDecision !== "pending" && (
                <p className="text-slate-500 mt-0.5">결정: {state.operatorDecision}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:absolute md:bottom-auto border-t border-slate-800 bg-slate-950 px-3 md:px-4 py-2 md:py-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <NextActionHint
            message={surface.nextAction}
            variant={surface.statusColor === "red" ? "blocked" : "default"}
          />
          <div className="flex flex-wrap gap-2 w-full md:w-auto md:shrink-0 md:ml-4">
            {onCancel && surface.canCancel && (
              <button onClick={() => onCancel(notes)} className="min-h-[40px] flex-1 md:flex-none rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors">
                취소
              </button>
            )}
            {onReopenConversion && surface.canReopenConversion && (
              <button onClick={onReopenConversion} className="min-h-[40px] flex-1 md:flex-none rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">
                PO 전환 재열기
              </button>
            )}
            {onReopenApproval && surface.canReopenApproval && (
              <button onClick={onReopenApproval} className="min-h-[40px] flex-1 md:flex-none rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">
                승인 재열기
              </button>
            )}
            {onRequestCorrection && surface.canRequestCorrection && (
              <button onClick={() => onRequestCorrection(notes)} className="min-h-[40px] flex-1 md:flex-none rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 active:scale-95 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
                보정 요청
              </button>
            )}
            {onAccept && surface.canAccept && (
              <button
                onClick={() => onAccept(state.totalChangeCount > 0, notes)}
                disabled={!notes.trim() && state.totalChangeCount > 0}
                className="min-h-[40px] flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 active:scale-95 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
              >
                {state.totalChangeCount > 0 ? "변경 수락" : "확인 수락"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

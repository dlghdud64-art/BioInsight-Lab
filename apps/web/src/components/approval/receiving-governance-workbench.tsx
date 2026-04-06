"use client";

/**
 * Receiving Governance Workbench — Receiving Preparation + Receiving Execution governance UI
 *
 * 기존 receiving-workbench.tsx의 field-level UI 위에
 * governance grammar (blocker/checklist/state machine/delta-first/discrepancy) 추가.
 *
 * 2개 surface:
 * 1. ReceivingPrepGovernanceWorkbench — 입고 준비 governance (blocker/checklist/scheduling)
 * 2. ReceivingExecutionGovernanceWorkbench — 실물 입고 (delta-first, line receipt, discrepancy)
 *
 * center = expected vs actual delta + discrepancy
 * rail = supplier confirmation basis + site/handling context + chain linkage
 * dock = confirm receipt / mark partial / quarantine / reopen upstream
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ReceivingPrepSurface, ReceivingPreparationGovernanceState } from "@/lib/ai/receiving-preparation-governance-engine";
import type { ReceivingExecutionGovSurface, ReceivingExecutionGovernanceState } from "@/lib/ai/receiving-execution-governance-engine";

// ══════════════════════════════════════════════
// ReceivingPrepGovernanceWorkbench — 입고 준비
// ══════════════════════════════════════════════

export interface ReceivingPrepGovernanceWorkbenchProps {
  state: ReceivingPreparationGovernanceState;
  surface: ReceivingPrepSurface;
  onStartReceiving?: () => void;
  onSchedule?: (date: string) => void;
  onCancel?: () => void;
  onReopenConfirmation?: () => void;
  className?: string;
}

const PREP_STATUS_BG: Record<string, string> = {
  allowed: "border-emerald-500/20 bg-emerald-500/5",
  blocked: "border-red-500/20 bg-red-500/5",
  needs_review: "border-amber-500/20 bg-amber-500/5",
  scheduled: "border-blue-500/20 bg-blue-500/5",
  cancelled: "border-slate-600/20 bg-slate-800/50",
};

const PREP_STATUS_TEXT: Record<string, string> = {
  allowed: "text-emerald-400",
  blocked: "text-red-400",
  needs_review: "text-amber-400",
  scheduled: "text-blue-400",
  cancelled: "text-slate-500",
};

export function ReceivingPrepGovernanceWorkbench({
  state, surface, onStartReceiving, onSchedule, onCancel, onReopenConfirmation, className,
}: ReceivingPrepGovernanceWorkbenchProps) {
  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ── Center ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded border", PREP_STATUS_BG[surface.statusBadge])}>
          <span className={cn("h-2 w-2 rounded-full shrink-0", surface.statusColor === "emerald" ? "bg-emerald-400" : surface.statusColor === "red" ? "bg-red-400" : surface.statusColor === "amber" ? "bg-amber-400" : surface.statusColor === "blue" ? "bg-blue-400" : "bg-slate-500")} />
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", PREP_STATUS_TEXT[surface.statusBadge])}>{surface.primaryMessage}</p>
            <p className="text-xs text-slate-500 mt-0.5">{surface.nextAction}</p>
          </div>
        </div>

        {/* Expected receipt summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">예상 입고</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">라인</span><p className="text-slate-700">{surface.expectedLineCount}건</p></div>
            <div><span className="text-slate-500 text-xs">금액</span><p className="text-sm font-semibold tabular-nums text-slate-900">{surface.expectedTotalAmount.toLocaleString()}원</p></div>
            <div><span className="text-slate-500 text-xs">예정일</span><p className="text-slate-700">{surface.expectedDeliveryDate ? new Date(surface.expectedDeliveryDate).toLocaleDateString("ko-KR") : "미정"}</p></div>
          </div>
        </div>

        {/* Blockers */}
        {surface.blockerMessages.length > 0 && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-1">
            <h4 className="text-[10px] font-medium text-red-400 uppercase tracking-wider">차단 사항</h4>
            {surface.blockerMessages.map((msg, i) => (
              <p key={i} className="text-xs text-red-300">{msg}</p>
            ))}
          </div>
        )}

        {/* Warnings */}
        {surface.warningMessages.length > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
            <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">검토 필요</h4>
            {surface.warningMessages.map((msg, i) => (
              <p key={i} className="text-xs text-amber-300">{msg}</p>
            ))}
          </div>
        )}

        {/* Checklist */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">입고 준비 체크리스트</h4>
            <span className="text-[10px] tabular-nums text-slate-400">{surface.checklistProgress}</span>
          </div>
          {state.confirmationChecklist.map(item => (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <span className={cn("h-1.5 w-1.5 rounded-full", item.confirmed ? "bg-emerald-400" : item.required ? "bg-red-400" : "bg-slate-600")} />
              <span className={item.confirmed ? "text-slate-600" : item.required ? "text-red-300" : "text-slate-500"}>{item.label}</span>
              {item.required && !item.confirmed && <span className="text-[9px] text-red-500 ml-auto">필수</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Rail ── */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Site/handling */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">수령 사이트</h4>
          <div><span className="text-slate-500">사이트</span><p className="text-slate-600">{state.receivingSite || "미지정"}</p></div>
          <div><span className="text-slate-500">보관</span><p className="text-slate-600">{state.storageLocation || "미지정"}</p></div>
          {state.requiresColdChain && <p className="text-blue-400">콜드체인 필수</p>}
          {state.requiresHazardHandling && <p className="text-amber-400">위험물 취급</p>}
          {state.handlingInstructions && <p className="text-slate-400">{state.handlingInstructions}</p>}
        </div>

        {/* Shipment */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">배송 정보</h4>
          <div><span className="text-slate-500">참조번호</span><p className="text-slate-600 font-mono">{state.shipmentReference || "—"}</p></div>
          <div><span className="text-slate-500">운송장</span><p className="text-slate-600 font-mono">{state.trackingNumber || "—"}</p></div>
          <div><span className="text-slate-500">운송사</span><p className="text-slate-600">{state.carrier || "—"}</p></div>
        </div>

        {/* Chain linkage */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">체인 연결</h4>
          <div className="flex justify-between"><span className="text-slate-500">PO</span><span className="text-slate-400 font-mono">{state.poNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">확인</span><span className="text-slate-400 font-mono truncate ml-2">{state.confirmationGovernanceId}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">실행</span><span className="text-slate-400 font-mono truncate ml-2">{state.executionId}</span></div>
        </div>
      </div>

      {/* ── Dock ── */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{surface.nextAction}</span>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {surface.canCancel && (
              <button onClick={onCancel} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-600 transition-colors">취소</button>
            )}
            {surface.canReopenConfirmation && (
              <button onClick={onReopenConfirmation} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition-colors">공급사 확인 재열기</button>
            )}
            {surface.canSchedule && (
              <button onClick={() => onSchedule?.(new Date().toISOString())} className="rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs text-blue-300 transition-colors">예약 입고</button>
            )}
            {surface.canStartReceiving && (
              <button onClick={onStartReceiving} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">입고 시작</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ReceivingExecutionGovernanceWorkbench — 입고 실행
// ══════════════════════════════════════════════

export interface ReceivingExecutionGovernanceWorkbenchProps {
  state: ReceivingExecutionGovernanceState;
  surface: ReceivingExecutionGovSurface;
  onRecordLine?: (lineId: string) => void;
  onMarkPartial?: () => void;
  onMarkComplete?: () => void;
  onMarkDiscrepancy?: () => void;
  onQuarantine?: () => void;
  onResolveDiscrepancy?: (discrepancyId: string) => void;
  onCancel?: () => void;
  onReopenPrep?: () => void;
  className?: string;
}

const MATCH_COLOR: Record<string, string> = {
  exact: "text-emerald-400",
  over: "text-amber-400",
  under: "text-red-400",
  zero: "text-red-500",
  pending: "text-slate-500",
};

const MATCH_ICON: Record<string, string> = {
  exact: "=",
  over: "↑",
  under: "↓",
  zero: "×",
  pending: "…",
};

export function ReceivingExecutionGovernanceWorkbench({
  state, surface, onRecordLine, onMarkPartial, onMarkComplete, onMarkDiscrepancy,
  onQuarantine, onResolveDiscrepancy, onCancel, onReopenPrep, className,
}: ReceivingExecutionGovernanceWorkbenchProps) {
  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ── Center ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded border border-slate-800 bg-slate-900">
          <span className={cn("h-2 w-2 rounded-full shrink-0",
            surface.statusColor === "emerald" ? "bg-emerald-400" :
            surface.statusColor === "red" ? "bg-red-400" :
            surface.statusColor === "amber" ? "bg-amber-400 animate-pulse" :
            surface.statusColor === "blue" ? "bg-blue-400" : "bg-slate-500"
          )} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">{surface.primaryMessage}</p>
            <p className="text-xs text-slate-500 mt-0.5">{surface.nextAction}</p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums text-slate-900">{surface.completeness}%</p>
            <p className="text-[10px] text-slate-500">완료</p>
          </div>
        </div>

        {/* Expected vs Received delta — center 최상단 */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">품목</th>
                <th className="px-3 py-2 text-right font-medium">예상</th>
                <th className="px-3 py-2 text-center font-medium">→</th>
                <th className="px-3 py-2 text-right font-medium">실수령</th>
                <th className="px-3 py-2 text-center font-medium">상태</th>
                <th className="px-3 py-2 text-left font-medium">이슈</th>
                {surface.canRecordLine && <th className="px-3 py-2 text-center font-medium w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {surface.lineDelta.map(line => (
                <tr key={line.lineId} className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-700">{line.itemName}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{line.expected}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600">→</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium", MATCH_COLOR[line.match])}>{line.received}</td>
                  <td className={cn("px-3 py-1.5 text-center font-mono", MATCH_COLOR[line.match])}>{MATCH_ICON[line.match]}</td>
                  <td className="px-3 py-1.5 text-slate-500">{line.issues.length > 0 ? line.issues.join(", ") : "—"}</td>
                  {surface.canRecordLine && (
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={() => onRecordLine?.(line.lineId)} className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-600 transition-colors">기록</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Discrepancy cards */}
        {state.discrepancies.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-red-400">불일치 ({surface.unresolvedDiscrepancyCount}건 미해결)</h4>
            {state.discrepancies.map(disc => (
              <div key={disc.discrepancyId} className={cn(
                "rounded border p-3 flex items-start justify-between",
                disc.resolution === "pending"
                  ? disc.severity === "critical" ? "border-red-500/30 bg-red-500/5" : disc.severity === "major" ? "border-amber-500/30 bg-amber-500/5" : "border-slate-700 bg-slate-900/50"
                  : "border-slate-800 bg-slate-900/30 opacity-60"
              )}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded",
                      disc.severity === "critical" ? "bg-red-500/20 text-red-300" :
                      disc.severity === "major" ? "bg-amber-500/20 text-amber-300" :
                      "bg-slate-700 text-slate-400"
                    )}>{disc.severity}</span>
                    <span className="text-xs text-slate-400">{disc.type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-slate-600">{disc.detail}</p>
                  {disc.resolution !== "pending" && (
                    <p className="text-[10px] text-slate-500">처리: {disc.resolution} — {disc.resolutionNote}</p>
                  )}
                </div>
                {disc.resolution === "pending" && onResolveDiscrepancy && (
                  <button onClick={() => onResolveDiscrepancy(disc.discrepancyId)} className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] text-slate-600 transition-colors shrink-0 ml-3">처리</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rail ── */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">입고 요약</h4>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">예상</span><p className="text-slate-700 tabular-nums">{surface.expectedLineCount}건</p></div>
            <div><span className="text-slate-500">수령</span><p className="text-slate-700 tabular-nums">{surface.receivedLineCount}건</p></div>
            <div><span className="text-slate-500">수락</span><p className="text-emerald-400 tabular-nums">{surface.acceptedCount}</p></div>
            <div><span className="text-slate-500">거부</span><p className="text-red-400 tabular-nums">{surface.rejectedCount}</p></div>
            <div><span className="text-slate-500">대기</span><p className="text-slate-400 tabular-nums">{surface.pendingCount}</p></div>
            <div><span className="text-slate-500">격리</span><p className="text-red-400 tabular-nums">{surface.quarantinedCount}</p></div>
          </div>
        </div>

        {/* Site info */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">수령 사이트</h4>
          <p className="text-slate-600">{state.receivingSite}</p>
          <p className="text-slate-400">{state.storageLocation}</p>
        </div>

        {/* Chain linkage */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">체인 연결</h4>
          <div className="flex justify-between"><span className="text-slate-500">PO</span><span className="text-slate-400 font-mono">{state.poNumber}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Prep</span><span className="text-slate-400 font-mono truncate ml-2">{state.receivingPrepStateId}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">확인</span><span className="text-slate-400 font-mono truncate ml-2">{state.confirmationGovernanceId}</span></div>
        </div>
      </div>

      {/* ── Dock ── */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{surface.nextAction}</span>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {surface.canCancel && (
              <button onClick={onCancel} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-600 transition-colors">취소</button>
            )}
            {surface.canReopenPrep && (
              <button onClick={onReopenPrep} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition-colors">Receiving Prep 재열기</button>
            )}
            {surface.canQuarantine && (
              <button onClick={onQuarantine} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs text-red-300 transition-colors">격리</button>
            )}
            {surface.canMarkDiscrepancy && (
              <button onClick={onMarkDiscrepancy} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs text-amber-300 transition-colors">불일치 보고</button>
            )}
            {surface.canMarkPartial && (
              <button onClick={onMarkPartial} className="rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs text-blue-300 transition-colors">부분 입고</button>
            )}
            {surface.canStartReceiving && (
              <button className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">입고 시작</button>
            )}
            {surface.canMarkComplete && (
              <button onClick={onMarkComplete} className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">입고 완료</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

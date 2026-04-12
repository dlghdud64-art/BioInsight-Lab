"use client";

/**
 * Stock Release Governance Workbench — 품질/안전/준법 릴리즈 governance UI
 *
 * received ≠ available stock.
 * receiving execution governance → stock release gate → quality/safety hold → release → available stock
 *
 * center = line-level release/held delta + hold cards + review status
 * rail = receiving basis + site context + chain linkage + review completion
 * dock = evaluate / hold / resolve / partial release / full release / cancel / reopen receiving
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  StockReleaseGovernanceState,
  StockReleaseGovSurface,
  StockHold,
} from "@/lib/ai/stock-release-governance-engine";

// ══════════════════════════════════════════════
// StockReleaseGovernanceWorkbench
// ══════════════════════════════════════════════

export interface StockReleaseGovernanceWorkbenchProps {
  state: StockReleaseGovernanceState;
  surface: StockReleaseGovSurface;
  onStartEvaluation?: () => void;
  onEvaluateLine?: (lineId: string) => void;
  onPlaceHold?: () => void;
  onResolveHold?: (holdId: string) => void;
  onCompleteReview?: (type: "quality" | "safety" | "compliance") => void;
  onPartialRelease?: () => void;
  onFullRelease?: () => void;
  onCancel?: () => void;
  onReopenReceiving?: () => void;
  className?: string;
}

const STATUS_BG: Record<string, string> = {
  slate: "border-slate-600/20 bg-slate-800/50",
  blue: "border-blue-500/20 bg-blue-500/5",
  amber: "border-amber-500/20 bg-amber-500/5",
  emerald: "border-emerald-500/20 bg-emerald-500/5",
  red: "border-red-500/20 bg-red-500/5",
};

const STATUS_DOT: Record<string, string> = {
  slate: "bg-slate-500",
  blue: "bg-blue-400",
  amber: "bg-amber-400 animate-pulse",
  emerald: "bg-emerald-400",
  red: "bg-red-400",
};

const DECISION_COLOR: Record<string, string> = {
  release: "text-emerald-400",
  hold: "text-amber-400",
  return: "text-red-400",
  destroy: "text-red-500",
  pending: "text-slate-500",
};

const DECISION_LABEL: Record<string, string> = {
  release: "릴리즈",
  hold: "보류",
  return: "반품",
  destroy: "폐기",
  pending: "미평가",
};

const QUALITY_COLOR: Record<string, string> = {
  passed: "text-emerald-400",
  pending: "text-slate-500",
  failed: "text-red-400",
  hold: "text-amber-400",
};

const QUALITY_LABEL: Record<string, string> = {
  passed: "통과",
  pending: "미검증",
  failed: "실패",
  hold: "보류",
};

export function StockReleaseGovernanceWorkbench({
  state, surface,
  onStartEvaluation, onEvaluateLine, onPlaceHold, onResolveHold,
  onCompleteReview, onPartialRelease, onFullRelease, onCancel, onReopenReceiving,
  className,
}: StockReleaseGovernanceWorkbenchProps) {
  const [railOpen, setRailOpen] = React.useState(false);

  return (
    <div className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:pb-0 h-full", className)}>
      {/* ── Center ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded border", STATUS_BG[surface.statusColor])}>
          <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[surface.statusColor])} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">{surface.primaryMessage}</p>
            <p className="text-xs text-slate-500 mt-0.5">{surface.nextAction}</p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums text-slate-900">{surface.completeness}%</p>
            <p className="text-[10px] text-slate-500">릴리즈</p>
          </div>
        </div>

        {/* Review gates */}
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-slate-800 bg-slate-900/50">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mr-2">게이트</span>
          {[
            { label: "품질", done: surface.qualityDone, key: "quality" as const },
            { label: "안전", done: surface.safetyDone, key: "safety" as const },
            { label: "준법", done: surface.complianceDone, key: "compliance" as const },
          ].map(gate => (
            <button
              key={gate.key}
              onClick={() => !gate.done && onCompleteReview?.(gate.key)}
              disabled={gate.done || surface.isTerminal}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors",
                gate.done
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700",
                (gate.done || surface.isTerminal) && "cursor-default",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", gate.done ? "bg-emerald-400" : "bg-slate-600")} />
              <span>{gate.label}</span>
              {gate.done && <span className="ml-0.5">완료</span>}
            </button>
          ))}
          {surface.allReviewsDone && (
            <span className="text-[10px] text-emerald-400 ml-auto">전체 리뷰 완료</span>
          )}
        </div>

        {/* Line-level release/held delta */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-x-auto">
          <table className="w-full min-w-[500px] text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">품목</th>
                <th className="px-3 py-2 text-right font-medium">수령</th>
                <th className="px-3 py-2 text-center font-medium">→</th>
                <th className="px-3 py-2 text-right font-medium">릴리즈</th>
                <th className="px-3 py-2 text-right font-medium">보류</th>
                <th className="px-3 py-2 text-center font-medium">품질</th>
                <th className="px-3 py-2 text-center font-medium">판정</th>
                <th className="px-3 py-2 text-left font-medium">사유</th>
                {!surface.isTerminal && <th className="px-3 py-2 text-center font-medium w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {surface.lineDecisions.map(line => (
                <tr key={line.lineId} className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-700">{line.itemName}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{line.received}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600">→</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium", line.releasable > 0 ? "text-emerald-400" : "text-slate-600")}>{line.releasable}</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums", line.held > 0 ? "text-amber-400" : "text-slate-600")}>{line.held}</td>
                  <td className={cn("px-3 py-1.5 text-center", QUALITY_COLOR[line.qualityStatus])}>{QUALITY_LABEL[line.qualityStatus]}</td>
                  <td className={cn("px-3 py-1.5 text-center font-medium", DECISION_COLOR[line.decision])}>{DECISION_LABEL[line.decision]}</td>
                  <td className="px-3 py-1.5 text-slate-500 max-w-[120px] truncate">{line.holdReasons.length > 0 ? line.holdReasons[0] : "—"}</td>
                  {!surface.isTerminal && (
                    <td className="px-3 py-1.5 text-center">
                      {line.decision === "pending" && (
                        <button onClick={() => onEvaluateLine?.(line.lineId)} className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px] text-slate-600 transition-colors">평가</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Active holds */}
        {state.activeHolds.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-amber-400">활성 보류 ({surface.activeHoldCount}건)</h4>
            {state.activeHolds.map(hold => (
              <div key={hold.holdId} className={cn(
                "rounded border p-3 flex items-start justify-between",
                hold.severity === "hard" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"
              )}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded",
                      hold.severity === "hard" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"
                    )}>{hold.severity}</span>
                    <span className="text-xs text-slate-400">{hold.type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-slate-600">{hold.reason}</p>
                  <p className="text-[10px] text-slate-500">영향 라인: {hold.affectedLineIds.length}건</p>
                </div>
                {onResolveHold && (
                  <button onClick={() => onResolveHold(hold.holdId)} className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] text-slate-600 transition-colors shrink-0 ml-3">처리</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Resolved holds (collapsed summary) */}
        {state.resolvedHolds.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/30 p-3">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">해결된 보류 ({state.resolvedHolds.length}건)</h4>
            <div className="flex flex-wrap gap-1">
              {state.resolvedHolds.map(hold => (
                <span key={hold.holdId} className="text-[9px] bg-slate-800 text-slate-500 rounded px-1.5 py-0.5">
                  {hold.type.replace(/_/g, " ")} → {hold.resolution}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Rail ── */}
      <div className="mt-3 md:mt-0 md:w-64 lg:w-72 shrink-0">
        <button
          className="flex items-center justify-between w-full py-2 px-3 text-xs text-slate-500 md:hidden rounded border border-slate-800 bg-slate-900/50"
          onClick={() => setRailOpen(!railOpen)}
        >
          릴리즈 요약 {railOpen ? "▲" : "▼"}
        </button>
        <div className={cn("overflow-hidden transition-all duration-200 md:max-h-none md:opacity-100", railOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
          <div className="space-y-3 mt-3 md:mt-0">
        {/* Release summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">릴리즈 요약</h4>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">수령</span><p className="text-slate-700 tabular-nums">{surface.totalReceived}개</p></div>
            <div><span className="text-slate-500">릴리즈</span><p className="text-emerald-400 tabular-nums">{surface.totalReleasable}개</p></div>
            <div><span className="text-slate-500">보류</span><p className="text-amber-400 tabular-nums">{surface.totalHeld}개</p></div>
            <div><span className="text-slate-500">완료율</span><p className="text-slate-700 tabular-nums">{surface.completeness}%</p></div>
          </div>
          <div className="border-t border-slate-800 pt-2 mt-2 grid grid-cols-3 gap-1 text-center">
            <div><p className="text-emerald-400 tabular-nums font-medium">{surface.releasedCount}</p><span className="text-slate-500 text-[9px]">릴리즈</span></div>
            <div><p className="text-amber-400 tabular-nums font-medium">{surface.heldCount}</p><span className="text-slate-500 text-[9px]">보류</span></div>
            <div><p className="text-slate-400 tabular-nums font-medium">{surface.pendingCount}</p><span className="text-slate-500 text-[9px]">대기</span></div>
          </div>
        </div>

        {/* Review completion */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">리뷰 상태</h4>
          {[
            { label: "품질 리뷰", done: surface.qualityDone },
            { label: "안전 리뷰", done: surface.safetyDone },
            { label: "준법 리뷰", done: surface.complianceDone },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full", r.done ? "bg-emerald-400" : "bg-slate-600")} />
              <span className={r.done ? "text-emerald-400" : "text-slate-500"}>{r.label}</span>
              <span className="ml-auto text-[9px]">{r.done ? "완료" : "미완료"}</span>
            </div>
          ))}
        </div>

        {/* Site info */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">보관 위치</h4>
          <p className="text-slate-600">{state.receivingSite}</p>
          <p className="text-slate-400">{state.storageLocation}</p>
        </div>

            {/* Chain linkage */}
            <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
              <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">체인 연결</h4>
              <div className="flex justify-between"><span className="text-slate-500">PO</span><span className="text-slate-400 font-mono">{state.poNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">입고실행</span><span className="text-slate-400 font-mono truncate ml-2">{state.receivingExecutionId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">확인</span><span className="text-slate-400 font-mono truncate ml-2">{state.confirmationGovernanceId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">PO객체</span><span className="text-slate-400 font-mono truncate ml-2">{state.poCreatedObjectId}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dock ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:absolute md:bottom-auto border-t border-slate-800 bg-slate-950 px-3 md:px-4 py-2 md:py-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{surface.nextAction}</span>
          <div className="flex flex-wrap gap-2 w-full md:w-auto md:shrink-0 md:ml-4">
            {surface.canCancel && (
              <button onClick={onCancel} className="min-h-[40px] flex-1 md:flex-none rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 active:scale-95 px-3 py-1.5 text-xs text-slate-600 transition-colors">취소</button>
            )}
            {surface.canReopenReceiving && (
              <button onClick={onReopenReceiving} className="min-h-[40px] flex-1 md:flex-none rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 px-3 py-1.5 text-xs text-amber-300 transition-colors">Receiving 재열기</button>
            )}
            {surface.canPlaceHold && !surface.isTerminal && (
              <button onClick={onPlaceHold} className="min-h-[40px] flex-1 md:flex-none rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 px-3 py-1.5 text-xs text-amber-300 transition-colors">보류 추가</button>
            )}
            {surface.canPartialRelease && (
              <button onClick={onPartialRelease} className="min-h-[40px] flex-1 md:flex-none rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 px-3 py-1.5 text-xs text-blue-300 transition-colors">부분 릴리즈</button>
            )}
            {surface.canEvaluate && (
              <button onClick={onStartEvaluation} className="min-h-[40px] flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 active:scale-95 px-4 py-1.5 text-xs font-medium text-white transition-colors">릴리즈 평가 시작</button>
            )}
            {surface.canFullRelease && (
              <button onClick={onFullRelease} className="min-h-[40px] flex-1 md:flex-none rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-4 py-1.5 text-xs font-medium text-white transition-colors">전량 릴리즈</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

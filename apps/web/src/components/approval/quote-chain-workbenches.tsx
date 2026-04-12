"use client";

/**
 * Quote Chain Workbenches — Quote Approval + PO Conversion + PO Approval + Chain Progress
 *
 * 기존 FireApprovalWorkbench 패턴 재사용:
 * - engine output = truth, React = projection
 * - center = judgment, rail = reference, dock = execution
 * - blocked ≠ approval_needed 분리
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, PolicyMessageStack, ApproverRequirementCard, NextActionHint } from "./index";
import type { QuoteChainPolicySurface, QuoteChainFullSurface, QuoteChainStage } from "@/lib/ai/quote-approval-governance-engine";
import { getStageLabel, getVisibleStages } from "@/lib/ai/governance-grammar-registry";
import { POCreatedReentrySurface, type POCreatedReentrySurfaceProps } from "./po-created-reentry-surface";
import { DispatchPrepWorkbench, type DispatchPrepWorkbenchProps } from "./dispatch-prep-workbench";

// ══════════════════════════════════════════════
// Re-exports — chain orchestrator는 이 파일을 단일 진입점으로 사용한다.
// dispatch / re-entry surface 도 chain entry 로 정식 편입.
// ══════════════════════════════════════════════
export { POCreatedReentrySurface, DispatchPrepWorkbench };
export type { POCreatedReentrySurfaceProps, DispatchPrepWorkbenchProps };

// ══════════════════════════════════════════════
// QuoteChainProgressStrip — 6단계 진행 공용 컴포넌트
// ══════════════════════════════════════════════

export interface QuoteChainProgressStripProps {
  surface: QuoteChainFullSurface;
  onStageClick?: (stage: QuoteChainStage) => void;
  /** Visibility mode — "ga" shows only GA stages, "pilot" includes pilot stages */
  visibilityMode?: "ga" | "pilot";
  className?: string;
}

/** Stage short labels — grammar registry 직접 소비. 하드코딩 금지. */

const BADGE_DOTS: Record<string, string> = {
  allowed: "bg-emerald-400",
  approval_needed: "bg-blue-400",
  blocked: "bg-red-400",
};

export function QuoteChainProgressStrip({ surface, onStageClick, visibilityMode = "ga", className }: QuoteChainProgressStripProps) {
  const visibleStageIds = React.useMemo(
    () => new Set(getVisibleStages(visibilityMode).map(s => s.stage)),
    [visibilityMode],
  );
  const filteredStages = surface.stages.filter(s => visibleStageIds.has(s.stage));

  return (
    <div className={cn(
      "flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 rounded bg-slate-900 border border-slate-800 overflow-x-auto snap-x scrollbar-none",
      className,
    )}>
      <div className="flex items-center gap-0.5 text-[11px] md:text-[10px] text-slate-500 shrink-0 mr-2">
        <span className="tabular-nums font-medium text-slate-600">{surface.overallProgress}%</span>
      </div>
      {filteredStages.map((stage, idx) => {
        const isCompleted = surface.completedStages.includes(stage.stage);
        const isCurrent = stage.stage === surface.currentStage;
        return (
          <React.Fragment key={stage.stage}>
            {idx > 0 && <span className="text-slate-700 text-[10px]">→</span>}
            <button
              onClick={() => onStageClick?.(stage.stage)}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-1 md:py-0.5 text-[11px] md:text-[10px] transition-colors shrink-0 snap-start",
                "min-h-[32px] md:min-h-0 active:scale-95",
                isCompleted && "bg-emerald-500/10 text-emerald-400",
                isCurrent && !isCompleted && "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30",
                !isCompleted && !isCurrent && "text-slate-500 hover:text-slate-400",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                isCompleted ? "bg-emerald-400" : isCurrent ? BADGE_DOTS[stage.statusBadge] || "bg-blue-400" : "bg-slate-600"
              )} />
              <span>{getStageLabel(stage.stage, true)}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// QuoteApprovalWorkbench — 견적 승인 center/rail/dock
// ══════════════════════════════════════════════

export interface QuoteApprovalWorkbenchProps {
  caseId: string;
  surface: QuoteChainPolicySurface;
  chainSurface: QuoteChainFullSurface;
  // Evidence
  vendorName: string;
  totalAmount: number;
  lineCount: number;
  requestedBy: string;
  requestedAt: string;
  quoteRef: string;
  // State
  canApprove: boolean;
  canReject: boolean;
  // Handlers
  onApprove?: (reason: string) => void;
  onReject?: (reason: string) => void;
  onStageClick?: (stage: QuoteChainStage) => void;
  className?: string;
}

export function QuoteApprovalWorkbench({
  caseId, surface, chainSurface,
  vendorName, totalAmount, lineCount, requestedBy, requestedAt, quoteRef,
  canApprove, canReject, onApprove, onReject, onStageClick,
  className,
}: QuoteApprovalWorkbenchProps) {
  const [reason, setReason] = React.useState("");

  return (
    <div
      role="main"
      aria-label="Quote Approval Workbench"
      className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:h-full md:pb-0", className)}
    >
      <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
        <QuoteChainProgressStrip surface={chainSurface} onStageClick={onStageClick} />

        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={surface.statusBadge} />
          <PolicyMessageStack primaryMessage={surface.primaryMessage} blockerMessages={surface.blockerMessages} nextActionMessage={surface.nextAction} compact />
        </div>

        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">견적 승인 요청</h3>
          <div className="grid grid-cols-2 gap-2 md:gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">공급사</span><p className="text-slate-700">{vendorName}</p></div>
            <div><span className="text-slate-500 text-xs">금액</span><p className="text-sm font-semibold tabular-nums text-slate-900">{totalAmount.toLocaleString()}원</p></div>
            <div><span className="text-slate-500 text-xs">라인</span><p className="text-slate-700">{lineCount}건</p></div>
            <div><span className="text-slate-500 text-xs">견적 참조</span><p className="text-slate-600 text-xs font-mono break-all">{quoteRef}</p></div>
            <div><span className="text-slate-500 text-xs">요청자</span><p className="text-slate-700">{requestedBy}</p></div>
            <div><span className="text-slate-500 text-xs">요청일</span><p className="text-slate-700">{new Date(requestedAt).toLocaleDateString("ko-KR")}</p></div>
          </div>
        </div>

        {surface.lockedFields.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">잠긴 필드</h4>
            <div className="flex flex-wrap gap-1">
              {surface.lockedFields.map(f => (
                <span key={f} className="text-[10px] bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">{f}</span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">결정 사유</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="승인/거부 사유..."
            className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-700 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none" rows={3} />
        </div>
      </div>

      {/* Rail — 모바일: center 아래에 표시 */}
      <div
        role="complementary"
        aria-label="참고 정보"
        className="mt-3 md:mt-0 md:w-64 md:shrink-0 space-y-3"
      >
        {surface.approvalInfo && (
          <ApproverRequirementCard requiredRole="approver" selfApprovalAllowed={false} dualApprovalRequired={false} riskTier={surface.riskTier} />
        )}
        {surface.approvalInfo && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <span className="text-slate-500">승인 기준:</span>
            <p className="text-slate-600 mt-0.5">{surface.approvalInfo.reason}</p>
          </div>
        )}
      </div>

      {/* Dock */}
      <div
        role="toolbar"
        aria-label="작업 도구"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950 px-3 py-2.5 md:absolute md:px-4 md:py-3 safe-area-pb"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <NextActionHint message={surface.nextAction} variant={surface.statusBadge === "blocked" ? "blocked" : "default"} />
          <div className="flex items-center gap-2 shrink-0">
            {canReject && <button onClick={() => onReject?.(reason)} disabled={!reason.trim()} aria-label="견적 거부" className="shrink-0 rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 active:scale-95 min-h-[40px] px-3 py-2 md:py-1.5 text-xs font-medium text-red-300 transition-all disabled:opacity-40">거부</button>}
            {canApprove && <button onClick={() => onApprove?.(reason)} disabled={!reason.trim()} aria-label="견적 승인" className="shrink-0 rounded bg-blue-600 hover:bg-blue-500 active:scale-95 min-h-[40px] px-4 py-2 md:py-1.5 text-xs font-medium text-white transition-all disabled:opacity-40">견적 승인</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// POConversionWorkbench — PO 전환 center/rail/dock
// ══════════════════════════════════════════════

export interface POConversionWorkbenchProps {
  caseId: string;
  surface: QuoteChainPolicySurface;
  chainSurface: QuoteChainFullSurface;
  // PO data
  vendorName: string;
  totalAmount: number;
  lineItems: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
  approvalSnapshotValid: boolean;
  // Handlers
  onConvert?: () => void;
  onStageClick?: (stage: QuoteChainStage) => void;
  className?: string;
}

export function POConversionWorkbench({
  caseId, surface, chainSurface,
  vendorName, totalAmount, lineItems, approvalSnapshotValid,
  onConvert, onStageClick, className,
}: POConversionWorkbenchProps) {
  return (
    <div
      role="main"
      aria-label="PO Conversion Workbench"
      className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:h-full md:pb-0", className)}
    >
      <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
        <QuoteChainProgressStrip surface={chainSurface} onStageClick={onStageClick} />

        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={surface.statusBadge} pulse={surface.statusBadge === "blocked"} />
          <PolicyMessageStack primaryMessage={surface.primaryMessage} blockerMessages={surface.blockerMessages} nextActionMessage={surface.nextAction} compact />
        </div>

        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">PO 전환</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">공급사</span><p className="text-slate-700">{vendorName}</p></div>
            <div><span className="text-slate-500 text-xs">총액</span><p className="text-sm font-semibold tabular-nums text-slate-900">{totalAmount.toLocaleString()}원</p></div>
          </div>
        </div>

        {/* 라인 아이템 테이블 — 모바일: 가로 스크롤 */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-x-auto">
          <table className="w-full text-xs min-w-[400px]">
            <thead><tr className="border-b border-slate-800 text-slate-500">
              <th className="px-3 py-2 text-left font-medium">품목</th>
              <th className="px-3 py-2 text-right font-medium">수량</th>
              <th className="px-3 py-2 text-right font-medium">단가</th>
              <th className="px-3 py-2 text-right font-medium">소계</th>
            </tr></thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="px-3 py-1.5 text-slate-700">{item.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{item.qty}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{item.unitPrice.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {surface.lockedFields.length > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <h4 className="text-[10px] font-medium text-amber-400 mb-1">승인에서 잠긴 필드 (수정 불가)</h4>
            <div className="flex flex-wrap gap-1">
              {surface.lockedFields.map(f => <span key={f} className="text-[10px] bg-amber-500/10 text-amber-300 rounded px-1.5 py-0.5 border border-amber-500/20">{f}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Rail — 모바일: center 아래에 표시 */}
      <div
        role="complementary"
        aria-label="참고 정보"
        className="mt-3 md:mt-0 md:w-64 md:shrink-0 space-y-3"
      >
        <div className={cn("rounded border p-3 text-xs", approvalSnapshotValid ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5")}>
          <span className="text-slate-500">승인 Snapshot</span>
          <p className={approvalSnapshotValid ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
            {approvalSnapshotValid ? "유효 — PO 전환 가능" : "무효 — 재승인 필요"}
          </p>
        </div>
      </div>

      {/* Dock */}
      <div
        role="toolbar"
        aria-label="작업 도구"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950 px-3 py-2.5 md:absolute md:px-4 md:py-3 safe-area-pb"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <NextActionHint message={surface.nextAction} variant={surface.statusBadge === "blocked" ? "blocked" : "default"} />
          <div className="flex items-center gap-2 shrink-0">
            {onConvert && surface.statusBadge !== "blocked" && (
              <button onClick={onConvert} aria-label="PO 전환 실행" className="shrink-0 rounded bg-blue-600 hover:bg-blue-500 active:scale-95 min-h-[40px] px-4 py-2 md:py-1.5 text-xs font-medium text-white transition-all">PO 전환 실행</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// QuoteChainWorkbench — chain stage 기반 단일 진입점
//
// Quote → Approval → PO Conversion → PO Created → Dispatch Prep 까지
// 모든 chain workbench 를 동일 governance grammar 로 라우팅한다.
//
// - center=decision, rail=context, dock=action 역할은 각 하위 workbench 가 보장
// - 본 컴포넌트는 stage 에 따라 적절한 workbench 만 mount (truth re-derivation 금지)
// - 알 수 없는 stage 는 명시적으로 null 반환 (silent fallback 금지)
// ══════════════════════════════════════════════

export type QuoteChainWorkbenchStage =
  | "quote_approval"
  | "po_conversion"
  | "po_created"
  | "dispatch_prep";

export interface QuoteChainWorkbenchProps {
  /** 현재 활성 chain stage — 이 값으로 어떤 workbench 를 mount 할지 결정 */
  stage: QuoteChainWorkbenchStage;
  /** stage 별 props — 활성 stage 와 일치하는 prop 만 사용된다. */
  quoteApprovalProps?: QuoteApprovalWorkbenchProps;
  poConversionProps?: POConversionWorkbenchProps;
  poCreatedProps?: POCreatedReentrySurfaceProps;
  dispatchPrepProps?: DispatchPrepWorkbenchProps;
  className?: string;
}

/**
 * Chain orchestrator entry point.
 *
 * 본 컴포넌트는 어떤 chain workbench 가 살아있는지를 알려주는 단일 진입점이다.
 * 각 stage 의 truth/governance 결과는 호출자가 미리 빌드해서 props 로 넘겨야 한다
 * (orchestrator 가 truth 를 다시 평가하지 않는다 — consume guard).
 */
export function QuoteChainWorkbench({
  stage,
  quoteApprovalProps,
  poConversionProps,
  poCreatedProps,
  dispatchPrepProps,
  className,
}: QuoteChainWorkbenchProps) {
  switch (stage) {
    case "quote_approval":
      if (!quoteApprovalProps) return null;
      return <QuoteApprovalWorkbench {...quoteApprovalProps} className={className} />;
    case "po_conversion":
      if (!poConversionProps) return null;
      return <POConversionWorkbench {...poConversionProps} className={className} />;
    case "po_created":
      if (!poCreatedProps) return null;
      return <POCreatedReentrySurface {...poCreatedProps} className={className} />;
    case "dispatch_prep":
      if (!dispatchPrepProps) return null;
      return <DispatchPrepWorkbench {...dispatchPrepProps} className={className} />;
    default:
      return null;
  }
}

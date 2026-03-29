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

// ══════════════════════════════════════════════
// QuoteChainProgressStrip — 6단계 진행 공용 컴포넌트
// ══════════════════════════════════════════════

export interface QuoteChainProgressStripProps {
  surface: QuoteChainFullSurface;
  onStageClick?: (stage: QuoteChainStage) => void;
  className?: string;
}

/** 활성 stage만 매핑 — 미래 슬롯(sent/supplier_confirmed/receiving_prep)은 config 추가 시 여기에 추가 */
const STAGE_SHORT: Partial<Record<QuoteChainStage, string>> = {
  quote_review: "검토",
  quote_shortlist: "선정",
  quote_approval: "견적승인",
  po_conversion: "PO전환",
  po_approval: "PO승인",
  po_send_readiness: "발송준비",
  po_created: "PO생성",
  dispatch_prep: "발송검증",
  sent: "발송완료",
  supplier_confirmed: "공급사확인",
  receiving_prep: "입고준비",
  stock_release: "릴리즈",
  reorder_decision: "재주문",
};

const BADGE_DOTS: Record<string, string> = {
  allowed: "bg-emerald-400",
  approval_needed: "bg-blue-400",
  blocked: "bg-red-400",
};

export function QuoteChainProgressStrip({ surface, onStageClick, className }: QuoteChainProgressStripProps) {
  return (
    <div className={cn("flex items-center gap-1 px-3 py-2 rounded bg-slate-900 border border-slate-800 overflow-x-auto", className)}>
      <div className="flex items-center gap-0.5 text-[10px] text-slate-500 shrink-0 mr-2">
        <span className="tabular-nums font-medium text-slate-300">{surface.overallProgress}%</span>
      </div>
      {surface.stages.filter(s => STAGE_SHORT[s.stage]).map((stage, idx) => {
        const isCompleted = surface.completedStages.includes(stage.stage);
        const isCurrent = stage.stage === surface.currentStage;
        return (
          <React.Fragment key={stage.stage}>
            {idx > 0 && <span className="text-slate-700 text-[10px]">→</span>}
            <button
              onClick={() => onStageClick?.(stage.stage)}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors shrink-0",
                isCompleted && "bg-emerald-500/10 text-emerald-400",
                isCurrent && !isCompleted && "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30",
                !isCompleted && !isCurrent && "text-slate-500 hover:text-slate-400",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                isCompleted ? "bg-emerald-400" : isCurrent ? BADGE_DOTS[stage.statusBadge] || "bg-blue-400" : "bg-slate-600"
              )} />
              <span>{STAGE_SHORT[stage.stage]}</span>
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
    <div className={cn("flex gap-4 h-full", className)}>
      <div className="flex-1 min-w-0 space-y-4">
        <QuoteChainProgressStrip surface={chainSurface} onStageClick={onStageClick} />

        <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={surface.statusBadge} />
          <PolicyMessageStack primaryMessage={surface.primaryMessage} blockerMessages={surface.blockerMessages} nextActionMessage={surface.nextAction} compact />
        </div>

        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">견적 승인 요청</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">공급사</span><p className="text-slate-200">{vendorName}</p></div>
            <div><span className="text-slate-500 text-xs">금액</span><p className="text-sm font-semibold tabular-nums text-slate-100">{totalAmount.toLocaleString()}원</p></div>
            <div><span className="text-slate-500 text-xs">라인</span><p className="text-slate-200">{lineCount}건</p></div>
            <div><span className="text-slate-500 text-xs">견적 참조</span><p className="text-slate-300 text-xs font-mono">{quoteRef}</p></div>
            <div><span className="text-slate-500 text-xs">요청자</span><p className="text-slate-200">{requestedBy}</p></div>
            <div><span className="text-slate-500 text-xs">요청일</span><p className="text-slate-200">{new Date(requestedAt).toLocaleDateString("ko-KR")}</p></div>
          </div>
        </div>

        {surface.lockedFields.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">잠긴 필드</h4>
            <div className="flex flex-wrap gap-1">
              {surface.lockedFields.map(f => (
                <span key={f} className="text-[9px] bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">{f}</span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">결정 사유</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="승인/거부 사유..."
            className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none" rows={3} />
        </div>
      </div>

      <div className="w-64 shrink-0 space-y-3">
        {surface.approvalInfo && (
          <ApproverRequirementCard requiredRole="approver" selfApprovalAllowed={false} dualApprovalRequired={false} riskTier={surface.riskTier} />
        )}
        {surface.approvalInfo && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <span className="text-slate-500">승인 기준:</span>
            <p className="text-slate-300 mt-0.5">{surface.approvalInfo.reason}</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <NextActionHint message={surface.nextAction} variant={surface.statusBadge === "blocked" ? "blocked" : "default"} />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {canReject && <button onClick={() => onReject?.(reason)} disabled={!reason.trim()} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors disabled:opacity-40">거부</button>}
            {canApprove && <button onClick={() => onApprove?.(reason)} disabled={!reason.trim()} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40">견적 승인</button>}
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
    <div className={cn("flex gap-4 h-full", className)}>
      <div className="flex-1 min-w-0 space-y-4">
        <QuoteChainProgressStrip surface={chainSurface} onStageClick={onStageClick} />

        <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={surface.statusBadge} pulse={surface.statusBadge === "blocked"} />
          <PolicyMessageStack primaryMessage={surface.primaryMessage} blockerMessages={surface.blockerMessages} nextActionMessage={surface.nextAction} compact />
        </div>

        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">PO 전환</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">공급사</span><p className="text-slate-200">{vendorName}</p></div>
            <div><span className="text-slate-500 text-xs">총액</span><p className="text-sm font-semibold tabular-nums text-slate-100">{totalAmount.toLocaleString()}원</p></div>
          </div>
        </div>

        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-800 text-slate-500">
              <th className="px-3 py-2 text-left font-medium">품목</th>
              <th className="px-3 py-2 text-right font-medium">수량</th>
              <th className="px-3 py-2 text-right font-medium">단가</th>
              <th className="px-3 py-2 text-right font-medium">소계</th>
            </tr></thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className="border-b border-slate-800/50"><td className="px-3 py-1.5 text-slate-200">{item.name}</td><td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{item.qty}</td><td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{item.unitPrice.toLocaleString()}</td><td className="px-3 py-1.5 text-right tabular-nums text-slate-200">{item.total.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {surface.lockedFields.length > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <h4 className="text-[10px] font-medium text-amber-400 mb-1">승인에서 잠긴 필드 (수정 불가)</h4>
            <div className="flex flex-wrap gap-1">
              {surface.lockedFields.map(f => <span key={f} className="text-[9px] bg-amber-500/10 text-amber-300 rounded px-1.5 py-0.5 border border-amber-500/20">{f}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="w-64 shrink-0 space-y-3">
        <div className={cn("rounded border p-3 text-xs", approvalSnapshotValid ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5")}>
          <span className="text-slate-500">승인 Snapshot</span>
          <p className={approvalSnapshotValid ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
            {approvalSnapshotValid ? "유효 — PO 전환 가능" : "무효 — 재승인 필요"}
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <NextActionHint message={surface.nextAction} variant={surface.statusBadge === "blocked" ? "blocked" : "default"} />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onConvert && surface.statusBadge !== "blocked" && (
              <button onClick={onConvert} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">PO 전환 실행</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

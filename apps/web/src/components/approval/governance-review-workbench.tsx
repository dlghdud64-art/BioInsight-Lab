"use client";

/**
 * GovernanceReviewWorkbench — ownership change request 검토/승인/실행 작업면
 *
 * center = pending change set + risk summary + simulation delta + explanation
 * rail = impacted scope / owner / escalation / effective date / conflicts
 * dock = approve / reject / request changes / schedule apply / revert
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge } from "./index";
import type { OwnershipChangeRequest } from "@/lib/ai/ownership-governance-lifecycle-engine";
import type { OwnershipSimulationResult } from "@/lib/ai/ownership-simulation-engine";
import type { DetectedConflict, ConflictDetectionResult } from "@/lib/ai/ownership-conflict-remediation-engine";
import type { OwnershipChangeExplanation } from "@/lib/ai/ownership-governance-lifecycle-engine";

export interface GovernanceReviewWorkbenchProps {
  changeRequest: OwnershipChangeRequest;
  simulation: OwnershipSimulationResult | null;
  conflicts: ConflictDetectionResult | null;
  explanation: OwnershipChangeExplanation | null;
  // Permissions
  canApprove: boolean;
  canReject: boolean;
  canSchedule: boolean;
  canRevert: boolean;
  // Handlers
  onApprove?: (comment: string) => void;
  onReject?: (comment: string) => void;
  onRequestChanges?: (comment: string) => void;
  onScheduleApply?: () => void;
  onApplyNow?: () => void;
  onRevert?: (reason: string) => void;
  onRunSimulation?: () => void;
  onRemediate?: (conflictId: string, actionId: string) => void;
  className?: string;
}

const STATUS_MAP: Record<string, { badge: "allowed" | "approval_needed" | "blocked" | "reapproval_needed" | "unknown"; label: string }> = {
  draft: { badge: "unknown", label: "Draft" },
  pending_review: { badge: "approval_needed", label: "검토 대기" },
  review_approved: { badge: "allowed", label: "검토 승인" },
  review_rejected: { badge: "blocked", label: "검토 거부" },
  approved: { badge: "allowed", label: "승인됨" },
  applied: { badge: "allowed", label: "적용 완료" },
  superseded: { badge: "unknown", label: "대체됨" },
  reverted: { badge: "reapproval_needed", label: "롤백됨" },
  cancelled: { badge: "unknown", label: "취소됨" },
};

const RISK_COLORS: Record<string, string> = {
  immediate: "text-emerald-400 bg-emerald-500/10",
  reviewed: "text-blue-400 bg-blue-500/10",
  governed: "text-red-400 bg-red-500/10",
};

const IMPACT_COLORS: Record<string, string> = {
  positive: "text-emerald-400",
  negative: "text-red-400",
  mixed: "text-amber-400",
  neutral: "text-slate-400",
};

export function GovernanceReviewWorkbench({
  changeRequest: cr,
  simulation,
  conflicts,
  explanation,
  canApprove, canReject, canSchedule, canRevert,
  onApprove, onReject, onRequestChanges, onScheduleApply, onApplyNow, onRevert, onRunSimulation, onRemediate,
  className,
}: GovernanceReviewWorkbenchProps) {
  const [comment, setComment] = React.useState("");
  const statusConfig = STATUS_MAP[cr.status] || STATUS_MAP.draft;

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status strip */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={statusConfig.badge} label={statusConfig.label} />
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", RISK_COLORS[cr.mutationRisk])}>
            {cr.mutationRisk}
          </span>
          <span className="text-xs text-slate-400">{cr.changeSummary}</span>
        </div>

        {/* Change detail */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">변경 내용</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Action</span>
              <p className="text-slate-700">{cr.action}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">영향 범위</span>
              <p className="text-slate-700">{cr.affectedCount}건</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">작성자</span>
              <p className="text-slate-700">{cr.authorId}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">적용 시점</span>
              <p className="text-slate-700">{cr.effectiveDate === "immediate" ? "즉시" : new Date(cr.effectiveDate).toLocaleDateString("ko-KR")}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">{cr.changeDetail}</p>
        </div>

        {/* Simulation result */}
        {simulation && (
          <div className={cn("rounded border p-4 space-y-2",
            simulation.overallImpact === "positive" ? "border-emerald-500/20 bg-emerald-500/5" :
            simulation.overallImpact === "negative" ? "border-red-500/20 bg-red-500/5" :
            "border-slate-800 bg-slate-900/50"
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">시뮬레이션 결과</h3>
              <span className={IMPACT_COLORS[simulation.overallImpact]}>{simulation.overallImpact}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Ownerless 변동</span>
                <p className={simulation.ownerlessDelta > 0 ? "text-red-400" : simulation.ownerlessDelta < 0 ? "text-emerald-400" : "text-slate-400"}>
                  {simulation.ownerlessDelta > 0 ? "+" : ""}{simulation.ownerlessDelta}
                </p>
              </div>
              <div>
                <span className="text-slate-500">SLA Risk</span>
                <p className={simulation.slaRiskChange === "worsened" ? "text-red-400" : simulation.slaRiskChange === "improved" ? "text-emerald-400" : "text-slate-400"}>
                  {simulation.slaRiskChange}
                </p>
              </div>
              <div>
                <span className="text-slate-500">새 과부하</span>
                <p className={simulation.newOverloaded.length > 0 ? "text-red-400" : "text-emerald-400"}>
                  {simulation.newOverloaded.length}명
                </p>
              </div>
            </div>
            {simulation.warnings.length > 0 && (
              <div className="space-y-0.5">
                {simulation.warnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-400">! {w}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conflicts */}
        {conflicts && conflicts.totalConflicts > 0 && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-4 space-y-2">
            <h3 className="text-xs font-medium text-red-300">{conflicts.summary}</h3>
            <div className="space-y-1.5">
              {conflicts.conflicts.slice(0, 5).map(c => (
                <div key={c.conflictId} className="rounded bg-red-500/5 p-2 text-xs space-y-1">
                  <p className="text-red-300">{c.detail}</p>
                  <div className="flex gap-1.5">
                    {c.remediationActions.map(a => (
                      <button key={a.actionId} onClick={() => onRemediate?.(c.conflictId, a.actionId)}
                        className="rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-0.5 text-[10px] text-red-300 transition-colors">
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review comment */}
        {(cr.status === "pending_review" || cr.status === "approved") && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">코멘트</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="검토 의견..."
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-700 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none" rows={3} />
          </div>
        )}
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-72 shrink-0 space-y-3">
        {explanation && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5 text-xs">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">판단 근거</h4>
            <p className="text-slate-600">{explanation.whyThisChange}</p>
            <p className="text-slate-400">{explanation.whyApprovalNeeded}</p>
            <p className="text-slate-500">{explanation.escalationPathDiff}</p>
          </div>
        )}

        {onRunSimulation && (
          <button onClick={onRunSimulation} className="w-full rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
            영향 시뮬레이션
          </button>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {canRevert && <button onClick={() => onRevert?.(comment)} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors">롤백</button>}
          {canReject && <button onClick={() => onReject?.(comment)} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors">거부</button>}
          {onRequestChanges && cr.status === "pending_review" && <button onClick={() => onRequestChanges(comment)} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">수정 요청</button>}
          {canSchedule && cr.status === "approved" && <button onClick={onScheduleApply} className="rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors">예약 적용</button>}
          {cr.status === "approved" && onApplyNow && <button onClick={onApplyNow} className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">즉시 적용</button>}
          {canApprove && <button onClick={() => onApprove?.(comment)} disabled={!comment.trim()} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40">승인</button>}
        </div>
      </div>
    </div>
  );
}

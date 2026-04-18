"use client";

/**
 * PolicyAdminWorkspace — 정책 관리 center/rail/dock workbench
 *
 * center = policy version list + draft editor + change diff
 * rail = simulation results + precedence preview + impact analysis
 * dock = save draft / submit review / publish / rollback
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge } from "./index";
import type { PolicySet, PolicyVersion, PolicyChangeDiff } from "@/lib/ai/policy-admin-lifecycle-engine";
import type { PolicySimulationResult, ApprovalImpactSimulation, BeforeAfterComparison } from "@/lib/ai/policy-simulation-engine";

export interface PolicyAdminWorkspaceProps {
  policySet: PolicySet;
  activeVersion: PolicyVersion | null;
  draftVersion: PolicyVersion | null;
  changeDiff: PolicyChangeDiff | null;
  simulationResult: PolicySimulationResult | null;
  // State
  canEdit: boolean;
  canSubmitReview: boolean;
  canApproveReview: boolean;
  canPublish: boolean;
  canRollback: boolean;
  // Handlers
  onSaveDraft?: () => void;
  onSubmitReview?: () => void;
  onApproveReview?: (comment: string) => void;
  onRejectReview?: (comment: string) => void;
  onPublish?: () => void;
  onRollback?: (targetVersionId: string, reason: string) => void;
  onRunSimulation?: () => void;
  className?: string;
}

const VERSION_STATUS_MAP: Record<string, { badge: "allowed" | "approval_needed" | "blocked" | "reapproval_needed" | "unknown"; label: string }> = {
  draft: { badge: "unknown", label: "Draft" },
  pending_review: { badge: "approval_needed", label: "검토 대기" },
  review_approved: { badge: "allowed", label: "검토 승인" },
  review_rejected: { badge: "blocked", label: "검토 거부" },
  published: { badge: "allowed", label: "게시됨" },
  active: { badge: "allowed", label: "활성" },
  superseded: { badge: "unknown", label: "대체됨" },
  rolled_back: { badge: "reapproval_needed", label: "롤백됨" },
};

export function PolicyAdminWorkspace({
  policySet,
  activeVersion,
  draftVersion,
  changeDiff,
  simulationResult,
  canEdit,
  canSubmitReview,
  canApproveReview,
  canPublish,
  canRollback,
  onSaveDraft,
  onSubmitReview,
  onApproveReview,
  onRejectReview,
  onPublish,
  onRollback,
  onRunSimulation,
  className,
}: PolicyAdminWorkspaceProps) {
  const [reviewComment, setReviewComment] = React.useState("");

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Policy set header */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900">{policySet.description}</h3>
            <span className="text-[10px] text-slate-500">
              {policySet.domain} · {policySet.scopeType}:{policySet.scopeLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>총 {policySet.totalVersions} 버전</span>
            {activeVersion && (
              <span className="text-emerald-400">활성: v{activeVersion.versionNumber}</span>
            )}
            {draftVersion && (
              <span className="text-blue-400">Draft: v{draftVersion.versionNumber}</span>
            )}
          </div>
        </div>

        {/* Version list */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">버전 이력</h4>
          </div>
          <div className="divide-y divide-slate-800/50">
            {policySet.versions.slice().reverse().map(v => {
              const statusConfig = VERSION_STATUS_MAP[v.status] || VERSION_STATUS_MAP.draft;
              return (
                <div key={v.versionId} className="px-3 py-2 hover:bg-slate-800/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-600">v{v.versionNumber}</span>
                    <PolicyStatusBadge status={statusConfig.badge} label={statusConfig.label} hideIcon />
                    <span className="text-xs text-slate-500">{v.ruleCount}개 규칙</span>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    {v.createdBy} · {new Date(v.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Change diff */}
        {changeDiff && changeDiff.totalChanges > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">변경 사항</h4>
            <p className="text-sm text-slate-600">{changeDiff.summary}</p>
            <div className="space-y-1 text-xs">
              {changeDiff.addedRules.length > 0 && (
                <div className="text-emerald-400">+ {changeDiff.addedRules.length}개 규칙 추가</div>
              )}
              {changeDiff.removedRules.length > 0 && (
                <div className="text-red-400">- {changeDiff.removedRules.length}개 규칙 삭제</div>
              )}
              {changeDiff.modifiedRules.length > 0 && (
                <div className="text-amber-400">~ {changeDiff.modifiedRules.length}개 규칙 수정</div>
              )}
            </div>
          </div>
        )}

        {/* Review comment */}
        {(canApproveReview || draftVersion?.status === "pending_review") && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">검토 코멘트</label>
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder="검토 의견을 입력하세요..."
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-700 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-72 shrink-0 space-y-3">
        {/* Simulation controls */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">시뮬레이션</h4>
          <button
            onClick={onRunSimulation}
            disabled={!draftVersion}
            className="w-full rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors disabled:opacity-40"
          >
            영향 미리보기
          </button>
        </div>

        {/* Simulation results */}
        {simulationResult && (
          <>
            {simulationResult.approvalImpact && (
              <ApprovalImpactCard impact={simulationResult.approvalImpact} />
            )}
            {simulationResult.beforeAfter && (
              <BeforeAfterCard comparison={simulationResult.beforeAfter} />
            )}
            {simulationResult.warnings.length > 0 && (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                {simulationResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">{w}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {canRollback && activeVersion && (
            <button
              onClick={() => onRollback?.(activeVersion.parentVersionId || "", "Manual rollback")}
              className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors"
            >
              롤백
            </button>
          )}
          {canEdit && onSaveDraft && (
            <button onClick={onSaveDraft} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
              Draft 저장
            </button>
          )}
          {canSubmitReview && (
            <button onClick={onSubmitReview} className="rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors">
              검토 제출
            </button>
          )}
          {canApproveReview && (
            <>
              <button
                onClick={() => onRejectReview?.(reviewComment)}
                className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors"
              >
                검토 거부
              </button>
              <button
                onClick={() => onApproveReview?.(reviewComment)}
                className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors"
              >
                검토 승인
              </button>
            </>
          )}
          {canPublish && (
            <button onClick={onPublish} className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">
              게시
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Approval Impact Card ──
function ApprovalImpactCard({ impact }: { impact: ApprovalImpactSimulation }) {
  return (
    <div className={cn(
      "rounded border p-3 space-y-1.5",
      impact.impactLevel === "tightened" && "border-red-500/20 bg-red-500/5",
      impact.impactLevel === "relaxed" && "border-emerald-500/20 bg-emerald-500/5",
      impact.impactLevel === "no_change" && "border-slate-800 bg-slate-900/50",
      impact.impactLevel === "mixed" && "border-amber-500/20 bg-amber-500/5",
    )}>
      <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">승인 영향</h5>
      <p className={cn("text-xs font-medium",
        impact.impactLevel === "tightened" && "text-red-400",
        impact.impactLevel === "relaxed" && "text-emerald-400",
        impact.impactLevel === "no_change" && "text-slate-400",
        impact.impactLevel === "mixed" && "text-amber-400",
      )}>
        {impact.impactSummary}
      </p>
    </div>
  );
}

// ── Before/After Card ──
function BeforeAfterCard({ comparison }: { comparison: BeforeAfterComparison }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
      <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Before/After ({comparison.testCaseCount}건)
      </h5>
      <div className="flex gap-3 text-xs">
        {comparison.summary.tightenedCount > 0 && (
          <span className="text-red-400">{comparison.summary.tightenedCount} 강화</span>
        )}
        {comparison.summary.relaxedCount > 0 && (
          <span className="text-emerald-400">{comparison.summary.relaxedCount} 완화</span>
        )}
        <span className="text-slate-500">{comparison.summary.noChangeCount} 동일</span>
      </div>
    </div>
  );
}

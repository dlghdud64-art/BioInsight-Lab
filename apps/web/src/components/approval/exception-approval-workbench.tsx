"use client";

/**
 * ExceptionApprovalWorkbench — 예외 복구 승인 center/rail/dock workbench
 *
 * center = exception detail + recovery plan + bypass risk
 * rail = affected lines + return target matrix + audit trail
 * dock = approve recovery / reject / escalate
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  PolicyStatusBadge,
  PolicyMessageStack,
  ApproverRequirementCard,
  ReapprovalBanner,
  NextActionHint,
} from "./index";
import { useWorkspacePolicySurface } from "@/hooks/use-approval-policy";
import type { ActorContext } from "@/lib/ai/dispatch-v2-permission-policy-engine";
import type { ApprovalSnapshotV2 } from "@/lib/ai/dispatch-v2-approval-workbench-engine";

export interface ExceptionApprovalWorkbenchProps {
  caseId: string;
  actor: ActorContext;
  snapshot?: ApprovalSnapshotV2 | null;
  // Target action
  targetAction: "exception_resolve" | "exception_return_to_stage";
  // State
  canApprove: boolean;
  canReject: boolean;
  canEscalate: boolean;
  canRequestChange: boolean;
  // Exception evidence
  exceptionRecordId: string;
  sourceStage: string;
  exceptionType: string;
  severity: string;
  exceptionDetail: string;
  affectedLines: string[];
  recoveryAction: string | null;
  recoveryReason: string;
  returnToStage: string | null;
  returnTargetAllowed: boolean;
  allowedTargets: string[];
  bypassRisk: string;
  requestedBy: string;
  requestedAt: string;
  // Audit trail
  auditTrail: Array<{ action: string; actor: string; timestamp: string; detail: string }>;
  approvalHistory: Array<{ actorId: string; role: string; decision: string; reason: string; timestamp: string }>;
  // Handlers
  onApprove?: (reason: string) => void;
  onReject?: (reason: string) => void;
  onEscalate?: (reason: string) => void;
  onRequestChange?: (reason: string) => void;
  onRequestReapproval?: () => void;
  className?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-red-300 bg-red-500/5 border-red-500/10",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export function ExceptionApprovalWorkbench({
  caseId,
  actor,
  snapshot = null,
  targetAction,
  canApprove,
  canReject,
  canEscalate,
  canRequestChange,
  exceptionRecordId,
  sourceStage,
  exceptionType,
  severity,
  exceptionDetail,
  affectedLines,
  recoveryAction,
  recoveryReason,
  returnToStage,
  returnTargetAllowed,
  allowedTargets,
  bypassRisk,
  requestedBy,
  requestedAt,
  auditTrail,
  approvalHistory,
  onApprove,
  onReject,
  onEscalate,
  onRequestChange,
  onRequestReapproval,
  className,
}: ExceptionApprovalWorkbenchProps) {
  const [reason, setReason] = React.useState("");
  const workspaceKey = targetAction === "exception_resolve" ? "exception_resolve" : "exception_return";

  const { data: policySurface } = useWorkspacePolicySurface(workspaceKey, actor, caseId);
  const guidance = policySurface?.inlineGuidance;
  const surface = policySurface?.policySurface;

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {guidance && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
            <PolicyStatusBadge status={guidance.statusBadge} pulse={guidance.statusBadge === "blocked"} />
            <PolicyMessageStack
              primaryMessage={guidance.primaryMessage}
              blockerMessages={guidance.blockerMessages}
              warningMessages={guidance.warningMessages}
              nextActionMessage={guidance.nextActionMessage}
              compact
            />
          </div>
        )}

        {surface?.operatorGuidance.reapprovalNeeded && (
          <ReapprovalBanner
            visible
            reason={surface.operatorGuidance.reapprovalReason}
            onRequestReapproval={onRequestReapproval}
          />
        )}

        {/* Exception summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {targetAction === "exception_resolve" ? "예외 해결 승인" : "예외 복귀 승인"}
            </h3>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium)}>
              {severity}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">예외 ID</span>
              <p className="text-slate-600 text-xs font-mono">{exceptionRecordId}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">발생 단계</span>
              <p className="text-slate-700">{sourceStage}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">유형</span>
              <p className="text-slate-700">{exceptionType}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">요청자</span>
              <p className="text-slate-700">{requestedBy}</p>
            </div>
          </div>
          <div>
            <span className="text-slate-500 text-xs">상세</span>
            <p className="text-sm text-slate-600 mt-0.5">{exceptionDetail}</p>
          </div>
        </div>

        {/* Recovery plan */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">복구 계획</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">복구 액션</span>
              <p className="text-slate-700">{recoveryAction || "미설정"}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">사유</span>
              <p className="text-slate-700">{recoveryReason || "—"}</p>
            </div>
            {targetAction === "exception_return_to_stage" && (
              <>
                <div>
                  <span className="text-slate-500 text-xs">복귀 대상</span>
                  <p className={returnTargetAllowed ? "text-slate-700" : "text-red-400"}>
                    {returnToStage || "미지정"}
                    {!returnTargetAllowed && " (불허)"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Bypass Risk</span>
                  <p className="text-amber-400 text-xs">{bypassRisk}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Decision input */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">결정 사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="승인/거부 사유를 입력하세요..."
            className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-700 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-72 shrink-0 space-y-3">
        {guidance?.approverInfo && (
          <ApproverRequirementCard
            requiredRole={guidance.approverInfo.requiredRole}
            selfApprovalAllowed={guidance.approverInfo.selfApprovalAllowed}
            dualApprovalRequired={guidance.approverInfo.dualApprovalRequired}
            riskTier={surface?.riskTier}
          />
        )}

        {/* Return target matrix */}
        {targetAction === "exception_return_to_stage" && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">허용된 복귀 대상</h4>
            <div className="space-y-1">
              {allowedTargets.map((t) => (
                <div key={t} className={cn(
                  "text-xs px-2 py-1 rounded",
                  t === returnToStage ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" : "text-slate-400",
                )}>
                  {t === returnToStage && "→ "}{t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Affected lines */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">영향 라인 ({affectedLines.length}건)</h4>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {affectedLines.map((line, i) => (
              <p key={i} className="text-xs text-slate-400 font-mono">{line}</p>
            ))}
          </div>
        </div>

        {/* Audit trail */}
        {auditTrail.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">감사 이력</h4>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {auditTrail.slice(-5).map((a, i) => (
                <div key={i} className="text-xs border-l-2 border-slate-700 pl-2">
                  <span className="text-slate-400">{a.action}</span>
                  <span className="text-slate-600"> by {a.actor}</span>
                  <p className="text-slate-500">{a.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          {guidance && (
            <NextActionHint
              message={guidance.nextActionMessage}
              whoCanUnblock={surface?.operatorGuidance.whoCanUnblock}
              variant={guidance.statusBadge === "blocked" ? "blocked" : "default"}
            />
          )}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {canEscalate && (
              <button onClick={() => onEscalate?.(reason)} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
                에스컬레이션
              </button>
            )}
            {canReject && (
              <button onClick={() => onReject?.(reason)} disabled={!reason.trim()} className="rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors disabled:opacity-40">
                거부
              </button>
            )}
            {canApprove && (
              <button onClick={() => onApprove?.(reason)} disabled={!reason.trim()} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40">
                {targetAction === "exception_resolve" ? "해결 승인" : "복귀 승인"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * FireApprovalWorkbench — 발송 승인 center/rail/dock workbench
 *
 * 원칙:
 * - engine output = truth, React = projection
 * - optimistic unlock 금지
 * - center = 판단 (action summary + policy + risk)
 * - rail = 참조 (snapshot detail + approval history + SoD)
 * - dock = 실행 (approve/reject/escalate — engine canApprove 기준)
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
import type { ConsumeGuardResult } from "@/lib/ai/approval-snapshot-validator";

export interface FireApprovalWorkbenchProps {
  caseId: string;
  actor: ActorContext;
  snapshot?: ApprovalSnapshotV2 | null;
  consumeGuardResult?: ConsumeGuardResult | null;
  // Approval state from parent
  canApprove: boolean;
  canReject: boolean;
  canEscalate: boolean;
  canRequestChange: boolean;
  isApproved: boolean;
  isRejected: boolean;
  // Evidence
  objectSummary: string;
  totalAmount: number;
  affectedLineCount: number;
  requestedBy: string;
  requestedAt: string;
  // Approval history
  approvalHistory: Array<{ actorId: string; role: string; decision: string; reason: string; timestamp: string }>;
  // Handlers
  onApprove?: (reason: string) => void;
  onReject?: (reason: string) => void;
  onEscalate?: (reason: string) => void;
  onRequestChange?: (reason: string) => void;
  onRequestReapproval?: () => void;
  className?: string;
}

export function FireApprovalWorkbench({
  caseId,
  actor,
  snapshot = null,
  consumeGuardResult = null,
  canApprove,
  canReject,
  canEscalate,
  canRequestChange,
  isApproved,
  isRejected,
  objectSummary,
  totalAmount,
  affectedLineCount,
  requestedBy,
  requestedAt,
  approvalHistory,
  onApprove,
  onReject,
  onEscalate,
  onRequestChange,
  onRequestReapproval,
  className,
}: FireApprovalWorkbenchProps) {
  const [reason, setReason] = React.useState("");
  const [railOpen, setRailOpen] = React.useState(false);

  // Policy surface from engine — truth source
  const { data: policySurface } = useWorkspacePolicySurface(
    "fire_execution", actor, caseId, { totalAmount }, snapshot, consumeGuardResult
  );

  const guidance = policySurface?.inlineGuidance;
  const surface = policySurface?.policySurface;

  return (
    <div className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:pb-0 h-full", className)}>
      {/* ═══ CENTER — 판단 ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Policy status strip */}
        {guidance && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
            <PolicyStatusBadge
              status={guidance.statusBadge}
              pulse={guidance.statusBadge === "blocked" || guidance.statusBadge === "reapproval_needed"}
            />
            <PolicyMessageStack
              primaryMessage={guidance.primaryMessage}
              blockerMessages={guidance.blockerMessages}
              warningMessages={guidance.warningMessages}
              nextActionMessage={guidance.nextActionMessage}
              compact
            />
          </div>
        )}

        {/* Reapproval banner */}
        {surface?.operatorGuidance.reapprovalNeeded && (
          <ReapprovalBanner
            visible
            reason={surface.operatorGuidance.reapprovalReason}
            hashMismatchDetail={surface.hashMismatchDetail.hasMismatch ? surface.hashMismatchDetail.mismatchExplanation : undefined}
            onRequestReapproval={onRequestReapproval}
          />
        )}

        {/* Action summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            발송 승인 요청
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">요청자</span>
              <p className="text-slate-700">{requestedBy}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">요청 시각</span>
              <p className="text-slate-700">{new Date(requestedAt).toLocaleString("ko-KR")}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">대상</span>
              <p className="text-slate-700">{objectSummary}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">금액</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {totalAmount.toLocaleString()}원
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">영향 라인</span>
              <p className="text-slate-700">{affectedLineCount}건</p>
            </div>
          </div>
        </div>

        {/* Policy blockers detail (if any) */}
        {guidance && (guidance.blockerMessages.length > 0 || guidance.warningMessages.length > 0) && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              정책 제약사항
            </h3>
            <PolicyMessageStack
              primaryMessage=""
              blockerMessages={guidance.blockerMessages}
              warningMessages={guidance.warningMessages}
              nextActionMessage={guidance.nextActionMessage}
            />
          </div>
        )}

        {/* Decision reason input */}
        {!isApproved && !isRejected && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
              결정 사유
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="승인/거부 사유를 입력하세요..."
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-700 placeholder-slate-600 focus:border-blue-600 focus:outline-none resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* ═══ RAIL — 참조 ═══ */}
      <button className="flex items-center justify-between w-full py-2 text-xs text-slate-500 md:hidden" onClick={() => setRailOpen(!railOpen)}>참고 정보 {railOpen ? "▲" : "▼"}</button>
      <div className={cn("mt-3 md:mt-0 md:w-72 shrink-0 overflow-hidden transition-all duration-200 md:max-h-none md:opacity-100 space-y-3", railOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 md:max-h-none md:opacity-100")}>
        {/* Approver requirement */}
        {guidance?.approverInfo && (
          <ApproverRequirementCard
            requiredRole={guidance.approverInfo.requiredRole}
            selfApprovalAllowed={guidance.approverInfo.selfApprovalAllowed}
            dualApprovalRequired={guidance.approverInfo.dualApprovalRequired}
            approvedBy={snapshot?.approvedBy}
            approvedAt={snapshot?.approvedAt}
            riskTier={surface?.riskTier}
          />
        )}

        {/* Snapshot status */}
        {surface?.snapshotSummary && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Snapshot 상태
            </h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">존재</span>
                <span className={surface.snapshotSummary.exists ? "text-emerald-400" : "text-slate-500"}>
                  {surface.snapshotSummary.exists ? "있음" : "없음"}
                </span>
              </div>
              {surface.snapshotSummary.exists && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">유효</span>
                    <span className={surface.snapshotSummary.valid ? "text-emerald-400" : "text-red-400"}>
                      {surface.snapshotSummary.valid ? "유효" : surface.snapshotSummary.expired ? "만료" : "무효"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">사용</span>
                    <span className={!surface.snapshotSummary.consumed ? "text-emerald-400" : "text-red-400"}>
                      {surface.snapshotSummary.consumed ? "사용됨" : "미사용"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Approval history */}
        {approvalHistory.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              승인 이력
            </h4>
            <div className="space-y-2">
              {approvalHistory.map((h, i) => (
                <div key={i} className="text-xs border-l-2 border-slate-700 pl-2 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "font-medium",
                      h.decision === "approved" && "text-emerald-400",
                      h.decision === "rejected" && "text-red-400",
                      h.decision === "escalated" && "text-amber-400",
                    )}>
                      {h.decision === "approved" ? "승인" : h.decision === "rejected" ? "거부" : "에스컬레이션"}
                    </span>
                    <span className="text-slate-600">by {h.actorId}</span>
                  </div>
                  <p className="text-slate-500">{h.reason}</p>
                  <p className="text-slate-600">{new Date(h.timestamp).toLocaleString("ko-KR")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DOCK — 실행 (하단 고정) ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:absolute md:bottom-auto border-t border-slate-800 bg-slate-950 px-3 md:px-4 py-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
          {/* Next action guidance */}
          {guidance && (
            <NextActionHint
              message={guidance.nextActionMessage}
              whoCanUnblock={surface?.operatorGuidance.whoCanUnblock}
              variant={guidance.statusBadge === "blocked" ? "blocked" : guidance.statusBadge === "reapproval_needed" ? "urgent" : "default"}
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 md:ml-4 flex-wrap md:flex-nowrap">
            {canEscalate && (
              <button
                onClick={() => onEscalate?.(reason)}
                className="flex-1 md:flex-none rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors active:scale-95 min-h-[40px]"
              >
                에스컬레이션
              </button>
            )}
            {canRequestChange && (
              <button
                onClick={() => onRequestChange?.(reason)}
                className="flex-1 md:flex-none rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors active:scale-95 min-h-[40px]"
              >
                수정 요청
              </button>
            )}
            {canReject && (
              <button
                onClick={() => onReject?.(reason)}
                disabled={!reason.trim()}
                className="flex-1 md:flex-none rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 min-h-[40px]"
              >
                거부
              </button>
            )}
            {canApprove && (
              <button
                onClick={() => onApprove?.(reason)}
                disabled={!reason.trim()}
                className="flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 min-h-[40px]"
              >
                발송 승인
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

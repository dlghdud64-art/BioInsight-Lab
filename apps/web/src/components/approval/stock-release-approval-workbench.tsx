"use client";

/**
 * StockReleaseApprovalWorkbench — 재고 릴리스 승인 center/rail/dock workbench
 *
 * center = release line summary + policy + risk
 * rail = disposition snapshot + location verification + approval history
 * dock = approve/reject/escalate
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

export interface StockReleaseApprovalWorkbenchProps {
  caseId: string;
  actor: ActorContext;
  snapshot?: ApprovalSnapshotV2 | null;
  consumeGuardResult?: ConsumeGuardResult | null;
  // State
  canApprove: boolean;
  canReject: boolean;
  canEscalate: boolean;
  canRequestChange: boolean;
  isApproved: boolean;
  // Evidence
  releaseLines: Array<{
    lineId: string;
    releasableQty: number;
    locationAssigned: string;
    binAssigned: string;
    releaseStatus: string;
  }>;
  totalReleasableQty: number;
  totalAmount: number;
  requestedBy: string;
  requestedAt: string;
  dispositionSummary: string;
  // History
  approvalHistory: Array<{ actorId: string; role: string; decision: string; reason: string; timestamp: string }>;
  // Handlers
  onApprove?: (reason: string) => void;
  onReject?: (reason: string) => void;
  onEscalate?: (reason: string) => void;
  onRequestChange?: (reason: string) => void;
  onRequestReapproval?: () => void;
  className?: string;
}

export function StockReleaseApprovalWorkbench({
  caseId,
  actor,
  snapshot = null,
  consumeGuardResult = null,
  canApprove,
  canReject,
  canEscalate,
  canRequestChange,
  isApproved,
  releaseLines,
  totalReleasableQty,
  totalAmount,
  requestedBy,
  requestedAt,
  dispositionSummary,
  approvalHistory,
  onApprove,
  onReject,
  onEscalate,
  onRequestChange,
  onRequestReapproval,
  className,
}: StockReleaseApprovalWorkbenchProps) {
  const [reason, setReason] = React.useState("");

  const { data: policySurface } = useWorkspacePolicySurface(
    "stock_release", actor, caseId, { totalAmount, targetLocation: releaseLines[0]?.locationAssigned || "" }, snapshot, consumeGuardResult
  );

  const guidance = policySurface?.inlineGuidance;
  const surface = policySurface?.policySurface;

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
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

        {surface?.operatorGuidance.reapprovalNeeded && (
          <ReapprovalBanner
            visible
            reason={surface.operatorGuidance.reapprovalReason}
            hashMismatchDetail={surface.hashMismatchDetail.hasMismatch ? surface.hashMismatchDetail.mismatchExplanation : undefined}
            onRequestReapproval={onRequestReapproval}
          />
        )}

        {/* Release summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            재고 릴리스 승인 요청
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">요청자</span>
              <p className="text-slate-700">{requestedBy}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">총 릴리스 수량</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{totalReleasableQty}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">라인 수</span>
              <p className="text-slate-700">{releaseLines.length}건</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Disposition</span>
              <p className="text-slate-700">{dispositionSummary}</p>
            </div>
          </div>
        </div>

        {/* Release lines table */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Line</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-left font-medium">Location</th>
                <th className="px-3 py-2 text-left font-medium">Bin</th>
                <th className="px-3 py-2 text-left font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {releaseLines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 text-slate-600">{line.lineId}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{line.releasableQty}</td>
                  <td className="px-3 py-1.5 text-slate-400">{line.locationAssigned || "—"}</td>
                  <td className="px-3 py-1.5 text-slate-400">{line.binAssigned || "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn(
                      "text-xs",
                      line.releaseStatus === "released" && "text-emerald-400",
                      line.releaseStatus === "pending" && "text-slate-400",
                    )}>
                      {line.releaseStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Decision input */}
        {!isApproved && (
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
        )}
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-72 shrink-0 space-y-3">
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

        {approvalHistory.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">승인 이력</h4>
            <div className="space-y-2">
              {approvalHistory.map((h, i) => (
                <div key={i} className="text-xs border-l-2 border-slate-700 pl-2 space-y-0.5">
                  <span className={cn(
                    "font-medium",
                    h.decision === "approved" && "text-emerald-400",
                    h.decision === "rejected" && "text-red-400",
                  )}>
                    {h.decision === "approved" ? "승인" : "거부"} by {h.actorId}
                  </span>
                  <p className="text-slate-500">{h.reason}</p>
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
                릴리스 승인
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

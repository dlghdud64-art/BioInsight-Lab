"use client";

/**
 * ApproverRequirementCard — 승인 요구사항을 rail에 표시하는 카드
 *
 * engine output의 approverInfo를 렌더.
 * requiredRole, selfApprovalAllowed, dualApprovalRequired를 표시.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ApproverRequirementCardProps {
  /** 필요 승인자 역할 */
  requiredRole: string;
  /** Self-approve 가능 여부 */
  selfApprovalAllowed: boolean;
  /** Dual approval 필요 여부 */
  dualApprovalRequired: boolean;
  /** 승인자 이름 (이미 승인된 경우) */
  approvedBy?: string | null;
  /** 승인 시각 */
  approvedAt?: string | null;
  /** Risk tier */
  riskTier?: string;
  className?: string;
}

const ROLE_LABELS: Record<string, string> = {
  viewer: "열람자",
  requester: "요청자",
  operator: "운영자",
  approver: "승인자",
  admin: "관리자",
  owner: "소유자",
};

export function ApproverRequirementCard({
  requiredRole,
  selfApprovalAllowed,
  dualApprovalRequired,
  approvedBy,
  approvedAt,
  riskTier,
  className,
}: ApproverRequirementCardProps) {
  const roleLabel = ROLE_LABELS[requiredRole] || requiredRole;
  const isApproved = !!approvedBy;

  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          승인 요구사항
        </h4>
        {riskTier && (
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            riskTier === "tier3_irreversible" && "bg-red-500/10 text-red-400",
            riskTier === "tier2_org_impact" && "bg-amber-500/10 text-amber-400",
            riskTier === "tier1_routine" && "bg-slate-500/10 text-slate-400",
          )}>
            {riskTier === "tier3_irreversible" ? "Tier 3" : riskTier === "tier2_org_impact" ? "Tier 2" : "Tier 1"}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">필요 역할</span>
          <span className="text-slate-200 font-medium">{roleLabel} 이상</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500">Self-approve</span>
          <span className={selfApprovalAllowed ? "text-emerald-400" : "text-red-400"}>
            {selfApprovalAllowed ? "가능" : "불가"}
          </span>
        </div>

        {dualApprovalRequired && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">이중 승인</span>
            <span className="text-amber-400">필수 (2인)</span>
          </div>
        )}

        {isApproved && (
          <div className="mt-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">승인자</span>
              <span className="text-emerald-400">{approvedBy}</span>
            </div>
            {approvedAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">승인 시각</span>
                <span className="text-slate-400">{new Date(approvedAt).toLocaleString("ko-KR")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

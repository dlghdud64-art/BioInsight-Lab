"use client";

/**
 * Dashboard Action Loop React Panels
 *
 * - RecommendedActionsPanel: urgency 순 recommended actions with owner + deep links
 * - OwnerBadge: ownership type + owner identity 표시
 * - ActionHandoffStrip: action → target link strip
 *
 * 원칙: UI는 recommended action + ownership payload를 그대로 projection.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { RecommendedAction, DashboardActionLink } from "@/lib/ai/dashboard-policy-action-loop-engine";
import type { ResolvedOwner, OwnershipType, FullOwnershipResolution } from "@/lib/ai/multi-team-ownership-engine";

// ══════════════════════════════════════════════
// RecommendedActionsPanel
// ══════════════════════════════════════════════

export interface RecommendedActionsPanelProps {
  actions: RecommendedAction[];
  ownershipMap?: Record<string, ResolvedOwner>;
  onActionClick?: (link: DashboardActionLink) => void;
  className?: string;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  immediate: { label: "즉시", color: "text-red-400", border: "border-red-500/20" },
  soon: { label: "조속", color: "text-amber-400", border: "border-amber-500/20" },
  scheduled: { label: "예정", color: "text-slate-400", border: "border-slate-800" },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  tune_policy: "정책 조정",
  assign_approver: "승인자 배정",
  escalate_ownership: "에스컬레이션 이관",
  review_cases: "케이스 검토",
  rollback_policy: "정책 롤백",
  adjust_threshold: "임계값 조정",
  investigate_loop: "루프 조사",
};

export function RecommendedActionsPanel({
  actions,
  ownershipMap,
  onActionClick,
  className,
}: RecommendedActionsPanelProps) {
  if (actions.length === 0) {
    return (
      <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4", className)}>
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">권장 조치</h3>
        <p className="text-xs text-slate-500">현재 필요한 운영 조치가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">권장 조치</h3>
        <div className="flex gap-2 text-[10px]">
          {actions.filter(a => a.urgency === "immediate").length > 0 && (
            <span className="text-red-400">{actions.filter(a => a.urgency === "immediate").length} 즉시</span>
          )}
          {actions.filter(a => a.urgency === "soon").length > 0 && (
            <span className="text-amber-400">{actions.filter(a => a.urgency === "soon").length} 조속</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {actions.slice(0, 8).map((action) => {
          const urgencyConfig = URGENCY_CONFIG[action.urgency] || URGENCY_CONFIG.scheduled;
          return (
            <div
              key={action.actionId}
              className={cn("rounded border p-2.5 space-y-1.5", urgencyConfig.border)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-medium px-1 py-0.5 rounded bg-slate-800", urgencyConfig.color)}>
                    {urgencyConfig.label}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {ACTION_TYPE_LABELS[action.type] || action.type}
                  </span>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-700">{action.title}</p>
              <p className="text-[10px] text-slate-500">{action.description}</p>

              {/* Owner badge if available */}
              {ownershipMap && ownershipMap[action.actionId] && (
                <OwnerBadge owner={ownershipMap[action.actionId]} compact />
              )}

              {/* Action links */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {action.targetLinks.map((link) => (
                  <button
                    key={link.linkId}
                    onClick={() => onActionClick?.(link)}
                    className="rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-600 transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              {action.estimatedImpact && (
                <p className="text-[10px] text-slate-600">예상 효과: {action.estimatedImpact}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// OwnerBadge
// ══════════════════════════════════════════════

export interface OwnerBadgeProps {
  owner: ResolvedOwner;
  compact?: boolean;
  className?: string;
}

const OWNERSHIP_ICONS: Record<OwnershipType, string> = {
  approval_owner: "✓",
  escalation_owner: "↑",
  policy_owner: "⚙",
  backlog_owner: "☰",
  sla_owner: "⏱",
};

const OWNERSHIP_COLORS: Record<OwnershipType, string> = {
  approval_owner: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  escalation_owner: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  policy_owner: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  backlog_owner: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  sla_owner: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

export function OwnerBadge({ owner, compact = false, className }: OwnerBadgeProps) {
  const isUnresolved = owner.resolvedBy === "unresolved";
  const colors = isUnresolved
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : OWNERSHIP_COLORS[owner.ownershipType] || OWNERSHIP_COLORS.backlog_owner;

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium border", colors, className)}>
        <span>{OWNERSHIP_ICONS[owner.ownershipType] || "?"}</span>
        <span>{isUnresolved ? "미지정" : owner.ownerName}</span>
      </span>
    );
  }

  return (
    <div className={cn("rounded border p-2 space-y-1", colors.split(" ").slice(1).join(" "), className)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-xs", colors.split(" ")[0])}>
          {OWNERSHIP_ICONS[owner.ownershipType]}
        </span>
        <span className="text-xs font-medium text-slate-700">
          {isUnresolved ? "미지정" : owner.ownerName}
        </span>
        <span className="text-[10px] text-slate-500">{owner.ownerRole}</span>
      </div>
      <p className="text-[10px] text-slate-500">{owner.ownershipReason}</p>
      {owner.escalationPath.length > 1 && (
        <div className="text-[10px] text-slate-600">
          에스컬레이션: {owner.escalationPath.map(e => e.ownerName).join(" → ")}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// OwnershipSummaryStrip
// ══════════════════════════════════════════════

export interface OwnershipSummaryStripProps {
  ownership: FullOwnershipResolution;
  className?: string;
}

export function OwnershipSummaryStrip({ ownership, className }: OwnershipSummaryStripProps) {
  const owners = [
    { type: "approval_owner" as OwnershipType, owner: ownership.approvalOwner, label: "승인" },
    { type: "escalation_owner" as OwnershipType, owner: ownership.escalationOwner, label: "에스컬" },
    { type: "policy_owner" as OwnershipType, owner: ownership.policyOwner, label: "정책" },
    { type: "backlog_owner" as OwnershipType, owner: ownership.backlogOwner, label: "대기건" },
    { type: "sla_owner" as OwnershipType, owner: ownership.slaOwner, label: "SLA" },
  ];

  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">Ownership</h4>
        {ownership.unresolvedCount > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            {ownership.unresolvedCount} 미지정
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {owners.map(({ type, owner, label }) => (
          <div key={type} className="flex items-center gap-1">
            <span className="text-[9px] text-slate-600">{label}:</span>
            <OwnerBadge owner={owner} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ActionHandoffStrip
// ══════════════════════════════════════════════

export interface ActionHandoffStripProps {
  links: DashboardActionLink[];
  onLinkClick?: (link: DashboardActionLink) => void;
  className?: string;
}

export function ActionHandoffStrip({ links, onLinkClick, className }: ActionHandoffStripProps) {
  if (links.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <span className="text-[10px] text-slate-600">→</span>
      {links.map((link) => (
        <button
          key={link.linkId}
          onClick={() => onLinkClick?.(link)}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-medium transition-colors border",
            link.priority === "critical" && "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
            link.priority === "high" && "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
            link.priority === "medium" && "bg-slate-800 text-slate-600 border-slate-700 hover:bg-slate-700",
            link.priority === "low" && "bg-slate-800/50 text-slate-400 border-slate-800 hover:bg-slate-800",
          )}
        >
          {link.label}
        </button>
      ))}
    </div>
  );
}

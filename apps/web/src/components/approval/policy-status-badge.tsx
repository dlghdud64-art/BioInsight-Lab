"use client";

/**
 * PolicyStatusBadge — approval/policy 상태를 일관되게 표시하는 badge
 *
 * engine output의 statusBadge/statusColor를 UI로 정확히 번역.
 * 이 컴포넌트가 policy truth를 재판정하지 않음 — engine output만 표시.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const policyStatusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      status: {
        allowed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        approval_needed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        blocked: "bg-red-500/10 text-red-400 border border-red-500/20",
        reapproval_needed: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        escalation_needed: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        unknown: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
      },
    },
    defaultVariants: {
      status: "unknown",
    },
  }
);

const STATUS_ICONS: Record<string, string> = {
  allowed: "✓",
  approval_needed: "⏳",
  blocked: "✕",
  reapproval_needed: "↻",
  escalation_needed: "↑",
  unknown: "?",
};

const STATUS_LABELS: Record<string, string> = {
  allowed: "실행 가능",
  approval_needed: "승인 필요",
  blocked: "차단됨",
  reapproval_needed: "재승인 필요",
  escalation_needed: "에스컬레이션 필요",
  unknown: "알 수 없음",
};

export interface PolicyStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof policyStatusBadgeVariants> {
  /** Engine output statusBadge — UI에서 재판정하지 않음 */
  status: "allowed" | "approval_needed" | "blocked" | "reapproval_needed" | "escalation_needed" | "unknown";
  /** 커스텀 라벨 (없으면 기본 라벨 사용) */
  label?: string;
  /** 아이콘 숨기기 */
  hideIcon?: boolean;
  /** dot pulse 표시 (urgent) */
  pulse?: boolean;
}

export const PolicyStatusBadge = React.forwardRef<HTMLSpanElement, PolicyStatusBadgeProps>(
  ({ className, status, label, hideIcon, pulse, ...props }, ref) => {
    const icon = STATUS_ICONS[status] || "?";
    const displayLabel = label || STATUS_LABELS[status] || status;

    return (
      <span
        ref={ref}
        className={cn(policyStatusBadgeVariants({ status, className }))}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
        )}
        {!hideIcon && <span aria-hidden="true">{icon}</span>}
        <span>{displayLabel}</span>
      </span>
    );
  }
);
PolicyStatusBadge.displayName = "PolicyStatusBadge";

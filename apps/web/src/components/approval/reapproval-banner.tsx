"use client";

/**
 * ReapprovalBanner — 재승인 필요 상태를 강하게 표시하는 배너
 *
 * reapproval_needed / snapshot_invalidated / expired 상태에서 표시.
 * blocked와 명확히 구분되는 독립 배너.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ReapprovalBannerProps {
  /** 재승인 필요 여부 */
  visible: boolean;
  /** 재승인 이유 */
  reason: string;
  /** hash mismatch 상세 (있으면 표시) */
  hashMismatchDetail?: string;
  /** 재승인 요청 핸들러 */
  onRequestReapproval?: () => void;
  className?: string;
}

export function ReapprovalBanner({
  visible,
  reason,
  hashMismatchDetail,
  onRequestReapproval,
  className,
}: ReapprovalBannerProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1.5",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-amber-400" aria-hidden="true">↻</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">재승인 필요</p>
          <p className="text-xs text-amber-400/80 mt-0.5">{reason}</p>
          {hashMismatchDetail && (
            <p className="text-xs text-amber-500/70 mt-1">{hashMismatchDetail}</p>
          )}
        </div>
        {onRequestReapproval && (
          <button
            onClick={onRequestReapproval}
            className="shrink-0 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors"
          >
            재승인 요청
          </button>
        )}
      </div>
    </div>
  );
}

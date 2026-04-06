"use client";

/**
 * PolicyMessageStack — policy blocker/warning/guidance 메시지 표시
 *
 * engine output의 blockerMessages, warningMessages, nextActionMessage를 렌더.
 * 주 메시지(primaryMessage)가 상단, blocker/warning이 하단, next action이 최하단.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PolicyMessageStackProps {
  /** 주 상태 메시지 (engine primaryMessage) */
  primaryMessage: string;
  /** 차단 이유 목록 (engine blockerMessages) */
  blockerMessages?: string[];
  /** 주의 사항 목록 (engine warningMessages) */
  warningMessages?: string[];
  /** 다음 행동 안내 (engine nextActionMessage) */
  nextActionMessage?: string;
  /** compact 모드 (최소 높이) */
  compact?: boolean;
  className?: string;
}

export function PolicyMessageStack({
  primaryMessage,
  blockerMessages = [],
  warningMessages = [],
  nextActionMessage,
  compact = false,
  className,
}: PolicyMessageStackProps) {
  const hasBlockers = blockerMessages.length > 0;
  const hasWarnings = warningMessages.length > 0;

  if (compact && !hasBlockers && !hasWarnings) {
    return (
      <div className={cn("text-sm text-slate-400", className)}>
        {primaryMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Primary message */}
      <p className="text-sm font-medium text-slate-700">{primaryMessage}</p>

      {/* Blockers */}
      {hasBlockers && (
        <div className="space-y-1">
          {blockerMessages.map((msg, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded bg-red-500/5 border border-red-500/10 px-2.5 py-1.5 text-xs text-red-400"
            >
              <span className="mt-0.5 shrink-0" aria-hidden="true">✕</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1">
          {warningMessages.map((msg, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded bg-amber-500/5 border border-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400"
            >
              <span className="mt-0.5 shrink-0" aria-hidden="true">!</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Next action */}
      {nextActionMessage && (
        <p className="text-xs text-slate-500">
          <span className="text-slate-600">다음 →</span>{" "}
          <span className="text-slate-400">{nextActionMessage}</span>
        </p>
      )}
    </div>
  );
}

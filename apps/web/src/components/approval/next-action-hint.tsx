"use client";

/**
 * NextActionHint — 다음 행동 안내를 dock 상단에 표시
 *
 * engine output의 nextActionMessage + whoCanUnblock을 렌더.
 * 작업자가 "지금 뭘 해야 하는지"를 즉시 파악할 수 있도록.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface NextActionHintProps {
  /** 다음 행동 메시지 (engine nextActionMessage) */
  message: string;
  /** 해결 가능한 사람 목록 (engine whoCanUnblock) */
  whoCanUnblock?: string[];
  /** status color context */
  variant?: "default" | "urgent" | "blocked";
  className?: string;
}

export function NextActionHint({
  message,
  whoCanUnblock = [],
  variant = "default",
  className,
}: NextActionHintProps) {
  return (
    <div
      className={cn(
        "rounded px-3 py-2 text-xs",
        variant === "blocked" && "bg-red-500/5 border border-red-500/10",
        variant === "urgent" && "bg-amber-500/5 border border-amber-500/10",
        variant === "default" && "bg-slate-800/50 border border-slate-800",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "shrink-0",
            variant === "blocked" && "text-red-400",
            variant === "urgent" && "text-amber-400",
            variant === "default" && "text-blue-400",
          )}
          aria-hidden="true"
        >
          →
        </span>
        <span
          className={cn(
            "font-medium",
            variant === "blocked" && "text-red-300",
            variant === "urgent" && "text-amber-300",
            variant === "default" && "text-slate-600",
          )}
        >
          {message}
        </span>
      </div>
      {whoCanUnblock.length > 0 && (
        <p className="mt-1 ml-5 text-slate-500">
          해결 가능: {whoCanUnblock.join(", ")}
        </p>
      )}
    </div>
  );
}

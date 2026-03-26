"use client";

/**
 * DraftStatusChip — supplier-local 최소 상태 echo chip
 *
 * 규칙:
 * - 한 시점에 1개만 표시
 * - supplier-local header 한 곳에서만 사용
 * - assembly summary와 시각/문구 충돌 금지
 * - CTA처럼 보이면 안 됨
 * - summary tile처럼 보여도 안 됨
 */

import type { RequestDraftEchoKind } from "@/lib/ai/request-draft-status-echo";

export interface DraftStatusChipProps {
  kind: Exclude<RequestDraftEchoKind, "none">;
  label: string;
}

const CHIP_STYLES: Record<DraftStatusChipProps["kind"], string> = {
  // conflict: 상대적으로 또렷, small warning tone
  conflicted: "text-amber-400/90 bg-amber-600/8 border-amber-600/15",
  // edited: muted neutral tone
  edited: "text-slate-400 bg-slate-600/8 border-slate-600/15",
  // accepted: 가장 약함, success-green 강조 금지
  accepted: "text-slate-500 bg-slate-600/5 border-slate-600/10",
};

export function DraftStatusChip({ kind, label }: DraftStatusChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ${CHIP_STYLES[kind]}`}
    >
      {kind === "conflicted" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />
      )}
      {label}
    </span>
  );
}

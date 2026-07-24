"use client";

/**
 * §global-filters P2 — 활성 필터 칩 행 (적용 시만 렌더) + 결과 건수 + 초기화.
 * controlled: 활성 칩 목록·건수는 화면이 파생해 주입. 이 컴포넌트는 표시·해제 트리거만.
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  key: string;
  label: string;
}

export interface FilterChipRowProps {
  active: FilterChip[];
  resultCount?: number;
  onClear: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterChipRow({
  active,
  resultCount,
  onClear,
  onClearAll,
  className,
}: FilterChipRowProps) {
  if (active.length === 0 && resultCount == null) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {active.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onClear(c.key)}
          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      {resultCount != null && (
        <span className="text-xs text-slate-500">결과 {resultCount}건</span>
      )}
      {active.length > 0 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
        >
          초기화
        </button>
      )}
    </div>
  );
}

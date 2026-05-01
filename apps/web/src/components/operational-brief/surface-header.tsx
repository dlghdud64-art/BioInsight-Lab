/**
 * §11.179 #operational-brief-density-up-other-surfaces
 *
 * 5 surface 공통 ContextPanel 헤더.
 *   - eyebrow "OPERATIONAL BRIEFING" (tracking-[0.12em] text-blue-700)
 *   - module label badge
 *   - work object title (text-2xl font-bold)
 *   - LAST UPDATED 상대 시간 (formatRelativeKr)
 *   - close X 버튼
 *
 * inbox 의 §11.175 헤더 패턴을 추출. 다른 5 surface 가 import.
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeKr } from "./relative-time";

interface BriefSurfaceHeaderProps {
  /** module 라벨 (예: "견적 검토", "발주 전환", "재고 위험"). */
  moduleLabel?: string;
  /** module 라벨 className override (기존 surface 의 SOURCE_MODULE_COLORS 와 호환). */
  moduleLabelClassName?: string;
  /** work object 제목 (text-2xl). */
  title: string;
  /** work object updatedAt — null/undefined 시 LAST UPDATED 행 미노출. */
  updatedAt?: Date | string | null;
  /** close 핸들러. undefined 시 X 버튼 미노출. */
  onClose?: () => void;
  /** 추가 className. */
  className?: string;
}

export function BriefSurfaceHeader({
  moduleLabel,
  moduleLabelClassName,
  title,
  updatedAt,
  onClose,
  className,
}: BriefSurfaceHeaderProps) {
  const lastUpdatedLabel = formatRelativeKr(updatedAt ?? null);
  return (
    <div className={cn("px-6 py-5 border-b border-bd bg-el/20", className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold tracking-[0.12em] text-blue-700 uppercase">
            OPERATIONAL BRIEFING
          </span>
          {moduleLabel && (
            <span
              className={cn(
                "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
                moduleLabelClassName ?? "bg-slate-100 text-slate-700",
              )}
            >
              {moduleLabel}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
            aria-label="브리핑 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <h3 className="text-2xl font-bold text-slate-900 leading-tight">
        {title}
      </h3>
      {lastUpdatedLabel && (
        <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wide">
          <span className="font-semibold">LAST UPDATED</span> · {lastUpdatedLabel}
        </div>
      )}
    </div>
  );
}

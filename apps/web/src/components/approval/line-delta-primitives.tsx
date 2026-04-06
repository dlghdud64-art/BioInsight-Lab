"use client";

/**
 * Line Delta Primitives — receiving/variance/stock release에서 사용하는 line-level UI 부품
 *
 * - LineDeltaSummaryStrip: expected vs received vs delta 요약
 * - BlockerRowAnnotation: 특정 line에 policy blocker 표시
 * - SubsetChips: releasable/held/rejected/pending 서브셋 칩
 * - ThresholdBreachMarker: threshold 초과 inline 마커
 * - LineStatusIndicator: line 상태별 dot + label
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ── LineDeltaSummaryStrip ──
export interface LineDeltaSummaryStripProps {
  expectedQty: number;
  receivedQty: number;
  deltaQty: number;
  deltaPercent: number;
  unit?: string;
  className?: string;
}

export function LineDeltaSummaryStrip({
  expectedQty,
  receivedQty,
  deltaQty,
  deltaPercent,
  unit = "",
  className,
}: LineDeltaSummaryStripProps) {
  const isShortage = deltaQty < 0;
  const isOverage = deltaQty > 0;

  return (
    <div className={cn("flex items-center gap-4 px-3 py-2 rounded bg-slate-900 border border-slate-800 text-xs", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">예상</span>
        <span className="text-slate-700 font-semibold tabular-nums">{expectedQty}{unit}</span>
      </div>
      <span className="text-slate-700">→</span>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">입고</span>
        <span className="text-slate-700 font-semibold tabular-nums">{receivedQty}{unit}</span>
      </div>
      <span className="text-slate-700">=</span>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">차이</span>
        <span className={cn(
          "font-semibold tabular-nums",
          isShortage && "text-red-400",
          isOverage && "text-amber-400",
          !isShortage && !isOverage && "text-emerald-400",
        )}>
          {deltaQty > 0 ? `+${deltaQty}` : deltaQty}{unit}
        </span>
        <span className={cn(
          "tabular-nums",
          Math.abs(deltaPercent) > 10 && "text-red-400",
          Math.abs(deltaPercent) > 5 && Math.abs(deltaPercent) <= 10 && "text-amber-400",
          Math.abs(deltaPercent) <= 5 && "text-slate-400",
        )}>
          ({deltaPercent > 0 ? "+" : ""}{deltaPercent.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

// ── BlockerRowAnnotation ──
export interface BlockerRowAnnotationProps {
  lineId: string;
  blockerReason: string;
  severity: "hard" | "soft" | "warning";
  className?: string;
}

export function BlockerRowAnnotation({
  lineId,
  blockerReason,
  severity,
  className,
}: BlockerRowAnnotationProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1 rounded text-[10px]",
      severity === "hard" && "bg-red-500/5 border border-red-500/10 text-red-400",
      severity === "soft" && "bg-amber-500/5 border border-amber-500/10 text-amber-400",
      severity === "warning" && "bg-slate-500/5 border border-slate-500/10 text-slate-400",
      className,
    )}>
      <span className="shrink-0 font-mono text-[9px] text-slate-600">{lineId}</span>
      <span className="shrink-0" aria-hidden="true">
        {severity === "hard" ? "✕" : severity === "soft" ? "!" : "·"}
      </span>
      <span>{blockerReason}</span>
    </div>
  );
}

// ── SubsetChips ──
export interface SubsetChipData {
  label: string;
  count: number;
  variant: "releasable" | "held" | "rejected" | "pending" | "accepted" | "returned" | "disposed";
}

export interface SubsetChipsProps {
  chips: SubsetChipData[];
  className?: string;
}

const CHIP_COLORS: Record<string, string> = {
  releasable: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  held: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  returned: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  disposed: "bg-red-500/10 text-red-300 border-red-500/20",
};

export function SubsetChips({ chips, className }: SubsetChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.filter(c => c.count > 0).map((chip) => (
        <span
          key={chip.variant}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border",
            CHIP_COLORS[chip.variant] || CHIP_COLORS.pending,
          )}
        >
          <span>{chip.label}</span>
          <span className="tabular-nums">{chip.count}</span>
        </span>
      ))}
    </div>
  );
}

// ── ThresholdBreachMarker ──
export interface ThresholdBreachMarkerProps {
  value: number;
  threshold: number;
  unit?: string;
  label?: string;
  /** inline or block */
  display?: "inline" | "block";
  className?: string;
}

export function ThresholdBreachMarker({
  value,
  threshold,
  unit = "%",
  label,
  display = "inline",
  className,
}: ThresholdBreachMarkerProps) {
  const breached = value > threshold;
  if (!breached) return null;

  if (display === "inline") {
    return (
      <span className={cn("text-[10px] font-medium text-red-400 ml-1", className)}>
        {label || `${value}${unit} > ${threshold}${unit}`}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/5 border border-red-500/10 text-[10px] text-red-400", className)}>
      <span aria-hidden="true">⚠</span>
      <span>{label || `Threshold 초과: ${value}${unit} > ${threshold}${unit}`}</span>
    </div>
  );
}

// ── LineStatusIndicator ──
export interface LineStatusIndicatorProps {
  status: string;
  label?: string;
  className?: string;
}

const LINE_STATUS_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  released: { dot: "bg-emerald-400", text: "text-emerald-400", label: "릴리스" },
  received: { dot: "bg-emerald-400", text: "text-emerald-400", label: "입고 완료" },
  partial: { dot: "bg-amber-400", text: "text-amber-400", label: "부분 입고" },
  pending: { dot: "bg-slate-400", text: "text-slate-400", label: "대기" },
  rejected: { dot: "bg-red-400", text: "text-red-400", label: "거부" },
  damaged: { dot: "bg-red-400", text: "text-red-400", label: "손상" },
  held: { dot: "bg-blue-400", text: "text-blue-400", label: "보류" },
  disposed: { dot: "bg-red-300", text: "text-red-300", label: "폐기" },
  accepted: { dot: "bg-emerald-400", text: "text-emerald-400", label: "수용" },
  returned: { dot: "bg-amber-400", text: "text-amber-400", label: "반품" },
};

export function LineStatusIndicator({ status, label, className }: LineStatusIndicatorProps) {
  const config = LINE_STATUS_CONFIG[status] || { dot: "bg-slate-400", text: "text-slate-400", label: status };
  const displayLabel = label || config.label;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", config.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {displayLabel}
    </span>
  );
}

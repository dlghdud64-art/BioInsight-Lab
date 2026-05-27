/**
 * §11.176 #operational-brief-multi-surface-shared-parts
 *
 * RESOLVER 판별 근거 4-cell metric grid 의 cell.
 * 5 surface (inbox/quotes/purchases/inventory/work-queue) 공통 사용.
 *
 * 디자인 원칙:
 *   - text-3xl 수치 (한눈에 들어오는 운영 OS 톤)
 *   - tone 별 좌측 border-l-4 액센트 (ok/warn/danger/neutral)
 *   - bg-white + border slate-200 (모든 surface bg 와 호환)
 */

import { cn } from "@/lib/utils";

export type MetricCellTone = "ok" | "warn" | "danger" | "neutral";

interface MetricCellProps {
  label: string;
  value: string;
  tone?: MetricCellTone;
}

export function MetricCell({ label, value, tone = "neutral" }: MetricCellProps) {
  const accent: Record<MetricCellTone, string> = {
    ok: "border-l-emerald-500",
    warn: "border-l-yellow-500",
    danger: "border-l-red-500",
    neutral: "border-l-slate-300",
  };
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 border-l-4",
        accent[tone],
        "border-y-slate-200 border-r-slate-200",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-3xl font-bold text-slate-900 leading-none truncate">
        {value}
      </div>
    </div>
  );
}

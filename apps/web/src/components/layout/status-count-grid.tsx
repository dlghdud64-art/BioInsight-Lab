"use client";

import { cn } from "@/lib/utils";

/**
 * §11.374 #mobile-surface-unify — 상태별 카운트 단일 컴포넌트.
 *
 * 4 대시보드 탭(견적/구매/재고/대시보드)이 "상태별 카운트"를 제각각 표현하던
 * drift 를 단일 시각언어로 정합. 모바일 2x2(§11.311 KPI 그리드 토큰) — 가로 N-탭
 * 빽빽 해소.
 *
 * 절대 제약(canonical truth 보호):
 *  - 이 컴포넌트는 **표현만** 담당. count 는 surface 가 props 로 주입 — 자체 fetch 금지.
 *  - onClick 은 surface 의 기존 필터 wiring 을 그대로 연결(dead button/no-op 금지).
 *  - disabled 항목은 클릭 무효 + 비활성 톤(예: 견적 "비교 검토 0건" 가드).
 */

export type StatusCountTone =
  | "neutral"
  | "info"
  | "review"
  | "warning"
  | "danger"
  | "success";

export interface StatusCountItem {
  /** React key + 필터 식별자 */
  key: string;
  /** 짧은 라벨(모바일 우선): 예 "발송", "회신" */
  label: string;
  /** canonical count (surface 주입) */
  count: number;
  tone: StatusCountTone;
  /** 현재 선택(필터 활성) 여부 */
  active?: boolean;
  /** 클릭 무효 + 비활성 톤 */
  disabled?: boolean;
  /** surface 필터 토글 등 실제 동작 — 없으면 비대화형(표시 전용) */
  onClick?: () => void;
}

interface StatusCountGridProps {
  items: StatusCountItem[];
  /** 집계 중 — count 자리에 placeholder */
  loading?: boolean;
  /** 모바일 컬럼 수(기본 2 = 2x2). md+ 는 자동 확장 안 함(표현 통일). */
  className?: string;
  /** 그룹 a11y 라벨 */
  ariaLabel?: string;
}

// §11.302 신호등 + §11.311 톤. 0건/비활성은 호출부에서 tone="neutral" or disabled 로.
const TONE_VALUE: Record<StatusCountTone, string> = {
  neutral: "text-slate-500",
  info: "text-blue-600",
  review: "text-purple-600",
  warning: "text-yellow-600",
  danger: "text-red-600",
  success: "text-emerald-600",
};

export function StatusCountGrid({
  items,
  loading = false,
  className,
  ariaLabel = "상태별 요약",
}: StatusCountGridProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("grid grid-cols-2 gap-2", className)}
    >
      {items.map((item) => {
        const isZero = !loading && item.count === 0;
        const interactive = !!item.onClick && !item.disabled;
        const valueTone = isZero || item.disabled ? "text-slate-400" : TONE_VALUE[item.tone];
        return (
          <button
            key={item.key}
            type="button"
            onClick={interactive ? item.onClick : undefined}
            disabled={item.disabled}
            aria-disabled={item.disabled || undefined}
            aria-pressed={item.onClick ? !!item.active : undefined}
            aria-label={`${item.label} ${loading ? "집계 중" : item.count}건${item.active ? " · 선택됨" : ""}`}
            className={cn(
              // §11.311: 컴팩트 패딩 p-3, 44px 터치, active ring, active:scale 피드백
              "flex items-center justify-between gap-2 rounded-xl border p-3 min-h-[44px] text-left transition-colors",
              item.active
                ? "border-slate-300 bg-slate-50 ring-1 ring-slate-300"
                : isZero
                  ? "border-slate-200 bg-gray-50"
                  : "border-slate-300 bg-white shadow-sm",
              interactive && "hover:bg-slate-50 active:scale-[0.98] cursor-pointer",
              item.disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                isZero || item.disabled ? "text-slate-400" : "text-slate-500",
              )}
            >
              {item.label}
            </span>
            <span className={cn("text-lg font-bold tabular-nums", valueTone)}>
              {loading ? <span className="inline-block h-5 w-5 rounded bg-slate-200 animate-pulse" /> : item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * §11.212 RelativeTimeText — client-only relative time helper
 *
 * client component 안 `Date.now()` / `new Date()` 직접 render-path 호출이
 * SSR-CSR hydration mismatch (#418/#423/#425) root cause. 본 helper 는
 * useEffect mount 후에만 Date.now() 호출하여 SSR HTML 에는 fallback (또는
 * 빈 문자열) 만 render, CSR mount 후에 실제 relative time 으로 swap.
 * `suppressHydrationWarning` 으로 fallback ↔ 실제 값 mismatch warn 차단.
 *
 * Lock:
 *   - useEffect + useState mount-after-render 패턴
 *   - suppressHydrationWarning 은 본 helper 한정 (generic suppress 0)
 *   - granularity: day / hour / minute (variant prop)
 *   - locale: 한국어 어미 강제 ("오늘" / "N일 전" / "N시간 전" / "N분 전")
 *
 * Usage:
 *   <RelativeTimeText iso={quote.createdAt} />
 *   <RelativeTimeText iso={item.updatedAt} variant="hour" />
 *   <RelativeTimeText iso={po.issuedAt} variant="minute" fallback="—" />
 */

"use client";

import { useEffect, useState } from "react";

export type RelativeTimeVariant = "day" | "hour" | "minute" | "auto" | "day-elapsed";

export interface RelativeTimeTextProps {
  /** ISO 8601 timestamp (UTC) */
  iso: string;
  /** 표시 단위 — 기본 "day" */
  variant?: RelativeTimeVariant;
  /** SSR fallback text — 기본 빈 문자열 (1 frame flash 최소화) */
  fallback?: string;
  /** 추가 className */
  className?: string;
}

function formatRelative(iso: string, variant: RelativeTimeVariant): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "—";
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (variant === "minute") {
    return minutes === 0 ? "방금" : `${minutes}분 전`;
  }
  if (variant === "hour") {
    const hours = Math.max(0, Math.floor(diffMs / 3_600_000));
    return hours === 0 ? "방금" : `${hours}시간 전`;
  }
  if (variant === "auto") {
    if (minutes < 1) return "방금";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}일 전`;
    const months = Math.floor(days / 30);
    return `${months}개월 전`;
  }
  if (variant === "day-elapsed") {
    // §11.214 — SLA aging UI ("N일 경과") 형식, day variant 와 다른 어미
    const days = Math.max(0, Math.floor(diffMs / 86_400_000));
    return days === 0 ? "오늘" : `${days}일 경과`;
  }
  // day (default)
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  return days === 0 ? "오늘" : `${days}일 전`;
}

export function RelativeTimeText({
  iso,
  variant = "day",
  fallback = "",
  className,
}: RelativeTimeTextProps) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    setText(formatRelative(iso, variant));
  }, [iso, variant]);

  return (
    <span suppressHydrationWarning className={className}>
      {text}
    </span>
  );
}

/**
 * §11.176 #operational-brief-multi-surface-shared-parts
 *
 * deterministic 한국어 상대 시간 포맷터 (외부 dep 0).
 * 5 surface (inbox/quotes/purchases/inventory/work-queue) 의 LAST UPDATED 표시 공통.
 *
 *   - 음수 (미래) → "방금 전"
 *   - < 60초 → "방금 전"
 *   - < 60분 → "{n}분 전"
 *   - < 24시간 → "{n}시간 전"
 *   - < 7일 → "{n}일 전"
 *   - 그 외 → toLocaleDateString("ko-KR")
 *   - null/invalid → null
 */

export function formatRelativeKr(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime()) || d.getTime() === 0) return null;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "방금 전";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return d.toLocaleDateString("ko-KR");
}

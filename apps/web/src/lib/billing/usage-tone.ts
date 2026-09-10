/**
 * §billing-redesign P3: 사용량 게이지 신호등 + 청구 기간 표기. 순수함수만 둔다.
 *
 * 왜 페이지가 아니라 여기인가(2026-09-09 실측):
 *   처음엔 이 함수들을 `app/billing/page.tsx` 에 export 해 두고 sentinel 이 그 모듈을
 *   import 했다. 그러자 테스트가 페이지 트리를 통째로 끌고 들어왔다:
 *     billing/page -> AppPageHeader -> dashboard/Header -> next-auth/react
 *   vitest 가 `next-auth/react` 를 해석하지 못해(next build 는 통과) 게이트가 통째로 RED 였다.
 *   계산은 옳은데 로딩 경로 때문에 검증이 막힌 것이다. 그래서 규칙만 떼어 여기 둔다.
 *   선례: `lib/reports/period-label.ts`(§mobile-residual-5).
 *
 * 이 배치가 CLAUDE.md "화면이 보여주는 수와 게이트가 판정하는 수는 같은 함수" 를
 *   물리적으로 만족시킨다: 게이트가 검증하는 함수와 화면이 부르는 함수가 같은 모듈이다.
 *
 * 색은 §11.302 신호등 그대로. 🛑 Tailwind `amber-*`/`orange-*` 금지(16 amber-removed
 *   sentinel). 시안이 "앰버" 라 불러도 클래스는 yellow 다.
 */

export type UsageTone = "danger" | "warn" | "normal";

/**
 * 게이지 색 판정.
 *   100% 도달 = danger · 80% 이상 또는 시트 만석 = warn · 그 외 normal.
 *   한도가 없거나(무제한) 0 이하면 normal: 채울 수 없는 막대는 거짓 신호다.
 */
export function usageTone(used: number, limit: number | null, seatFull = false): UsageTone {
  if (limit === null || limit <= 0) return "normal";
  const pct = (used / limit) * 100;
  if (pct >= 100) return "danger";
  if (pct >= 80 || seatFull) return "warn";
  return "normal";
}

export const USAGE_BAR: Record<UsageTone, string> = {
  danger: "bg-red-600",
  warn: "bg-yellow-500",
  normal: "bg-blue-600",
};

export const USAGE_TEXT: Record<UsageTone, string> = {
  danger: "text-red-700",
  warn: "text-yellow-700",
  normal: "text-slate-900",
};

/** 날짜 표기 `YYYY. M. D.` (CLAUDE.md 단일 날짜 규약). */
export function formatBillingDate(d: Date): string {
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * 이번 달 기간 + 초기화까지 남은 일수.
 * 월 한도의 기준점(1일 00:00)과 같은 축이라 화면과 enforce 가 같은 달을 말한다.
 */
export function billingPeriodLabel(now = new Date()): {
  range: string;
  resetInDays: number;
  resetDateLabel: string;
} {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const resetInDays = Math.max(0, Math.ceil((nextStart.getTime() - today.getTime()) / 86_400_000));
  return {
    range: `${formatBillingDate(start)} ~ ${formatBillingDate(end)}`,
    resetInDays,
    resetDateLabel: formatBillingDate(nextStart),
  };
}

/**
 * 한도 상태의 다음 행동 문장. 사유 없는 빨간 막대는 노이즈로 늙는다.
 *   시트는 월 한도가 아니라 정원이라 "초기화" 가 없다: 안내가 다르다.
 */
export function usageNote(
  tone: UsageTone,
  opts: { kind: string; resetDateLabel: string; isSeat?: boolean },
): string | null {
  if (tone === "normal") return null;
  if (opts.isSeat) return "멤버 초대 시 시트 추가 필요";
  if (tone === "danger") return `한도 도달 · 다음 ${opts.kind}은 ${opts.resetDateLabel} 또는 업그레이드`;
  return null;
}

/**
 * §mobile-residual-5 1b/1c — 구매 리포트 기간 표기·검증 순수 함수 (UI 0 · fetch 0).
 *
 * 표기 규칙(호영님 핸드오프 2026-09-07 공통):
 *   기간 = `MM-DD ~ MM-DD · N일` (MM-DD 통일 · em dash 금지 · `~` 구분).
 *   N일 = end − start (달력 일수 차). 프리셋 `최근 7일/30일` 이 now − N days 로
 *   start 를 잡으므로 같은 diff 규칙이어야 프리셋 라벨과 행 표기가 일치한다
 *   (05-31 ~ 08-31 = 92일 = 시안 1b 정합).
 *
 * 검증(1c): 종료일 > 시작일 · 최대 범위 1년(시작일 + 1년 이하). 위반 시 사유 반환.
 */

const DAY_MS = 86_400_000;

/** 로컬 날짜 → YYYY-MM-DD (toISOString 의 UTC 시프트로 하루 밀리는 문제 회피). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 로컬 자정 Date. 형식 불량이면 null. */
export function parseIsoDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** 기간 일수 = end − start (달력 일수). 형식 불량이면 0. */
export function periodDayCount(startIso: string, endIso: string): number {
  const s = parseIsoDate(startIso);
  const e = parseIsoDate(endIso);
  if (!s || !e) return 0;
  return Math.round((e.getTime() - s.getTime()) / DAY_MS);
}

/** YYYY-MM-DD → MM-DD */
export function toMonthDay(iso: string): string {
  return iso.length >= 10 ? iso.slice(5, 10) : iso;
}

/** 기간 행 표기. 빈 기간 = API 기본(최근 1개월). */
export function formatPeriodRow(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "최근 1개월";
  return `${toMonthDay(startIso)} ~ ${toMonthDay(endIso)} · ${periodDayCount(startIso, endIso)}일`;
}

export type CustomRangeValidation = { ok: true } | { ok: false; reason: string };

/** 1c 검증 — 종료일 > 시작일 · 최대 1년. 위반 시 적용 disabled + 사유 라벨. */
export function validateCustomRange(startIso: string, endIso: string): CustomRangeValidation {
  const s = parseIsoDate(startIso);
  const e = parseIsoDate(endIso);
  if (!s || !e) return { ok: false, reason: "시작일과 종료일을 모두 선택하세요" };
  if (e.getTime() <= s.getTime()) return { ok: false, reason: "종료일은 시작일보다 뒤여야 해요" };
  const limit = new Date(s.getFullYear() + 1, s.getMonth(), s.getDate());
  if (e.getTime() > limit.getTime()) return { ok: false, reason: "최대 1년까지 선택할 수 있어요" };
  return { ok: true };
}

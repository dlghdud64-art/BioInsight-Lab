/**
 * ops-console/demo-clock.ts
 *
 * 데모용 고정 시계.
 * 현재 날짜가 바뀌어도 시나리오 데이터가 동일하게 작동하도록
 * 데모 기준 시점(ANCHOR)에서의 상대 시간만 사용합니다.
 *
 * @module ops-console/demo-clock
 */

/**
 * Demo anchor: 항상 "오늘 오전 9시" 기준.
 * 모든 relative offset은 이 시점 기준으로 계산됩니다.
 */
function createAnchor(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

let _anchor: Date | null = null;

function getAnchor(): Date {
  if (!_anchor) _anchor = createAnchor();
  return _anchor;
}

/** Reset anchor (for test / scenario reset) */
export function resetDemoClock(): void {
  _anchor = null;
}

/** ISO string at anchor (= "today 09:00") */
export function isoNow(): string {
  return getAnchor().toISOString();
}

/** ISO string N days from anchor (positive = future, negative = past) */
export function isoFromNow(days: number, hours = 0): string {
  const d = new Date(getAnchor());
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/** ISO string N days before anchor */
export function isoAgo(days: number, hours = 0): string {
  return isoFromNow(-days, -hours);
}

/** Hours elapsed since a given ISO timestamp, relative to anchor */
export function hoursSinceAnchor(iso: string): number {
  return Math.max(0, (getAnchor().getTime() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

/** Days between anchor and a future ISO timestamp */
export function daysUntil(iso: string): number {
  return (new Date(iso).getTime() - getAnchor().getTime()) / (1000 * 60 * 60 * 24);
}

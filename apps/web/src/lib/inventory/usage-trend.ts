/**
 * §inventory-delta-label-kpi P2b-1 (호영님 2026-07-27 핸드오프 §2b) — 품목 소진 추이 버킷.
 *   canonical 소스 = /api/inventory/usage (db.inventoryUsage). 본 함수는 records 파생(표시 계층).
 *   주버킷 기본, 데이터 span < 2주(14일) 시 일 단위 폴백. 빈 버킷은 0으로 채워 연속 추세 표시.
 *   순수 함수(Date.now 미사용) — 경계 unit test 대상.
 */

export type UsageTrendGranularity = "week" | "day";

export interface UsageTrendInput {
  usageDate: string | Date;
  quantity: number;
}

export interface UsageTrendPoint {
  label: string; // "M/D" (버킷 시작, UTC)
  periodStart: string; // YYYY-MM-DD (UTC)
  total: number;
}

export interface UsageTrendResult {
  granularity: UsageTrendGranularity;
  points: UsageTrendPoint[];
  totalUsage: number;
  recordCount: number;
}

const DAY_MS = 86_400_000;

function parseDate(v: string | Date): Date | null {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayStartUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function weekStartUTC(t: number, weekStartsOn: number): number {
  const d = new Date(t);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (dow - weekStartsOn + 7) % 7;
  return t - diff * DAY_MS;
}

function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function shortLabel(t: number): string {
  const d = new Date(t);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function computeUsageTrend(
  records: UsageTrendInput[],
  opts: { weekStartsOn?: number; maxBuckets?: number } = {},
): UsageTrendResult {
  const weekStartsOn = opts.weekStartsOn ?? 1; // 월요일 시작

  const valid = (records ?? [])
    .map((r) => ({ t: parseDate(r.usageDate), q: Number(r.quantity) }))
    .filter((r): r is { t: Date; q: number } => r.t !== null && Number.isFinite(r.q))
    .map((r) => ({ day: dayStartUTC(r.t), q: r.q }));

  const totalUsage = valid.reduce((s, r) => s + r.q, 0);
  if (valid.length === 0) {
    return { granularity: "week", points: [], totalUsage: 0, recordCount: 0 };
  }

  const minDay = Math.min(...valid.map((r) => r.day));
  const maxDay = Math.max(...valid.map((r) => r.day));
  const spanDays = Math.round((maxDay - minDay) / DAY_MS);

  const granularity: UsageTrendGranularity = spanDays >= 14 ? "week" : "day";
  const stepMs = granularity === "week" ? 7 * DAY_MS : DAY_MS;
  const maxBuckets = opts.maxBuckets ?? (granularity === "week" ? 26 : 30);

  const bucketOf = (day: number): number =>
    granularity === "week" ? weekStartUTC(day, weekStartsOn) : day;

  const totals = new Map<number, number>();
  for (const r of valid) {
    const b = bucketOf(r.day);
    totals.set(b, (totals.get(b) ?? 0) + r.q);
  }

  const firstBucket = bucketOf(minDay);
  const lastBucket = bucketOf(maxDay);

  const points: UsageTrendPoint[] = [];
  for (let t = firstBucket; t <= lastBucket; t += stepMs) {
    points.push({ label: shortLabel(t), periodStart: isoDay(t), total: totals.get(t) ?? 0 });
  }

  const trimmed =
    points.length > maxBuckets ? points.slice(points.length - maxBuckets) : points;

  return { granularity, points: trimmed, totalUsage, recordCount: valid.length };
}

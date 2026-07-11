/**
 * §quotes-quick-filter-4a — 견적 빠른 필터 순수 파생 로직 (호영님 4a 확정안)
 *
 * 원칙:
 *  - canonical 파생만: 우선순위/마감(dd)/사유는 computePriority(toQuoteCase(q)) 로 읽을 때마다 계산.
 *    저장 0, UI state 가 truth 대체 금지.
 *  - status 칩은 다중선택(AND). mine/period/search/sort 와 전부 AND 결합.
 *  - 정직 배지: chipCount(id) = base(mine+period) + 다른 활성 status 적용 후 그 칩을 켰을 때 매칭 수.
 *  - show(id) = chipCount(id) > 0 || active  → 비활성 0건 숨김, 활성 0건은 항상 노출(해제 데드락 방지).
 *
 * 데이터 경계(P0 truth lock):
 *  - deadline = dd ≤ 3 · stalled = reason "회신정체" · priority = level high
 *  - send = status PENDING(발송 대기) · reply = status SENT & 무회신(회신 대기)
 *  - mine = quote.user.id === currentUserId (LabAxis 는 별도 ownerId 없음 → 요청자 user 로 대체)
 *  - budget(예산 초과) 칩은 데이터 부재로 미도입 · arrival 칩은 4a 셋에 없어 미도입
 */
import { computePriority } from "./derive";
import { toQuoteCase, type QuoteLike } from "./from-quote";

export type StatusChipKey = "deadline" | "stalled" | "priority" | "send" | "reply";
export type PeriodKey = "all" | "week" | "d3";
export type SortKey = "dday" | "priority" | "amount";

export const STATUS_CHIP_KEYS: readonly StatusChipKey[] = [
  "deadline",
  "stalled",
  "priority",
  "send",
  "reply",
];

/** 페이지 Quote 를 구조적으로 수용 — 예측 로직에 필요한 필드만 요구. */
export interface QuickFilterQuote extends QuoteLike {
  responses?: Array<{ totalPrice?: number | null; vendor?: { name?: string | null } }> | null;
  user?: { id?: string | null; name?: string | null } | null;
}

export interface QuickFilterState {
  q: string;
  mine: boolean;
  period: PeriodKey;
  status: Set<StatusChipKey>;
  sort: SortKey;
}

export interface QuickFilterContext {
  currentUserId: string | null;
  now?: Date;
}

export function initialQuickFilterState(): QuickFilterState {
  return { q: "", mine: false, period: "all", status: new Set<StatusChipKey>(), sort: "dday" };
}

interface Derived {
  dd: number | null;
  level: "high" | "mid" | "low";
  reason: string | null;
}

/** canonical 파생 1회 계산 — 퍼널 외(null) 케이스는 중립값. */
export function deriveQuote(q: QuickFilterQuote, now: Date = new Date()): Derived {
  const c = toQuoteCase(q);
  if (!c) return { dd: null, level: "low", reason: null };
  const p = computePriority(c, now);
  return { dd: p.dd, level: p.level, reason: p.reason };
}

/** status 칩 술어 — derived + 원본 status 로 판정. */
export const STATUS_PREDICATES: Record<
  StatusChipKey,
  (q: QuickFilterQuote, d: Derived) => boolean
> = {
  deadline: (_q, d) => d.dd != null && d.dd <= 3,
  stalled: (_q, d) => d.reason === "회신정체",
  priority: (_q, d) => d.level === "high",
  send: (q, _d) => q.status === "PENDING",
  reply: (q, _d) => q.status === "SENT" && (q.responses?.length ?? 0) === 0,
};

/** 마감 기간 술어 — 마감 없는(dd null) 케이스는 week/d3 에서 항상 제외. */
export function periodMatch(period: PeriodKey, d: Derived): boolean {
  if (period === "all") return true;
  if (d.dd == null) return false;
  return period === "week" ? d.dd <= 7 : d.dd <= 3; // d3
}

/** 내 담당 술어. */
export function mineMatch(q: QuickFilterQuote, currentUserId: string | null): boolean {
  return currentUserId != null && q.user?.id != null && q.user.id === currentUserId;
}

/** 검색 매칭 — 견적명 + 공급사명(회신/요청). 빈 검색어는 통과. */
export function searchMatch(q: QuickFilterQuote, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const haystack: string[] = [q.title ?? ""];
  for (const r of q.responses ?? []) if (r.vendor?.name) haystack.push(r.vendor.name);
  for (const v of q.vendorRequests ?? []) if (v.vendorName) haystack.push(v.vendorName);
  return haystack.some((s) => s.toLowerCase().includes(t));
}

/** base = 전체 → mine → period (검색·status 미적용). §5 파이프라인 정합. */
function computeBase(
  quotes: QuickFilterQuote[],
  state: QuickFilterState,
  ctx: QuickFilterContext,
): Array<{ q: QuickFilterQuote; d: Derived }> {
  const now = ctx.now ?? new Date();
  const rows = quotes.map((q) => ({ q, d: deriveQuote(q, now) }));
  return rows
    .filter(({ q }) => (state.mine ? mineMatch(q, ctx.currentUserId) : true))
    .filter(({ d }) => periodMatch(state.period, d));
}

/** 최종 결과(정렬 전) — base + 모든 활성 status(AND) + 검색. */
export function applyQuickFilter(
  quotes: QuickFilterQuote[],
  state: QuickFilterState,
  ctx: QuickFilterContext,
): QuickFilterQuote[] {
  const active = [...state.status];
  return computeBase(quotes, state, ctx)
    .filter(({ q, d }) => active.every((k) => STATUS_PREDICATES[k](q, d)))
    .filter(({ q }) => searchMatch(q, state.q))
    .map(({ q }) => q);
}

/**
 * 정직 배지 건수 — base(mine+period) + 현재 활성인 *다른* status 를 적용한 뒤,
 * 대상 칩(id)을 추가로 켰을 때 매칭될 수. 선택마다 전 칩 재계산.
 */
export function chipCount(
  quotes: QuickFilterQuote[],
  state: QuickFilterState,
  id: StatusChipKey,
  ctx: QuickFilterContext,
): number {
  const others = [...state.status].filter((k) => k !== id);
  return computeBase(quotes, state, ctx)
    .filter(({ q, d }) => others.every((k) => STATUS_PREDICATES[k](q, d)))
    .filter(({ q, d }) => STATUS_PREDICATES[id](q, d)).length;
}

/** 노출 규칙 — 비활성 0건 숨김, 활성 칩은 0건이어도 항상 노출(해제 데드락 방지). */
export function chipShow(
  quotes: QuickFilterQuote[],
  state: QuickFilterState,
  id: StatusChipKey,
  ctx: QuickFilterContext,
): boolean {
  if (state.status.has(id)) return true;
  return chipCount(quotes, state, id, ctx) > 0;
}

const LEVEL_RANK: Record<"high" | "mid" | "low", number> = { high: 0, mid: 1, low: 2 };

/** 정렬 — 기본 마감 임박순(dd asc, null 후순위). 우선순위순/금액 높은순. */
export function sortQuotes(
  quotes: QuickFilterQuote[],
  sort: SortKey,
  now: Date = new Date(),
): QuickFilterQuote[] {
  const rows = quotes.map((q) => ({ q, d: deriveQuote(q, now) }));
  const byDdayAsc = (a: Derived, b: Derived) => {
    const av = a.dd == null ? Number.POSITIVE_INFINITY : a.dd;
    const bv = b.dd == null ? Number.POSITIVE_INFINITY : b.dd;
    return av - bv;
  };
  rows.sort((ra, rb) => {
    if (sort === "dday") return byDdayAsc(ra.d, rb.d);
    if (sort === "priority") {
      const lv = LEVEL_RANK[ra.d.level] - LEVEL_RANK[rb.d.level];
      return lv !== 0 ? lv : byDdayAsc(ra.d, rb.d);
    }
    // amount — 높은순, null 후순위
    const aa = ra.q.totalAmount ?? Number.NEGATIVE_INFINITY;
    const ba = rb.q.totalAmount ?? Number.NEGATIVE_INFINITY;
    return ba - aa;
  });
  return rows.map(({ q }) => q);
}

/** URL 쿼리 직렬화 — ?mine&period&status&sort&q (truth 아님, 공유·복원용). */
export function serializeQuickFilter(state: QuickFilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.mine) p.set("mine", "1");
  if (state.period !== "all") p.set("period", state.period);
  if (state.status.size > 0) p.set("status", [...state.status].join(","));
  if (state.sort !== "dday") p.set("sort", state.sort);
  if (state.q.trim()) p.set("q", state.q.trim());
  return p;
}

/** persist/URL CSV → status Set (unknown key 무시, 역호환). */
export function parseStatusCsv(csv: string | null | undefined): Set<StatusChipKey> {
  const set = new Set<StatusChipKey>();
  if (!csv) return set;
  for (const raw of csv.split(",")) {
    const k = raw.trim();
    if ((STATUS_CHIP_KEYS as readonly string[]).includes(k)) set.add(k as StatusChipKey);
  }
  return set;
}

export function parseQuickFilterParams(params: URLSearchParams): Partial<QuickFilterState> {
  const out: Partial<QuickFilterState> = {};
  if (params.get("mine") === "1") out.mine = true;
  const period = params.get("period");
  if (period === "week" || period === "d3") out.period = period;
  const status = parseStatusCsv(params.get("status"));
  if (status.size > 0) out.status = status;
  const sort = params.get("sort");
  if (sort === "priority" || sort === "amount") out.sort = sort;
  const q = params.get("q");
  if (q) out.q = q;
  return out;
}

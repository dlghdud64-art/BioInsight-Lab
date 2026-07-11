/**
 * §quotes-quick-filter-4a — 빠른 필터 순수 파생 로직 검증 (P1)
 *
 * 검증: 다중 AND · 정직 배지(문맥 카운트) · 0건 숨김/활성 노출 · 기간·내담당·검색 AND
 *       · 정렬 3종 · URL 직렬화/파싱 · budget/arrival 미도입.
 */
import { describe, it, expect } from "vitest";
import {
  STATUS_CHIP_KEYS,
  initialQuickFilterState,
  applyQuickFilter,
  chipCount,
  chipShow,
  sortQuotes,
  periodMatch,
  mineMatch,
  searchMatch,
  deriveQuote,
  serializeQuickFilter,
  parseQuickFilterParams,
  parseStatusCsv,
  type QuickFilterQuote,
  type QuickFilterState,
  type StatusChipKey,
} from "@/lib/quote-management/quick-filter";

// ── 고정 now: 2026-07-11 ──
const NOW = new Date("2026-07-11T00:00:00+09:00");
const ctx = (currentUserId: string | null = null) => ({ currentUserId, now: NOW });

// vendorRequest 로 dd(마감) 유도 — created + window 로 만료일 산출.
function vr(createdDaysAgo: number, windowDays: number) {
  const created = new Date(NOW.getTime() - createdDaysAgo * 86400000);
  const expires = new Date(created.getTime() + windowDays * 86400000);
  return {
    vendorName: "가나상사",
    status: "SENT",
    createdAt: created.toISOString(),
    expiresAt: expires.toISOString(),
    respondedAt: null,
  };
}

function q(partial: Partial<QuickFilterQuote> & { id: string; status: string }): QuickFilterQuote {
  return {
    title: partial.title ?? `견적 ${partial.id}`,
    createdAt: NOW.toISOString(),
    totalAmount: null,
    vendorRequests: [],
    responses: [],
    user: null,
    ...partial,
  };
}

function withState(over: Partial<QuickFilterState>): QuickFilterState {
  return { ...initialQuickFilterState(), ...over };
}

describe("§quotes-quick-filter-4a — predicate & 파생", () => {
  it("STATUS_CHIP_KEYS = 5칩(budget/arrival 미포함)", () => {
    expect([...STATUS_CHIP_KEYS].sort()).toEqual(
      ["deadline", "priority", "reply", "send", "stalled"].sort(),
    );
    expect(STATUS_CHIP_KEYS as readonly string[]).not.toContain("budget");
    expect(STATUS_CHIP_KEYS as readonly string[]).not.toContain("arrival");
  });

  it("deadline = dd ≤ 3 (마감 임박)", () => {
    // window 5일, 발송 4일 전 → 만료 D+1 → dd=1 ≤ 3
    const near = q({ id: "A", status: "SENT", vendorRequests: [vr(4, 5)] });
    expect(deriveQuote(near, NOW).dd).toBeLessThanOrEqual(3);
    const far = q({ id: "B", status: "SENT", vendorRequests: [vr(0, 20)] });
    expect((deriveQuote(far, NOW).dd ?? 99) > 3).toBe(true);
  });

  it("send = PENDING · reply = SENT & 무회신", () => {
    const pending = q({ id: "P", status: "PENDING" });
    const waiting = q({ id: "W", status: "SENT", responses: [] });
    const partial = q({ id: "R", status: "SENT", responses: [{ totalPrice: 100, vendor: { name: "V" } }] });
    const s = withState({ status: new Set<StatusChipKey>(["send"]) });
    expect(applyQuickFilter([pending, waiting, partial], s, ctx()).map((x) => x.id)).toEqual(["P"]);
    const s2 = withState({ status: new Set<StatusChipKey>(["reply"]) });
    expect(applyQuickFilter([pending, waiting, partial], s2, ctx()).map((x) => x.id)).toEqual(["W"]);
  });

  it("마감 없는 케이스는 week/d3 에서 제외", () => {
    const noDue = deriveQuote(q({ id: "N", status: "PENDING" }), NOW);
    expect(periodMatch("all", noDue)).toBe(true);
    expect(periodMatch("week", noDue)).toBe(false);
    expect(periodMatch("d3", noDue)).toBe(false);
  });

  it("mine = user.id === currentUserId", () => {
    const mineQ = q({ id: "M", status: "SENT", user: { id: "u1" } });
    const otherQ = q({ id: "O", status: "SENT", user: { id: "u2" } });
    expect(mineMatch(mineQ, "u1")).toBe(true);
    expect(mineMatch(otherQ, "u1")).toBe(false);
    expect(mineMatch(mineQ, null)).toBe(false);
  });

  it("search = 견적명 + 공급사명, 빈 검색어 통과", () => {
    const item = q({ id: "S", status: "SENT", title: "배지 시약", responses: [{ vendor: { name: "시그마" } }] });
    expect(searchMatch(item, "")).toBe(true);
    expect(searchMatch(item, "시그마")).toBe(true);
    expect(searchMatch(item, "배지")).toBe(true);
    expect(searchMatch(item, "없는값")).toBe(false);
  });
});

describe("§quotes-quick-filter-4a — 다중 AND & 정직 배지", () => {
  const pending = q({ id: "P", status: "PENDING" });
  const waiting = q({ id: "W", status: "SENT", responses: [] });
  const nearWaiting = q({ id: "NW", status: "SENT", responses: [], vendorRequests: [vr(4, 5)] });
  const pool = [pending, waiting, nearWaiting];

  it("다중 선택 AND — reply + deadline = 교집합만", () => {
    const s = withState({ status: new Set<StatusChipKey>(["reply", "deadline"]) });
    expect(applyQuickFilter(pool, s, ctx()).map((x) => x.id)).toEqual(["NW"]);
  });

  it("chipCount = 문맥 카운트(다른 활성 조건 반영)", () => {
    // reply 활성 상태에서 deadline 배지 = reply∩deadline = 1 (NW)
    const s = withState({ status: new Set<StatusChipKey>(["reply"]) });
    expect(chipCount(pool, s, "deadline", ctx())).toBe(1);
    // 아무 것도 활성 아닐 때 deadline 배지 = 1 (NW)
    const s0 = withState({});
    expect(chipCount(pool, s0, "deadline", ctx())).toBe(1);
    // send 배지(문맥 무관) = 1 (P)
    expect(chipCount(pool, s0, "send", ctx())).toBe(1);
  });

  it("show — 비활성 0건 숨김, 활성 0건 노출(데드락 방지)", () => {
    // send 활성 → send∩priority 조합에서 priority 0건이면 비활성 priority 숨김
    const s = withState({ status: new Set<StatusChipKey>(["send"]) });
    expect(chipCount(pool, s, "priority", ctx())).toBe(0);
    expect(chipShow(pool, s, "priority", ctx())).toBe(false);
    // priority 를 활성으로 강제 → 0건이어도 노출
    const s2 = withState({ status: new Set<StatusChipKey>(["send", "priority"]) });
    expect(chipShow(pool, s2, "priority", ctx())).toBe(true);
  });

  it("mine + period + status + search 전부 AND", () => {
    const mineNear = q({ id: "MN", status: "SENT", responses: [], user: { id: "u1" }, title: "긴급 배지", vendorRequests: [vr(4, 5)] });
    const otherNear = q({ id: "ON", status: "SENT", responses: [], user: { id: "u2" }, vendorRequests: [vr(4, 5)] });
    const s = withState({ mine: true, period: "d3", status: new Set<StatusChipKey>(["reply"]), q: "배지" });
    expect(applyQuickFilter([mineNear, otherNear], s, ctx("u1")).map((x) => x.id)).toEqual(["MN"]);
  });
});

describe("§quotes-quick-filter-4a — 정렬", () => {
  it("dday asc(기본), null 후순위", () => {
    const near = q({ id: "N", status: "SENT", vendorRequests: [vr(4, 5)] }); // dd 작음
    const noDue = q({ id: "X", status: "PENDING" }); // dd null
    const sorted = sortQuotes([noDue, near], "dday", NOW).map((x) => x.id);
    expect(sorted[0]).toBe("N");
    expect(sorted[1]).toBe("X");
  });

  it("amount 높은순, null 후순위", () => {
    const hi = q({ id: "H", status: "SENT", totalAmount: 900 });
    const lo = q({ id: "L", status: "SENT", totalAmount: 100 });
    const nul = q({ id: "Z", status: "SENT", totalAmount: null });
    expect(sortQuotes([lo, nul, hi], "amount", NOW).map((x) => x.id)).toEqual(["H", "L", "Z"]);
  });
});

describe("§quotes-quick-filter-4a — URL 동기화", () => {
  it("serialize → parse 라운드트립", () => {
    const s = withState({ mine: true, period: "week", status: new Set<StatusChipKey>(["deadline", "stalled"]), sort: "amount", q: "배지" });
    const params = serializeQuickFilter(s);
    expect(params.get("mine")).toBe("1");
    expect(params.get("period")).toBe("week");
    expect(params.get("status")).toBe("deadline,stalled");
    expect(params.get("sort")).toBe("amount");
    expect(params.get("q")).toBe("배지");
    const parsed = parseQuickFilterParams(params);
    expect(parsed.mine).toBe(true);
    expect(parsed.period).toBe("week");
    expect([...(parsed.status ?? [])].sort()).toEqual(["deadline", "stalled"]);
    expect(parsed.sort).toBe("amount");
    expect(parsed.q).toBe("배지");
  });

  it("기본값은 쿼리에 생략(빈 URL)", () => {
    const params = serializeQuickFilter(initialQuickFilterState());
    expect(params.toString()).toBe("");
  });

  it("parseStatusCsv — unknown key 무시(역호환)", () => {
    expect([...parseStatusCsv("deadline,budget,arrival,reply")].sort()).toEqual(["deadline", "reply"]);
  });
});

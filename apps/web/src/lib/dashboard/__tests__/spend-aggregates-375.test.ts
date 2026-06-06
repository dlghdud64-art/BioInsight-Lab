/**
 * §11.375 Phase 2 — 지출 집계 slimming 단위테스트.
 *
 * 값 동등성 핵심: aggregate 경계가 기존 route.ts JS 필터와 1:1 미러인지 검증.
 *   - prev7 은 < sevenDaysAgo (lt, 미포함)
 *   - thisMonth/last7 은 상한 thisMonthEnd(기존 fetch 상한)
 *   - monthly mEnd 는 말일 00:00:00
 *   - null _sum → 0
 */
import { describe, it, expect, vi } from "vitest";
import { buildSpendWindows, fetchSpendAggregates } from "../spend-aggregates";

describe("§11.375 — buildSpendWindows 경계", () => {
  const now = new Date(2026, 5, 15, 12, 0, 0); // 2026-06-15
  const w = buildSpendWindows(now);

  it("이번달/지난달 경계", () => {
    expect(w.monthStart.getTime()).toBe(new Date(2026, 5, 1).getTime());
    expect(w.thisMonthEnd.getTime()).toBe(new Date(2026, 6, 0, 23, 59, 59, 999).getTime());
    expect(w.lastMonthStart.getTime()).toBe(new Date(2026, 4, 1).getTime());
    expect(w.lastMonthEnd.getTime()).toBe(new Date(2026, 5, 0, 23, 59, 59, 999).getTime());
  });

  it("7일/14일 경계", () => {
    expect(w.sevenDaysAgo.getTime()).toBe(now.getTime() - 7 * 86400000);
    expect(w.fourteenDaysAgo.getTime()).toBe(now.getTime() - 14 * 86400000);
  });

  it("6개월 월별 — 6개, 라벨, mEnd 말일 00:00:00", () => {
    expect(w.months).toHaveLength(6);
    expect(w.months[0].label).toBe("2026-01");
    expect(w.months[5].label).toBe("2026-06");
    // mEnd 는 말일 00:00:00 (기존 경계 그대로 — 시분초 없음)
    expect(w.months[5].end.getTime()).toBe(new Date(2026, 6, 0).getTime());
  });
});

describe("§11.375 — fetchSpendAggregates 범위/null", () => {
  it("prev7 은 lt(미포함), thisMonth/last7 상한 thisMonthEnd, null→0", async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    const w = buildSpendWindows(now);
    const calls: any[] = [];
    const db = {
      purchaseRecord: {
        aggregate: vi.fn(async ({ where }: any) => {
          calls.push(where.purchasedAt);
          return { _sum: { amount: null } }; // null → 0 검증
        }),
      },
    };
    const result = await fetchSpendAggregates(db, { scopeKey: "x" }, now);

    // 호출 순서: thisMonth, lastMonth, last7, prev7, month×6
    expect(calls[0]).toEqual({ gte: w.monthStart, lte: w.thisMonthEnd });
    expect(calls[1]).toEqual({ gte: w.lastMonthStart, lte: w.lastMonthEnd });
    expect(calls[2]).toEqual({ gte: w.sevenDaysAgo, lte: w.thisMonthEnd });
    expect(calls[3]).toEqual({ gte: w.fourteenDaysAgo, lt: w.sevenDaysAgo }); // lt 미포함
    expect(calls).toHaveLength(10); // 4 + 6개월

    // null _sum → 0
    expect(result.thisMonthPurchaseAmount).toBe(0);
    expect(result.monthlySpending).toHaveLength(6);
    expect(result.monthlySpending[0]).toEqual({ month: "2026-01", amount: 0 });
  });

  it("scope where 가 각 aggregate 에 전파", async () => {
    const now = new Date(2026, 5, 15);
    const db = {
      purchaseRecord: {
        aggregate: vi.fn(async () => ({ _sum: { amount: 100 } })),
      },
    };
    await fetchSpendAggregates(db, { scopeKey: "owner-1" }, now);
    for (const call of (db.purchaseRecord.aggregate as any).mock.calls) {
      expect(call[0].where.scopeKey).toBe("owner-1");
    }
  });
});

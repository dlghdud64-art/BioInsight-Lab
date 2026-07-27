import { describe, it, expect } from "vitest";
import { computeUsageTrend } from "../usage-trend";

/**
 * §inventory-delta-label-kpi P2b-1 — 소진 추이 버킷 경계 unit.
 *   0건 · <2주(일 폴백) · ≥2주(주버킷) · 주 경계 합산 · 갭 0채움 · 불량레코드 제외.
 */
describe("computeUsageTrend", () => {
  it("0건 → points 빈 배열, total 0, granularity week", () => {
    const r = computeUsageTrend([]);
    expect(r.points).toEqual([]);
    expect(r.totalUsage).toBe(0);
    expect(r.recordCount).toBe(0);
    expect(r.granularity).toBe("week");
  });

  it("span < 14일 → 일 단위 폴백 + 갭 0채움", () => {
    const r = computeUsageTrend([
      { usageDate: "2026-07-01T00:00:00Z", quantity: 3 },
      { usageDate: "2026-07-04T00:00:00Z", quantity: 2 }, // 3일 갭
    ]);
    expect(r.granularity).toBe("day");
    expect(r.points).toHaveLength(4); // 7/1,7/2,7/3,7/4
    expect(r.points[0]).toMatchObject({ label: "7/1", total: 3 });
    expect(r.points[1].total).toBe(0);
    expect(r.points[3]).toMatchObject({ label: "7/4", total: 2 });
    expect(r.totalUsage).toBe(5);
  });

  it("span ≥ 14일 → 주버킷 + 빈 주 0채움", () => {
    const r = computeUsageTrend([
      { usageDate: "2026-07-01T00:00:00Z", quantity: 5 }, // 주 A
      { usageDate: "2026-07-22T00:00:00Z", quantity: 4 }, // 주 A+3
    ]);
    expect(r.granularity).toBe("week");
    expect(r.points.length).toBeGreaterThanOrEqual(3); // 중간 빈 주 포함
    const nonzero = r.points.filter((p) => p.total > 0);
    expect(nonzero).toHaveLength(2);
    expect(r.totalUsage).toBe(9);
    // 빈 주 존재
    expect(r.points.some((p) => p.total === 0)).toBe(true);
  });

  it("같은 주 다건 → 한 버킷 합산", () => {
    const r = computeUsageTrend([
      { usageDate: "2026-07-06T00:00:00Z", quantity: 2 }, // 월
      { usageDate: "2026-07-09T00:00:00Z", quantity: 3 }, // 같은 주 목
      { usageDate: "2026-07-27T00:00:00Z", quantity: 1 }, // 3주 뒤(주버킷 강제)
    ]);
    expect(r.granularity).toBe("week");
    const firstWeek = r.points[0];
    expect(firstWeek.total).toBe(5); // 2+3 합산
  });

  it("불량 레코드(NaN·잘못된 날짜) 제외", () => {
    const r = computeUsageTrend([
      { usageDate: "2026-07-01T00:00:00Z", quantity: 4 },
      { usageDate: "bad-date", quantity: 9 },
      { usageDate: "2026-07-02T00:00:00Z", quantity: Number.NaN },
    ]);
    expect(r.recordCount).toBe(1);
    expect(r.totalUsage).toBe(4);
  });
});

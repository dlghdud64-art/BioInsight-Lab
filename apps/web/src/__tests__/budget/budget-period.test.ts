/**
 * §order-budget-reservation P2 — resolveBudgetPeriod 단위 계약 (⑤ 교정)
 *
 * ⑤ 결함의 핵심: 표시용 기간(description)과 합산 창(yearMonth 월 창)이 분리돼
 * 있었다. 이 계약은 "명시 기간이 있으면 합산 창도 그 기간이다"를 고정한다.
 */
import { describe, it, expect } from "vitest";
import { resolveBudgetPeriod } from "@/lib/budget/budget-period";

describe("resolveBudgetPeriod — ⑤ 합산 창 단일화", () => {
  it("description 의 period: 명시 기간이 있으면 그 창을 쓴다 (월 창 아님)", () => {
    const r = resolveBudgetPeriod({
      yearMonth: "2026-08",
      description: "[연구] 프로젝트: X · period:2026-07-15~2026-09-14",
    });
    expect(r.source).toBe("description");
    expect(r.periodStart.getTime()).toBe(new Date("2026-07-15").getTime());
    expect(r.periodEnd.getTime()).toBe(new Date("2026-09-14T23:59:59").getTime());
  });

  it("명시 기간이 없으면 yearMonth 월 창 — 기존 라우트 문법 그대로 (1일 00:00 ~ 말일 23:59:59)", () => {
    const r = resolveBudgetPeriod({ yearMonth: "2026-08", description: "메모만 있음" });
    expect(r.source).toBe("yearMonth");
    expect(r.periodStart.getTime()).toBe(new Date(2026, 7, 1).getTime());
    expect(r.periodEnd.getTime()).toBe(new Date(2026, 8, 0, 23, 59, 59).getTime());
  });

  it("description 이 null/undefined 여도 월 창으로 안전 낙하", () => {
    expect(resolveBudgetPeriod({ yearMonth: "2026-02", description: null }).source).toBe("yearMonth");
    expect(resolveBudgetPeriod({ yearMonth: "2026-02" }).source).toBe("yearMonth");
  });

  it("역전 기간(start > end)은 무시하고 월 창으로 낙하 — 깨진 명시가 창을 오염시키지 않는다", () => {
    const r = resolveBudgetPeriod({
      yearMonth: "2026-08",
      description: "period:2026-09-01~2026-08-01",
    });
    expect(r.source).toBe("yearMonth");
  });

  it("월 경계: 12월 창의 말일은 12-31 23:59:59", () => {
    const r = resolveBudgetPeriod({ yearMonth: "2025-12" });
    expect(r.periodEnd.getTime()).toBe(new Date(2025, 12, 0, 23, 59, 59).getTime());
  });
});

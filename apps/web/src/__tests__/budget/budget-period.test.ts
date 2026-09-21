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

// ── §budget-period-axis — 달력 날짜 축 (2026-09-21) ───────────────────
//   대시보드 예산 카드(남은 일수 · 기간 라벨)가 이 값 위에 선다.
describe("resolveBudgetPeriod — endCalendarDate (시간대 왕복 0)", () => {
  it("명시 기간이면 **원문 문자열 그대로** — Date 를 거치지 않는다", () => {
    const r = resolveBudgetPeriod({
      yearMonth: "2026-09",
      description: "[Smoke 검증용 예산 2026-09] | period:2026-09-20~2026-12-30",
    });
    expect(r.endCalendarDate).toBe("2026-12-30");
    // 🛑 이것이 핵심 — yearMonth(9월) 를 믿으면 9.30 이 된다. 실측 결함이 그 형태였다.
    expect(r.endCalendarDate).not.toBe("2026-09-30");
  });

  it("Date 로 왕복하면 하루가 어긋난다 — 그래서 문자열로 다룬다", () => {
    const r = resolveBudgetPeriod({ yearMonth: "2026-09", description: "period:2026-09-01~2026-12-30" });
    // periodEnd 는 **로컬** 23:59:59 로 파싱된다. UTC 서버에서 KST 달력으로 읽으면 12-31 이 된다.
    const viaDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(r.periodEnd);
    // 두 값이 같을 수도(서버 TZ 가 KST 면) 다를 수도 있다 — **어느 쪽이든** 원문이 정답이다.
    expect(r.endCalendarDate).toBe("2026-12-30");
    expect(["2026-12-30", "2026-12-31"]).toContain(viaDate);
  });

  it("월 창이면 그 달의 말일 — 문자열로 조립한다", () => {
    expect(resolveBudgetPeriod({ yearMonth: "2026-02", description: null }).endCalendarDate).toBe("2026-02-28");
    expect(resolveBudgetPeriod({ yearMonth: "2024-02", description: null }).endCalendarDate).toBe("2024-02-29");
    expect(resolveBudgetPeriod({ yearMonth: "2026-09", description: "메모만" }).endCalendarDate).toBe("2026-09-30");
    // 한 자리 월도 0 패딩 — budgetPace 의 파서가 YYYY-MM-DD 만 받는다.
    expect(resolveBudgetPeriod({ yearMonth: "2026-1", description: null }).endCalendarDate).toBe("2026-01-31");
  });

  it("역전 기간은 월 창으로 낙하하고 달력 날짜도 함께 낙하한다", () => {
    const r = resolveBudgetPeriod({ yearMonth: "2026-08", description: "period:2026-09-01~2026-08-01" });
    expect(r.source).toBe("yearMonth");
    expect(r.endCalendarDate).toBe("2026-08-31");
  });
});

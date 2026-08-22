/**
 * §order-budget-reservation P2 — Budget 기간 해석 (⑤ yearMonth 창 결함 교정)
 *
 * 결함(⑤, HANDOFF 2026-08-18): /api/budgets/[id] 의 usage 합산 창이
 * 항상 yearMonth 월 창으로 고정되어, description 에 명시된 실제 기간
 * ("period:YYYY-MM-DD~YYYY-MM-DD")과 다른 창으로 지출을 합산한다 —
 * 표시(기간)와 합산(창)이 서로 다른 truth 를 본다.
 *
 * 이 모듈이 단일 truth: description 명시 기간 우선, 없으면 yearMonth 월 창.
 * 순수 함수 — P3 에서 /api/budgets/[id] 합산 창과 예약 잔액식이 함께 사용한다.
 * 날짜 생성 문법은 기존 라우트 구현을 그대로 승계한다 (동작 드리프트 금지):
 *   월 창: new Date(y, m-1, 1) ~ new Date(y, m, 0, 23:59:59)
 *   명시 창: new Date("YYYY-MM-DD") ~ new Date("YYYY-MM-DDT23:59:59")
 */

export interface BudgetPeriodInput {
  /** Budget.yearMonth — "YYYY-MM" */
  yearMonth: string;
  /** Budget.description — "period:YYYY-MM-DD~YYYY-MM-DD" 를 품을 수 있다 */
  description?: string | null;
}

export interface ResolvedBudgetPeriod {
  periodStart: Date;
  periodEnd: Date;
  /** 어느 truth 를 썼는가 — 합산 창 디버깅 축 */
  source: "description" | "yearMonth";
}

const PERIOD_RE = /period:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/;

/** description 명시 기간 우선, 없거나 비정상이면 yearMonth 월 창 */
export function resolveBudgetPeriod(input: BudgetPeriodInput): ResolvedBudgetPeriod {
  const m = input.description?.match(PERIOD_RE);
  if (m) {
    const start = new Date(m[1]);
    const end = new Date(m[2] + "T23:59:59");
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { periodStart: start, periodEnd: end, source: "description" };
    }
  }
  const [year, month] = input.yearMonth.split("-").map(Number);
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59),
    source: "yearMonth",
  };
}

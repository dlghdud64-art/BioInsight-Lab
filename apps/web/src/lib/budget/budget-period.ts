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
  /**
   * §budget-period-axis — `periodEnd` 의 **달력 날짜** "YYYY-MM-DD".
   *
   * 🛑 `periodEnd` 를 Date 로 받아 시간대 변환하면 **하루가 어긋난다.**
   *   명시 기간은 `new Date("2026-12-30T23:59:59")` = **로컬** 시각으로 파싱된다.
   *   서버가 UTC 면 그 값을 KST 달력으로 다시 읽을 때 12-31 이 된다.
   *   그래서 여기서는 Date 를 거치지 않고 **원문 문자열/숫자로 조립**한다.
   *   대시보드 예산 카드(남은 일수 · 기간 라벨)가 이 값을 쓴다.
   */
  endCalendarDate: string;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

const PERIOD_RE = /period:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/;

/** description 명시 기간 우선, 없거나 비정상이면 yearMonth 월 창 */
export function resolveBudgetPeriod(input: BudgetPeriodInput): ResolvedBudgetPeriod {
  const m = input.description?.match(PERIOD_RE);
  if (m) {
    const start = new Date(m[1]);
    const end = new Date(m[2] + "T23:59:59");
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      // 달력 날짜는 매치된 **원문 그대로** — Date 왕복 0.
      return { periodStart: start, periodEnd: end, source: "description", endCalendarDate: m[2] };
    }
  }
  const [year, month] = input.yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59),
    source: "yearMonth",
    // 월 창일 때도 문자열로 조립한다 — 위와 같은 이유(시간대 왕복 0).
    endCalendarDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

/**
 * §budget-pick-by-period (2026-09-24 prod 실측) · 오늘을 포함하는 예산을 고른다.
 *
 * 🛑 대시보드 폴백이 `yearMonth === 이번 달` 로 예산을 골랐다.
 *   「2026 하반기 실측 예산」 은 yearMonth 가 2026-08 이고 기간은 8.18~12.30 이다.
 *   9월에는 기간 안인데도 대시보드가 「예산 미설정」 을 띄웠다. 예산 관리 화면은 같은 예산을 보여 준다.
 *   yearMonth 는 **만든 달**이지 기간이 아니다. 기간은 resolveBudgetPeriod 하나로 읽는다.
 *   (검증용 예산은 yearMonth 가 2026-09 여서 이 결함을 가리고 있었다.)
 *
 * 규칙: 기간(periodStart~periodEnd)이 now 를 포함하는 것 중 가장 최근 생성분. 입력 순서에 기대지 않는다.
 */
export function pickBudgetCoveringNow<
  T extends BudgetPeriodInput & { createdAt: Date | string },
>(rows: readonly T[], now: Date): T | null {
  const covering = rows.filter((b) => {
    const p = resolveBudgetPeriod(b);
    return p.periodStart <= now && now <= p.periodEnd;
  });
  covering.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return covering[0] ?? null;
}

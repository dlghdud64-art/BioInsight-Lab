/**
 * §11.375 Phase 2 #spend-aggregates — 대시보드 지출 집계 slimming.
 *
 * 기존: purchaseRecord findMany(take 1000, select amount/purchasedAt) 1000행을
 *   서버로 끌어와 JS reduce 로 thisMonth/lastMonth/last7/prev7/6개월 월별 합계를
 *   계산 → cold latency 증폭 + take 1000 초과 계정은 오래된 건 누락(부정확).
 *
 * 변경: 각 범위를 DB SUM aggregate 로 병렬 계산. 1000행 전송 제거, 전체 집계라
 *   누락 없음. 경계는 기존 JS 필터를 1:1 미러(값 동등성 보존):
 *     - thisMonth  : purchasedAt >= monthStart        (&& <= thisMonthEnd: 기존 fetch 상한)
 *     - lastMonth  : >= lastMonthStart && <= lastMonthEnd
 *     - last7      : >= sevenDaysAgo                    (&& <= thisMonthEnd: 기존 fetch 상한)
 *     - prev7      : >= fourteenDaysAgo && <  sevenDaysAgo   ← lt(미포함) 주의
 *     - monthly[i] : >= mStart && <= mEnd (mEnd = 말일 00:00:00, 기존 경계 그대로)
 *
 * ⚠️ 값 동등성: take 1000 미만 계정은 기존과 동일. 1000행 초과 계정은 기존이
 *   누락하던 오래된 건이 합산되어 "더 정확"해진다(회귀 아닌 정확도 개선) — prod 전후 대조.
 */

/** 집계에 필요한 날짜 경계. 순수 계산 → 단위테스트 대상. */
export interface SpendWindows {
  monthStart: Date;
  thisMonthEnd: Date;
  lastMonthStart: Date;
  lastMonthEnd: Date;
  sevenDaysAgo: Date;
  fourteenDaysAgo: Date;
  now: Date;
  months: { label: string; start: Date; end: Date }[];
}

/** now 기준 지출 집계 경계 산출(기존 route.ts 경계와 동일 산식). */
export function buildSpendWindows(now: Date): SpendWindows {
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = new Date(y, m, 1);
  const thisMonthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const lastMonthStart = new Date(y, m - 1, 1);
  const lastMonthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(y, m - i, 1);
    const end = new Date(y, m - i + 1, 0); // 말일 00:00:00 (기존 mEnd 경계 그대로)
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label, start, end });
  }
  return { monthStart, thisMonthEnd, lastMonthStart, lastMonthEnd, sevenDaysAgo, fourteenDaysAgo, now, months };
}

export interface SpendAggregates {
  thisMonthPurchaseAmount: number;
  lastMonthPurchaseAmount: number;
  last7DaysSpending: number;
  prev7DaysSpending: number;
  monthlySpending: { month: string; amount: number }[];
}

/**
 * purchaseRecord SUM aggregate 들을 병렬로 계산. where 는 purchaseOwnerWhere(scope).
 * null _sum 은 0 으로(기존 `(amount||0)` 동등).
 */
export async function fetchSpendAggregates(
  db: any,
  where: any,
  now: Date,
): Promise<SpendAggregates> {
  const w = buildSpendWindows(now);
  const sum = async (purchasedAt: Record<string, Date>): Promise<number> => {
    const r = await db.purchaseRecord.aggregate({
      _sum: { amount: true },
      where: { ...where, purchasedAt },
    });
    return r._sum?.amount ?? 0;
  };

  const [thisMonth, lastMonth, last7, prev7, ...monthly] = await Promise.all([
    sum({ gte: w.monthStart, lte: w.thisMonthEnd }),
    sum({ gte: w.lastMonthStart, lte: w.lastMonthEnd }),
    sum({ gte: w.sevenDaysAgo, lte: w.thisMonthEnd }),
    sum({ gte: w.fourteenDaysAgo, lt: w.sevenDaysAgo }),
    ...w.months.map((mo) => sum({ gte: mo.start, lte: mo.end })),
  ]);

  return {
    thisMonthPurchaseAmount: thisMonth,
    lastMonthPurchaseAmount: lastMonth,
    last7DaysSpending: last7,
    prev7DaysSpending: prev7,
    monthlySpending: w.months.map((mo, i) => ({ month: mo.label, amount: monthly[i] })),
  };
}

/**
 * §billing-redesign P4: 플랜 비교표 행 정의. 값은 전부 PLAN_LIMITS / PLAN_DESCRIPTOR 파생이다.
 *
 * 왜 순수모듈인가: P3 와 같은 이유다(2026-09-09). sentinel 이 페이지를 import 하면
 *   셸 -> next-auth 를 끌고 들어와 게이트가 vite 설정에 인질로 잡힌다.
 *
 * 🛑 시안 숫자를 그대로 옮기지 않는다. 2026-09-10 실측으로 두 곳이 어긋났다:
 *   ① 시안은 재고 품목을 Basic/Pro "무제한" 이라 적었지만 PLAN_LIMITS 는 50 / 200 이다.
 *      그대로 넣으면 화면이 팔지 않는 것을 판다.
 *   ② 시안의 "요청·구매 진행 추적" 행에 대응하는 entitlement 가 없다. Free X / Basic O /
 *      Pro O 패턴을 만족하는 실제 플래그는 `exportPack` 하나뿐이라 그 이름으로 적는다.
 *   두 건 다 호영님 판정 대기 중이며, 뒤집히면 이 파일만 고치면 된다.
 */

import { SubscriptionPlan, PLAN_LIMITS, PLAN_PRICES, formatKrwMonthly } from "@/lib/plans";
import { PLAN_DESCRIPTOR } from "@/lib/billing/plan-descriptor";

/** 비교표에 세우는 3개 플랜. Enterprise 는 문의 경로라 표에 넣지 않는다. */
export const COMPARISON_PLANS = [
  SubscriptionPlan.FREE,
  SubscriptionPlan.TEAM,
  SubscriptionPlan.ORGANIZATION,
] as const;

export type ComparisonPlan = (typeof COMPARISON_PLANS)[number];

const INTENT_BY_PLAN: Record<ComparisonPlan, "starter" | "team" | "business"> = {
  [SubscriptionPlan.FREE]: "starter",
  [SubscriptionPlan.TEAM]: "team",
  [SubscriptionPlan.ORGANIZATION]: "business",
};

export function planLabel(plan: ComparisonPlan): string {
  return PLAN_DESCRIPTOR[INTENT_BY_PLAN[plan]].label;
}

export function planPriceLabel(plan: ComparisonPlan): string {
  const krw = PLAN_PRICES[plan];
  return krw === 0 ? "무료" : formatKrwMonthly(krw);
}

/** 셀 값. `null` = 미제공(화면에서 빈 값 표기), `true` = 제공. */
export type CellValue = string | boolean | null;

export interface ComparisonRow {
  key: string;
  label: string;
  cell: (plan: ComparisonPlan) => CellValue;
}

const countOrUnlimited = (n: number | null, unit: string) =>
  n === null ? "무제한" : `${n}${unit}`;

export const COMPARISON_ROWS: ReadonlyArray<ComparisonRow> = [
  {
    key: "quotes",
    label: "견적 요청",
    cell: (plan) => countOrUnlimited(PLAN_LIMITS[plan].maxQuotesPerMonth, "건/월"),
  },
  {
    key: "seats",
    label: "운영자 시트",
    cell: (plan) => {
      const seats = `${PLAN_LIMITS[plan].maxMembers}명`;
      const extra = PLAN_DESCRIPTOR[INTENT_BY_PLAN[plan]].additionalSeatPriceKrw;
      return extra === null ? seats : `${seats} · 추가 ${formatKrwMonthly(extra)}/명`;
    },
  },
  {
    key: "inventory",
    label: "재고 품목 · 라벨 스캔",
    cell: (plan) => {
      const items = countOrUnlimited(PLAN_LIMITS[plan].maxItems, "품목");
      const scans = countOrUnlimited(PLAN_LIMITS[plan].maxLabelScansPerMonth, "회/월");
      return `${items} · ${scans}`;
    },
  },
  {
    key: "exportPack",
    label: "견적·구매 내보내기",
    cell: (plan) => (PLAN_LIMITS[plan].features.exportPack ? true : null),
  },
  {
    key: "approval",
    label: "구매 전 승인 단계",
    cell: (plan) => (PLAN_LIMITS[plan].features.approvalWorkflow ? "1단계" : null),
  },
];

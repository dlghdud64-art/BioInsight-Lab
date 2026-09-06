/**
 * §plan-change-claim (호영님 2026-09-06, (가) 상태 정직화) —
 * **유료 플랜을 적용하면 "청구할 것이 생겼다" 는 사실도 함께 기록한다.**
 *
 * 배경 — 이 경로가 무엇인가:
 *   `/api/organizations/[id]/subscription` 은 **세금계산서 기반 B2B 신청 경로**다.
 *   `CheckoutDialog` 4단계(확인 → 청구 정보 → 동의 → 완료)에 카드 단계가 애초에 없다.
 *   PG 미호출은 결함이 아니라 **형태**이고, 봉인은 2026-09-05 호영님 판정으로 **철회**됐다
 *   (대안 경로인 Stripe 도 죽어 있어 둘 다 막으면 플랜 변경 경로가 0이 된다).
 *   → `__tests__/regression/checkout-two-paths.test.ts` 가 그 판정을 잠그고 있다.
 *
 * 그런데 어제 정직화한 것은 **말**이지 **상태**가 아니었다. 실측(2026-09-06 prod):
 *   `Organization.plan = TEAM` · `Subscription.plan = TEAM` · `status = "active"`
 *   `Invoice` 0행 · `PaymentMethod` 0행 · 감사 기록 0행
 *   → 화면은 "청구 없음" 이라 말하는데 DB 에는 유료가 `active` 로 적혀 있었다.
 *
 * 🛑 `status: "unpaid"` 만으로는 부족하다(호영님).
 *   "미수다" 라고 말할 뿐 **미수액을 말하지 못한다.** 값과 근거는 같이 간다 —
 *   `lotSource` · `categorySource` · `unitSource` 와 같은 원칙이다.
 *   그래서 이 모듈은 **상태(status) 와 청구서(Invoice) 를 한 번에** 만든다.
 *
 * 🛑 **청구서는 언제나 `DRAFT` 다. `OPEN`(발행됨)을 쓰지 않는다.**
 *   실측 2026-09-06: `taxInvoiceEmail` 을 **읽는 코드가 이 저장소에 없다**(5개 파일 전부
 *   저장·폼·이 모듈뿐). 메일 발송기도 계산서 API(popbill·barobill 등) 배선도 0이다.
 *   → 발행 요건(`businessNumber`·`taxInvoiceEmail`)이 다 채워져 있어도 **아무데도 안 나간다.**
 *   그 상태를 `OPEN` 으로 적으면 "발행됨" 이라는 없는 사실을 canonical 에 쓰는 것이고,
 *   그건 오늘 내내 걷어낸 placeholder success 와 같은 형태다.
 *   발행 **가능 여부**는 별도로 기록해 둔다 — 배선이 생겼을 때 무엇이 막고 있었는지 남긴다.
 *   같은 이유로 **청구서 번호도 붙이지 않는다**(번호는 발행의 표지다).
 *
 * 🔑 그래서 §checkout-two-paths 의 `즉시 적용 (청구 없음)` 문구는 **여전히 참**이다.
 *   사용자에게 발행된 청구서가 없다. 여기서 만드는 것은 "청구할 것이 있다" 는 **내부 기록**이다.
 *   문구를 바꾸지 않는다 — 어제 판정과 충돌하지 않는다.
 *
 * 🛑 `dueDate` 를 지어내지 않는다.
 *   결제 기한이 합의된 적이 없다. `now + 30일` 을 적으면 §checkout-two-paths 에서
 *   지운 "없는 결제일" 이 청구서 쪽으로 자리만 옮기는 것이다.
 */

import {
  PLAN_PRICES,
  SubscriptionPlan,
  getAnnualMonthlyPrice,
} from "@/lib/plans";

/** 구독 상태 문자열 — 스키마가 enum 이 아니라 String 이고 주석이 값 집합을 적어 둔다. */
export const SUBSCRIPTION_STATUS = {
  /** 유효하게 동작 중. FREE 의 기본값이기도 하다(신규 조직이 이 조합으로 생성된다). */
  ACTIVE: "active",
  /** 청구할 것이 있는데 수금되지 않았다. */
  UNPAID: "unpaid",
} as const;

/**
 * 이 경로가 만드는 청구서 상태 — **`DRAFT` 하나뿐이다.**
 *
 * 🛑 `OPEN`(발행됨)을 여기 넣지 말 것. `InvoiceStatus` enum 에는 존재하지만
 *   이 경로는 발행 배선이 없어 그 값을 정직하게 쓸 수 없다. 배선이 생기면
 *   그때 이 상수와 함께 발행 시점을 정의한다(지금 미리 열어 두면 잘못 쓰인다).
 */
export const CLAIM_INVOICE_STATUS = {
  /** 청구할 것이 확정됐으나 아직 발행되지 않았다. */
  DRAFT: "DRAFT",
} as const;

/** 세금계산서 발행에 반드시 필요한 항목. 없으면 발행했다고 말할 수 없다. */
export const ISSUANCE_REQUIRED_FIELDS = [
  "businessNumber",
  "taxInvoiceEmail",
] as const;

export interface ClaimBillingInfo {
  businessNumber?: string | null;
  taxInvoiceEmail?: string | null;
}

export interface IssuanceReadiness {
  /** 세금계산서를 실제로 발행할 수 있는가. */
  issuable: boolean;
  /** 비어 있는 필수 항목. 사람이 읽고 무엇을 채워야 하는지 알 수 있게. */
  missing: string[];
}

/**
 * 발행 가능 여부를 판정한다.
 *
 * 🔑 빈 문자열도 없는 것으로 센다 — 실측에서 `businessNumber` 가 `null` 이 아니라
 *   `""` 였다. `!= null` 로만 보면 "있다" 로 잘못 세고, 그게 곧 발행 가능한 척이다.
 */
export function resolveIssuanceReadiness(
  billingInfo: ClaimBillingInfo | null | undefined,
): IssuanceReadiness {
  const missing: string[] = [];
  for (const field of ISSUANCE_REQUIRED_FIELDS) {
    const raw = billingInfo?.[field];
    if (typeof raw !== "string" || raw.trim() === "") missing.push(field);
  }
  return { issuable: missing.length === 0, missing };
}

/**
 * 이번 기간에 청구할 금액(원).
 *
 * 🛑 화면이 이미 보여준 금액과 **같은 식**을 쓴다(`checkout-utils.calculatePricing`).
 *   청구서가 화면과 다른 수를 적으면 그 자체가 새 거짓이다.
 *   연간(12개월) = 월환산가 × 12 · 그 외 = 월정가 × 개월수.
 */
export function claimAmountKrw(
  plan: SubscriptionPlan,
  periodMonths: number,
): number {
  if (plan === SubscriptionPlan.FREE) return 0;
  if (periodMonths === 12) return getAnnualMonthlyPrice(plan) * 12;
  return PLAN_PRICES[plan] * periodMonths;
}

export interface PlanChangeClaimInvoice {
  status: (typeof CLAIM_INVOICE_STATUS)[keyof typeof CLAIM_INVOICE_STATUS];
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  /** 🛑 항상 null — 결제 기한이 합의된 적이 없다. 지어내지 않는다. */
  dueDate: null;
  /** 🛑 항상 null — 수금된 적이 없다. */
  paidAt: null;
  /** 🛑 항상 null — 번호는 발행의 표지다. 발행 배선이 없으므로 붙이지 않는다. */
  number: null;
  description: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  /** 발행 판정 근거 — 값과 함께 남긴다. */
  issuance: IssuanceReadiness;
}

export interface PlanChangeClaim {
  /** `Subscription.status` 에 쓸 값. */
  subscriptionStatus: string;
  /** 생성할 청구서. 무료 전환이면 null — 청구할 것이 없다. */
  invoice: PlanChangeClaimInvoice | null;
}

/**
 * 플랜 변경 1건이 만들어야 하는 **상태 + 청구** 한 벌.
 *
 * FREE 로 내려가면 청구서를 만들지 않고 상태는 `active` 다 —
 * FREE + active 는 이 시스템의 기본 상태이고(신규 조직 생성이 그 조합이다),
 * `canceled` · `unpaid` 로 적으면 각각 "해지됨" · "미수금 있음" 이라는 다른 거짓이 된다.
 *
 * 🛑 기존 청구서는 건드리지 않는다. 과거에 실제로 발생한 청구 사실이라
 *   다운그레이드했다고 지우면 기록을 지우는 것이다(별건).
 */
export function buildPlanChangeClaim(input: {
  plan: SubscriptionPlan;
  periodMonths: number;
  planLabel: string;
  billingInfo: ClaimBillingInfo | null | undefined;
  periodStart: Date;
  periodEnd: Date;
}): PlanChangeClaim {
  const { plan, periodMonths, planLabel, billingInfo, periodStart, periodEnd } =
    input;

  if (plan === SubscriptionPlan.FREE) {
    return { subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE, invoice: null };
  }

  const amountDue = claimAmountKrw(plan, periodMonths);
  const issuance = resolveIssuanceReadiness(billingInfo);
  const cycle = periodMonths === 12 ? "연간" : `${periodMonths}개월`;

  return {
    subscriptionStatus: SUBSCRIPTION_STATUS.UNPAID,
    invoice: {
      /* 🛑 조건 분기가 없다 — 발행 배선이 없으므로 언제나 초안이다. */
      status: CLAIM_INVOICE_STATUS.DRAFT,
      amountDue,
      amountPaid: 0,
      currency: "KRW",
      periodStart,
      periodEnd,
      dueDate: null,
      paidAt: null,
      number: null,
      description: issuance.issuable
        ? `${planLabel} 플랜 ${cycle} · 미수 · 미발행(발행 배선 없음)`
        : `${planLabel} 플랜 ${cycle} · 미수 · 미발행(발행 정보 미비: ${issuance.missing.join(", ")})`,
      lineItems: [
        {
          description: `${planLabel} 플랜 (${cycle})`,
          quantity: 1,
          unitPrice: amountDue,
          amount: amountDue,
        },
      ],
      issuance,
    },
  };
}

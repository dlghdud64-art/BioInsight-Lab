/**
 * 결제 세션 유틸리티
 *
 * 과금 규칙:
 * - 업그레이드: 즉시 적용, 당일 청구 (비례 배분 없이 전액)
 * - 다운그레이드: 즉시 차감 금지, 다음 갱신일부터 적용
 * - 연간/월간 전환 시 금액/적용일 분리 표시
 * - 좌석 수 변경은 플랜 변경과 별도로 계산 가능하게 설계
 */

import {
  SubscriptionPlan,
  PLAN_DISPLAY,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_ORDER,
  getAnnualMonthlyPrice,
} from "@/lib/plans";

import type {
  CheckoutStep,
  CheckoutEntryValidation,
  CheckoutDenialReason,
  ChangeScenario,
  PlanChangePreview,
  PricingBreakdown,
  BillingInfoData,
} from "./checkout-types";

// ── 기능 라벨 매핑 ────────────────────────────────────
const FEATURE_LABELS: Record<string, string> = {
  exportPack: "견적서 내보내기",
  advancedReports: "고급 리포트",
  budgetManagement: "예산 관리",
  autoReorder: "자동 재발주",
  vendorPortal: "벤더 포탈",
  inboundEmail: "이메일 수신 연동",
  sso: "SSO 인증",
  onPremise: "On-Premise 설치",
  prioritySupport: "우선 지원",
  auditTrail: "감사 추적",
  approvalWorkflow: "승인 워크플로",
  lotManagement: "Lot 관리",
};

// ── 진입 조건 검증 ────────────────────────────────────

export function validateCheckoutEntry(
  currentPlan: SubscriptionPlan,
  targetPlan: SubscriptionPlan,
  userRole: string,
): CheckoutEntryValidation {
  // Owner/Admin만 진입 가능
  if (!["ADMIN", "OWNER"].includes(userRole)) {
    return { canEnter: false, reason: "INSUFFICIENT_ROLE" };
  }
  // 현재 플랜과 동일하면 진입 불가
  if (currentPlan === targetPlan) {
    return { canEnter: false, reason: "SAME_PLAN" };
  }
  return { canEnter: true };
}

// ── 업그레이드/다운그레이드 판별 ──────────────────────

export function isUpgrade(
  current: SubscriptionPlan,
  target: SubscriptionPlan,
): boolean {
  return PLAN_ORDER[target] > PLAN_ORDER[current];
}

// ── 시나리오 분기 (billing-lifecycle.md §2.4) ─────────
/**
 * 현재/대상 플랜 기준으로 Step 1 문구·적용 시점을 확정한다.
 * Stripe 실제 proration 계산은 Phase 2 body (Webhook + Preview API).
 * Phase 1 에서는 "무엇이 일어날지" 를 사용자에게 명확히 알리는 문구만 확정한다.
 */
export function resolveChangeScenario(
  currentPlan: SubscriptionPlan,
  targetPlan: SubscriptionPlan,
): ChangeScenario {
  // 무료 → 유료: 최초 결제. proration 개념 없음.
  if (currentPlan === SubscriptionPlan.FREE && targetPlan !== SubscriptionPlan.FREE) {
    return "free_to_paid";
  }
  // 유료 → 상위: 즉시 적용 + 남은 기간 차액 정산 (Stripe proration).
  if (isUpgrade(currentPlan, targetPlan)) {
    return "upgrade_prorated";
  }
  // 그 외(유료 → 하위 / 유료 → 무료): 현 결제 주기 종료 시 전환.
  return "downgrade_at_period_end";
}

interface ScenarioCopy {
  headline: string;
  detail: string;
  /** UI 상위 컴포넌트용 기존 호환 문구 (effectiveDescription) */
  effectiveDescription: string;
  effectiveDate: "immediate" | "next_billing";
}

function getScenarioCopy(
  scenario: ChangeScenario,
  targetDisplayName: string,
  nextBillingDate: string,
): ScenarioCopy {
  switch (scenario) {
    /* §checkout-two-paths (호영님 재판정 2026-09-05) — **결제를 약속하지 않는다.**
     *
     * 이 다이얼로그가 부르는 것은 `POST /api/organizations/[id]/subscription` 하나이고
     * 거기에 PG 연동이 **0곳**이다. 즉 플랜은 적용되지만 **청구도 갱신도 일어나지 않는다.**
     * 그런데 문구는 "지금 결제하고 바로 사용 · 다음 결제는 …에 자동 갱신됩니다" 라고 말했다 —
     * dead button 보다 무겁다. dead button 은 아무 일도 안 일어나는데, 이건
     * **일어나지 않은 일을 일어났다고** 말한다(돈에 대해서).
     *
     * 🛑 `nextBillingDate` 를 쓰지 않는다. 갱신 주체가 없어 **결제일이라는 것이 존재하지 않는다.**
     *    날짜를 보여주면 그 자체가 새 약속이다.
     * ⏳ 결제가 배선되면 이 문구를 되돌린다 — 그 순서는 `regression/checkout-two-paths.test.ts`
     *    가 지킨다(PG 연동이 생기면 RED 로 알린다). */
    case "free_to_paid":
      return {
        headline: "결제 없이 바로 적용",
        detail: `${targetDisplayName} 플랜이 즉시 활성화됩니다 · 결제 연동 준비 중이라 지금은 청구되지 않습니다.`,
        effectiveDescription: "즉시 적용 (청구 없음)",
        effectiveDate: "immediate",
      };
    case "upgrade_prorated":
      return {
        headline: "결제 없이 즉시 적용",
        detail: `${targetDisplayName} 플랜이 바로 활성화됩니다 · 결제 연동 준비 중이라 차액 정산이나 청구는 발생하지 않습니다.`,
        effectiveDescription: "즉시 적용 (청구 없음)",
        effectiveDate: "immediate",
      };
    case "downgrade_at_period_end":
      return {
        headline: "즉시 적용",
        detail: `${targetDisplayName} 플랜으로 바로 전환됩니다 · 결제 연동 준비 중이라 환불이나 정산은 발생하지 않습니다.`,
        effectiveDescription: "즉시 적용 (정산 없음)",
        effectiveDate: "immediate",
      };
  }
}

// ── 가격 계산 ─────────────────────────────────────────

export function calculatePricing(
  targetPlan: SubscriptionPlan,
  billingCycle: "monthly" | "yearly",
): PricingBreakdown {
  const planPrice = PLAN_PRICES[targetPlan];
  const effectiveMonthlyPrice =
    billingCycle === "yearly"
      ? getAnnualMonthlyPrice(targetPlan)
      : planPrice;

  const recurringAmount =
    billingCycle === "yearly"
      ? effectiveMonthlyPrice * 12
      : effectiveMonthlyPrice;

  // 다음 결제일: 오늘로부터 1개월 후 or 12개월 후
  const next = new Date();
  if (billingCycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  const nextBillingDate = next.toISOString().split("T")[0]!;

  return {
    planPrice,
    pricePerSeat: null, // 현재 좌석제 아님 (플랜 단위 과금)
    effectiveMonthlyPrice,
    amountDueToday: 0, // 실제 결제 연동 시 서버에서 계산
    recurringAmount,
    nextBillingDate,
    effectiveDescription: "",
  };
}

// ── 플랜 변경 프리뷰 빌드 ─────────────────────────────

export function buildPlanChangePreview(
  currentPlan: SubscriptionPlan,
  targetPlan: SubscriptionPlan,
  billingCycle: "monthly" | "yearly",
  currentSeats: number,
): PlanChangePreview {
  const currentDisplay = PLAN_DISPLAY[currentPlan];
  const targetDisplay = PLAN_DISPLAY[targetPlan];

  const currentPrice =
    billingCycle === "yearly"
      ? getAnnualMonthlyPrice(currentPlan)
      : PLAN_PRICES[currentPlan];
  const targetPrice =
    billingCycle === "yearly"
      ? getAnnualMonthlyPrice(targetPlan)
      : PLAN_PRICES[targetPlan];

  const pricing = calculatePricing(targetPlan, billingCycle);

  // 시나리오 분기 (billing-lifecycle.md §2.4)
  const scenario = resolveChangeScenario(currentPlan, targetPlan);
  const copy = getScenarioCopy(
    scenario,
    targetDisplay.displayName,
    pricing.nextBillingDate,
  );

  // 오늘 결제 금액
  // - free_to_paid: 한 주기 전액 (Phase 2 에서 Stripe Checkout 로 대체)
  // - upgrade_prorated: 미정 — Stripe proration 결과에 따라 결정 (표시는 "차액 정산" 문구만)
  // - downgrade_at_period_end: 즉시 결제 없음
  if (scenario === "free_to_paid") {
    pricing.amountDueToday = pricing.recurringAmount;
  } else if (scenario === "upgrade_prorated") {
    // Phase 1: 실제 일할 계산은 Stripe 연동 시 확정. UI 는 "차액" 로만 표기.
    pricing.amountDueToday = 0;
  } else {
    pricing.amountDueToday = 0;
  }
  pricing.effectiveDescription = copy.effectiveDescription;

  // 기능 비교
  const currentFeatures = PLAN_LIMITS[currentPlan].features;
  const targetFeatures = PLAN_LIMITS[targetPlan].features;
  const gained: string[] = [];
  const lost: string[] = [];

  for (const [key, label] of Object.entries(FEATURE_LABELS)) {
    const featureKey = key as keyof typeof currentFeatures;
    if (!currentFeatures[featureKey] && targetFeatures[featureKey]) {
      gained.push(label);
    }
    if (currentFeatures[featureKey] && !targetFeatures[featureKey]) {
      lost.push(label);
    }
  }

  return {
    currentPlanDisplay: currentDisplay.displayName,
    targetPlanDisplay: targetDisplay.displayName,
    currentPrice,
    targetPrice,
    priceDiff: targetPrice - currentPrice,
    pricing,
    effectiveDate: copy.effectiveDate,
    scenario,
    scenarioHeadline: copy.headline,
    scenarioDetail: copy.detail,
    featureChanges: { gained, lost },
    seatChanges: {
      current: PLAN_LIMITS[currentPlan].maxMembers,
      target: PLAN_LIMITS[targetPlan].maxMembers,
    },
  };
}

// ── 가격 포맷 ─────────────────────────────────────────

export function formatPrice(amount: number): string {
  if (amount === 0) return "무료";
  return `₩${amount.toLocaleString("ko-KR")}`;
}

// ── 단계 라벨 ─────────────────────────────────────────

const STEP_LABELS: Record<CheckoutStep, string> = {
  confirm: "변경 확인",
  billing: "청구 정보",
  review: "최종 확인",
  complete: "완료",
};

export function getStepLabel(step: CheckoutStep): string {
  return STEP_LABELS[step];
}

export const CHECKOUT_STEPS: CheckoutStep[] = [
  "confirm",
  "billing",
  "review",
  "complete",
];

// ── 청구 정보 필수 필드 검증 ──────────────────────────

export function validateBillingInfo(
  data: Partial<BillingInfoData>,
): { valid: boolean; missingFields: string[] } {
  const required: { key: keyof BillingInfoData; label: string }[] = [
    { key: "companyName", label: "회사명" },
    { key: "contactName", label: "담당자명" },
    { key: "contactEmail", label: "청구 이메일" },
  ];
  const missingFields = required
    .filter((f) => !data[f.key]?.trim())
    .map((f) => f.label);

  return { valid: missingFields.length === 0, missingFields };
}

// ── 좌석 표시 ─────────────────────────────────────────

export function formatSeatLimit(limit: number | null): string {
  return limit === null ? "무제한" : `${limit}명`;
}

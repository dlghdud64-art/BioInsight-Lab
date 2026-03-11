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
  const upgrade = isUpgrade(currentPlan, targetPlan);

  const currentPrice =
    billingCycle === "yearly"
      ? getAnnualMonthlyPrice(currentPlan)
      : PLAN_PRICES[currentPlan];
  const targetPrice =
    billingCycle === "yearly"
      ? getAnnualMonthlyPrice(targetPlan)
      : PLAN_PRICES[targetPlan];

  const pricing = calculatePricing(targetPlan, billingCycle);

  // 업그레이드: 즉시 적용, 다운그레이드: 다음 갱신일
  pricing.amountDueToday = upgrade ? pricing.recurringAmount : 0;
  pricing.effectiveDescription = upgrade
    ? "즉시 적용됩니다"
    : "현 결제 주기 종료 후 적용됩니다";

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
    effectiveDate: upgrade ? "immediate" : "next_billing",
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

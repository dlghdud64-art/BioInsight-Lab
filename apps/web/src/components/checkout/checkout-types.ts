/**
 * 결제 세션 타입 정의
 *
 * 핵심 원칙:
 * - 화면보다 "누가 / 언제 / 어떤 조건으로 / 얼마를 결제하는가"를 먼저 잠근다
 * - 플랜 선택 화면(plans/page)과 결제 세션 화면(CheckoutDialog) 역할 분리
 */

import type { SubscriptionPlan } from "@/lib/plans";

// ── 결제 세션 상태 ────────────────────────────────────
export type CheckoutStatus =
  | "idle"                // 세션 비활성
  | "reviewing_change"    // Step 1: 변경 내용 확인 중
  | "entering_billing"    // Step 2: 청구 정보 입력 중
  | "confirming"          // Step 3: 최종 확인 중
  | "processing_payment"  // 결제 처리 중 (로딩)
  | "success"             // 완료
  | "failed";             // 실패

export type CheckoutStep = "confirm" | "billing" | "review" | "complete";

// ── 진입 조건 검증 ────────────────────────────────────
export interface CheckoutEntryValidation {
  canEnter: boolean;
  reason?: CheckoutDenialReason;
}

export type CheckoutDenialReason =
  | "INSUFFICIENT_ROLE"    // Owner/Admin 이외
  | "SAME_PLAN"            // 현재 플랜과 동일
  | "ENTERPRISE_PLAN"      // Enterprise는 별도 문의
  | "PENDING_CHANGE";      // 이미 변경 진행 중

// ── 결제 세션 데이터 ──────────────────────────────────
export interface CheckoutSessionData {
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  billingCycle: "monthly" | "yearly";
  isUpgrade: boolean;
  seatCount: number;
}

// ── 과금 규칙 ─────────────────────────────────────────
export interface PricingBreakdown {
  /** 플랜 기본 월 단가 */
  planPrice: number;
  /** 좌석당 가격 (좌석제일 경우, 아니면 null) */
  pricePerSeat: number | null;
  /** 결제 주기별 실제 단가 (연간이면 할인 적용) */
  effectiveMonthlyPrice: number;
  /** 오늘 청구 금액 (업그레이드: 즉시, 다운그레이드: 0) */
  amountDueToday: number;
  /** 다음 정기 결제 금액 */
  recurringAmount: number;
  /** 다음 결제일 (ISO string) */
  nextBillingDate: string;
  /** 적용 시점 설명 */
  effectiveDescription: string;
}

// ── 플랜 변경 프리뷰 ──────────────────────────────────
export interface PlanChangePreview {
  currentPlanDisplay: string;
  targetPlanDisplay: string;
  currentPrice: number;
  targetPrice: number;
  priceDiff: number;                // 양수=인상, 음수=절감
  pricing: PricingBreakdown;
  effectiveDate: "immediate" | "next_billing";
  featureChanges: {
    gained: string[];               // 새로 사용 가능한 기능
    lost: string[];                 // 사용 불가해지는 기능
  };
  seatChanges: {
    current: number | null;         // null = 무제한
    target: number | null;
  };
}

// ── 청구 정보 ─────────────────────────────────────────
export interface BillingInfoData {
  companyName: string;
  businessNumber?: string;
  representativeName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  taxInvoiceEmail?: string;
  notes?: string;
}

// ── 에러 처리 ─────────────────────────────────────────
export type CheckoutErrorCode =
  | "PERMISSION_DENIED"
  | "PAYMENT_FAILED"
  | "NO_PAYMENT_METHOD"
  | "MISSING_BILLING_INFO"
  | "PRICE_CALCULATION_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutErrorCode, string> = {
  PERMISSION_DENIED: "플랜 변경 권한이 없습니다. 조직 관리자에게 문의하세요.",
  PAYMENT_FAILED: "결제 처리에 실패했습니다. 결제 수단을 확인하고 다시 시도해 주세요.",
  NO_PAYMENT_METHOD: "등록된 결제 수단이 없습니다. 결제 수단을 먼저 추가해 주세요.",
  MISSING_BILLING_INFO: "청구 정보가 누락되었습니다. 필수 항목을 모두 입력해 주세요.",
  PRICE_CALCULATION_ERROR: "금액 계산 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  NETWORK_ERROR: "네트워크 연결을 확인해 주세요.",
  UNKNOWN_ERROR: "예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

// ── 완료 후 액션 ──────────────────────────────────────
export interface CheckoutCompletionData {
  newPlan: SubscriptionPlan;
  newPlanDisplay: string;
  nextBillingDate: string;
  recurringAmount: number;
  billingCycle: "monthly" | "yearly";
}

// ── CheckoutDialog Props ──────────────────────────────
export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  isAnnual: boolean;
  currentSeats: number;
  organizationId: string;
  onComplete: () => void;
}

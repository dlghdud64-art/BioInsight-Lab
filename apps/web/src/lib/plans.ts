/**
 * 플랜 마스터 — Single Source of Truth
 *
 * DB enum (Prisma): FREE | TEAM | ORGANIZATION
 * UI 표시:          Starter | Team | Business | Enterprise(별도 문의)
 *
 * 가격 기준 (Single Source of Truth): 퍼블릭 pricing 페이지 (/pricing)
 *   Starter  → 무료
 *   Team     → ₩129,000/월 (연간 10% 할인)
 *   Business → ₩349,000/월 (연간 10% 할인)
 *   Enterprise → 별도 문의
 *
 * ⚠️ 이 파일의 가격은 반드시 /pricing 페이지와 일치해야 한다.
 *    /pricing 페이지는 현재 자체 하드코딩을 쓰지만, Phase 2에서
 *    이 파일의 PLAN_CATALOG를 import하도록 일원화된다(billing-lifecycle.md §5).
 */

// ── DB Enum (Prisma SubscriptionPlan과 동일) ──
export enum SubscriptionPlan {
  FREE = "FREE",
  TEAM = "TEAM",
  ORGANIZATION = "ORGANIZATION",
}

// ── 가격 상수 ──
export const PLAN_PRICES = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.TEAM]: 129_000,
  [SubscriptionPlan.ORGANIZATION]: 349_000,
} as const;

/** 연간 결제 시 할인율 (10%) */
export const ANNUAL_DISCOUNT_RATE = 0.1;

/** 연간 결제 시 월 단가 */
export function getAnnualMonthlyPrice(plan: SubscriptionPlan): number {
  const base = PLAN_PRICES[plan];
  return Math.round(base * (1 - ANNUAL_DISCOUNT_RATE));
}

/** 연간 결제 시 연 합계 */
export function getAnnualTotalPrice(plan: SubscriptionPlan): number {
  return getAnnualMonthlyPrice(plan) * 12;
}

// ── 플랜 표시 정보 ──
export interface PlanDisplayInfo {
  /** DB enum key */
  planKey: SubscriptionPlan;
  /** UI 표시명 (Starter / Team / Business) */
  displayName: string;
  /** 한국어 부제 */
  tagline: string;
  /** 짧은 설명 */
  description: string;
  /** 월간 가격 (원) — 0이면 무료 */
  monthlyPrice: number;
  /** 가격 표시용 문자열 */
  priceDisplay: string;
  /** Recommended 배지 표시 여부 */
  isRecommended: boolean;
}

// §11.304 — 티어명 등급화 (Free / Basic / Pro / Enterprise) 정합.
//   PLAN_DESCRIPTOR (lib/billing/plan-descriptor.ts) 의 canonical label과
//   동기화. FREE→Free, TEAM→Basic, ORGANIZATION→Pro. tagline 도 권장형
//   ("N명 규모에 적합") 으로 정합.
export const PLAN_DISPLAY: Record<SubscriptionPlan, PlanDisplayInfo> = {
  [SubscriptionPlan.FREE]: {
    planKey: SubscriptionPlan.FREE,
    displayName: "Free",
    tagline: "도입 검토 · 1인 사용에 적합",
    description: "도입 검토와 1인 사용을 위한 시작 플랜",
    monthlyPrice: 0,
    priceDisplay: "무료",
    isRecommended: false,
  },
  [SubscriptionPlan.TEAM]: {
    planKey: SubscriptionPlan.TEAM,
    displayName: "Basic",
    tagline: "소규모 운영 · 3명 규모에 적합",
    description: "소규모 운영과 3명 규모 협업에 적합한 플랜",
    monthlyPrice: 129_000,
    priceDisplay: "₩129,000/월",
    isRecommended: false,
  },
  [SubscriptionPlan.ORGANIZATION]: {
    planKey: SubscriptionPlan.ORGANIZATION,
    displayName: "Pro",
    tagline: "다중 운영 · 통제 기능 · 10명 규모에 적합",
    description: "다중 운영과 통제 기능이 필요한 조직용 플랜 (10명 규모)",
    monthlyPrice: 349_000,
    priceDisplay: "₩349,000/월",
    isRecommended: true,
  },
};

/** Enterprise 전용 — DB에 저장되지 않고, UI에서만 표시.
 *  §11.303c — PLAN_DESCRIPTOR.enterprise.features (plan-descriptor.ts) 와
 *    정합. "Business 전체 기능" → "R&D Operations 전체 +" 라벨 통일 +
 *    SSO/SAML/감사 통제 + 전담 온보딩 매니저 + 기관 SLA + 커스텀 AI 분석
 *    (§11.303 AI 등급 spec 정합). 향후 ENTERPRISE_INFO → PLAN_DESCRIPTOR
 *    단일화는 별도 batch (caller audit 후).
 */
export const ENTERPRISE_INFO = {
  displayName: "Enterprise",
  // §11.304 — PLAN_DESCRIPTOR.enterprise.tagline 와 정합 (조직 유형 규정
  //   제거, 계약형 운영 강조).
  tagline: "기관 · 계약형 운영 · 좌석/운영량 협의",
  description: "보안·연동·대규모 운영이 필요한 기관용 플랜",
  priceDisplay: "별도 문의",
  contactEmail: "support@labaxis.co.kr",
  features: [
    // §11.304 — features 선두 라벨 "R&D Operations" → "Pro" 정합.
    "Pro 전체 +",
    "전용 좌석 / 운영량 협의",
    "SSO / SAML / 감사 통제",
    "전담 온보딩 매니저",
    "기관 SLA / 보안 검토 지원",
    "커스텀 AI 분석",
  ],
} as const;

// ── 플랜별 기능 제한 ──
// §11.303b — maxPurchaseOrdersPerMonth field 신규 (Free 5, Basic/Pro/Enterprise null).
//   UI "무제한" 표기와 backend enforce 정합 (현재 enforce throw 0건이라
//   field 정의 + client 전달만으로 정합 보장).
export interface PlanLimits {
  maxMembers: number | null;
  maxQuotesPerMonth: number | null;
  maxPurchaseOrdersPerMonth: number | null;
  maxSharedLinks: number | null;
  maxItems: number | null;
  features: {
    exportPack: boolean;
    advancedReports: boolean;
    budgetManagement: boolean;
    autoReorder: boolean;
    vendorPortal: boolean;
    inboundEmail: boolean;
    sso: boolean;
    onPremise: boolean;
    prioritySupport: boolean;
    auditTrail: boolean;
    approvalWorkflow: boolean;
    lotManagement: boolean;
  };
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE]: {
    maxMembers: 1,        // 개인 전용
    // §11.303b — Free maxQuotesPerMonth 10 → 5 (호영님 spec 정합)
    maxQuotesPerMonth: 5,
    // §11.303b — Free maxPurchaseOrdersPerMonth 5 (신규)
    maxPurchaseOrdersPerMonth: 5,
    maxSharedLinks: 5,
    maxItems: 10,         // 품목 등록 10개
    features: {
      exportPack: false,
      advancedReports: false,
      budgetManagement: false,
      autoReorder: false,
      vendorPortal: false,
      inboundEmail: false,
      sso: false,
      onPremise: false,
      prioritySupport: false,
      auditTrail: false,
      approvalWorkflow: false,
      lotManagement: false,
    },
  },
  [SubscriptionPlan.TEAM]: {
    maxMembers: 5,          // 팀원 5명 — §11.303b-3 grandfather 결정 대기 (3 으로 축소 검토)
    // §11.303b — TEAM(Basic) maxQuotesPerMonth 100 → null (무제한)
    maxQuotesPerMonth: null,
    // §11.303b — TEAM(Basic) maxPurchaseOrdersPerMonth null (신규, 무제한)
    maxPurchaseOrdersPerMonth: null,
    maxSharedLinks: 50,
    maxItems: 50,           // 품목 등록 50개
    features: {
      exportPack: true,
      advancedReports: false,
      budgetManagement: false,
      autoReorder: false,
      vendorPortal: false,
      inboundEmail: false,
      sso: false,
      onPremise: false,
      prioritySupport: false,
      auditTrail: false,
      approvalWorkflow: false,
      lotManagement: false,
    },
  },
  [SubscriptionPlan.ORGANIZATION]: {
    maxMembers: null,         // 무제한 — §11.303b-3 grandfather: 10 으로 축소 검토 (현재 null 유지)
    maxQuotesPerMonth: null,  // 무제한
    // §11.303b — ORGANIZATION(Pro) maxPurchaseOrdersPerMonth null (신규, 무제한)
    maxPurchaseOrdersPerMonth: null,
    maxSharedLinks: null,     // 무제한
    maxItems: null,           // 무제한
    features: {
      exportPack: true,
      advancedReports: true,
      budgetManagement: true,
      autoReorder: true,
      vendorPortal: true,
      inboundEmail: true,
      sso: false,           // SSO는 Enterprise 전용
      onPremise: false,      // On-Premise는 Enterprise 전용
      prioritySupport: false, // Enterprise 전용
      auditTrail: true,
      approvalWorkflow: true,
      lotManagement: true,
    },
  },
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS[SubscriptionPlan.FREE];
}

/** 플랜 우선순위 (업그레이드/다운그레이드 판별) */
export const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.TEAM]: 1,
  [SubscriptionPlan.ORGANIZATION]: 2,
};

/** 플랜 이름으로 DB enum 값 반환 — §11.304 fallback "Starter" → "Free" 정합. */
export function getPlanDisplayName(plan: SubscriptionPlan): string {
  return PLAN_DISPLAY[plan]?.displayName ?? "Free";
}

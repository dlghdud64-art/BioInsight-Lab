/**
 * 플랜 마스터 — Single Source of Truth
 *
 * DB enum (Prisma): FREE | TEAM | ORGANIZATION
 * UI 표시:          Starter | Team | Business | Enterprise(별도 문의)
 *
 * 가격 기준: 퍼블릭 pricing 페이지 (/pricing)
 *   Starter  → 무료
 *   Team     → ₩49,000/월 (연간 10% 할인)
 *   Business → ₩149,000/월 (연간 10% 할인)
 *   Enterprise → 별도 문의
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
  [SubscriptionPlan.TEAM]: 49_000,
  [SubscriptionPlan.ORGANIZATION]: 149_000,
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

export const PLAN_DISPLAY: Record<SubscriptionPlan, PlanDisplayInfo> = {
  [SubscriptionPlan.FREE]: {
    planKey: SubscriptionPlan.FREE,
    displayName: "Starter",
    tagline: "개인 시작",
    description: "개인 연구자와 초기 검토를 위한 시작 플랜",
    monthlyPrice: 0,
    priceDisplay: "무료",
    isRecommended: false,
  },
  [SubscriptionPlan.TEAM]: {
    planKey: SubscriptionPlan.TEAM,
    displayName: "Team",
    tagline: "협업 시작",
    description: "소규모 연구팀 협업을 위한 플랜",
    monthlyPrice: 49_000,
    priceDisplay: "₩49,000/월",
    isRecommended: false,
  },
  [SubscriptionPlan.ORGANIZATION]: {
    planKey: SubscriptionPlan.ORGANIZATION,
    displayName: "Business",
    tagline: "조직 운영 표준",
    description: "승인과 예산 관리가 필요한 조직용 표준 플랜",
    monthlyPrice: 149_000,
    priceDisplay: "₩149,000/월",
    isRecommended: true,
  },
};

/** Enterprise 전용 — DB에 저장되지 않고, UI에서만 표시 */
export const ENTERPRISE_INFO = {
  displayName: "Enterprise",
  tagline: "기관 도입",
  description: "보안·연동·대규모 운영이 필요한 기관용 플랜",
  priceDisplay: "별도 문의",
  contactEmail: "sales@bioinsight.co.kr",
  features: [
    "Business 전체 기능",
    "ERP API 연동",
    "SSO 지원",
    "무제한 데이터 저장",
    "전담 매니저 및 SLA",
    "조직 맞춤 구축 지원",
  ],
} as const;

// ── 플랜별 기능 제한 ──
export interface PlanLimits {
  maxMembers: number | null;
  maxQuotesPerMonth: number | null;
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
    maxQuotesPerMonth: 10,
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
    maxMembers: 5,          // 팀원 5명
    maxQuotesPerMonth: 100,
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
    maxMembers: null,         // 무제한
    maxQuotesPerMonth: null,  // 무제한
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

/** 플랜 이름으로 DB enum 값 반환 */
export function getPlanDisplayName(plan: SubscriptionPlan): string {
  return PLAN_DISPLAY[plan]?.displayName ?? "Starter";
}

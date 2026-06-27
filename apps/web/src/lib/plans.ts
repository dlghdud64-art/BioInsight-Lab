/**
 * 플랜 마스터 — Single Source of Truth
 *
 * DB enum (Prisma): FREE | TEAM | ORGANIZATION
 * UI 표시:          Starter | Team | Business | Enterprise(별도 문의)
 *
 * 가격 기준 (Single Source of Truth): 퍼블릭 pricing 페이지 (/pricing)
 *   Starter  → 무료
 *   Team     → ₩89,000/월 (연간 1개월 무료 = 11개월 금액)
 *   Business → ₩259,000/월 (연간 1개월 무료 = 11개월 금액)
 *   Enterprise → 별도 문의
 *
 * ⚠️ 이 파일의 가격은 반드시 /pricing 페이지와 일치해야 한다.
 *    /pricing 페이지는 현재 자체 하드코딩을 쓰지만, Phase 2에서
 *    이 파일의 PLAN_CATALOG를 import하도록 일원화된다(billing-lifecycle.md §5).
 */

import type { TrackingMode } from "./inventory/tracking-mode";

// ── DB Enum (Prisma SubscriptionPlan과 동일) ──
export enum SubscriptionPlan {
  FREE = "FREE",
  TEAM = "TEAM",
  ORGANIZATION = "ORGANIZATION",
}

// ── 가격 상수 ──
export const PLAN_PRICES = {
  [SubscriptionPlan.FREE]: 0,
  // §pricing-redesign (호영님 2026-06-27) — TEAM 129k→89k · ORG 349k→259k.
  [SubscriptionPlan.TEAM]: 89_000,
  [SubscriptionPlan.ORGANIZATION]: 259_000,
} as const;

// §pricing-redesign (호영님 2026-06-27) — 연간 결제 = 1개월 무료(12개월 결제 시
//   11개월 금액). 이전 연 할인율 상수 폐기.

// §pricing-prelaunch (호영님 2026-06-27) — 연간 월환산 = 명시 절사값(×11/12 파생 폐기).
//   체험 혼동되는 "1개월 무료" 대신 "약 11% 할인". 출시 후 적용(PG 연동 전 표시만).
//   검산: 79k×12=948k vs 89k×12=1,068k → 11.2% / 229k×12=2,748k vs 259k×12=3,108k → 11.6%.
export const PLAN_PRICES_ANNUAL_MONTHLY = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.TEAM]: 79_000,
  [SubscriptionPlan.ORGANIZATION]: 229_000,
} as const;

/** 연간 결제 시 월 환산 단가 — 명시 절사값(SoT). */
export function getAnnualMonthlyPrice(plan: SubscriptionPlan): number {
  return PLAN_PRICES_ANNUAL_MONTHLY[plan];
}

/** 연간 결제 시 연 합계 — 월환산 × 12. */
export function getAnnualTotalPrice(plan: SubscriptionPlan): number {
  return getAnnualMonthlyPrice(plan) * 12;
}

// §pricing-sot-unify-p4 (호영님 2026-06-27) — 월 가격 표시 문자열 = PLAN_PRICES 단일 SoT 파생.
/** 월 가격(KRW) → "₩89,000/월" 표시 문자열. */
export function formatKrwMonthly(krw: number): string {
  return `₩${krw.toLocaleString("ko-KR")}/월`;
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
    // §pricing-sot-unify-p4 — PLAN_PRICES 단일 SoT 파생(수기 중복 제거).
    monthlyPrice: PLAN_PRICES[SubscriptionPlan.TEAM],
    priceDisplay: formatKrwMonthly(PLAN_PRICES[SubscriptionPlan.TEAM]),
    isRecommended: false,
  },
  [SubscriptionPlan.ORGANIZATION]: {
    planKey: SubscriptionPlan.ORGANIZATION,
    displayName: "Pro",
    tagline: "다중 운영 · 통제 기능 · 10명 규모에 적합",
    description: "다중 운영과 통제 기능이 필요한 조직용 플랜 (10명 규모)",
    // §pricing-sot-unify-p4 — PLAN_PRICES 단일 SoT 파생(수기 중복 제거).
    monthlyPrice: PLAN_PRICES[SubscriptionPlan.ORGANIZATION],
    priceDisplay: formatKrwMonthly(PLAN_PRICES[SubscriptionPlan.ORGANIZATION]),
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
// §pricing-redesign (호영님 2026-06-27) — PO 월 한도 field 제거
//   (PO 한도 = pricing/entitlement 범위에서 폐기). 라벨스캔 월 한도 +
//   추적 모드 게이팅 field 신규.
export interface PlanLimits {
  maxMembers: number | null;
  maxQuotesPerMonth: number | null;
  maxSharedLinks: number | null;
  maxItems: number | null;
  /** 라벨 스캔 월 한도 — null = 무제한 (Basic 이상) */
  maxLabelScansPerMonth: number | null;
  /** 허용 재고 추적 모드 — Pro 만 LOT / GMP_STRICT 게이팅 */
  allowedTrackingModes: readonly TrackingMode[];
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
    maxMembers: 1,        // 개인 전용(사용자 1명, 현행 유지)
    // §pricing-refresh(호영님 2026-06-18) — Free RFQ 5 → 3 (조이기). 실제 enforce 는 P2.
    maxQuotesPerMonth: 3,
    maxSharedLinks: 5,
    maxItems: 10,         // 품목 등록 10개(재고, 현행 유지 — 호영님 확정)
    // §pricing-redesign — Free 라벨 스캔 월 10회 / QUANTITY 추적만.
    maxLabelScansPerMonth: 10,
    allowedTrackingModes: ["QUANTITY"],
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
    // §pricing-redesign (호영님 2026-06-27) — Basic 팀원 5→3 (grandfather 없음, 파일럿).
    maxMembers: 3,
    // §11.303b — TEAM(Basic) maxQuotesPerMonth 100 → null (무제한)
    maxQuotesPerMonth: null,
    maxSharedLinks: 50,
    maxItems: 50,           // 품목 등록 50개
    // §pricing-redesign — Basic 라벨 스캔 무제한 / QUANTITY 추적만.
    maxLabelScansPerMonth: null,
    allowedTrackingModes: ["QUANTITY"],
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
    // §pricing-redesign (호영님 2026-06-27) — Pro 팀원 10명, 재고 200 품목 (정직 정합).
    maxMembers: 10,
    maxQuotesPerMonth: null,  // 무제한
    maxSharedLinks: null,     // 무제한
    maxItems: 200,            // 품목 등록 200개 (광고 표기와 일치)
    // §pricing-redesign — Pro 라벨 스캔 무제한 / QUANTITY+LOT+GMP_STRICT 추적.
    maxLabelScansPerMonth: null,
    allowedTrackingModes: ["QUANTITY", "LOT", "GMP_STRICT"],
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

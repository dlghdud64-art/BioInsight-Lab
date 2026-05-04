/**
 * §11.201 #pricing-operating-volume-redefine — Phase 1 GREEN
 *
 * Single source of truth for LabAxis plan display layer.
 * canonical SubscriptionPlan enum (DB) 변경 0 — display-only 매핑.
 *
 * 4 PlanIntent (starter/team/business/enterprise) × 운영자 수 + 운영량 +
 * LabOps Credit + features + CTA route 매핑. pricing 카드 / settings badge /
 * dashboard upgrade surface 모두 본 모듈 통과.
 *
 * §11.142 lock 호환:
 *   - canonical SubscriptionPlan / WorkspacePlan / Stripe price ID 변경 0
 *   - dead checkout button 0 (ctaRoute = 기존 alive 라우트만)
 *   - fake "AI 무제한" / "무제한 워크스페이스" 카피 0
 *   - LabOps Credit 실 차감 0 (display only — §11.202 defer)
 *   - 코어 workflow (검색/요청/승인/PO/입고/재고) 차단 0 — Credit 보호 명시
 */

import type { PlanIntent } from "./plan-select";

/** 운영량 권장치 — pricing 카드 카피의 정량 근거 */
export interface OperatingVolume {
  /** 월 RFQ 권장 건수 — null = 계약 기반 (Enterprise) */
  monthlyRfq: number | null;
  /** 월 PO 권장 건수 — null = 계약 기반 */
  monthlyPo: number | null;
  /** 재고 등록 권장 품목 수 — null = 계약 기반 */
  inventoryItems: number | null;
}

/** Plan 의 display layer descriptor — pricing / settings / dashboard 통합 source */
export interface PlanDescriptor {
  /** PlanIntent enum 값 (4종) */
  intent: PlanIntent;
  /** 한국어 노출 라벨 — Starter / Lab Team / R&D Operations / Enterprise */
  label: string;
  /** 운영 범위 한 줄 요약 (raw enum 키 비노출) */
  tagline: string;
  /** 월 가격 (KRW) — Enterprise 는 null (계약 기반) */
  priceMonthlyKrw: number | null;
  /** 권장 좌석 수 — Enterprise 는 null (무제한 / 계약) */
  seatsRecommended: number | null;
  /** 운영량 권장치 (RFQ / PO / 재고) */
  operatingVolume: OperatingVolume;
  /** 월 LabOps Credit 한도 — null = 계약 기반 */
  labOpsCreditMonthly: number | null;
  /** 핵심 features 배열 (검색/비교/견적/PO/입고/재고 중심) */
  features: string[];
  /** CTA 라우트 — 기존 alive 라우트만 (fake checkout 0) */
  ctaRoute: string;
  /** CTA button 한국어 라벨 */
  ctaLabel: string;
  /** 추천 tag (한국어) — null = 비추천 */
  recommendTag: string | null;
  /**
   * §11.209b Phase 1 — Tier 별 결재 정책 default.
   *
   * Schema 의 ApprovalPolicy enum (§11.209b-pre 통일) 정합:
   *   - "none" — 결재 불필요 (Lab Team 이하)
   *   - "in_app_approval" — LabAxis 내부 결재 (R&D Operations / Enterprise)
   *   - "external_approval" — 외부 ERP/그룹웨어 (§11.209c 후속, 현재
   *     Enterprise 도 in_app_approval default)
   *
   * caller (createPoCandidate 호출 지점) 가 workspace.plan →
   * PlanIntent → descriptor.approvalPolicy 로 default 결정. workspace 에
   * approvalPolicy field 추가는 후속 cluster (§11.209c).
   */
  approvalPolicy: "none" | "in_app_approval" | "external_approval";
}

/**
 * Single source of truth — pricing 카드 / settings badge / dashboard upgrade
 * 모든 surface 가 본 매트릭스 통과.
 *
 * canonical SubscriptionPlan enum (FREE/TEAM/ORGANIZATION) 은 그대로 유지.
 * PlanIntent (starter/team/business/enterprise) 가 display layer 의 4 단계 분리.
 *   - starter → SubscriptionPlan.FREE
 *   - team → SubscriptionPlan.TEAM (Stripe price: TEAM_MONTHLY)
 *   - business → SubscriptionPlan.TEAM (Stripe price: BUSINESS_MONTHLY) — same enum, different SKU
 *   - enterprise → SubscriptionPlan.ORGANIZATION (계약 기반)
 *
 * 운영량 / Credit 수치는 호영님 ChatGPT 분석 + LabAxis 운영 OS 정합 매트릭스.
 * pilot 기간 동안 LabOps Credit 은 display only — 실 차감 §11.202 defer.
 */
export const PLAN_DESCRIPTOR: Record<PlanIntent, PlanDescriptor> = {
  starter: {
    intent: "starter",
    label: "Starter",
    tagline: "1인 연구실 또는 도입 검토 — 14일 전체 운영 흐름 체험",
    priceMonthlyKrw: 0,
    seatsRecommended: 1,
    operatingVolume: {
      monthlyRfq: 5,
      monthlyPo: 5,
      inventoryItems: 50,
    },
    labOpsCreditMonthly: 100,
    features: [
      "운영자 1명 포함",
      "통합 검색 / 카탈로그",
      "견적 요청 (월 5건)",
      "PO 발행 (월 5건)",
      "재고 등록 (50 품목)",
    ],
    ctaRoute: "/dashboard",
    ctaLabel: "무료 파일럿 시작",
    recommendTag: null,
    approvalPolicy: "none",
  },
  team: {
    intent: "team",
    label: "Lab Team",
    // §11.209b Phase 4 — "승인" 단어 제거 (dead promise 차단). Lab Team
    // 은 approvalPolicy='none' → 결재/승인 약속 visible 0 lock 정합.
    // "승인" → "비교" swap (LabAxis canonical workflow 정합 — 검색·견적·
    // 비교·PO·입고·재고).
    tagline: "단일 연구실 운영 — 견적·비교·PO·입고·재고를 한 화면에서",
    priceMonthlyKrw: 129000,
    seatsRecommended: 5,
    operatingVolume: {
      monthlyRfq: 30,
      monthlyPo: 30,
      inventoryItems: 500,
    },
    labOpsCreditMonthly: 1500,
    features: [
      "Starter 전체 +",
      "운영자 5명 포함 (추가 운영자 별도)",
      "견적 요청 (월 30건)",
      "PO 발행 (월 30건)",
      "재고 운영 (500 품목)",
      "운영 브리핑 (AI 인사이트)",
      "활동 로그 / 권한 관리",
    ],
    ctaRoute: "/dashboard/settings/plans?plan=team&intent=checkout",
    ctaLabel: "Lab Team 시작하기",
    recommendTag: "추천: 단일 연구실 운영",
    approvalPolicy: "none",
  },
  business: {
    intent: "business",
    label: "R&D Operations",
    tagline: "다중 연구실 / R&D 센터 — 운영량 확장 + 통제 기능",
    priceMonthlyKrw: 349000,
    seatsRecommended: 15,
    operatingVolume: {
      monthlyRfq: 80,
      monthlyPo: 80,
      inventoryItems: 2000,
    },
    labOpsCreditMonthly: 7500,
    features: [
      "Lab Team 전체 +",
      "운영자 15명 포함 (추가 운영자 별도)",
      "견적 요청 (월 80건)",
      "PO 발행 (월 80건)",
      "재고 운영 (2,000 품목)",
      "다중 부서 / 비용센터 분리",
      "감사 로그 PDF 내보내기",
      "워크플로 템플릿 / 승인자 매트릭스",
    ],
    ctaRoute: "/dashboard/settings/plans?plan=business&intent=checkout",
    ctaLabel: "R&D 운영 플랜 상담",
    recommendTag: "추천: R&D 센터 운영",
    approvalPolicy: "in_app_approval",
  },
  enterprise: {
    intent: "enterprise",
    label: "Enterprise",
    tagline: "기관 / 법인 — 계약 기반 좌석·운영량·Credit",
    priceMonthlyKrw: null,
    seatsRecommended: null,
    operatingVolume: {
      monthlyRfq: null,
      monthlyPo: null,
      inventoryItems: null,
    },
    labOpsCreditMonthly: null,
    features: [
      "R&D Operations 전체 +",
      "전용 좌석 / 운영량 협의",
      "SSO / SAML / 감사 통제",
      "전담 온보딩 매니저",
      "기관 SLA / 보안 검토 지원",
    ],
    ctaRoute: "/support?topic=enterprise",
    ctaLabel: "영업 문의하기",
    recommendTag: null,
    approvalPolicy: "in_app_approval",
  },
};

/**
 * LabOps Credit "사용 작업" — pilot 기간 display only.
 *
 * AI 호출이 동반되는 작업은 Credit 차감 대상 (§11.202 실 차감 wiring 진행 시).
 * pilot 기간 동안 운영자가 "왜 Credit 이 있는가" 를 이해하도록 노출.
 */
export const LABOPS_CREDIT_USAGE_SCENARIOS: readonly string[] = [
  "AI 견적 비교 / rationale 생성",
  "AI 문서 추출 (PDF / 견적서 / 발주서 OCR)",
  "AI 운영 브리핑 narrative",
  "AI 견적 자동 작성 보조",
];

/**
 * LabOps Credit "차단 안 되는 작업" — 코어 workflow 보호 약속.
 *
 * 검색 / 요청 / 승인 / PO / 입고 / 재고 같은 운영 OS 의 본질적 행위는
 * Credit 소진 여부와 무관하게 항상 가용. fake "AI 무제한" 약속이 아니라
 * "코어 workflow 무차단" 약속.
 */
export const LABOPS_CREDIT_PROTECTED_SCENARIOS: readonly string[] = [
  "통합 검색 / 카탈로그 조회",
  "견적 요청 (RFQ) 생성",
  "승인 / 반려 결정",
  "PO 발행 / 공급사 확인",
  "입고 / 검수 / 격리 처리",
  "재고 조회 / 조정 / 이동",
  "활동 로그 / 감사 추적",
];

/* ─────────────────── helper functions (raw enum 노출 0) ─────────────────── */

/** PlanIntent → PlanDescriptor (defensive — 항상 매핑 보장, enum coverage 100%) */
export function getPlanDescriptor(intent: PlanIntent): PlanDescriptor {
  return PLAN_DESCRIPTOR[intent];
}

/** PlanIntent → 한국어 라벨 (settings badge / pricing 카드 / invoice label) */
export function getPlanLabel(intent: PlanIntent): string {
  return PLAN_DESCRIPTOR[intent].label;
}

/** PlanIntent → 월 가격 (KRW) — Enterprise 는 null (계약 기반) */
export function getPlanPriceMonthly(intent: PlanIntent): number | null {
  return PLAN_DESCRIPTOR[intent].priceMonthlyKrw;
}

/** PlanIntent → 월 LabOps Credit 한도 — Enterprise 는 null (계약 기반) */
export function getPlanCreditQuota(intent: PlanIntent): number | null {
  return PLAN_DESCRIPTOR[intent].labOpsCreditMonthly;
}

/**
 * §11.209b Phase 2 — canonical workspace.plan (FREE / TEAM / ENTERPRISE /
 * ORGANIZATION) → PlanIntent 매핑 utility.
 *
 * dashboard/pricing/page.tsx 의 inline 정의를 재사용 가능한 utility 로 추출
 * (single source of truth 정합 — settings/pricing/po-candidates route 모두
 * 본 함수 호출).
 *
 * 옵션 1 정합 — TEAM enum 2 SKU 분리 (Lab Team vs R&D Operations) 미해소,
 * 보수적으로 "team" 매핑. 미래 workspace tier discriminator (subscriptionPriceId
 * 등) 추가 시 본 함수가 분기 가능 (caller wiring 자체는 이미 정상).
 *
 * canonical SubscriptionPlan enum:
 *   - FREE → "starter"
 *   - TEAM → "team" (Lab Team 보수, business 분기 0)
 *   - ENTERPRISE / ORGANIZATION → "enterprise"
 *
 * 대소문자 둔감 + null/undefined/unknown defensive (null 반환).
 */
export function workspacePlanToIntent(
  plan: string | null | undefined,
): PlanIntent | null {
  if (!plan) return null;
  const upper = plan.toUpperCase();
  if (upper === "FREE") return "starter";
  if (upper === "TEAM") return "team";
  if (upper === "ENTERPRISE" || upper === "ORGANIZATION") return "enterprise";
  return null;
}

/**
 * §11.209b Phase 2 — workspace.plan → ApprovalPolicy (POCandidate.approvalPolicy
 * default 결정).
 *
 * 옵션 1 보수적 wiring:
 *   - FREE / TEAM → "none" (Lab Team / Starter)
 *   - ENTERPRISE / ORGANIZATION → "in_app_approval"
 *   - unknown / null → "none" (defensive default)
 *
 * /api/po-candidates POST 의 createPOCandidate 호출 시 caller (route handler)
 * 가 본 함수 통과 → input.approvalPolicy 부재면 fallback 으로 사용.
 *
 * 미래 workspace.subscriptionPriceId / planSku 추가 시 R&D Operations 분기
 * 활성 (PLAN_DESCRIPTOR.business.approvalPolicy = "in_app_approval" 즉시 효과).
 */
export function resolveApprovalPolicyForPlan(
  plan: string | null | undefined,
): "none" | "in_app_approval" | "external_approval" {
  const intent = workspacePlanToIntent(plan);
  if (!intent) return "none";
  return PLAN_DESCRIPTOR[intent].approvalPolicy;
}

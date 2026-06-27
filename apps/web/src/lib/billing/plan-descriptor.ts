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
// §pricing-sot-unify-p4 — 가격 단일 SoT. priceMonthlyKrw 는 PLAN_PRICES 에서 파생(수기 중복 제거).
//   단방향 import (plans.ts 는 descriptor 를 import 하지 않음 → cycle 0).
import { PLAN_PRICES, PLAN_PRICES_ANNUAL_MONTHLY, SubscriptionPlan } from "@/lib/plans";

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
  /** §pricing-prelaunch — 연간 결제 시 월 환산(명시 절사값). Enterprise null. */
  priceAnnualMonthlyKrw: number | null;
  /** 권장 좌석 수 — Enterprise 는 null (무제한 / 계약) */
  seatsRecommended: number | null;
  /** 운영량 권장치 (RFQ / PO / 재고) */
  operatingVolume: OperatingVolume;
  // §11.303b-2 — labOpsCreditMonthly field 제거 (production caller 0 확인 후).
  //   §11.303 Q2 "보존" → §11.303b "caller 제거 후 field 정리" 으로 override.
  //   dashboard/pricing/page.tsx stale 표시 제거 동반.
  /** 핵심 features 배열 (검색/비교/견적/PO/입고/재고 중심) */
  features: string[];
  /** CTA 라우트 — 기존 alive 라우트만 (fake checkout 0) */
  ctaRoute: string;
  /** CTA button 한국어 라벨 */
  ctaLabel: string;
  /** 추천 tag (한국어) — null = 비추천 */
  recommendTag: string | null;
  /**
   * §pricing-copy-cleanup (호영님 2026-06-27) — 체험(trial) 자격. Basic 만 true.
   * ⚠️ 데이터 플래그 전용 — 체험 사용자 노출(예: "30일")은 trial-START 메커니즘(결제 백엔드)
   *    구현 후. 현재 노출 0(메커니즘 부재 → 노출 시 fake claim).
   */
  trialEligible: boolean;
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
    // §11.304 — 티어명 등급화 (Starter → Free). 사용자 유형 규정 제거.
    //   Free < Basic < Pro < Enterprise 글로벌 표준 위계.
    label: "Free",
    // §11.304 — 권장형 (조직 유형 규정 X)
    tagline: "도입 검토 · 1인 사용에 적합",
    // §pricing-sot-unify-p4 — Free 가격 = PLAN_PRICES[FREE] 파생(현 0).
    priceMonthlyKrw: PLAN_PRICES[SubscriptionPlan.FREE],
    priceAnnualMonthlyKrw: PLAN_PRICES_ANNUAL_MONTHLY[SubscriptionPlan.FREE],
    seatsRecommended: 1,
    operatingVolume: {
      // §pricing-redesign P3 (호영님 2026-06-27) — 표기=enforce 정직 정합.
      //   RFQ 5→3(plans.ts FREE maxQuotesPerMonth=3), PO 5→null(PO 한도 폐기=무제한).
      monthlyRfq: 3,
      monthlyPo: null,
      inventoryItems: 10,
    },
    features: [
      "견적 비교 후보 3개 확인",
      "운영자 1명 포함",
      "통합 검색 / 카탈로그",
      // §pricing-copy-cleanup — RFQ 3(enforce 정합). PO/발주 문구 제거(P1 PO 한도 폐기 정합).
      "견적 요청 (월 3건)",
      "재고 등록 (10 품목)",
      // §pricing-redesign P3 — 라벨 스캔 훅(Free 월 10회, P2b enforce 정합).
      "라벨 스캔 (월 10회)",
    ],
    ctaRoute: "/dashboard",
    // §11.304 — CTA 새 티어명 정합. "파일럿" 단어 제거 (사용자 유형 규정).
    ctaLabel: "무료로 시작",
    recommendTag: null,
    trialEligible: false, // Free = 영구 무료, 체험 개념 무관
    approvalPolicy: "none",
  },
  team: {
    intent: "team",
    // §11.304 — 티어명 등급화 (Lab Team → Basic). 사용자 유형 규정 제거.
    label: "Basic",
    // §11.209b Phase 4 — "승인" 단어 제거 (dead promise 차단). Basic 은
    //   approvalPolicy='none' → 결재/승인 약속 visible 0 lock 정합.
    // §11.304 — 권장형 + 인원 구간 정합 (5→3명, 점프 완화).
    tagline: "소규모 운영 · 3명 규모에 적합",
    // §pricing-sot-unify-p4 — Basic 가격 = PLAN_PRICES[TEAM] 파생(현 89,000).
    priceMonthlyKrw: PLAN_PRICES[SubscriptionPlan.TEAM],
    priceAnnualMonthlyKrw: PLAN_PRICES_ANNUAL_MONTHLY[SubscriptionPlan.TEAM],
    // §11.304 — 기본 운영자 5→3 (1→5 점프 완화, 2~3명 소규모 랩 진입 문턱
    //   낮춤). backend includedSeats 필드 변경 = §11.303b 별도 batch.
    seatsRecommended: 3,
    operatingVolume: {
      // §11.303b — Basic 견적/PO 무제한 (UI literal + backend null 동시).
      monthlyRfq: null,
      monthlyPo: null,
      // §pricing-redesign — 표기=enforce(maxItems) 정직 정합. 500→50.
      inventoryItems: 50,
    },
    // §11.303 — AI 기능 등급별 명시 (호영님 Q1=C UI batch).
    //   Quartzy/Benchling 벤치마크 정합: AI 기능 = 플랜 등급별 포함,
    //   사용량 무제한. Credit 모델 제거 후 등급 분기.
    //   건수 제한 = 현재 backend 한도 그대로 (Q3 보존, §11.303b 에서
    //   maxQuotesPerMonth null + UI "무제한" 동시 land 예정).
    // §11.304 — 운영자 3명 + 추가 1명당 ₩35,000/월 (기본 인당 ₩43,000
    //   대비 약간 저렴 → 확장 장려, Quartzy Starter 동등).
    features: [
      "Free 전체 +",
      "요청·구매 진행 추적",
      "운영자 3명 포함 (추가 1명당 ₩35,000/월)",
      // §11.303b — Basic 견적/PO "무제한" (backend null + UI literal 동시)
      "견적 요청 무제한",
      "구매 처리 무제한",
      "재고 운영 (50 품목)",
      "라벨 스캔 무제한",
      "AI 견적 비교 / 문서 추출 / 운영 브리핑",
      "활동 로그 / 권한 관리",
    ],
    ctaRoute: "/dashboard/settings/plans?plan=team&intent=checkout",
    // §11.304 — CTA 새 티어명 정합.
    ctaLabel: "Basic 시작하기",
    // §11.304 — 추천 배지 등급화 (조직 유형 규정 X).
    recommendTag: "가장 많이 선택",
    trialEligible: true, // §pricing-copy-cleanup — 체험은 Basic 한정(메인 전환 타깃)
    approvalPolicy: "none",
  },
  business: {
    intent: "business",
    // §11.304 — 티어명 등급화 (R&D Operations → Pro). 사용자 유형 규정
    //   제거 — R&D 가 아닌 QC/생산/구매팀도 자기 규모만 보고 선택 가능.
    label: "Pro",
    // §11.304 — 권장형 + 인원 구간 정합 (15→10명).
    tagline: "다중 운영 · 통제 기능 · 10명 규모에 적합",
    // §pricing-sot-unify-p4 — Pro 가격 = PLAN_PRICES[ORGANIZATION] 파생(현 259,000).
    priceMonthlyKrw: PLAN_PRICES[SubscriptionPlan.ORGANIZATION],
    priceAnnualMonthlyKrw: PLAN_PRICES_ANNUAL_MONTHLY[SubscriptionPlan.ORGANIZATION],
    // §11.304 — 기본 운영자 15→10 (점프 완화 + Quartzy Pro 동등 인당 단가).
    //   backend includedSeats 변경 = §11.303b 별도.
    seatsRecommended: 10,
    operatingVolume: {
      // §11.303b — Pro 견적/PO 무제한 (UI literal + backend null 동시).
      monthlyRfq: null,
      monthlyPo: null,
      // §pricing-redesign — 표기=enforce(maxItems) 정직 정합. 2,000→200 (fake 무제한 폐기 방향).
      inventoryItems: 200,
    },
    // §11.303 — AI 견적 작성 보조 추가 + CTA "상담" → "시작하기" (셀프
    //   결제 전환율 정합). 건수 보존 (Q3, §11.303b 후속).
    // §11.304 — 운영자 10명 + 추가 1명당 ₩28,000/월 (기본 ₩34,900 대비
    //   저렴, Quartzy Pro $30 < 보다 저렴 → 확장 장려).
    features: [
      "Basic 전체 +",
      "구매 전 승인 1단계",
      "운영자 10명 포함 (추가 1명당 ₩28,000/월)",
      // §11.303b — Pro 견적/PO "무제한" (backend null + UI literal 동시)
      "견적 요청 무제한",
      "구매 처리 무제한",
      "재고 운영 (200 품목)",
      "라벨 스캔 무제한",
      "LOT / GMP 추적",
      "AI 견적 작성 보조",
      "다중 부서 / 비용센터 분리",
      "감사 로그 PDF 내보내기",
      "워크플로 템플릿 / 승인자 매트릭스",
    ],
    ctaRoute: "/dashboard/settings/plans?plan=business&intent=checkout",
    // §11.304 — CTA 새 티어명 정합.
    ctaLabel: "Pro 시작하기",
    // §11.304 — 추천 배지 등급화 (조직 유형 규정 X).
    recommendTag: "성장 단계 추천",
    trialEligible: false, // §pricing-copy-cleanup — Pro 는 체험 없음(고비용 기능, Basic→업그레이드 경로)
    approvalPolicy: "in_app_approval",
  },
  enterprise: {
    intent: "enterprise",
    label: "Enterprise",
    // §11.304 — 권장형 (계약형 운영 명시, 조직 유형 규정 X).
    tagline: "기관 · 계약형 운영 · 좌석/운영량 협의",
    priceMonthlyKrw: null,
    priceAnnualMonthlyKrw: null,
    seatsRecommended: null,
    operatingVolume: {
      monthlyRfq: null,
      monthlyPo: null,
      inventoryItems: null,
    },
    // §11.303 — 커스텀 AI 분석 추가 (Enterprise 전용 AI 등급).
    // §11.304 — features 선두 라벨 "R&D Operations" → "Pro" 정합.
    features: [
      "Pro 전체 +",
      "기관 승인 매트릭스 · 구매 감사 추적",
      "전용 좌석 / 운영량 협의",
      "SSO / SAML / 감사 통제",
      "전담 온보딩 매니저",
      "기관 SLA / 보안 검토 지원",
      "커스텀 AI 분석",
    ],
    ctaRoute: "/support?topic=enterprise",
    ctaLabel: "영업 문의하기",
    recommendTag: null,
    trialEligible: false, // Enterprise = 계약형, 체험 무관
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

// §11.303b-2 — getPlanCreditQuota getter 제거 (labOpsCreditMonthly field 제거 동반)

/**
 * §11.209b Phase 2 + §11.209c Phase 1 — canonical workspace.plan + optional
 * stripePriceId → PlanIntent 매핑 utility.
 *
 * §11.209c 확장: TEAM enum 의 2 SKU 분리 (Lab Team vs R&D Operations) 를
 * stripePriceId env 매칭으로 분기.
 *   - TEAM + stripePriceId === STRIPE_PRICE_ID_BUSINESS_MONTHLY → "business"
 *   - TEAM + (그 외 / null / undefined) → "team" (Lab Team 보수)
 *
 * canonical SubscriptionPlan enum:
 *   - FREE → "starter"
 *   - TEAM → "team" (또는 stripePriceId 매칭 시 "business")
 *   - ENTERPRISE / ORGANIZATION → "enterprise"
 *
 * 대소문자 둔감 + null/undefined/unknown defensive (null 반환).
 * 기존 caller (1-arg) 호환 — stripePriceId optional.
 */
export function workspacePlanToIntent(
  plan: string | null | undefined,
  stripePriceId?: string | null,
): PlanIntent | null {
  if (!plan) return null;
  const upper = plan.toUpperCase();
  if (upper === "FREE") return "starter";
  if (upper === "ENTERPRISE" || upper === "ORGANIZATION") return "enterprise";
  if (upper === "TEAM") {
    // §11.209c — stripePriceId 분기. env 매칭 시 R&D Operations 활성.
    // env 미정의 또는 매칭 실패 시 보수적 "team" (Lab Team) fallback.
    const businessPriceId = process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
    if (
      stripePriceId &&
      businessPriceId &&
      stripePriceId === businessPriceId
    ) {
      return "business";
    }
    return "team";
  }
  return null;
}

/**
 * §11.209b Phase 2 + §11.209c Phase 2 — workspace.plan + optional stripePriceId
 * → ApprovalPolicy (POCandidate.approvalPolicy default 결정).
 *
 * §11.209c 확장: TEAM enum 의 SKU 분리 (Lab Team vs R&D Operations) 를
 * stripePriceId 분기로 활성. workspacePlanToIntent 가 분기 처리 — 본 함수는
 * 단순 wrapper.
 *
 *   - FREE / TEAM (stripePriceId 미매칭) → "none" (Starter / Lab Team)
 *   - TEAM + STRIPE_PRICE_ID_BUSINESS_MONTHLY 매칭 → "in_app_approval"
 *     (R&D Operations Tier 결재 약속 활성)
 *   - ENTERPRISE / ORGANIZATION → "in_app_approval"
 *   - unknown / null → "none" (defensive default)
 *
 * /api/po-candidates POST 의 createPOCandidate fallback / purchases 헤더
 * 카피 분기 등 모든 caller 가 본 함수 통과.
 *
 * 기존 caller (1-arg) 호환 — stripePriceId optional.
 */
export function resolveApprovalPolicyForPlan(
  plan: string | null | undefined,
  stripePriceId?: string | null,
): "none" | "in_app_approval" | "external_approval" {
  const intent = workspacePlanToIntent(plan, stripePriceId);
  if (!intent) return "none";
  return PLAN_DESCRIPTOR[intent].approvalPolicy;
}

/**
 * LabAxis Public Release-Ready QA — cross-page regression + release 판정 + future guard
 *
 * 퍼블릭 전체를 하나의 시스템으로 평가.
 * 페이지 단위 QA가 아니라 cross-page 정합성 + messaging integrity 기준.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * release-ready 이후:
 * - cosmetic/system polish만 허용 (문장 길이/리듬/density)
 * - messaging truth edit 금지 (product definition/CTA taxonomy/claim boundary/tone hierarchy)
 * - 수정은 frozen policy 안에서만. 명시적 재개방 없이는 truth를 바꾸지 않는다.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Release-Ready Checklist (10축) ──

export interface PublicReleaseReadyChecklist {
  /** 랜딩/소개/요금/지원이 같은 제품 정의(연구 구매 운영 OS)를 쓰는가 */
  productDefinitionAligned: boolean;
  /** hero=broad, intro=structured, pricing=scoped, support=calm, faq=expectation 역할 유지 */
  pageRolesAligned: boolean;
  /** AI canonical sentence bank 기반 + forbidden claim 전수 제거 */
  aiMessagingFrozenAndConsistent: boolean;
  /** 비-AI vocabulary가 preferred terms 기준 유지 + discouraged terms 제거 */
  nonAiVocabularyAligned: boolean;
  /** CTA가 explore/evaluate/support/authEntry taxonomy에 맞고 vague CTA 없음 */
  ctaTaxonomyAligned: boolean;
  /** 자동 확정/전송/대신 결정/완전 자동화 계열 claim 전수 차단 */
  claimBoundariesHeld: boolean;
  /** 지원/FAQ/문의가 public truth와 같은 boundary를 유지 */
  supportFaqInquiryAligned: boolean;
  /** sales short answer가 public claim보다 더 큰 약속을 하지 않음 */
  salesDoesNotExceedPublicTruth: boolean;
  /** hero/explainer/pricing/support/faq/cta tone hierarchy 유지 */
  toneHierarchyAligned: boolean;
  /** release-blocking drift 항목 0건 */
  releaseBlockingDriftAbsent: boolean;
}

// ── Release Readiness (binary 판정) ──

export interface PublicReleaseReadiness {
  ready: boolean;
  failedChecks: (keyof PublicReleaseReadyChecklist)[];
}

export function evaluatePublicReleaseReadiness(
  checklist: PublicReleaseReadyChecklist
): PublicReleaseReadiness {
  const failedChecks: (keyof PublicReleaseReadyChecklist)[] = [];
  const keys = Object.keys(checklist) as (keyof PublicReleaseReadyChecklist)[];
  for (const key of keys) {
    if (!checklist[key]) failedChecks.push(key);
  }
  return { ready: failedChecks.length === 0, failedChecks };
}

// ── Cross-Page Regression Matrix ──

export const CROSS_PAGE_REGRESSION_MATRIX = {
  landingToIntro: [
    "제품 정의가 동일한가",
    "hero broad promise와 intro structured explainer가 연결되는가",
    "vocabulary drift 없는가",
  ],
  landingToPricing: [
    "hero broad promise가 pricing scope 설명과 충돌하지 않는가",
    "pricing이 hero보다 더 큰 claim을 하지 않는가",
    "CTA 목적이 다르게 정렬되는가 (explore vs evaluate)",
  ],
  landingToSupport: [
    "랜딩의 promise와 support의 expectation-setting이 같은 truth를 말하는가",
    "support가 더 큰 약속을 하지 않는가",
  ],
  pricingToSupport: [
    "Enterprise 협의 범위가 support/inquiry에서 과장되지 않는가",
    "plan scope와 support guidance가 같은 경계를 유지하는가",
  ],
  faqToSales: [
    "sales short answer가 FAQ/public보다 더 세지 않은가",
    "automation boundary가 동일한가",
  ],
} as const;

// ── Page Role Checklist ──

export const PAGE_ROLE_DEFINITIONS = {
  landingHero: "broad flagship promise — deeptech trust",
  landingIntro: "structured product explanation — capability flow",
  landingOpsSection: "operating layers bridge — queue→review→governance→improvement",
  pricing: "scoped plan clarity — not feature showcase",
  support: "calm reassurance + clear next step",
  faq: "direct expectation setting — capability + boundary",
  inquiry: "serious evaluation tone — current + collaboration scope",
} as const;

// ── CTA Flow Checklist ──

export const CTA_FLOW_REQUIREMENTS = [
  "explore CTA가 랜딩/소개에서 일관 (무료로 시작하기 / 검색 시작)",
  "evaluate CTA가 요금/문의에서 일관 (도입 문의 / Business 도입)",
  "support CTA가 지원/FAQ에서 일관 (지원 문의 / 고객 지원)",
  "authEntry CTA가 로그인/가입 맥락에서 일관",
  "vague CTA (자세히 보기/지금 시작/알아보기) 잔존 없음",
] as const;

// ── Release-Blocking Drift ──

export const RELEASE_BLOCKING_DRIFT = [
  "forbidden automation claim remains",
  "support or sales exceeds public truth",
  "pricing enterprise scope overstates current capability",
  "vague CTA remains on primary surface",
  "page-local product definition drift remains",
  "internal/raw vocabulary leak remains",
  "tone hierarchy collapse (consumer SaaS hype / generic corporate)",
] as const;

// ── Manual QA Pass Order ──

export const MANUAL_QA_PASS_ORDER = [
  "1. 랜딩 hero 읽기 — broad promise + 운영형 톤",
  "2. 랜딩 intro 읽기 — structured capability flow",
  "3. 하단 운영 섹션 읽기 — 4계층 operating layers",
  "4. 요금 페이지 읽기 — plan scope + AI bullet",
  "5. 지원/FAQ/문의 읽기 — expectation setting + boundary",
  "6. sales short answer 읽기 — public truth 이내",
  "7. CTA만 따로 훑기 — taxonomy 일관 + vague 제거",
  "8. forbidden/internal vocabulary 전수 검색",
  "9. 전체를 이어서 읽기 — 하나의 제품처럼 읽히는가",
] as const;

// ── Release-Ready Handoff Note ──

export const RELEASE_READY_HANDOFF = {
  allowedPostRelease: [
    "UI spacing / visual polish",
    "section density 미세 조정",
    "문장 길이/리듬 minor copy rhythm 개선",
    "중복 문장 축약",
  ],
  forbiddenPostRelease: [
    "product definition 변경",
    "CTA taxonomy 변경",
    "AI/non-AI tone hierarchy 변경",
    "claim boundary 변경",
    "새 capability claim 추가",
    "sales/support stronger promise 허용",
    "canonical sentence bank 구조 변경",
  ],
} as const;

/**
 * LabAxis Public Tone System — 제품 언어 + CTA taxonomy + tone hierarchy + freeze
 *
 * 퍼블릭 전체 (랜딩/소개/요금/지원/FAQ/도입문의/세일즈)의
 * 비-AI 카피를 포함한 전체 제품 언어 체계.
 *
 * AI messaging은 public-ai-sentence-bank.ts + public-ai-messaging-freeze.ts가 담당.
 * 이 파일은 비-AI 제품 언어 + 전체 톤 시스템을 담당.
 */

// ── Product Language Glossary ──

export const publicProductLanguageGlossary = {

  productName: "LabAxis" as const,

  productDefinition: [
    "연구 구매 운영 OS",
    "시약·장비 검색, 비교, 견적 요청, 발주, 재고 관리까지 이어지는 플랫폼",
  ],

  /** 퍼블릭 전체에서 우선 사용하는 작업/운영 중심 언어 */
  preferredTerms: [
    "검색", "비교", "견적 요청", "발주", "입고", "재고",
    "관리", "운영", "도입", "협업", "검토", "반영", "점검",
  ],

  /** 지양하는 buzzword/hype 언어 */
  discouragedTerms: [
    "조달", "혁신", "차세대", "마법 같은", "원스톱", "스마트",
    "초지능", "디지털 전환", "디지털 트랜스포메이션",
  ],

} as const;

// ── Product Definition Canonical Sentences (비-AI) ──

export const productDefinitionSentences = [
  "LabAxis는 시약·장비 검색, 비교, 견적 요청, 발주, 재고 관리까지 이어지는 연구 구매 운영 OS입니다.",
  "연구팀의 구매 검토와 운영 흐름을 한 화면에서 더 일관되게 연결합니다.",
  "검색에서 끝나지 않고 비교, 요청, 운영 판단까지 이어지는 작업 구조를 제공합니다.",
] as const;

// ── CTA Taxonomy ──

export const ctaTaxonomy = {
  /** 탐색 — 제품 경험 시작 */
  explore: [
    "무료로 시작하기",
    "시약·장비 검색 시작하기",
    "제품 둘러보기",
  ],
  /** 도입 평가 — 조직 도입 검토 */
  evaluate: [
    "도입 문의하기",
    "요금 및 도입 상담하기",
    "Business 도입하기",
    "Team으로 시작하기",
  ],
  /** 지원 — 기존 사용자 도움 */
  support: [
    "지원 문의하기",
    "고객 지원 보기",
  ],
  /** 인증 진입 — 로그인/가입 */
  authEntry: [
    "무료로 시작하기",
    "로그인",
  ],
} as const;

// ── Header/Navigation Labels ──

export const headerLabels = {
  loggedOut: ["서비스 소개", "요금 & 도입", "검색", "로그인", "무료로 시작하기"],
  loggedIn: ["서비스 소개", "요금 & 도입", "검색", "대시보드", "계정 메뉴"],
} as const;

// ── Tone System ──

export const publicToneSystem = {
  /** 브랜드 인상 강하지만 과장 없음 */
  hero: "flagship_deeptech",
  /** 기능 설명보다 작업 구조 설명 */
  explainer: "structured_operational",
  /** 범위와 차이 명확 */
  pricing: "clear_scope",
  /** 차분하고 확실한 지원 */
  support: "calm_reassuring",
  /** 오해 줄이는 문장 */
  faq: "direct_expectation_setting",
  /** 모호하지 않은 행동 유도 */
  cta: "explicit_action",
} as const;

// ── Page Role Summary ──

export const pageRoleSummary = {
  landingHero: "flagship trust + broad product promise",
  landingIntro: "structured product explanation",
  landingOpsSection: "operating layers bridge (queue→review→governance→improvement)",
  pricing: "plan scope clarity (not feature showcase)",
  intro: "product structure + workflow explanation",
  support: "reassurance + clear next step",
  faq: "expectation setting (capability + boundary)",
  inquiry: "serious evaluation tone (current + collaboration scope)",
  sales: "short consistent answer, never stronger than public",
} as const;

// ── Public Tone Freeze Policy ──

export const publicToneFreezePolicy = {
  /** 다시 열지 않는 제품 정의 */
  frozenProductDefinition: [
    "연구 구매 운영 OS",
    "검색, 비교, 요청, 운영 연결",
  ],

  /** 다시 열지 않는 preferred vocabulary */
  frozenPreferredVocabulary: [
    "검색", "비교", "견적 요청", "발주", "입고", "재고",
    "관리", "운영", "도입", "협업",
  ],

  /** 다시 열지 않는 CTA 분류 체계 */
  frozenCtaTaxonomy: ["explore", "evaluate", "support", "authEntry"],

  /** 다시 열지 않는 톤 계층 */
  frozenToneHierarchy: [
    "hero=flagship_deeptech",
    "explainer=structured_operational",
    "pricing=clear_scope",
    "support=calm_reassuring",
    "faq=direct_expectation_setting",
    "cta=explicit_action",
  ],

  /** 수정 가능한 영역 (meaning-preserving only) */
  editableAreas: [
    "문장 길이 조정",
    "section 리듬 조정",
    "중복 문장 축약",
    "density 미세 조정",
  ],

  /** 절대 금지되는 drift */
  forbiddenDrift: [
    "consumer SaaS hype",
    "generic corporate jargon",
    "vague CTA (자세히 보기/지금 시작/알아보기)",
    "page-local vocabulary inconsistency",
    "서비스/솔루션/툴 혼용",
  ],
} as const;

// ── Discouraged Term → Preferred Replacement Map ──

export const termReplacementMap: Record<string, string> = {
  "조달": "구매 운영",
  "혁신": "(제거 또는 구체 문장으로 치환)",
  "차세대": "(제거)",
  "원스톱": "하나의 운영 흐름으로",
  "스마트": "(구체적 작업 언어로 치환)",
  "솔루션": "플랫폼",
  "서비스": "플랫폼 또는 제품명(LabAxis)",
};

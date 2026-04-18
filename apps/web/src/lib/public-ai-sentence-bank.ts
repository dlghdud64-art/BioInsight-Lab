/**
 * LabAxis Public AI Canonical Sentence Bank
 *
 * Single source of messaging truth for all customer-facing AI copy.
 * 랜딩 / 소개 / 요금 / FAQ / 지원 / 세일즈가 모두 이 bank를 참조.
 *
 * 규칙:
 * 1. page-local에서 새 capability sentence를 임의로 만들지 않음.
 * 2. 같은 뜻의 문장 변형 축적 금지 — bucket당 1~3개로 압축.
 * 3. 자동 확정/전송/대신 결정/완전 자동화 표현 절대 포함 금지.
 * 4. internal raw term (contextHash/noop/inflight/baseline) 포함 금지.
 * 5. 운영형 B2B 톤 유지 — flashy AI hype 금지.
 */

// ── Sentence Bank ──

export const canonicalAiSentenceBank = {

  /** hero + support intro용. 가장 넓고 짧은 가치 문장. */
  broadPromise: [
    "AI가 검색, 비교, 요청 준비의 다음 검토 단계를 정리합니다.",
    "팀은 필요한 항목만 더 빠르게 검토하고 적용할 수 있습니다.",
  ],

  /** intro + support + pricing description용. 구체 capability. */
  capability: [
    "검색 결과를 정리하고 비교가 필요한 후보를 제안합니다.",
    "반영할 항목과 다음 검토 대상을 먼저 정리합니다.",
  ],

  /** request_draft public 번역. 요청 준비 특화. */
  requestPreparation: [
    "공급사 요청서에 반영할 메시지와 문의 항목을 준비합니다.",
    "요청 메시지 초안과 검토가 필요한 항목을 정리합니다.",
    "누락된 문의 항목을 빠르게 점검할 수 있습니다.",
  ],

  /** 모든 surface에서 사용. 사람 검토 경계. 가장 중요. */
  operatorReviewBoundary: [
    "운영자가 검토 후 적용하거나 수정할 수 있습니다.",
    "LabAxis는 운영자의 판단을 대체하지 않고 검토를 더 빠르게 돕습니다.",
  ],

  /** FAQ + sales에서 주로 사용. 무엇을 자동으로 하지 않는지 명시. */
  automationBoundary: [
    "현재는 자동 확정이나 자동 전송을 대신 수행하지 않습니다.",
    "AI는 준비와 제안 단계에 집중하고, 실행은 운영자 검토를 전제로 합니다.",
  ],

  /** pricing Enterprise + inquiry + sales용. 현재 기능 vs 협의 범위 분리. */
  enterpriseScope: [
    "Enterprise에서는 조직 기준에 맞는 확장형 자동화와 워크플로 설계를 별도로 협의할 수 있습니다.",
    "현재 제공 기능과 별도 설계 범위를 구분해 안내합니다.",
  ],

  /** CTA 주변. 가장 보수적. 자동 실행 오해 금지. */
  ctaSupport: [
    "검토 후 다음 단계로 바로 이어갈 수 있습니다.",
    "직접 적용하거나 수정할 수 있습니다.",
  ],

  /** FAQ short answer용. canonical bucket 조합. */
  faqShortAnswers: [
    "LabAxis의 AI는 검색 결과 정리, 비교 후보 제안, 요청 준비를 지원합니다.",
    "운영자가 검토 후 적용하거나 수정할 수 있습니다.",
    "현재는 자동 확정이나 자동 전송을 대신 수행하지 않습니다.",
  ],

  /** Sales enablement short answer. canonical bucket 축약. */
  salesShortAnswers: [
    "AI는 검색 정리, 비교 제안, 요청 초안 준비를 지원합니다.",
    "최종 적용은 운영자 검토를 전제로 합니다.",
    "Enterprise에서는 확장형 자동화와 워크플로 설계를 협의할 수 있습니다.",
  ],

} as const;

// ── Usage Map: 페이지별 허용 bucket ──

export type AiSentenceBucket = keyof typeof canonicalAiSentenceBank;

export const aiSentenceUsageMap: Record<string, AiSentenceBucket[]> = {
  landingHero: ["broadPromise", "operatorReviewBoundary"],
  landingIntro: ["capability", "requestPreparation", "operatorReviewBoundary"],
  landingOpsConsole: ["capability", "requestPreparation", "operatorReviewBoundary"],
  pricing: ["capability", "requestPreparation", "enterpriseScope"],
  faq: ["capability", "operatorReviewBoundary", "automationBoundary", "enterpriseScope"],
  supportInquiry: ["capability", "operatorReviewBoundary", "enterpriseScope"],
  sales: ["broadPromise", "capability", "operatorReviewBoundary", "automationBoundary", "enterpriseScope"],
  ctaSupport: ["ctaSupport"],
};

// ── Forbidden Claims (sentence bank에 절대 포함 금지) ──

export const FORBIDDEN_AI_CLAIMS = [
  "자동 확정",
  "자동 전송",
  "AI가 대신 결정",
  "완전 자동화",
  "무인 운영",
  "사람 없이 처리",
  "검토 없이 진행",
  "도입 즉시 자동 처리",
  "엔드투엔드 자동 처리",
] as const;

// ── Internal Vocabulary Blocklist (customer-facing copy에 포함 금지) ──

export const INTERNAL_VOCABULARY_BLOCKLIST = [
  "contextHash",
  "draftFingerprint",
  "requestId",
  "inflight",
  "noop",
  "resolved",
  "byContextKey",
  "generationBaseline",
  "resolutionLog",
  "representative",
  "baseline",
  "request_draft",
  "patch",
] as const;

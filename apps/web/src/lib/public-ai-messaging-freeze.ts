/**
 * LabAxis Public AI Messaging Freeze — Step 6 완료 판정 + Future Polish Boundary
 *
 * Step 6 = 퍼블릭/지원/세일즈 AI 메시지 system stabilization.
 * 이후 세부 polish는 meaning-preserving edit만 허용.
 * capability truth / claim boundary / canonical sentence structure는 freeze.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * Step 6 이후 AI messaging truth는 freeze한다.
 * 이후 변경은 meaning-preserving polish만 허용한다.
 * capability ladder와 boundary claims는 명시적 재개방 없이는 수정하지 않는다.
 * sales/support/public 중 어느 채널도 단독 예외를 만들지 않는다.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Step 6 Completion Checklist (10축) ──

export interface Step6AiMessagingCompletionChecklist {
  /** 랜딩/소개/요금/FAQ/지원/세일즈가 같은 AI truth를 말하는가 */
  publicTruthAligned: boolean;
  /** search → compare → request preparation → operator review ladder 고정 */
  capabilityLadderLocked: boolean;
  /** canonical sentence bank가 single source로 유지 */
  canonicalSentenceBankLocked: boolean;
  /** 자동 확정/전송/대신 결정/완전 자동화 등 forbidden claim 전수 제거 */
  forbiddenClaimsCleared: boolean;
  /** contextHash/noop/inflight 등 internal vocabulary 제거 */
  internalVocabularyCleared: boolean;
  /** hero=broad, intro=structured, pricing=scoped, FAQ=expectation-setting */
  densityAlignedAcrossChannels: boolean;
  /** FAQ가 capability + review boundary + automation boundary 구조 유지 */
  faqBoundaryAligned: boolean;
  /** sales가 public보다 더 큰 약속을 하지 않음 */
  salesBoundaryAligned: boolean;
  /** Enterprise: current capability vs 협의 scope 분리 */
  enterpriseScopeSeparated: boolean;
  /** CTA support가 review/apply 문법만 사용 */
  ctaSupportConservative: boolean;
}

// ── Step 6 Readiness (binary 판정) ──

export interface Step6AiMessagingReadiness {
  done: boolean;
  failedChecks: (keyof Step6AiMessagingCompletionChecklist)[];
}

export function evaluateStep6Readiness(
  checklist: Step6AiMessagingCompletionChecklist
): Step6AiMessagingReadiness {
  const failedChecks: (keyof Step6AiMessagingCompletionChecklist)[] = [];
  const keys = Object.keys(checklist) as (keyof Step6AiMessagingCompletionChecklist)[];
  for (const key of keys) {
    if (!checklist[key]) failedChecks.push(key);
  }
  return { done: failedChecks.length === 0, failedChecks };
}

// ── Messaging Freeze Policy ──

export const AI_MESSAGING_FREEZE_POLICY = {
  /** 다시 열지 않는 핵심 truth */
  frozenCoreTruth: [
    "AI는 preparation layer이다",
    "AI는 검색, 비교, 요청 준비의 다음 검토 단계를 정리한다",
    "운영자가 검토 후 적용하거나 수정한다",
  ],

  /** 다시 열지 않는 경계 */
  frozenBoundaries: [
    "자동 확정 금지",
    "자동 전송 금지",
    "AI가 대신 결정 금지",
    "Enterprise도 현재 기능과 협의 범위를 분리한다",
  ],

  /** 수정 가능한 영역 (meaning-preserving only) */
  editableSurfaces: [
    "문장 길이 조정",
    "headline/support line 리듬 조정",
    "section 내 배치 조정",
    "중복 문장 축약",
    "density 미세 조정",
  ],

  /** 절대 금지되는 수정 */
  forbiddenEdits: [
    "새 capability claim 추가",
    "automation implication 강화",
    "page-local 예외 문장 생성",
    "sales/support stronger promise 허용",
    "canonical sentence bank 구조 변경",
    "Enterprise scope 과장",
  ],
} as const;

// ── Canonical Sentence Bank Freeze Rules ──

export const CANONICAL_SENTENCE_BANK_FREEZE = {
  /** bucket 구조 frozen — 새 bucket 추가 금지 */
  structureFrozen: true,
  /** 기존 bucket의 의미 변경 금지 */
  meaningFrozen: true,
  /** wording polish 허용 (길이 축약, 리듬 정리) */
  wordingPolishAllowed: true,
  /** 새 capability sentence 추가 금지 */
  claimExpansionForbidden: true,
} as const;

// ── Future Polish Safe-Edit Checklist ──

export const FUTURE_POLISH_SAFE_EDIT_CHECKLIST = [
  "이 수정이 새 capability claim을 만들지 않는가?",
  "operator review boundary를 약화시키지 않는가?",
  "automation boundary를 흐리지 않는가?",
  "canonical sentence bank 밖 새 문장을 추가하지 않는가?",
  "sales/support/public 중 한 채널만 더 세게 만들지 않는가?",
  "Enterprise scope를 즉시 제공 자동화처럼 바꾸지 않는가?",
  "CTA support에 실행형 뉘앙스를 넣지 않는가?",
] as const;

// ── Channel Role Summary (freeze) ──

export const CHANNEL_ROLE_SUMMARY = {
  landingHero: "broad promise",
  landingIntro: "structured capability flow",
  landingOpsSection: "operating layers bridge",
  pricing: "scoped capability by plan",
  faqSupport: "expectation setting",
  sales: "short consistent answer, never stronger than public",
  ctaSupport: "minimal, review/apply grammar only",
} as const;

// ── Channel Consistency Guard ──

export interface AiMessagingConsistencyGuard {
  publicMatchesCanonical: boolean;
  supportMatchesCanonical: boolean;
  salesMatchesCanonical: boolean;
  noChannelExceedsPublicTruth: boolean;
}

// ── Frozen Forbidden Claims (재명시) ──

export const FROZEN_FORBIDDEN_CLAIMS = [
  "자동 선택",
  "자동 확정",
  "자동 전송",
  "AI가 대신 결정",
  "완전 자동화",
  "무인 운영",
  "검토 없이 진행",
  "사람 없이 처리",
  "엔드투엔드 자동 처리",
] as const;

// ── Frozen Internal Vocabulary (재명시) ──

export const FROZEN_INTERNAL_VOCABULARY = [
  "request_draft",
  "baseline",
  "contextHash",
  "draftFingerprint",
  "noop",
  "inflight",
  "resolution",
  "representative",
  "patch",
] as const;

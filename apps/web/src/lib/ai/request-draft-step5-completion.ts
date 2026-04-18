/**
 * Request Draft Step 5 Completion — 완료 판정 + Step 6 Handoff 기준
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * Step 5 = request_draft supplier-local subflow stabilization
 * Step 6 = 랜딩/소개/요금 퍼블릭 AI 카피 alignment
 *
 * Step 5 완료 전 Step 6 진입 금지.
 * Step 6에서 request_draft store/selector/orchestration 구조 재개방 금지.
 * Step 6은 copy-level wording alignment만 수행.
 * 구조 변경은 regression fix 또는 명시적 재개방이 있을 때만 허용.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Step 5 Completion Checklist (8축) ──

export interface RequestDraftStep5CompletionChecklist {
  /** current context → representative → active suggestion 체인 고정 */
  selectorTruthLocked: boolean;

  /** accepted/dismissed/edited/noop + baseline 정합성 확보 */
  lifecycleBaselineAligned: boolean;

  /** meaningful change / quiet period / cooldown / visible suppress 작동 */
  generationGateLocked: boolean;

  /** inflight dedupe / stale discard / request identity guard 작동 */
  asyncRaceGuarded: boolean;

  /** A/B supplier round-trip 오염 없음 */
  supplierIsolationLocked: boolean;

  /** UI가 unified surface model만 소비 */
  surfaceModelUnified: boolean;

  /** UI에 raw/internal key 노출 없음 */
  internalVocabularyHidden: boolean;

  /** util/selector/orchestration/async/surface 최소 세트 통과 */
  regressionTestsPassing: boolean;
}

// ── Step 5 Readiness (binary 판정) ──

export interface RequestDraftStep5Readiness {
  done: boolean;
  failedChecks: (keyof RequestDraftStep5CompletionChecklist)[];
}

export function evaluateStep5Readiness(
  checklist: RequestDraftStep5CompletionChecklist
): RequestDraftStep5Readiness {
  const failedChecks: (keyof RequestDraftStep5CompletionChecklist)[] = [];

  const keys = Object.keys(checklist) as (keyof RequestDraftStep5CompletionChecklist)[];
  for (const key of keys) {
    if (!checklist[key]) failedChecks.push(key);
  }

  return { done: failedChecks.length === 0, failedChecks };
}

// ── Manual Implementation Pass Checklist ──

export const MANUAL_PASS_CHECKLIST = [
  "supplier A visible → B hidden → A visible round-trip 정상",
  "dismissed 후 복귀 시 suggestion 재등장 없음",
  "accepted 후 edited echo만 유지, old suggestion 부활 없음",
  "conflict 상태에서 suggestion suppress",
  "sent / ready_to_send 근접에서 redundant suggestion suppress",
  "suggestion 없음 상태에서 empty AI copy 없이 workbench 자연스러움",
  "preview/actionability/review가 같은 suggestion 기준으로 정렬",
  "internal raw key/debug 용어 UI 미노출 (contextHash/noop/inflight/fingerprint)",
] as const;

// ── Step 6 Handoff ──

/**
 * Step 6 퍼블릭 카피가 참조할 수 있는 구현 수준 요약.
 * 이 summary가 퍼블릭 AI 카피의 상한선.
 */
export const STEP6_CAPABILITY_SUMMARY = {
  what_ai_can_do: [
    "공급사 요청서에 반영할 항목을 제안할 수 있음",
    "요청 메시지 초안 보강을 제안할 수 있음",
    "납기 문의 / 대체품 문의 포함을 제안할 수 있음",
    "첨부 / 대상 품목 조정을 제안할 수 있음",
    "운영자가 검토 후 적용/수정/보류할 수 있음",
  ],
  what_ai_cannot_do: [
    "요청서를 자동 확정할 수 없음",
    "요청을 자동 전송할 수 없음",
    "공급사를 자동 선택할 수 없음",
    "운영자 승인 없이 draft를 변경할 수 없음",
  ],
  ai_identity: "current supplier draft context 기준의 preparation layer",
} as const;

/**
 * Step 6 퍼블릭 카피에서 허용되는 표현.
 * 운영형 B2B 톤 유지. 소비자형 flashy 카피 금지.
 */
export const STEP6_ALLOWED_CLAIMS = [
  "공급사 요청서에 반영할 항목을 제안합니다",
  "요청 메시지 초안과 문의 항목을 준비합니다",
  "운영자가 검토 후 적용하거나 수정할 수 있습니다",
  "납기/대체품/첨부 항목을 빠르게 정리할 수 있습니다",
  "다음 단계 검토를 더 빠르게 돕습니다",
  "누락 항목을 점검합니다",
] as const;

/**
 * Step 6 퍼블릭 카피에서 금지되는 표현.
 * request_draft는 preparation layer. 자동화/결정 표현 금지.
 */
export const STEP6_FORBIDDEN_CLAIMS = [
  "AI가 요청서를 자동 완성합니다",
  "AI가 최적 공급사를 대신 결정합니다",
  "요청서를 자동 전송합니다",
  "검토 없이 바로 발송할 수 있습니다",
  "AI가 견적 요청을 끝까지 처리합니다",
  "완전 자동화된 공급사 커뮤니케이션",
  "AI가 대신 결정합니다",
  "자동 선택",
  "자동 확정",
  "자동 전송",
] as const;

/**
 * Step 6 진입 precondition.
 */
export const STEP6_PRECONDITIONS = [
  "Step 5 checklist 8축 모두 true",
  "manual implementation pass 완료",
  "regression test suite 통과",
  "request_draft 관련 known blocker 없음",
  "퍼블릭 카피가 internal vocabulary를 참조하지 않음",
] as const;

/**
 * Step 6 scope freeze.
 * Step 6에서는 request_draft store/selector/orchestration 구조를 다시 열지 않는다.
 * copy-level wording alignment만 수행.
 * 구조 변경은 regression fix 또는 명시적 재개방이 있을 때만 허용.
 */
export const STEP6_SCOPE_FREEZE = {
  frozen: [
    "request_draft selector chain",
    "request_draft orchestration helpers",
    "request_draft candidate store",
    "request_draft generation eligibility",
    "request_draft lifecycle/baseline",
    "request_draft surface model",
  ],
  allowed_in_step6: [
    "퍼블릭 AI 카피 wording alignment",
    "UI label 미세 조정 (internal vocab 제거)",
    "regression fix (구조 변경 아닌 버그 수정)",
  ],
} as const;

// ── Internal vocabulary — UI에 절대 노출 금지 ──

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
  "latestResolvedSource",
  "representative",
  "baseline",
] as const;

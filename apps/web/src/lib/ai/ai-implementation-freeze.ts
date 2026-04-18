/**
 * AI Implementation Freeze — 3-stage operating layer freeze + messaging gate + roadmap boundary
 *
 * sourcing / compare / request 3-stage operating layer가 통합 완료된 상태를 전제로,
 * 현재 구현 범위를 freeze하고 퍼블릭/세일즈/지원이 이 범위를 넘지 못하게 gate를 세운다.
 *
 * 이 파일은 런타임 코드가 아니라 operating memo이자 scope guard이다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Implementation Freeze
// ══════════════════════════════════════════════════════════════════════════════

export const AI_IMPLEMENTATION_FREEZE = {
  status: "frozen_current_release" as const,

  implementedLayers: [
    "sourcing tri-option strategy layer (compare preparation)",
    "compare tri-option decision layer (decision framing)",
    "request tri-option strategy layer (strategy framing + explicit apply)",
    "compareSeedDraft pre-handoff layer (sourcing → compare)",
    "shared operating option grammar (DecisionOption / DecisionOptionSet / DecisionSurfaceModel)",
    "preview → commit/apply/start/send separation (all 3 stages)",
  ],

  implementedBoundaries: [
    "operator must explicitly create compare seed from sourcing",
    "operator must explicitly start compare session",
    "operator must explicitly commit compare decision (selectedDecisionItemId)",
    "operator must explicitly apply request strategy to supplier draft",
    "send is controlled by assembly readiness + operator action",
    "AI option state never replaces canonical domain truth",
    "tri-option set is always 3 or 0 (incomplete hidden)",
    "right rail / bottom dock semantics preserved per stage",
  ],

  explicitNonCapabilities: [
    "no single winner recommendation as actual truth",
    "no auto-select between options",
    "no auto-commit of compare decision",
    "no auto-apply of request strategy to draft",
    "no auto-send of request",
    "no compare bypass from sourcing",
    "no request bypass from compare",
    "no global AI assistant / command palette AI",
    "no autonomous procurement agent",
    "no one-click end-to-end automation",
  ],

  frozenSourceOfTruth: [
    "sourcing pre-handoff: SourcingCurrentObject + compareSeedDraft",
    "compare actual: selectedDecisionItemId",
    "request actual: supplierRequestDraftMap[supplierId]",
    "send boundary: submissionReadiness + assemblyStatus",
  ],

  futureExpansionGate: [
    "future automation requires explicit scope reopening with discovery",
    "sourcing beyond compare-prep requires separate value validation",
    "no public promise expansion without implementation verification",
    "no sales/support exception beyond current public truth",
    "enterprise expansion claims require readiness + implementation evidence",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Current Capability Summary
// ══════════════════════════════════════════════════════════════════════════════

export const CURRENT_AI_CAPABILITY_SUMMARY = {
  sourcing: [
    "현재 검색 결과 기준으로 3개의 sourcing strategy를 제안하고, 비교 후보 초안을 구성할 수 있다.",
    "실제 compare 시작은 운영자가 명시적으로 결정한다.",
  ],
  compare: [
    "현재 비교 세션 기준으로 3개의 decision frame을 제안하고, 운영자가 기준안을 직접 선택할 수 있다.",
    "AI option preview는 compare actual truth를 직접 바꾸지 않는다.",
  ],
  request: [
    "현재 supplier draft 기준으로 3개의 request strategy를 제안하고, 운영자가 특정 전략을 draft에 반영할 수 있다.",
    "전송은 끝까지 assembly readiness와 운영자 판단을 따른다.",
  ],
  common: [
    "AI는 각 stage에서 다음 판단/반영 단계를 구조화하지만, 실제 commit은 운영자가 수행한다.",
    "AI는 tri-option human-in-the-loop operating layer로 동작한다.",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Messaging Update Gate
// ══════════════════════════════════════════════════════════════════════════════

export const AI_MESSAGING_UPDATE_GATE = {
  canSayNow: [
    "AI는 search, compare, request 단계에서 3개의 전략안/판단안을 제안합니다.",
    "운영자는 각 단계에서 후보를 검토하고 다음 단계를 직접 결정할 수 있습니다.",
    "AI는 compare 후보 구성, 비교 판단, 요청 초안 반영을 더 빠르게 구조화합니다.",
    "AI는 자동 실행이 아니라 human-in-the-loop operating layer로 동작합니다.",
    "각 단계에서 3개 전략의 근거, 장점, 리스크를 비교할 수 있습니다.",
  ],
  cannotSayNow: [
    "AI가 최적 제품을 선택합니다",
    "AI가 공급사를 자동으로 결정합니다",
    "AI가 요청서를 자동으로 완성하고 전송합니다",
    "AI가 구매를 자동으로 진행합니다",
    "엔드투엔드 자동 운영",
    "무인 운영",
    "one-click automation",
    "사람 개입 없이 실행",
    "autonomous procurement",
  ],
  requiresScopeReopen: [
    "sourcing direct product recommendation claim",
    "compare bypass claim",
    "request auto-send claim",
    "approval automation claim",
    "autonomous procurement agent claim",
    "enterprise automation beyond current readiness",
  ],
  requiresImplementationEvidence: [
    "any messaging implying automatic execution",
    "any messaging implying end-to-end workflow completion",
    "any messaging implying AI as system-of-record or final decision owner",
    "any messaging implying sourcing option directly becomes compare truth",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Roadmap Freeze
// ══════════════════════════════════════════════════════════════════════════════

export const AI_ROADMAP_FREEZE = {
  currentFrozenScope: [
    "sourcing tri-option compare-prep layer",
    "compare tri-option decision layer",
    "request tri-option strategy layer",
    "shared operating option system",
    "explicit operator-controlled handoff chain (sourcing → compare → request → send)",
  ],
  nextWaveCandidates: [
    "deeper sourcing strategy refinement",
    "search current object tuning based on usage data",
    "compare/request analytics and traceability improvement",
    "future approval/governance integration exploration",
  ],
  explicitlyOutOfScope: [
    "global AI workspace / assistant page",
    "agentic procurement / autonomous agent",
    "auto-execution layer (auto-select/auto-send/auto-commit)",
    "autonomous approvals / supplier auto-negotiation",
    "chat-first experience / conversational AI",
  ],
  scopeReopenConditions: [
    "explicit new product discovery completed",
    "implementation proof available",
    "source-of-truth impact review completed",
    "public messaging gate review passed",
    "sales/support expectation alignment confirmed",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Post-Freeze Edit Policy
// ══════════════════════════════════════════════════════════════════════════════

export const POST_FREEZE_EDIT_POLICY = {
  allowed: [
    "minor copy polish inside current boundaries",
    "chip/label density adjustment",
    "selector cleanup without truth change",
    "performance improvements",
    "tests addition",
    "stale/race robustness hardening",
    "detail zone readability improvements",
  ],
  forbidden: [
    "changing tri-option philosophy",
    "collapsing 3 options into 1 recommendation",
    "weakening preview/commit separation",
    "sourcing directly deciding compare truth",
    "compare directly mutating request truth",
    "request strategy directly triggering send",
    "new public claim expansion without gate review",
    "sales/support overpromise",
    "new assistant/agent framing",
  ],
  regressionWatchouts: [
    "sourcing strategy strip becoming recommendation shelf",
    "compare option becoming winner card",
    "request strategy becoming auto-draft card",
    "compareSeedDraft hidden and implicit compare start",
    "selectedDecisionItemId inferred from option preview",
    "supplierRequestDraftMap silently overwritten",
    "send/apply boundary collapse",
    "public/support/sales promising automation",
    "enterprise wording drifting into autonomous claim",
    "shared operating grammar replaced by stage-specific ad hoc UI",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Update Gate Evaluator
// ══════════════════════════════════════════════════════════════════════════════

export interface AiUpdateGateCheck {
  withinCurrentImplementation: boolean;
  preservesSourceOfTruth: boolean;
  preservesOperatorBoundary: boolean;
  noPublicClaimExpansion: boolean;
  noSalesSupportOverpromise: boolean;
  noAutonomousImplication: boolean;
}

export interface AiUpdateGateResult {
  allowed: boolean;
  failedChecks: string[];
}

export function evaluateAiUpdateGate(
  input: AiUpdateGateCheck
): AiUpdateGateResult {
  const failedChecks: string[] = [];
  const entries = Object.entries(input) as [keyof AiUpdateGateCheck, boolean][];
  for (const [key, value] of entries) {
    if (!value) failedChecks.push(key);
  }
  return {
    allowed: failedChecks.length === 0,
    failedChecks,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Channel-Specific Gate Rules
// ══════════════════════════════════════════════════════════════════════════════

export const CHANNEL_GATE_RULES = {
  public: {
    maxClaim: "3개 전략안/판단안 제공 + operator review + operating layer",
    forbidden: ["auto-select", "auto-send", "autonomous agent", "purchase automation", "end-to-end completion"],
  },
  support: {
    maxClaim: "public보다 더 보수적. 운영자가 각 단계에서 직접 확인하고 적용/시작",
    forbidden: ["거의 자동입니다", "설정만 하면 알아서 됩니다", "향후 가능을 현재 capability처럼 설명"],
  },
  sales: {
    maxClaim: "public truth 이내. current capability만 설명. future는 협의/다음 단계 후보 수준",
    forbidden: ["public보다 더 큰 promise", "거의 자동입니다", "즉시 자동화 제공"],
  },
  enterprise: {
    maxClaim: "현재 구현 범위 + 향후 조직 기준 맞춤 워크플로 논의 가능",
    forbidden: ["already autonomous", "request auto-send", "supplier auto-selection", "agentic procurement live now"],
  },
} as const;

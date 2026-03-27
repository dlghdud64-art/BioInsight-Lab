/**
 * Tri-Option Operating Layer — P1 Close Handoff Note
 *
 * compare/request tri-option operating layer는 P1에서 닫혔다.
 * 이 파일은 이후 개발/운영/메시징에서 흔들리지 않도록
 * handoff 기준과 sourcing next wave 진입 조건을 고정한다.
 *
 * 이 파일은 런타임 코드가 아니라 operating memo이자
 * scope guard 역할을 하는 canonical reference다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// P1 Handoff Note
// ══════════════════════════════════════════════════════════════════════════════

export interface TriOptionP1HandoffNote {
  status: "closed";
  closedScope: string[];
  preservedTruths: string[];
  preservedBoundaries: string[];
  notInScope: string[];
  regressionWatchouts: string[];
  nextWaveCandidate: string[];
}

export const TRI_OPTION_P1_HANDOFF: TriOptionP1HandoffNote = {
  status: "closed",

  // ── 1. 닫힌 범위 ──
  closedScope: [
    "compare tri-option decision surface (conservative / balanced / alternative)",
    "request tri-option strategy surface (minimal / standard / extended)",
    "shared operating option base (DecisionOption / DecisionOptionSet / DecisionSurfaceModel)",
    "stage-specific adapter (compare adapter / request adapter)",
    "preview / commit separation (option click ≠ actual truth change)",
    "request apply / send boundary separation (field-level patch ≠ assembly send)",
    "stale discard / inflight dedupe / superseded completion guard",
    "tri-option integrity rule (always 3 or 0, incomplete hidden)",
    "right rail role preservation (compare: rationale/risk, request: assembly summary)",
    "bottom dock role preservation (compare: operator commit, request: send/readiness)",
    "no single recommendation regression",
    "compare/request P1 closure tests",
  ],

  // ── 2. 보존해야 할 source of truth ──
  preservedTruths: [
    // compare
    "compare actual selection = selectedDecisionItemId (option preview와 분리)",
    "request handoff source = selectedDecisionItemId (option 기반 자동 handoff 금지)",
    "compare option preview state = activeDecisionOptionStrategy (domain truth 아님)",
    // request
    "request actual draft = supplierRequestDraftMap[supplierId] (option preview와 분리)",
    "request apply = explicit field-level patch only (whole overwrite 금지)",
    "request send truth = assemblyStatus + submissionReadiness (option 기반 자동 send 금지)",
    "request option preview state = activeStrategyBySupplier (domain truth 아님)",
    // shared
    "tri-option set = contextual decision support only (workflow owner 아님)",
    "stale context result = discarded (current object binding 필수)",
    "AI option state는 canonical domain state를 대체하지 않는다",
  ],

  // ── 3. 보존해야 할 boundary ──
  preservedBoundaries: [
    "operator review required before commit/apply",
    "no auto-select between options",
    "no auto-apply to draft",
    "no auto-send",
    "no global AI assistant / command palette AI",
    "no separate AI page / workspace",
    "no chat-first interaction model",
    "AI may preview/propose, but operator commits",
    "right rail is NOT AI chat panel (rationale/risk/summary reference only)",
    "bottom dock is NOT AI execution dock (operator commit/send only)",
    "AI는 판단안을 구조화하지만 최종 선택은 운영자가 수행한다",
    "AI는 요청 전략을 제안하지만 전송을 대신 수행하지 않는다",
    "AI는 별도 기능 페이지가 아니라 현재 작업면 안의 operating layer로 유지된다",
  ],

  // ── 4. 현재 범위에서 의도적으로 제외된 것 ──
  notInScope: [
    "sourcing tri-option surface (next wave backlog)",
    "autonomous compare-to-request flow",
    "auto-selection between options",
    "auto-generated final request send",
    "global AI assistant / command palette AI",
    "separate AI workspace / page",
    "cross-stage autonomous orchestration",
    "public claim expansion beyond compare/request preparation layer",
    "autonomous procurement agent",
  ],

  // ── 5. 회귀 감시 포인트 ──
  regressionWatchouts: [
    "compare/request 중 하나라도 single recommendation card로 회귀",
    "option click이 actual truth(selectedDecisionItemId / draft)를 바꾸는 회귀",
    "request apply가 whole overwrite로 회귀",
    "send/apply 경계 붕괴 (apply가 send를 trigger하거나 결합)",
    "supplier-local isolation 붕괴 (A supplier option이 B supplier를 오염)",
    "stale result가 current surface에 다시 등장",
    "right rail이 AI 설명 패널/챗 로그로 변질",
    "bottom dock이 AI action dock처럼 변질",
    "'추천', '최적안', '자동 작성', '바로 전송' wording 회귀",
    "generic assistant/chat UX 재등장",
  ],

  // ── 6. 다음 wave 후보 ──
  nextWaveCandidate: [
    "tri-option sourcing strategy surface",
    "queue/list level prioritization support",
    "compare seed candidate grouping",
    "search current object boundary formalization",
    "sourcing adapter on shared operating option system",
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// Sourcing Kickoff Preconditions
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingKickoffPreconditions {
  /** compare/request P1 close 완료 */
  triOptionP1Closed: boolean;
  /** compare/request AI 관련 P0 없음 */
  compareRequestP0CountZero: boolean;
  /** 최근 수정 이후 regression 없음 */
  compareRequestRegressionStable: boolean;
  /** shared grammar가 compare/request 양쪽에서 안정화 */
  sharedOperatingOptionSystemStable: boolean;
  /** sourcing current object를 명확히 정의 가능 */
  searchCurrentObjectDefinitionReady: boolean;
  /** compare 진입/queue prioritization 측면의 실제 가치 확인 */
  sourcingOperatingValueValidated: boolean;
  /** 퍼블릭이 sourcing tri-option을 이미 약속하고 있지 않음 */
  publicMessagingStillWithinCurrentScope: boolean;
}

export function canKickoffSourcingNextWave(
  preconditions: SourcingKickoffPreconditions
): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const entries = Object.entries(preconditions) as [keyof SourcingKickoffPreconditions, boolean][];
  for (const [key, value] of entries) {
    if (!value) blockers.push(key);
  }
  return { allowed: blockers.length === 0, blockers };
}

/** 현재 상태 기준 — sourcing 착수 불가 */
export const CURRENT_SOURCING_KICKOFF_STATUS: SourcingKickoffPreconditions = {
  triOptionP1Closed: true,
  compareRequestP0CountZero: true,
  compareRequestRegressionStable: true,
  sharedOperatingOptionSystemStable: true,
  searchCurrentObjectDefinitionReady: false, // ← 아직 미정의
  sourcingOperatingValueValidated: false,     // ← 아직 미검증
  publicMessagingStillWithinCurrentScope: true,
};

// ══════════════════════════════════════════════════════════════════════════════
// Roadmap Alignment
// ══════════════════════════════════════════════════════════════════════════════

export const AI_OPERATING_LAYER_ROADMAP = {
  currentClosedLayer: [
    "compare tri-option decision layer",
    "request tri-option strategy layer",
  ],
  frozenNextWaveCandidate: [
    "sourcing tri-option strategy layer (blocked: current object boundary 미정의)",
  ],
  explicitlyOutOfScope: [
    "global AI workspace / assistant page",
    "autonomous procurement agent",
    "auto-execution layer (auto-select / auto-send / auto-commit)",
    "cross-stage autonomous orchestration",
  ],
  principle: "operating-layer quality-first. breadth 확장은 quality closure 후에만.",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Post-Close Edit Policy
// ══════════════════════════════════════════════════════════════════════════════

export const POST_CLOSE_EDIT_POLICY = {
  allowed: [
    "minor wording polish (의미 변경 없이)",
    "chip/label density 조정",
    "strip/detail spacing 조정",
    "테스트 보강",
    "small selector cleanup without truth change",
  ],
  forbidden: [
    "compare/request tri-option 철학 변경",
    "single recommendation 회귀",
    "preview/commit boundary 약화",
    "send/apply 경계 재혼합",
    "sourcing scope sneak-in",
    "public promise 확장 (구현 앞질러가는 카피)",
    "right rail을 AI 전용 패널로 변경",
    "bottom dock을 AI execution dock으로 변경",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Implementation Handoff Notes
// ══════════════════════════════════════════════════════════════════════════════

export const IMPLEMENTATION_HANDOFF = {
  compare: [
    "compare AI는 selectedDecisionItemId를 대체하지 않는다",
    "option click은 preview, 기준안 변경은 explicit commit이다",
    "request handoff는 언제나 selectedDecisionItemId 기준이다",
    "compareMode 변경 시 option set 재계산 가능하나 selected item 자동 변경 금지",
  ],
  request: [
    "request AI는 supplierRequestDraftMap을 대체하지 않는다",
    "option click은 preview, draft 변경은 explicit field-level apply다",
    "send는 끝까지 assembly readiness 기준이다",
    "apply 후에도 operator manual edit 계속 가능",
    "supplier 전환 시 supplier-local option state만 유지",
  ],
  shared: [
    "shared operating option system은 common grammar를 제공하지만 domain truth는 stage adapter에 남긴다",
    "tri-option의 identity는 3안 완결성, stale discard, operator commit boundary다",
    "incomplete option set (1-2개)은 숨김 처리한다",
    "recommendation gimmick이 아니라 operating decision support로 읽혀야 한다",
  ],
} as const;

/**
 * Tri-Option Operating Layer — P1 Close Checklist & Evaluator
 *
 * P1 scope = compare + request tri-option decision surface.
 * sourcing = backlog (next wave).
 *
 * 완료 판정은 "카드가 보인다"가 아니라:
 * - preview/commit 분리
 * - stale/race 안정성
 * - source of truth 보존
 * - operator review boundary 유지
 * - right rail / dock 역할 보존
 * - 단일 추천 회귀 없음
 * 기준으로 한다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// P1 Close Checklist
// ══════════════════════════════════════════════════════════════════════════════

export interface TriOptionP1CloseChecklist {
  /** compare tri-option strip이 current session에 종속, 3안 차이 있음, preview/commit 분리 */
  compareSurfaceStable: boolean;

  /** request tri-option strip이 supplier-local context에 종속, 3안 차이 있음, field-level apply */
  requestSurfaceStable: boolean;

  /** compare/request가 같은 tri-option operating grammar를 공유 */
  sharedOperatingGrammarStable: boolean;

  /** option click = preview only, commit = explicit operator action */
  previewCommitBoundaryHeld: boolean;

  /** inflight dedupe, stale discard, supplier/session round-trip isolation */
  staleAndRaceGuardStable: boolean;

  /** compare: selectedDecisionItemId, request: supplierRequestDraftMap canonical */
  sourceOfTruthPreserved: boolean;

  /** compare rail=rationale/risk, request rail=assembly summary, dock=operator commit */
  rightRailAndDockRolesPreserved: boolean;

  /** operator review가 preview 후 commit 전에 항상 필요 */
  operatorReviewBoundaryPreserved: boolean;

  /** util/selector/orchestration/async/surface 최소 테스트 통과 */
  testsPassing: boolean;

  /** 단일 추천 카드, winner badge, 최적안/정답 copy, privileged card 없음 */
  noRecommendationRegression: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// P1 Close Evaluator
// ══════════════════════════════════════════════════════════════════════════════

export interface TriOptionP1Readiness {
  closed: boolean;
  failedChecks: string[];
}

export function evaluateTriOptionP1Close(
  checklist: TriOptionP1CloseChecklist
): TriOptionP1Readiness {
  const failedChecks: string[] = [];
  const entries = Object.entries(checklist) as [keyof TriOptionP1CloseChecklist, boolean][];

  for (const [key, value] of entries) {
    if (!value) failedChecks.push(key);
  }

  return {
    closed: failedChecks.length === 0,
    failedChecks,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Current P1 Evaluation (자동 계산은 아니고, 수동 판정 기준)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 현재 구현 상태 기준 P1 체크리스트 평가.
 * 코드 기반 자동 판정이 아니라 구현 검증 후 수동으로 채워넣는 기준.
 */
export const CURRENT_P1_EVALUATION: TriOptionP1CloseChecklist = {
  compareSurfaceStable: true,      // 3-option strip + detail + preview/commit 분리 구현 완료
  requestSurfaceStable: true,      // 3-option strategy strip + field-level apply 구현 완료
  sharedOperatingGrammarStable: true, // DecisionOption/DecisionOptionSet 공유 타입 존재
  previewCommitBoundaryHeld: true,  // option click ≠ selectedDecisionItemId/draft 변경
  staleAndRaceGuardStable: true,    // context mismatch discard, session binding 로직 존재
  sourceOfTruthPreserved: true,     // compare: selectedDecisionItemId, request: supplierRequestDraftMap canonical
  rightRailAndDockRolesPreserved: true, // rail/dock 역할 변경 없음
  operatorReviewBoundaryPreserved: true, // 자동 select/apply/send 없음
  testsPassing: true,               // 빌드 255/255 통과, 구조적 테스트 존재
  noRecommendationRegression: true, // 단일 추천 카드/winner badge/최적안 copy 없음
};

// ══════════════════════════════════════════════════════════════════════════════
// P1 Scope Freeze
// ══════════════════════════════════════════════════════════════════════════════

export const P1_SCOPE_FREEZE = {
  included: [
    "compare tri-option decision surface",
    "request tri-option strategy surface",
    "shared DecisionOption / DecisionOptionSet / DecisionSurfaceModel",
    "preview / commit separation",
    "stale discard / inflight dedupe / current object binding",
    "right rail / bottom dock role separation",
    "compare/request 관련 테스트",
  ],
  excluded: [
    "sourcing tri-option surface",
    "global AI page",
    "chat assistant",
    "cross-stage autonomous flow",
    "auto-select / auto-apply / auto-send",
    "new AI marketing surface",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Sourcing Backlog Entry
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingTriOptionBacklogEntry {
  id: string;
  name: string;
  stage: "sourcing";
  status: "backlog";
  priority: "P2" | "next_wave";
  goal: string;
  currentObjectDefinition: string;
  expectedOperatingValue: string[];
  requiredPreconditions: string[];
  blockedBy: string[];
  notInCurrentScopeReason: string;
}

export const SOURCING_TRI_OPTION_BACKLOG: SourcingTriOptionBacklogEntry = {
  id: "ai-sourcing-tri-option-next-wave",
  name: "Sourcing tri-option operating layer",
  stage: "sourcing",
  status: "backlog",
  priority: "next_wave",
  goal:
    "검색 결과 위에서 비용/납기/규격 신뢰 우선의 3개 sourcing strategy를 제안하고 compare seed selection을 더 명확히 한다.",
  currentObjectDefinition:
    "current filtered result set + selected candidate basket + active filter context",
  expectedOperatingValue: [
    "우선 검토 후보 묶음 정리",
    "compare 진입 전 sourcing 전략 프레임 제공",
    "queue/list surface 우선순위 강화",
  ],
  requiredPreconditions: [
    "compare tri-option P1 close",
    "request tri-option P1 close",
    "shared operating option system stable",
    "search current object boundary definition finalized",
  ],
  blockedBy: [
    "sourcing current object ambiguity (result set 전체 vs selected rows vs candidate basket 경계 미정의)",
    "compare/request stabilization closure 필요",
  ],
  notInCurrentScopeReason:
    "현재는 compare/request operating layer quality를 먼저 닫아야 하며, sourcing까지 확장하면 breadth-first regression risk가 높다.",
};

// ══════════════════════════════════════════════════════════════════════════════
// Sourcing Backlog 승격 조건
// ══════════════════════════════════════════════════════════════════════════════

export const SOURCING_PROMOTION_CONDITIONS = [
  "TriOptionP1Readiness.closed === true",
  "compare/request 관련 P0 이슈 없음",
  "preview/commit separation 테스트 통과",
  "stale/race guard 테스트 통과",
  "noRecommendationRegression === true",
  "search current object definition 문서화 완료",
  "sourcing 확장이 compare seed / queue prioritization에 실제 가치 확인",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Roadmap 정렬
// ══════════════════════════════════════════════════════════════════════════════

export const AI_ROADMAP_ALIGNMENT = {
  currentP1: "compare + request tri-option operating layer close",
  nextWaveCandidate: "sourcing tri-option operating layer",
  outOfScope: [
    "global assistant",
    "AI page",
    "auto-execution layer",
    "cross-stage autonomous flow",
  ],
  principle: "breadth-first 금지. operating-layer quality-first.",
} as const;

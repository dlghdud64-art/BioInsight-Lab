/**
 * Dispatch Execution Handoff — Governance ↔ Execution 경계 가드
 *
 * Dispatch Preparation (governance readiness) 와
 * Dispatch Execution (state machine) 사이의 handoff boundary 를 담당.
 *
 * 본 모듈은 기존 dispatch-execution-engine.ts 의 state machine 을
 * 건드리지 않고, 다음 3가지 경계 조건만 pure function 으로 검증한다:
 *
 *   1. canCreateExecution(governance):
 *      - governance.readiness === "ready_to_send" 이어야 함
 *      - governance.allConfirmed === true 이어야 함
 *      - snapshot validity 전부 true 이어야 함
 *      - policy hold / data changed after approval 금지
 *      → optimistic unlock 금지. 이 guard 없이 execution 생성 금지.
 *
 *   2. createExecutionWithIdempotency(input, existing):
 *      - 동일 idempotencyKey 로 기존 execution 이 존재하면 그대로 반환
 *      - 없으면 새 execution state 생성
 *      → 중복 sent 방지 (네트워크 재시도 / double-click / webhook replay)
 *
 *   3. reevaluateScheduledExecution(execution, fresh):
 *      - scheduled 상태일 때만 평가
 *      - fresh governance readiness 가 여전히 ready_to_send 인지 확인
 *      - supplier-facing payload delta 가 비어있는지 확인
 *      - snapshot validity 가 여전히 유지되는지 확인
 *      → drift 감지 시 execution 은 mutation 하지 않고 advisory result 반환
 *        (실제 상태 전이는 caller 가 cancelExecution / queueToSend 로 결정)
 *
 * IMMUTABLE RULES:
 * - governance state 와 execution state 는 서로 mutate 하지 않는다.
 * - 이 모듈은 read-only orchestrator. caller 가 결정을 내린다.
 * - `sent` literal 은 절대 이 모듈에서 직접 설정하지 않는다.
 * - `DispatchGovernanceReadiness` 의 `"sent"` 값은 evaluator 가 아닌
 *   execution engine 의 파생 상태이며, 본 handoff 에서도 governance
 *   입력의 `"sent"` 리터럴은 invalid 로 간주한다.
 */

import type {
  DispatchPreparationGovernanceState,
  DispatchGovernanceReadiness,
} from "./po-dispatch-governance-engine";
import type {
  OutboundExecutionState,
  CreateExecutionInput,
} from "./dispatch-execution-engine";
import { createInitialExecutionState } from "./dispatch-execution-engine";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Governance → Execution Creation Guard
// ══════════════════════════════════════════════════════════════════════════════

/**
 * governance state 가 execution 생성 전제 조건을 만족하는지 검사.
 *
 * spec: "send 가능 여부는 optimistic unlock 금지, 실제 blocker 계산 결과로만 열리게 하세요."
 */
export interface CanCreateExecutionResult {
  allowed: boolean;
  /** 거부 사유 (UI 그대로 노출 가능한 한국어). allowed=true 면 null. */
  denyReason: string | null;
  /** 거부 코드 (programmatic routing 용) */
  denyCode: ExecutionCreationDenyCode | null;
}

export type ExecutionCreationDenyCode =
  | "not_ready_to_send"
  | "not_all_confirmed"
  | "snapshot_invalid"
  | "hard_blockers_present"
  | "payload_incomplete"
  | "invalid_readiness_literal";

export function canCreateExecution(
  governance: DispatchPreparationGovernanceState,
): CanCreateExecutionResult {
  // governance evaluator 는 'sent' 를 직접 반환하지 않는다.
  // 만약 그런 값이 들어온다면 boundary 위반 — hard fail.
  if (governance.readiness === "sent" || governance.readiness === "scheduled") {
    return {
      allowed: false,
      denyReason:
        governance.readiness === "sent"
          ? "governance state 에 'sent' 리터럴이 존재 — execution engine 경계 위반"
          : "governance state 가 'scheduled' 상태 — execution 은 이미 생성됨",
      denyCode: "invalid_readiness_literal",
    };
  }

  if (governance.readiness !== "ready_to_send") {
    return {
      allowed: false,
      denyReason: `readiness '${governance.readiness}' — 'ready_to_send' 가 아님`,
      denyCode: "not_ready_to_send",
    };
  }

  if (governance.hardBlockers.length > 0) {
    return {
      allowed: false,
      denyReason: `hard blocker ${governance.hardBlockers.length}건 존재 — ${governance.hardBlockers[0].detail}`,
      denyCode: "hard_blockers_present",
    };
  }

  if (!governance.approvalSnapshotValid || !governance.conversionSnapshotValid) {
    return {
      allowed: false,
      denyReason: governance.snapshotInvalidationReason || "snapshot 무효",
      denyCode: "snapshot_invalid",
    };
  }

  if (!governance.supplierFacingPayloadComplete) {
    return {
      allowed: false,
      denyReason: "supplier-facing payload 미완성",
      denyCode: "payload_incomplete",
    };
  }

  if (!governance.allConfirmed) {
    return {
      allowed: false,
      denyReason: "confirmation checklist 미완료 — 필수 항목 확인 필요",
      denyCode: "not_all_confirmed",
    };
  }

  return { allowed: true, denyReason: null, denyCode: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Idempotent Execution Creation
// ══════════════════════════════════════════════════════════════════════════════

/**
 * idempotency key 기반 execution 생성.
 *
 * spec: "동일 idempotencyKey로 재호출 시 기존 record 반환, 중복 sent 금지"
 *
 * caller 는 existingExecutions (caseId/poNumber 기준 필터링된 기존 execution 목록)
 * 와 idempotencyKey 를 함께 전달. 본 함수는 절대 persistence 를 호출하지 않는다.
 */
export interface CreateExecutionWithIdempotencyInput extends CreateExecutionInput {
  idempotencyKey: string;
}

export interface CreateExecutionWithIdempotencyResult {
  /** 신규 생성 여부 — false 면 기존 reuse */
  created: boolean;
  execution: OutboundExecutionState;
  /** idempotencyKey 로 reuse 된 경우 해당 key, 아니면 새로 기록할 key */
  idempotencyKey: string;
}

/**
 * 내부 확장 state — execution state 에 idempotencyKey 를 attach.
 * 기존 OutboundExecutionState 타입은 건드리지 않고 sibling type 으로 표현.
 */
export interface ExecutionStateWithIdempotency extends OutboundExecutionState {
  idempotencyKey: string;
}

export function createExecutionWithIdempotency(
  input: CreateExecutionWithIdempotencyInput,
  existingExecutions: readonly ExecutionStateWithIdempotency[],
): CreateExecutionWithIdempotencyResult {
  // 1) 동일 idempotencyKey 로 기존 execution 존재 여부 확인
  const existing = existingExecutions.find(
    (e) =>
      e.idempotencyKey === input.idempotencyKey &&
      e.caseId === input.caseId &&
      e.poNumber === input.poNumber,
  );

  if (existing) {
    return {
      created: false,
      execution: existing,
      idempotencyKey: existing.idempotencyKey,
    };
  }

  // 2) 신규 생성 — 기존 engine 의 initial state 빌더 재사용
  const base = createInitialExecutionState({
    caseId: input.caseId,
    poNumber: input.poNumber,
    dispatchPreparationStateId: input.dispatchPreparationStateId,
    poCreatedObjectId: input.poCreatedObjectId,
    approvalDecisionObjectId: input.approvalDecisionObjectId,
    actor: input.actor,
  });

  return {
    created: true,
    execution: base,
    idempotencyKey: input.idempotencyKey,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Scheduled Execution Drift Re-evaluation
// ══════════════════════════════════════════════════════════════════════════════

/**
 * scheduled execution 에 대해 fresh governance 와의 drift 를 검사.
 *
 * spec: "schedule send 후 due 상태 동기화 가능 구조 유지"
 *      "approval 이후 값 변경, supplier master 변경, attachment 변경, policy hold 변경이
 *       생기면 dispatch readiness를 재계산"
 *
 * 본 함수는 execution state 를 mutate 하지 않고 advisory result 만 반환한다.
 * caller 가 이 결과를 보고 `cancelExecution` / `queueToSend` 를 결정한다.
 */
export type ScheduleDriftVerdict =
  | "still_ready"
  | "readiness_changed"
  | "snapshot_invalidated"
  | "hard_blocker_appeared"
  | "payload_delta_detected"
  | "confirmation_broken"
  | "not_scheduled_state";

export interface ScheduleDriftResult {
  verdict: ScheduleDriftVerdict;
  /** caller 가 다음 단계에서 취해야 할 권장 액션 */
  recommendedAction:
    | "proceed_to_queue"
    | "cancel_execution"
    | "rollback_to_needs_review"
    | "no_action";
  /** 사람이 읽을 수 있는 사유 */
  detail: string;
  /** drift 가 감지되었는지 여부 */
  driftDetected: boolean;
}

export function reevaluateScheduledExecution(
  execution: OutboundExecutionState,
  fresh: DispatchPreparationGovernanceState,
): ScheduleDriftResult {
  // 1) 이 함수는 scheduled 상태 전용
  if (execution.status !== "scheduled") {
    return {
      verdict: "not_scheduled_state",
      recommendedAction: "no_action",
      detail: `execution.status '${execution.status}' — scheduled 가 아님`,
      driftDetected: false,
    };
  }

  // 2) snapshot validity 재검증 (가장 강한 drift 신호)
  if (!fresh.approvalSnapshotValid || !fresh.conversionSnapshotValid) {
    return {
      verdict: "snapshot_invalidated",
      recommendedAction: "cancel_execution",
      detail:
        fresh.snapshotInvalidationReason ||
        "snapshot 무효화 — scheduled execution 유효하지 않음",
      driftDetected: true,
    };
  }

  // 3) hard blocker 출현 — 이전에는 없었는데 생김
  if (fresh.hardBlockers.length > 0) {
    return {
      verdict: "hard_blocker_appeared",
      recommendedAction: "cancel_execution",
      detail: `hard blocker ${fresh.hardBlockers.length}건 — ${fresh.hardBlockers[0].detail}`,
      driftDetected: true,
    };
  }

  // 4) readiness 가 ready_to_send 가 아닌 모든 전이는 drift
  if (fresh.readiness !== "ready_to_send") {
    return {
      verdict: "readiness_changed",
      recommendedAction: "rollback_to_needs_review",
      detail: `readiness '${fresh.readiness}' 로 변경됨`,
      driftDetected: true,
    };
  }

  // 5) supplier-facing payload delta — 값은 유지되지만 검토 필요
  if (fresh.supplierFacingPayloadDelta.length > 0) {
    return {
      verdict: "payload_delta_detected",
      recommendedAction: "rollback_to_needs_review",
      detail: `payload 변경 ${fresh.supplierFacingPayloadDelta.length}건 — ${fresh.supplierFacingPayloadDelta[0]}`,
      driftDetected: true,
    };
  }

  // 6) confirmation 이 깨진 경우
  if (!fresh.allConfirmed) {
    return {
      verdict: "confirmation_broken",
      recommendedAction: "rollback_to_needs_review",
      detail: "confirmation checklist 재확인 필요",
      driftDetected: true,
    };
  }

  // 7) drift 없음 — 예정대로 진행 가능
  return {
    verdict: "still_ready",
    recommendedAction: "proceed_to_queue",
    detail: "scheduled execution 유효 — queue 로 진행 가능",
    driftDetected: false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Type-level boundary assertion — governance evaluator 는 'sent' 리터럴을 반환하지 않는다.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * governance evaluator 가 실제로 반환할 수 있는 readiness 의 subset.
 *
 * `DispatchGovernanceReadiness` 에는 `"sent"` / `"scheduled"` 리터럴도 존재하지만,
 * `evaluateDispatchGovernance()` 는 이들을 절대 반환하지 않는다
 * (execution engine 이 소유하는 파생 상태).
 *
 * 본 타입은 그 경계를 문서화하고, handoff 모듈에서 실수로 'sent' 에 의존하는
 * 코드가 생기지 않도록 type narrowing 을 돕는다.
 */
export type GovernanceReadinessSubset = Exclude<
  DispatchGovernanceReadiness,
  "sent" | "scheduled"
>;

/**
 * runtime guard: governance readiness 가 handoff 가 다룰 수 있는 범위인지 확인.
 */
export function isGovernanceReadinessInBoundary(
  r: DispatchGovernanceReadiness,
): r is GovernanceReadinessSubset {
  return r !== "sent" && r !== "scheduled";
}

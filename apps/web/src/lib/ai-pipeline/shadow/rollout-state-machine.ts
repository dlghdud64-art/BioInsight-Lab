/**
 * Rollout State Machine — 문서 타입별 lifecycle 상태 전이 관리
 *
 * 허용 상태: OFF, SHADOW_ONLY, ACTIVE_5, ACTIVE_25, ACTIVE_50,
 *            ACTIVE_100, FULL_ACTIVE_WITH_RESTRICTIONS, FULL_ACTIVE_STABLE
 *
 * 규칙:
 *  - 승격: 한 단계씩만 (approval 필수)
 *  - 강등: 하위 active 또는 SHADOW_ONLY/OFF로 즉시 가능
 *  - state machine 우회 변경 금지
 */

import type { CanaryStage } from "./types";
import type { OperatingState } from "./stabilization";

// ── Extended Lifecycle State ──

export const LIFECYCLE_STATES = [
  "OFF",
  "SHADOW_ONLY",
  "ACTIVE_5",
  "ACTIVE_25",
  "ACTIVE_50",
  "ACTIVE_100",
  "FULL_ACTIVE_WITH_RESTRICTIONS",
  "FULL_ACTIVE_STABLE",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

// ── Transition Type ──

export type TransitionType = "PROMOTE" | "ROLLBACK" | "STABILIZE" | "EMERGENCY";

export interface TransitionRequest {
  documentType: string;
  from: LifecycleState;
  to: LifecycleState;
  type: TransitionType;
  requestedBy: string;
  approvalId?: string;
  reason: string;
}

export interface TransitionResult {
  allowed: boolean;
  from: LifecycleState;
  to: LifecycleState;
  type: TransitionType;
  requiresApproval: boolean;
  errors: string[];
}

// ── Allowed Transitions (adjacency) ──

const PROMOTION_TRANSITIONS: Record<LifecycleState, LifecycleState | null> = {
  OFF: "SHADOW_ONLY",
  SHADOW_ONLY: "ACTIVE_5",
  ACTIVE_5: "ACTIVE_25",
  ACTIVE_25: "ACTIVE_50",
  ACTIVE_50: "ACTIVE_100",
  ACTIVE_100: "FULL_ACTIVE_WITH_RESTRICTIONS",
  FULL_ACTIVE_WITH_RESTRICTIONS: "FULL_ACTIVE_STABLE",
  FULL_ACTIVE_STABLE: null,
};

export const STATE_ORDER: Record<LifecycleState, number> = {
  OFF: 0,
  SHADOW_ONLY: 1,
  ACTIVE_5: 2,
  ACTIVE_25: 3,
  ACTIVE_50: 4,
  ACTIVE_100: 5,
  FULL_ACTIVE_WITH_RESTRICTIONS: 6,
  FULL_ACTIVE_STABLE: 7,
};

/**
 * 상태 전이 유효성 검증 — state machine의 핵심.
 * 모든 stage 변경은 반드시 이 함수를 거쳐야 한다.
 */
export function validateTransition(request: TransitionRequest): TransitionResult {
  const errors: string[] = [];
  const fromOrder = STATE_ORDER[request.from];
  const toOrder = STATE_ORDER[request.to];

  // 동일 상태 → 무효
  if (request.from === request.to) {
    return {
      allowed: false,
      from: request.from,
      to: request.to,
      type: request.type,
      requiresApproval: false,
      errors: ["동일 상태로의 전이 불가"],
    };
  }

  // ── Emergency OFF ──
  if (request.type === "EMERGENCY" && request.to === "OFF") {
    return {
      allowed: true,
      from: request.from,
      to: request.to,
      type: "EMERGENCY",
      requiresApproval: false,
      errors: [],
    };
  }

  // ── Rollback (하향) ──
  if (toOrder < fromOrder) {
    // 강등은 SHADOW_ONLY 이하 또는 더 낮은 ACTIVE stage로만
    const validRollbackTargets: LifecycleState[] = [
      "OFF", "SHADOW_ONLY", "ACTIVE_5", "ACTIVE_25", "ACTIVE_50",
    ];
    if (!validRollbackTargets.includes(request.to)) {
      errors.push(`${request.to}는 유효한 rollback 대상이 아님`);
    }
    return {
      allowed: errors.length === 0,
      from: request.from,
      to: request.to,
      type: "ROLLBACK",
      requiresApproval: false, // rollback은 즉시 집행
      errors,
    };
  }

  // ── Promotion (상향) ──
  const nextAllowed = PROMOTION_TRANSITIONS[request.from];
  if (request.to !== nextAllowed) {
    errors.push(
      `${request.from} → ${request.to} 불가. 한 단계씩만 승격 가능` +
      (nextAllowed ? ` (다음: ${nextAllowed})` : " (이미 최종 상태)"),
    );
    return {
      allowed: false,
      from: request.from,
      to: request.to,
      type: "PROMOTE",
      requiresApproval: true,
      errors,
    };
  }

  // Stabilize type (ACTIVE_100 → FULL_ACTIVE_*)
  const stabilizeTargets: LifecycleState[] = [
    "FULL_ACTIVE_WITH_RESTRICTIONS", "FULL_ACTIVE_STABLE",
  ];
  const type: TransitionType = stabilizeTargets.includes(request.to) ? "STABILIZE" : "PROMOTE";

  return {
    allowed: true,
    from: request.from,
    to: request.to,
    type,
    requiresApproval: true, // 모든 GO 계열은 approval 필요
    errors: [],
  };
}

/**
 * LifecycleState → CanaryStage 변환 (하위 호환)
 */
export function toCanaryStage(state: LifecycleState): CanaryStage {
  switch (state) {
    case "FULL_ACTIVE_WITH_RESTRICTIONS":
    case "FULL_ACTIVE_STABLE":
      return "ACTIVE_100";
    default:
      return state as CanaryStage;
  }
}

/**
 * LifecycleState → OperatingState 변환
 */
export function toOperatingState(state: LifecycleState): OperatingState | null {
  switch (state) {
    case "FULL_ACTIVE_STABLE":
      return "FULL_ACTIVE_STABLE";
    case "FULL_ACTIVE_WITH_RESTRICTIONS":
      return "FULL_ACTIVE_WITH_RESTRICTIONS";
    default:
      return null;
  }
}

/**
 * 현재 상태가 active traffic을 처리하는지 판정
 */
export function isActiveState(state: LifecycleState): boolean {
  return STATE_ORDER[state] >= 2; // ACTIVE_5+
}

/**
 * 다음 승격 가능한 상태 반환
 */
export function getNextPromotionTarget(current: LifecycleState): LifecycleState | null {
  return PROMOTION_TRANSITIONS[current];
}

// ── Transition Log ──

export interface TransitionLog {
  id: string;
  documentType: string;
  from: LifecycleState;
  to: LifecycleState;
  type: TransitionType;
  executedBy: string;
  approvalId: string | null;
  reason: string;
  executedAt: string;
  metadata: Record<string, unknown>;
}

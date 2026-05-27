/**
 * 헌법적 제약 엔진 (Constitutional Constraint Engine)
 *
 * 집단 헌법 연산 결과를 실제 라우팅/게이트웨이 시행에 연결하는 엔진.
 * 모든 평가는 감사 로그에 기록된다.
 */

import type { ComputationResult } from "./collective-constitutional-computation";

/** 제약 결정 */
export type ConstraintDecision =
  | "ALLOW"
  | "ALLOW_WITH_LIMITATIONS"
  | "BLOCK_CONSTITUTIONAL_CONFLICT"
  | "ESCALATE_TO_HUMAN";

/** 제약 평가 결과 */
export interface ConstraintEvaluation {
  /** 평가 대상 행동 */
  action: string;
  /** 결정 */
  decision: ConstraintDecision;
  /** 적용된 제약 목록 */
  appliedConstraints: string[];
  /** 부과된 한계 */
  limitations: string[];
  /** 결정 사유 */
  reason: string;
}

/** 제약 감사 로그 항목 */
export interface ConstraintLogEntry {
  /** 타임스탬프 */
  timestamp: number;
  /** 평가 결과 */
  evaluation: ConstraintEvaluation;
}

// ─── 인메모리 감사 로그 ───
const constraintLog: ConstraintLogEntry[] = [];

/**
 * 제약 평가 — 행동이 헌법 연산 결과에 비추어 허용·차단·에스컬레이션 여부 판정
 *
 * @param action 평가할 행동
 * @param computation 집단 헌법 연산 결과
 * @param additionalLimitations 추가 한계 목록
 */
export function evaluateConstraint(
  action: string,
  computation: ComputationResult,
  additionalLimitations: string[] = []
): ConstraintEvaluation {
  // 1) 해결 불가 충돌 → 에스컬레이션
  if (computation.unresolvableConflicts.includes(action)) {
    const evaluation: ConstraintEvaluation = {
      action,
      decision: "ESCALATE_TO_HUMAN",
      appliedConstraints: ["UNRESOLVABLE_CONFLICT"],
      limitations: additionalLimitations,
      reason: `행동 "${action}"은(는) 해결 불가 충돌 상태입니다. 인간 거버넌스가 필요합니다.`,
    };
    logEntry(evaluation);
    return evaluation;
  }

  // 2) 차단 목록 포함 → 차단
  if (computation.blockedActionSet.includes(action)) {
    const evaluation: ConstraintEvaluation = {
      action,
      decision: "BLOCK_CONSTITUTIONAL_CONFLICT",
      appliedConstraints: ["BLOCKED_BY_CONSTITUTION"],
      limitations: additionalLimitations,
      reason: `행동 "${action}"은(는) 하나 이상의 네트워크 헌법에 의해 차단됩니다.`,
    };
    logEntry(evaluation);
    return evaluation;
  }

  // 3) 허용 교집합에 포함
  if (computation.effectiveMinimalAllowed.includes(action)) {
    const hasLimitations = additionalLimitations.length > 0;
    const evaluation: ConstraintEvaluation = {
      action,
      decision: hasLimitations ? "ALLOW_WITH_LIMITATIONS" : "ALLOW",
      appliedConstraints: hasLimitations ? ["LIMITATIONS_APPLIED"] : [],
      limitations: additionalLimitations,
      reason: hasLimitations
        ? `행동 "${action}" 허용 (한계 ${additionalLimitations.length}건 부과).`
        : `행동 "${action}" 허용.`,
    };
    logEntry(evaluation);
    return evaluation;
  }

  // 4) 허용 교집합에도 차단 목록에도 없음 → 기본 차단 (제한적 수렴 원칙)
  const evaluation: ConstraintEvaluation = {
    action,
    decision: "BLOCK_CONSTITUTIONAL_CONFLICT",
    appliedConstraints: ["NOT_IN_MINIMAL_ALLOWED"],
    limitations: additionalLimitations,
    reason: `행동 "${action}"은(는) 최소 허용 집합에 포함되지 않아 차단됩니다.`,
  };
  logEntry(evaluation);
  return evaluation;
}

/**
 * 제약 시행 — evaluateConstraint 결과를 기반으로 boolean 허용 여부 반환
 */
export function enforceConstraint(
  action: string,
  computation: ComputationResult,
  additionalLimitations: string[] = []
): boolean {
  const result = evaluateConstraint(action, computation, additionalLimitations);
  return result.decision === "ALLOW" || result.decision === "ALLOW_WITH_LIMITATIONS";
}

/**
 * 감사 로그 기록
 */
function logEntry(evaluation: ConstraintEvaluation): void {
  constraintLog.push({ timestamp: Date.now(), evaluation });
}

/**
 * 제약 감사 로그 조회
 * @param limit 반환할 최대 항목 수
 */
export function getConstraintLog(limit?: number): ConstraintLogEntry[] {
  if (limit !== undefined) {
    return constraintLog.slice(-limit);
  }
  return [...constraintLog];
}

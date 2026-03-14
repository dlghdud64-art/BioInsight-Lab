/**
 * @module closure-readiness-gate
 * @description 종결 준비 게이트 — 10가지 필수 점검 항목을 평가하여
 * 터미널 종결이 가능한지 판단한다. 필수 항목 중 하나라도 실패하면 종결이 차단된다.
 */

/** 준비 상태 점검 항목 */
export interface ReadinessCheck {
  /** 점검 고유 ID */
  id: string;
  /** 점검 이름 */
  name: string;
  /** 필수 여부 — true이면 실패 시 종결 차단 */
  required: boolean;
  /** 통과 여부 */
  passed: boolean;
  /** 상세 설명 또는 실패 사유 */
  details: string;
}

/** 준비 상태 평가 결과 */
export interface ReadinessResult {
  /** 종결 준비 완료 여부 */
  ready: boolean;
  /** 준비 점수 (0~100) */
  score: number;
  /** 점검 항목 목록 */
  checks: ReadinessCheck[];
  /** 차단 사유 목록 */
  blockers: string[];
}

/** 외부에서 주입 가능한 점검 상태 */
export interface ReadinessInputs {
  /** 정규 통제 척추 완성 여부 */
  canonicalSpineComplete: boolean;
  /** 개정 불가 코어 등록 여부 */
  nonAmendableCoreRegistered: boolean;
  /** 모든 모호성 해결 여부 */
  allAmbiguitiesResolved: boolean;
  /** 갱신 루프 활성 여부 */
  renewalLoopActive: boolean;
  /** 개정 프로토콜 활성 여부 */
  amendmentProtocolActive: boolean;
  /** 목적 잠금 활성 여부 */
  purposeLockActive: boolean;
  /** 의무 원장 완성 여부 */
  obligationLedgerComplete: boolean;
  /** 터미널 감사 통과 여부 */
  terminalAuditPassing: boolean;
  /** 재창설 트리거 무장 여부 */
  refoundationTriggerArmed: boolean;
  /** 종결 대시보드 라이브 여부 */
  closureDashboardLive: boolean;
}

/** 10개 점검 항목 정의 */
const CHECK_DEFINITIONS: Array<{
  id: string;
  name: string;
  required: boolean;
  inputKey: keyof ReadinessInputs;
  failureDetail: string;
}> = [
  {
    id: "RG-001",
    name: "정규 통제 척추 완성",
    required: true,
    inputKey: "canonicalSpineComplete",
    failureDetail: "정규 통제 척추가 완성되지 않음",
  },
  {
    id: "RG-002",
    name: "개정 불가 코어 등록",
    required: true,
    inputKey: "nonAmendableCoreRegistered",
    failureDetail: "개정 불가 코어 원칙이 등록되지 않음",
  },
  {
    id: "RG-003",
    name: "모든 모호성 해결",
    required: true,
    inputKey: "allAmbiguitiesResolved",
    failureDetail: "미해결 모호성이 남아 있음",
  },
  {
    id: "RG-004",
    name: "갱신 루프 활성",
    required: true,
    inputKey: "renewalLoopActive",
    failureDetail: "영구 갱신 루프가 비활성 상태",
  },
  {
    id: "RG-005",
    name: "개정 프로토콜 활성",
    required: true,
    inputKey: "amendmentProtocolActive",
    failureDetail: "9단계 개정 프로토콜이 비활성 상태",
  },
  {
    id: "RG-006",
    name: "목적 잠금 활성",
    required: true,
    inputKey: "purposeLockActive",
    failureDetail: "목적 연속성 잠금이 비활성 상태",
  },
  {
    id: "RG-007",
    name: "의무 원장 완성",
    required: true,
    inputKey: "obligationLedgerComplete",
    failureDetail: "최종 의무 원장이 완성되지 않음",
  },
  {
    id: "RG-008",
    name: "터미널 감사 통과",
    required: true,
    inputKey: "terminalAuditPassing",
    failureDetail: "터미널 감사를 통과하지 못함",
  },
  {
    id: "RG-009",
    name: "재창설 트리거 무장",
    required: true,
    inputKey: "refoundationTriggerArmed",
    failureDetail: "재창설 트리거가 무장되지 않음",
  },
  {
    id: "RG-010",
    name: "종결 대시보드 라이브",
    required: true,
    inputKey: "closureDashboardLive",
    failureDetail: "종결 대시보드가 라이브 상태가 아님",
  },
];

/**
 * 종결 준비 상태를 평가한다.
 * 10가지 점검 항목을 검사하여 종결 가능 여부, 점수, 차단 사유를 반환한다.
 * 필수(required) 항목 중 하나라도 실패하면 종결이 차단된다.
 * @param inputs - 각 점검 항목의 상태 입력
 * @returns 준비 상태 평가 결과
 */
export function evaluateClosureReadiness(
  inputs: ReadinessInputs
): ReadinessResult {
  const checks: ReadinessCheck[] = CHECK_DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    required: def.required,
    passed: inputs[def.inputKey],
    details: inputs[def.inputKey] ? "통과" : def.failureDetail,
  }));

  const blockers = checks
    .filter((c) => c.required && !c.passed)
    .map((c) => `[${c.id}] ${c.name}: ${c.details}`);

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    ready: blockers.length === 0,
    score,
    checks,
    blockers,
  };
}

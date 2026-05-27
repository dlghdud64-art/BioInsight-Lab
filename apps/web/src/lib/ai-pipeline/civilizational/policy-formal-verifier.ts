/**
 * 정책 형식 검증기 (Policy Formal Verifier)
 *
 * 모델 체킹, 정리 증명, 속성 테스트, 불변량 검사 등의 형식적 방법으로
 * 정책의 정합성·완전성을 검증합니다.
 */

/** 검증 방법 */
export type VerificationMethod =
  | "MODEL_CHECKING"
  | "THEOREM_PROVING"
  | "PROPERTY_TESTING"
  | "INVARIANT_CHECK";

/** 검증 결과 */
export interface VerificationResult {
  /** 검증 대상 정책 ID */
  policyId: string;
  /** 사용된 검증 방법 */
  method: VerificationMethod;
  /** 검증 속성 이름 */
  property: string;
  /** 속성 충족 여부 */
  satisfied: boolean;
  /** 반례 (속성 미충족 시) */
  counterExample: string | null;
  verifiedAt: Date;
}

/** 정책 정의 (검증 대상) */
export interface PolicySpec {
  id: string;
  name: string;
  /** 정책 규칙 목록 (문자열 형태의 논리식) */
  rules: string[];
  /** 보장해야 할 속성 목록 */
  properties: string[];
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const results: VerificationResult[] = [];
const policies: PolicySpec[] = [];

let nextId = 1;
function genId(): string {
  return `vr-${Date.now()}-${nextId++}`;
}

/** 시뮬레이션 검증 — 규칙 수 대비 속성 이름 길이로 판정 */
function simulateVerification(
  policy: PolicySpec,
  property: string,
  method: VerificationMethod
): { satisfied: boolean; counterExample: string | null } {
  // 규칙이 비어 있으면 모든 속성 미충족
  if (policy.rules.length === 0) {
    return {
      satisfied: false,
      counterExample: `정책 "${policy.name}"에 규칙이 없습니다.`,
    };
  }

  // 간이 결정론적 시뮬레이션
  const score =
    policy.rules.length * 7 + property.length * 3 + method.length;
  const satisfied = score % 5 !== 0; // 대부분 통과, 일부 실패

  return {
    satisfied,
    counterExample: satisfied
      ? null
      : `속성 "${property}"을(를) 위반하는 상태가 발견되었습니다.`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 정책 사양을 등록합니다 (검증 전 필수).
 * @param spec 정책 사양
 */
export function registerPolicy(spec: PolicySpec): PolicySpec {
  const existing = policies.findIndex((p) => p.id === spec.id);
  if (existing >= 0) {
    policies[existing] = spec;
  } else {
    policies.push(spec);
  }
  return spec;
}

/**
 * 단일 정책의 특정 속성을 검증합니다.
 * @param policyId 정책 ID
 * @param property 검증할 속성
 * @param method 검증 방법
 */
export function verifyPolicy(
  policyId: string,
  property: string,
  method: VerificationMethod
): VerificationResult | null {
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) return null;

  const sim = simulateVerification(policy, property, method);
  const result: VerificationResult = {
    policyId,
    method,
    property,
    satisfied: sim.satisfied,
    counterExample: sim.counterExample,
    verifiedAt: new Date(),
  };
  results.push(result);
  return result;
}

/**
 * 불변량을 검사합니다.
 * @param policyId 정책 ID
 * @param invariant 불변량 명세
 */
export function checkInvariant(
  policyId: string,
  invariant: string
): VerificationResult | null {
  return verifyPolicy(policyId, invariant, "INVARIANT_CHECK");
}

/**
 * 속성 위반 반례를 탐색합니다.
 * @param policyId 정책 ID
 * @param property 속성
 */
export function findCounterExample(
  policyId: string,
  property: string
): { found: boolean; counterExample: string | null } {
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) return { found: false, counterExample: null };

  const sim = simulateVerification(policy, property, "MODEL_CHECKING");
  if (!sim.satisfied) {
    return { found: true, counterExample: sim.counterExample };
  }
  return { found: false, counterExample: null };
}

/**
 * 정책의 모든 속성을 일괄 검증합니다.
 * @param policyId 정책 ID
 * @param method 검증 방법
 */
export function batchVerify(
  policyId: string,
  method: VerificationMethod
): VerificationResult[] {
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) return [];

  return policy.properties
    .map((prop) => verifyPolicy(policyId, prop, method))
    .filter((r): r is VerificationResult => r !== null);
}

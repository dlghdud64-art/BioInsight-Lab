/**
 * 집단 헌법 연산 (Collective Constitutional Computation)
 *
 * 다수 네트워크의 헌법적 프로필로부터 최소(가장 제한적) 허용 집합을 계산.
 * 결과는 항상 교집합(INTERSECTION)이며, 절대 합집합(UNION)이 아니다.
 * 해결 불가 충돌 → requiresHumanGovernance = true
 */

/** 네트워크별 헌법 프로필 */
export interface ConstitutionalProfile {
  /** 네트워크 식별자 */
  networkId: string;
  /** 허용된 행동 목록 */
  allowedActions: string[];
  /** 차단된 행동 목록 */
  blockedActions: string[];
  /** 한계 목록 */
  limitations: string[];
  /** 관할권 목록 */
  jurisdictions: string[];
}

/** 헌법 연산 결과 */
export interface ComputationResult {
  /** 최소(가장 제한적) 허용 행동 집합 */
  effectiveMinimalAllowed: string[];
  /** 차단된 행동 합집합 */
  blockedActionSet: string[];
  /** 해결 불가 충돌 목록 */
  unresolvableConflicts: string[];
  /** 인간 거버넌스 필요 여부 */
  requiresHumanGovernance: boolean;
}

/**
 * 최소 헌법 연산 — 교집합 기반
 *
 * 정책 충돌 시 결과는 항상 가장 제한적 제약으로 수렴한다.
 * 해결 불가능한 충돌은 인간 거버넌스로 에스컬레이션된다.
 *
 * @param profiles 참여 네트워크 헌법 프로필 배열
 * @returns 연산 결과
 */
export function computeMinimalConstitution(
  profiles: ConstitutionalProfile[]
): ComputationResult {
  if (profiles.length === 0) {
    return {
      effectiveMinimalAllowed: [],
      blockedActionSet: [],
      unresolvableConflicts: [],
      requiresHumanGovernance: false,
    };
  }

  // 1) 차단 행동 합집합 (어떤 네트워크든 차단하면 전체 차단)
  const blockedActionSet = new Set<string>();
  for (const profile of profiles) {
    for (const action of profile.blockedActions) {
      blockedActionSet.add(action);
    }
  }

  // 2) 허용 행동 교집합 (모든 네트워크가 허용해야 허용)
  let allowedIntersection = new Set<string>(profiles[0].allowedActions);
  for (let i = 1; i < profiles.length; i++) {
    const currentAllowed = new Set(profiles[i].allowedActions);
    allowedIntersection = new Set(
      [...allowedIntersection].filter((a) => currentAllowed.has(a))
    );
  }

  // 3) 차단 목록에 포함된 항목은 허용 교집합에서 제거
  const effectiveMinimalAllowed = [...allowedIntersection].filter(
    (a) => !blockedActionSet.has(a)
  );

  // 4) 충돌 감지: 어떤 네트워크에서 허용인데 다른 네트워크에서 차단인 행동
  const unresolvableConflicts: string[] = [];
  for (const profile of profiles) {
    for (const action of profile.allowedActions) {
      if (blockedActionSet.has(action)) {
        // 다른 네트워크가 차단 → 충돌
        const blockingNetworks = profiles
          .filter((p) => p.blockedActions.includes(action))
          .map((p) => p.networkId);
        if (blockingNetworks.length > 0 && !unresolvableConflicts.includes(action)) {
          unresolvableConflicts.push(action);
        }
      }
    }
  }

  return {
    effectiveMinimalAllowed,
    blockedActionSet: [...blockedActionSet],
    unresolvableConflicts,
    requiresHumanGovernance: unresolvableConflicts.length > 0,
  };
}

/**
 * @module sovereign-control-plane
 * @description 주권 통제 플레인 — 주권 관련 액션에 대한 정책 평가, 결정, 오버라이드 관리
 */

/** 주권 관련 액션 유형 */
export type SovereignAction =
  | 'DATA_EXPORT'
  | 'CROSS_BORDER_TRANSFER'
  | 'MODEL_DEPLOYMENT'
  | 'POLICY_OVERRIDE'
  | 'AUDIT_ACCESS';

/** 주권 정책 */
export interface SovereignPolicy {
  /** 정책 ID */
  id: string;
  /** 관할권 ID */
  jurisdictionId: string;
  /** 대상 액션 */
  action: SovereignAction;
  /** 허용 여부 기본값 */
  defaultPermitted: boolean;
  /** 조건 목록 */
  conditions: string[];
}

/** 주권 결정 기록 */
export interface SovereignDecision {
  /** 결정 고유 ID */
  actionId: string;
  /** 액션 유형 */
  action: SovereignAction;
  /** 테넌트 ID */
  tenantId: string;
  /** 관할권 ID */
  jurisdictionId: string;
  /** 허용 여부 */
  permitted: boolean;
  /** 결정 사유 */
  reason: string;
  /** 결정 시각 */
  decidedAt: Date;
}

/** 인메모리 정책 저장소 */
const policyStore: SovereignPolicy[] = [];

/** 인메모리 결정 로그 */
const decisionLog: SovereignDecision[] = [];

let decisionCounter = 0;

/**
 * 주권 액션을 평가하여 허용 여부를 결정한다.
 * @param action 액션 유형
 * @param tenantId 테넌트 ID
 * @param jurisdictionId 관할권 ID
 * @returns 주권 결정
 */
export function evaluateSovereignAction(
  action: SovereignAction,
  tenantId: string,
  jurisdictionId: string,
): SovereignDecision {
  const policy = policyStore.find(
    (p) => p.jurisdictionId === jurisdictionId && p.action === action,
  );

  const decision: SovereignDecision = {
    actionId: `sd-${++decisionCounter}`,
    action,
    tenantId,
    jurisdictionId,
    permitted: policy ? policy.defaultPermitted : false,
    reason: policy
      ? `정책 ${policy.id}에 의한 결정`
      : '해당 관할권에 대한 정책이 없습니다',
    decidedAt: new Date(),
  };

  decisionLog.push(decision);
  return decision;
}

/**
 * 관할권과 액션에 해당하는 정책을 조회한다.
 * @param jurisdictionId 관할권 ID
 * @param action 액션 유형
 * @returns 정책 또는 undefined
 */
export function getSovereignPolicy(
  jurisdictionId: string,
  action: SovereignAction,
): SovereignPolicy | undefined {
  return policyStore.find(
    (p) => p.jurisdictionId === jurisdictionId && p.action === action,
  );
}

/**
 * 주권 정책을 추가하거나 덮어쓴다.
 * @param policy 정책 정보
 * @returns 저장된 정책
 */
export function overrideSovereignPolicy(policy: SovereignPolicy): SovereignPolicy {
  const idx = policyStore.findIndex((p) => p.id === policy.id);
  if (idx !== -1) {
    policyStore[idx] = policy;
  } else {
    policyStore.push(policy);
  }
  return policy;
}

/**
 * 결정 로그를 조회한다.
 * @param filter 필터 조건 (선택)
 * @returns 결정 로그 배열
 */
export function getDecisionLog(filter?: {
  tenantId?: string;
  jurisdictionId?: string;
  action?: SovereignAction;
}): SovereignDecision[] {
  if (!filter) return [...decisionLog];

  return decisionLog.filter((d) => {
    if (filter.tenantId && d.tenantId !== filter.tenantId) return false;
    if (filter.jurisdictionId && d.jurisdictionId !== filter.jurisdictionId) return false;
    if (filter.action && d.action !== filter.action) return false;
    return true;
  });
}

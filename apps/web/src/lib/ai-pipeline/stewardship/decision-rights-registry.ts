/**
 * @module decision-rights-registry
 * @description 의사결정 권한 레지스트리 — 조직 내 의사결정 권한의 등록, 위임, 철회 및 검증을 관리합니다.
 */

/** 의사결정 도메인 */
export type DecisionDomain =
  | 'STRATEGIC'
  | 'OPERATIONAL'
  | 'TECHNICAL'
  | 'COMPLIANCE'
  | 'FINANCIAL';

/** 의사결정 권한 제약 조건 */
export interface DecisionConstraint {
  /** 제약 조건 유형 */
  type: string;
  /** 제약 조건 설명 */
  description: string;
  /** 제약 조건 값 */
  value: string | number | boolean;
}

/** 의사결정 권한 */
export interface DecisionRight {
  /** 고유 식별자 */
  id: string;
  /** 의사결정 도메인 */
  domain: DecisionDomain;
  /** 권한 보유자 */
  authority: string;
  /** 위임 대상 */
  delegatedTo: string | null;
  /** 권한 범위 */
  scope: string;
  /** 제약 조건 목록 */
  constraints: DecisionConstraint[];
  /** 권한 부여 일시 */
  grantedAt: Date;
  /** 권한 만료 일시 */
  expiresAt: Date | null;
  /** 활성 여부 */
  active: boolean;
}

/** 인메모리 권한 저장소 */
const rightsStore: DecisionRight[] = [];

/**
 * 새로운 의사결정 권한을 등록합니다.
 * @param right - 등록할 권한 정보 (id, grantedAt, active 자동 생성)
 * @returns 등록된 의사결정 권한
 */
export function registerRight(
  right: Omit<DecisionRight, 'id' | 'grantedAt' | 'active'>
): DecisionRight {
  const newRight: DecisionRight = {
    ...right,
    id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    grantedAt: new Date(),
    active: true,
  };
  rightsStore.push(newRight);
  return newRight;
}

/**
 * 의사결정 권한을 다른 사용자에게 위임합니다.
 * @param rightId - 위임할 권한 ID
 * @param delegateTo - 위임 대상
 * @returns 업데이트된 권한 또는 null
 */
export function delegateRight(
  rightId: string,
  delegateTo: string
): DecisionRight | null {
  const right = rightsStore.find((r) => r.id === rightId && r.active);
  if (!right) return null;
  right.delegatedTo = delegateTo;
  return { ...right };
}

/**
 * 의사결정 권한을 철회합니다.
 * @param rightId - 철회할 권한 ID
 * @returns 철회 성공 여부
 */
export function revokeRight(rightId: string): boolean {
  const right = rightsStore.find((r) => r.id === rightId);
  if (!right) return false;
  right.active = false;
  right.delegatedTo = null;
  return true;
}

/**
 * 현재 활성화된 모든 권한을 조회합니다.
 * @param domain - 선택적 도메인 필터
 * @returns 활성 권한 목록
 */
export function getActiveRights(domain?: DecisionDomain): DecisionRight[] {
  const now = new Date();
  return rightsStore.filter((r) => {
    if (!r.active) return false;
    if (r.expiresAt && r.expiresAt < now) return false;
    if (domain && r.domain !== domain) return false;
    return true;
  });
}

/**
 * 특정 사용자의 권한을 검증합니다.
 * @param authority - 검증할 사용자
 * @param domain - 의사결정 도메인
 * @param scope - 권한 범위
 * @returns 검증 결과
 */
export function validateAuthority(
  authority: string,
  domain: DecisionDomain,
  scope: string
): { valid: boolean; rights: DecisionRight[]; reason: string } {
  const activeRights = getActiveRights(domain);
  const matchingRights = activeRights.filter(
    (r) =>
      (r.authority === authority || r.delegatedTo === authority) &&
      r.scope === scope
  );

  if (matchingRights.length === 0) {
    return {
      valid: false,
      rights: [],
      reason: `'${authority}'에게 '${domain}' 도메인의 '${scope}' 범위 권한이 없습니다.`,
    };
  }

  return {
    valid: true,
    rights: matchingRights.map((r) => ({ ...r })),
    reason: `${matchingRights.length}개의 유효한 권한이 확인되었습니다.`,
  };
}

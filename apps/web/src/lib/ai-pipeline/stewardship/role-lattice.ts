/**
 * @module role-lattice
 * @description 역할 격자 구조 — 조직 내 역할의 계층적 구조, 역량 매트릭스, 보고 체계를 관리합니다.
 */

/** 역할 수준 */
export type RoleLevel =
  | 'EXECUTIVE'
  | 'DIRECTOR'
  | 'MANAGER'
  | 'OPERATOR'
  | 'OBSERVER';

/** 역할 노드 */
export interface RoleNode {
  /** 역할 고유 식별자 */
  roleId: string;
  /** 역할 수준 */
  level: RoleLevel;
  /** 역할 제목 */
  title: string;
  /** 책임 목록 */
  responsibilities: string[];
  /** 상위 역할 ID 목록 */
  parentRoles: string[];
  /** 하위 역할 ID 목록 */
  childRoles: string[];
  /** 필요 역량 목록 */
  competencies: string[];
}

/** 역할 할당 정보 */
export interface RoleAssignment {
  /** 역할 ID */
  roleId: string;
  /** 할당된 사용자 */
  assignee: string;
  /** 할당 일시 */
  assignedAt: Date;
  /** 활성 여부 */
  active: boolean;
}

/** 인메모리 역할 저장소 */
const roleStore: RoleNode[] = [];
/** 인메모리 할당 저장소 */
const assignmentStore: RoleAssignment[] = [];

/** 역할 수준 순서 매핑 */
const levelOrder: Record<RoleLevel, number> = {
  EXECUTIVE: 0,
  DIRECTOR: 1,
  MANAGER: 2,
  OPERATOR: 3,
  OBSERVER: 4,
};

/**
 * 새로운 역할을 정의합니다.
 * @param role - 역할 정의 정보
 * @returns 정의된 역할 노드
 */
export function defineRole(role: RoleNode): RoleNode {
  const existing = roleStore.findIndex((r) => r.roleId === role.roleId);
  if (existing >= 0) {
    roleStore[existing] = { ...role };
  } else {
    roleStore.push({ ...role });
  }
  return { ...role };
}

/**
 * 사용자에게 역할을 할당합니다.
 * @param roleId - 역할 ID
 * @param assignee - 할당 대상 사용자
 * @returns 역할 할당 정보 또는 null
 */
export function assignRole(
  roleId: string,
  assignee: string
): RoleAssignment | null {
  const role = roleStore.find((r) => r.roleId === roleId);
  if (!role) return null;

  const assignment: RoleAssignment = {
    roleId,
    assignee,
    assignedAt: new Date(),
    active: true,
  };
  assignmentStore.push(assignment);
  return { ...assignment };
}

/**
 * 특정 역할의 보고 체계(상위 역할 체인)를 조회합니다.
 * @param roleId - 시작 역할 ID
 * @returns 보고 체계 역할 목록 (하위 → 상위 순)
 */
export function getReportingChain(roleId: string): RoleNode[] {
  const chain: RoleNode[] = [];
  const visited = new Set<string>();

  function traverse(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const role = roleStore.find((r) => r.roleId === id);
    if (!role) return;
    chain.push({ ...role });
    for (const parentId of role.parentRoles) {
      traverse(parentId);
    }
  }

  traverse(roleId);
  return chain;
}

/**
 * 전체 역량 매트릭스를 생성합니다.
 * @returns 역할별 역량 매핑
 */
export function getCapabilityMatrix(): Array<{
  roleId: string;
  title: string;
  level: RoleLevel;
  competencies: string[];
  responsibilities: string[];
}> {
  return roleStore.map((r) => ({
    roleId: r.roleId,
    title: r.title,
    level: r.level,
    competencies: [...r.competencies],
    responsibilities: [...r.responsibilities],
  }));
}

/**
 * 두 역할 간의 호환성을 검증합니다.
 * @param roleIdA - 첫 번째 역할 ID
 * @param roleIdB - 두 번째 역할 ID
 * @returns 호환성 검증 결과
 */
export function validateRoleCompatibility(
  roleIdA: string,
  roleIdB: string
): {
  compatible: boolean;
  levelGap: number;
  sharedCompetencies: string[];
  reason: string;
} {
  const roleA = roleStore.find((r) => r.roleId === roleIdA);
  const roleB = roleStore.find((r) => r.roleId === roleIdB);

  if (!roleA || !roleB) {
    return {
      compatible: false,
      levelGap: -1,
      sharedCompetencies: [],
      reason: '하나 이상의 역할을 찾을 수 없습니다.',
    };
  }

  const levelGap = Math.abs(levelOrder[roleA.level] - levelOrder[roleB.level]);
  const sharedCompetencies = roleA.competencies.filter((c) =>
    roleB.competencies.includes(c)
  );

  const compatible = levelGap <= 1 && sharedCompetencies.length > 0;

  return {
    compatible,
    levelGap,
    sharedCompetencies,
    reason: compatible
      ? `역할 간 수준 차이(${levelGap})가 허용 범위이며, ${sharedCompetencies.length}개의 공통 역량이 있습니다.`
      : `역할 간 수준 차이(${levelGap})가 크거나 공통 역량이 없습니다.`,
  };
}

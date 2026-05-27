/**
 * @module federated-policy-boundary
 * @description 연합 정책 경계 관리
 *
 * 조직 간 정책 경계를 정의하고, 정책 동기화 방향을 설정하여
 * 연합 네트워크 내 일관된 정책 적용을 보장한다.
 */

/** 동기화 방향 */
export type SyncDirection = "PUSH" | "PULL" | "BIDIRECTIONAL";

/** 정책 항목 */
export interface PolicyItem {
  policyId: string;
  name: string;
  version: string;
  rules: Record<string, unknown>;
}

/** 정책 경계 */
export interface PolicyBoundary {
  id: string;
  scope: string;
  ownerId: string;
  sharedWith: string[];
  policies: PolicyItem[];
  version: number;
  lastSyncedAt: Date;
}

/** 정책 경계 정의 요청 */
export interface DefineBoundaryInput {
  scope: string;
  ownerId: string;
  sharedWith?: string[];
  policies?: PolicyItem[];
}

/** 정책 동기화 요청 */
export interface SyncPoliciesInput {
  boundaryId: string;
  targetPartnerId: string;
  direction: SyncDirection;
}

/** 정책 호환성 검사 결과 */
export interface CompatibilityResult {
  compatible: boolean;
  conflicts: string[];
  checkedAt: Date;
}

/** 정책 동기화 결과 */
export interface SyncResult {
  boundaryId: string;
  targetPartnerId: string;
  direction: SyncDirection;
  policiesSynced: number;
  syncedAt: Date;
}

/** 인메모리 정책 경계 저장소 */
const boundaryStore: PolicyBoundary[] = [];

/** 고유 ID 생성 */
let boundarySeq = 0;
function nextBoundaryId(): string {
  boundarySeq += 1;
  return `boundary-${boundarySeq}`;
}

/**
 * 정책 경계를 정의한다.
 * @param input 경계 정의 정보
 * @returns 생성된 정책 경계
 */
export function defineBoundary(input: DefineBoundaryInput): PolicyBoundary {
  const boundary: PolicyBoundary = {
    id: nextBoundaryId(),
    scope: input.scope,
    ownerId: input.ownerId,
    sharedWith: input.sharedWith ?? [],
    policies: input.policies ?? [],
    version: 1,
    lastSyncedAt: new Date(),
  };

  boundaryStore.push(boundary);
  return boundary;
}

/**
 * 정책을 파트너와 동기화한다.
 * @param input 동기화 요청 정보
 * @returns 동기화 결과
 * @throws 경계를 찾을 수 없는 경우
 */
export function syncPolicies(input: SyncPoliciesInput): SyncResult {
  const boundary = boundaryStore.find((b) => b.id === input.boundaryId);
  if (!boundary) {
    throw new Error(`정책 경계 '${input.boundaryId}'을(를) 찾을 수 없습니다.`);
  }

  if (!boundary.sharedWith.includes(input.targetPartnerId)) {
    boundary.sharedWith.push(input.targetPartnerId);
  }

  boundary.version += 1;
  boundary.lastSyncedAt = new Date();

  return {
    boundaryId: boundary.id,
    targetPartnerId: input.targetPartnerId,
    direction: input.direction,
    policiesSynced: boundary.policies.length,
    syncedAt: boundary.lastSyncedAt,
  };
}

/**
 * 두 경계의 정책 호환성을 검사한다.
 * @param boundaryIdA 첫 번째 경계 ID
 * @param boundaryIdB 두 번째 경계 ID
 * @returns 호환성 검사 결과
 */
export function checkPolicyCompatibility(
  boundaryIdA: string,
  boundaryIdB: string,
): CompatibilityResult {
  const boundaryA = boundaryStore.find((b) => b.id === boundaryIdA);
  const boundaryB = boundaryStore.find((b) => b.id === boundaryIdB);
  const conflicts: string[] = [];

  if (!boundaryA) {
    conflicts.push(`경계 '${boundaryIdA}'을(를) 찾을 수 없습니다.`);
  }
  if (!boundaryB) {
    conflicts.push(`경계 '${boundaryIdB}'을(를) 찾을 수 없습니다.`);
  }

  if (boundaryA && boundaryB) {
    const policyIdsA = new Set(boundaryA.policies.map((p) => p.policyId));
    const policyIdsB = new Set(boundaryB.policies.map((p) => p.policyId));

    for (const policyA of boundaryA.policies) {
      if (policyIdsB.has(policyA.policyId)) {
        const policyB = boundaryB.policies.find(
          (p) => p.policyId === policyA.policyId,
        );
        if (policyB && policyA.version !== policyB.version) {
          conflicts.push(
            `정책 '${policyA.policyId}' 버전 불일치: ${policyA.version} vs ${policyB.version}`,
          );
        }
      }
    }
  }

  return {
    compatible: conflicts.length === 0,
    conflicts,
    checkedAt: new Date(),
  };
}

/**
 * 특정 파트너에게 공유된 정책 경계 목록을 반환한다.
 * @param partnerId 조회할 파트너 ID
 * @returns 공유된 정책 경계 배열
 */
export function getSharedPolicies(partnerId: string): PolicyBoundary[] {
  return boundaryStore.filter((b) => b.sharedWith.includes(partnerId));
}

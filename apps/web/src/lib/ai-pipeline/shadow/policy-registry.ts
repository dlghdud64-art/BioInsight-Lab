/**
 * Policy Registry - 중앙 정책 버전 레지스트리
 *
 * 정책의 등록, 수정, 조회 및 버전 이력 관리를 담당합니다.
 * 모든 변경 사항은 감사 추적(audit trail)에 기록됩니다.
 */

// --- 타입 정의 ---

/** 정책 적용 범위 유형 */
export type ScopeType = "global" | "docType" | "vendorCluster";

/** 정책 배포 모드 */
export type RolloutMode = "shadow" | "canary" | "active";

/** 정책 승인 상태 */
export type ApprovalStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVERTED";

/** 감사 추적 항목 */
export interface AuditTrailEntry {
  /** 변경 시각 */
  timestamp: Date;
  /** 변경 유형 (등록/수정/승인/거부/되돌림) */
  action: string;
  /** 변경 수행자 */
  changedBy: string;
  /** 변경 전 값 (최초 등록 시 null) */
  previousValues: Record<string, unknown> | null;
  /** 변경 후 값 */
  newValues: Record<string, unknown>;
}

/** 정책 엔트리 */
export interface PolicyEntry {
  /** 정책 고유 식별자 */
  policyId: string;
  /** 적용 범위 유형 */
  scopeType: ScopeType;
  /** 정책 버전 (semantic versioning) */
  version: string;
  /** 배포 모드 */
  rolloutMode: RolloutMode;
  /** 승인 상태 */
  approvalStatus: ApprovalStatus;
  /** 현재 정책 값 */
  currentValues: Record<string, unknown>;
  /** 이전 버전 ID (최초 버전이면 null) */
  previousVersion: string | null;
  /** 마지막 변경 수행자 */
  changedBy: string;
  /** 마지막 변경 시각 */
  changedAt: Date;
  /** 감사 추적 이력 */
  auditTrail: AuditTrailEntry[];
}

// --- 인메모리 저장소 (production: DB-backed) ---
const policyStore = new Map<string, PolicyEntry>();

// --- CRUD 함수 ---

/**
 * 새 정책을 등록합니다.
 * @param entry 등록할 정책 엔트리
 * @returns 등록된 정책 엔트리
 * @throws 이미 동일한 policyId가 존재하면 에러
 */
export function registerPolicy(entry: PolicyEntry): PolicyEntry {
  if (policyStore.has(entry.policyId)) {
    throw new Error(`정책 ID '${entry.policyId}'가 이미 존재합니다.`);
  }

  // 최초 등록 감사 추적 기록
  const auditEntry: AuditTrailEntry = {
    timestamp: new Date(),
    action: "REGISTER",
    changedBy: entry.changedBy,
    previousValues: null,
    newValues: { ...entry.currentValues },
  };

  const policyWithAudit: PolicyEntry = {
    ...entry,
    changedAt: new Date(),
    auditTrail: [auditEntry],
  };

  policyStore.set(entry.policyId, policyWithAudit);
  return policyWithAudit;
}

/**
 * 기존 정책을 수정합니다.
 * @param policyId 수정할 정책 ID
 * @param updates 변경할 필드들
 * @param changedBy 변경 수행자
 * @returns 수정된 정책 엔트리
 * @throws 정책 ID가 존재하지 않으면 에러
 */
export function updatePolicy(
  policyId: string,
  updates: Partial<
    Pick<
      PolicyEntry,
      | "scopeType"
      | "version"
      | "rolloutMode"
      | "approvalStatus"
      | "currentValues"
      | "previousVersion"
    >
  >,
  changedBy: string
): PolicyEntry {
  const existing = policyStore.get(policyId);
  if (!existing) {
    throw new Error(`정책 ID '${policyId}'를 찾을 수 없습니다.`);
  }

  // 감사 추적 기록 추가
  const auditEntry: AuditTrailEntry = {
    timestamp: new Date(),
    action: "UPDATE",
    changedBy,
    previousValues: { ...existing.currentValues },
    newValues: updates.currentValues
      ? { ...updates.currentValues }
      : { ...existing.currentValues },
  };

  const updated: PolicyEntry = {
    ...existing,
    ...updates,
    changedBy,
    changedAt: new Date(),
    auditTrail: [...existing.auditTrail, auditEntry],
  };

  policyStore.set(policyId, updated);
  return updated;
}

/**
 * 정책 ID로 정책을 조회합니다.
 * @param policyId 조회할 정책 ID
 * @returns 정책 엔트리 또는 undefined
 */
export function getPolicyById(policyId: string): PolicyEntry | undefined {
  return policyStore.get(policyId);
}

/**
 * 특정 범위 유형에 해당하는 모든 정책을 조회합니다.
 * @param scopeType 조회할 범위 유형
 * @returns 해당 범위의 정책 목록
 */
export function getPoliciesByScope(scopeType: ScopeType): PolicyEntry[] {
  const results: PolicyEntry[] = [];
  for (const entry of policyStore.values()) {
    if (entry.scopeType === scopeType) {
      results.push(entry);
    }
  }
  return results;
}

/**
 * 현재 활성 상태(APPROVED + active)인 모든 정책을 조회합니다.
 * @returns 활성 정책 목록
 */
export function getActivePolicies(): PolicyEntry[] {
  const results: PolicyEntry[] = [];
  for (const entry of policyStore.values()) {
    if (
      entry.approvalStatus === "APPROVED" &&
      entry.rolloutMode === "active"
    ) {
      results.push(entry);
    }
  }
  return results;
}

/**
 * 정책의 버전 이력 체인을 반환합니다.
 * previousVersion 링크를 따라가며 전체 이력을 구성합니다.
 * @param policyId 조회할 정책 ID
 * @returns 버전 체인 (최신 -> 과거 순서)
 */
export function getPolicyHistory(policyId: string): PolicyEntry[] {
  const history: PolicyEntry[] = [];
  let currentId: string | null = policyId;

  while (currentId) {
    const entry = policyStore.get(currentId);
    if (!entry) break;
    history.push(entry);
    currentId = entry.previousVersion;
  }

  return history;
}

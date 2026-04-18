/**
 * @module interinstitutional-registry
 * @description 연합 멤버 중앙 레지스트리
 *
 * 연합에 가입한 기관들의 상태·범위·이력을 관리하는 중앙 레지스트리.
 * 정지·제명 이력을 추적하며, 모든 범위 변경에 대한 사유를 기록한다.
 */

/** 기관 상태 */
export type MemberStatus =
  | 'ACTIVE'
  | 'PROBATIONARY'
  | 'SUSPENDED'
  | 'EXPELLED'
  | 'PENDING_ADMISSION';

/** 승인된 접근 범위 */
export type ApprovedScope =
  | 'FULL'
  | 'LIMITED_READ'
  | 'EVIDENCE_ONLY'
  | 'OBSERVER';

/** 정지 이력 항목 */
export interface SuspensionRecord {
  /** 이전 상태 */
  previousStatus: MemberStatus;
  /** 이전 범위 */
  previousScope: ApprovedScope;
  /** 정지 사유 */
  reason: string;
  /** 정지 일시 */
  suspendedAt: Date;
  /** 복원 일시 (null이면 현재 정지 중) */
  restoredAt: Date | null;
}

/** 기관 등록 엔트리 */
export interface InstitutionEntry {
  /** 기관 고유 ID */
  id: string;
  /** 기관 명칭 */
  name: string;
  /** 현재 상태 */
  status: MemberStatus;
  /** 성숙도 지수 (0–100) */
  maturityIndex: number;
  /** 승인된 접근 범위 */
  approvedScope: ApprovedScope;
  /** 보증 수준 (1–4) */
  assuranceLevel: number;
  /** 가입 일시 */
  joinedAt: Date;
  /** 마지막 감사 일시 */
  lastAuditAt: Date | null;
  /** 정지 이력 */
  suspensionHistory: SuspensionRecord[];
}

// ── 인메모리 저장소 ──
const registry: InstitutionEntry[] = [];

/**
 * 새 기관을 연합에 등록한다.
 * @param params 등록 파라미터
 * @returns 등록된 기관 엔트리
 */
export function registerInstitution(params: {
  id: string;
  name: string;
  maturityIndex: number;
  approvedScope: ApprovedScope;
  assuranceLevel: number;
}): InstitutionEntry {
  const existing = registry.find((e) => e.id === params.id);
  if (existing) {
    throw new Error(`이미 등록된 기관: ${params.id}`);
  }

  const entry: InstitutionEntry = {
    id: params.id,
    name: params.name,
    status: 'PENDING_ADMISSION',
    maturityIndex: params.maturityIndex,
    approvedScope: params.approvedScope,
    assuranceLevel: params.assuranceLevel,
    joinedAt: new Date(),
    lastAuditAt: null,
    suspensionHistory: [],
  };
  registry.push(entry);
  return { ...entry, suspensionHistory: [...entry.suspensionHistory] };
}

/**
 * 기관 상태를 갱신한다.
 * @param institutionId 기관 ID
 * @param newStatus 새 상태
 * @param reason 변경 사유
 */
export function updateStatus(
  institutionId: string,
  newStatus: MemberStatus,
  reason: string,
): InstitutionEntry {
  const entry = registry.find((e) => e.id === institutionId);
  if (!entry) {
    throw new Error(`등록되지 않은 기관: ${institutionId}`);
  }

  entry.status = newStatus;
  return { ...entry, suspensionHistory: [...entry.suspensionHistory] };
}

/**
 * 기관을 정지시키고 이력을 기록한다.
 * @param institutionId 기관 ID
 * @param reason 정지 사유
 */
export function suspendMember(
  institutionId: string,
  reason: string,
): InstitutionEntry {
  const entry = registry.find((e) => e.id === institutionId);
  if (!entry) {
    throw new Error(`등록되지 않은 기관: ${institutionId}`);
  }

  const record: SuspensionRecord = {
    previousStatus: entry.status,
    previousScope: entry.approvedScope,
    reason,
    suspendedAt: new Date(),
    restoredAt: null,
  };

  entry.suspensionHistory.push(record);
  entry.status = 'SUSPENDED';
  entry.approvedScope = 'OBSERVER';

  return { ...entry, suspensionHistory: [...entry.suspensionHistory] };
}

/**
 * 기관을 제명한다.
 * @param institutionId 기관 ID
 * @param reason 제명 사유
 */
export function expelMember(
  institutionId: string,
  reason: string,
): InstitutionEntry {
  const entry = registry.find((e) => e.id === institutionId);
  if (!entry) {
    throw new Error(`등록되지 않은 기관: ${institutionId}`);
  }

  const record: SuspensionRecord = {
    previousStatus: entry.status,
    previousScope: entry.approvedScope,
    reason: `제명: ${reason}`,
    suspendedAt: new Date(),
    restoredAt: null,
  };

  entry.suspensionHistory.push(record);
  entry.status = 'EXPELLED';
  entry.approvedScope = 'OBSERVER';

  return { ...entry, suspensionHistory: [...entry.suspensionHistory] };
}

/**
 * 활성 기관 목록을 반환한다.
 * @returns ACTIVE 상태 기관 배열
 */
export function listActiveMembers(): InstitutionEntry[] {
  return registry
    .filter((e) => e.status === 'ACTIVE')
    .map((e) => ({ ...e, suspensionHistory: [...e.suspensionHistory] }));
}

/**
 * 특정 기관 프로필을 반환한다.
 * @param institutionId 기관 ID
 */
export function getMemberProfile(institutionId: string): InstitutionEntry | null {
  const entry = registry.find((e) => e.id === institutionId);
  if (!entry) return null;
  return { ...entry, suspensionHistory: [...entry.suspensionHistory] };
}

/**
 * 전체 등록 기관 목록을 반환한다.
 */
export function listAllMembers(): InstitutionEntry[] {
  return registry.map((e) => ({ ...e, suspensionHistory: [...e.suspensionHistory] }));
}

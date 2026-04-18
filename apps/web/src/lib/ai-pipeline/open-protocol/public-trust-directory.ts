/**
 * @module public-trust-directory
 * @description 공개 신뢰 디렉토리
 *
 * 보증 생태계 참여자들의 공개 정보를 등록·조회·검색하는 디렉토리를 제공한다.
 * 적합성 검사 이력, 철회 상태, 공개 메트릭을 관리하며,
 * 부적합 참여자를 신고(flag)할 수 있다.
 */

/** 참여자 계층 */
export type DirectoryTier =
  | "OBSERVER"
  | "CONSUMER"
  | "VERIFIED_PARTICIPANT"
  | "ASSERTION_ISSUER"
  | "PROTOCOL_STEWARD";

/** 적합성 검사 기록 */
export interface ConformanceRecord {
  /** 검사 날짜 */
  checkDate: number;
  /** 통과 여부 */
  passed: boolean;
  /** 발견 사항 목록 */
  findings: string[];
}

/** 공개 메트릭 */
export interface PublicMetrics {
  /** 총 발행 수 */
  totalIssuances: number;
  /** 철회된 발행 수 */
  revokedIssuances: number;
  /** 수신된 이의 제기 수 */
  contestationsReceived: number;
  /** 인정된(upheld) 이의 제기 수 */
  contestationsUpheld: number;
}

/** 철회 상태 */
export type RevocationStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

/** 디렉토리 항목 */
export interface DirectoryEntry {
  /** 참여자 ID */
  participantId: string;
  /** 참여자 이름 */
  name: string;
  /** 계층 */
  tier: DirectoryTier;
  /** 적합성 검사 이력 */
  conformanceHistory: ConformanceRecord[];
  /** 철회 상태 */
  revocationStatus: RevocationStatus;
  /** 마지막 검증 시각 */
  lastVerifiedAt: number;
  /** 공개 메트릭 */
  publicMetrics: PublicMetrics;
}

// --- 인메모리 저장소 ---
const directoryStore: DirectoryEntry[] = [];

/**
 * 디렉토리에 참여자를 등록한다.
 * @param participantId - 참여자 ID
 * @param name - 참여자 이름
 * @param tier - 계층
 * @returns 등록된 디렉토리 항목
 */
export function registerEntry(
  participantId: string,
  name: string,
  tier: DirectoryTier
): DirectoryEntry {
  const entry: DirectoryEntry = {
    participantId,
    name,
    tier,
    conformanceHistory: [],
    revocationStatus: "ACTIVE",
    lastVerifiedAt: Date.now(),
    publicMetrics: {
      totalIssuances: 0,
      revokedIssuances: 0,
      contestationsReceived: 0,
      contestationsUpheld: 0,
    },
  };
  directoryStore.push(entry);
  return entry;
}

/**
 * 디렉토리 항목을 업데이트한다.
 * @param participantId - 참여자 ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트된 항목 또는 null
 */
export function updateEntry(
  participantId: string,
  updates: Partial<Pick<DirectoryEntry, "name" | "tier" | "revocationStatus" | "publicMetrics">>
): DirectoryEntry | null {
  const entry = directoryStore.find((e) => e.participantId === participantId);
  if (!entry) return null;

  if (updates.name !== undefined) entry.name = updates.name;
  if (updates.tier !== undefined) entry.tier = updates.tier;
  if (updates.revocationStatus !== undefined) entry.revocationStatus = updates.revocationStatus;
  if (updates.publicMetrics !== undefined) entry.publicMetrics = updates.publicMetrics;
  entry.lastVerifiedAt = Date.now();

  return entry;
}

/**
 * 디렉토리를 검색한다.
 * @param query - 검색어 (이름 또는 ID 부분 일치)
 * @param tierFilter - 선택적 계층 필터
 * @returns 일치하는 항목 배열
 */
export function searchDirectory(
  query: string,
  tierFilter?: DirectoryTier
): DirectoryEntry[] {
  const lowerQuery = query.toLowerCase();
  return directoryStore.filter((e) => {
    const matchesQuery =
      e.name.toLowerCase().includes(lowerQuery) ||
      e.participantId.toLowerCase().includes(lowerQuery);
    const matchesTier = tierFilter === undefined || e.tier === tierFilter;
    return matchesQuery && matchesTier;
  });
}

/**
 * 참여자의 적합성 검사 이력을 반환한다.
 * @param participantId - 참여자 ID
 * @returns 적합성 검사 이력 또는 빈 배열
 */
export function getConformanceHistory(participantId: string): ConformanceRecord[] {
  const entry = directoryStore.find((e) => e.participantId === participantId);
  return entry?.conformanceHistory ?? [];
}

/**
 * 참여자를 부적합으로 신고한다. 적합성 이력에 실패 기록을 추가하고 상태를 SUSPENDED로 변경.
 * @param participantId - 참여자 ID
 * @param findings - 발견 사항
 * @returns 업데이트된 항목 또는 null
 */
export function flagNonCompliance(
  participantId: string,
  findings: string[]
): DirectoryEntry | null {
  const entry = directoryStore.find((e) => e.participantId === participantId);
  if (!entry) return null;

  entry.conformanceHistory.push({
    checkDate: Date.now(),
    passed: false,
    findings,
  });
  entry.revocationStatus = "SUSPENDED";
  entry.lastVerifiedAt = Date.now();

  return entry;
}

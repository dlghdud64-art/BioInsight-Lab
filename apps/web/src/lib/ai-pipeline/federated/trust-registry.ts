/**
 * @module trust-registry
 * @description 외부 파트너/조직 신뢰 등록소
 *
 * 연합 네트워크에 참여하는 파트너 조직의 신뢰 수준을 등록·관리한다.
 * 신뢰 수준에 따라 데이터 교환, 정책 동기화 등의 권한이 결정된다.
 */

/** 파트너 신뢰 수준 */
export type TrustLevel =
  | "FULL"
  | "CONDITIONAL"
  | "PROBATIONARY"
  | "SUSPENDED"
  | "REVOKED";

/** 파트너 등록 항목 */
export interface PartnerEntry {
  partnerId: string;
  orgName: string;
  trustLevel: TrustLevel;
  registeredAt: Date;
  lastVerifiedAt: Date;
  capabilities: string[];
  restrictions: string[];
  metadata: Record<string, unknown>;
}

/** 파트너 등록 요청 */
export interface RegisterPartnerInput {
  partnerId: string;
  orgName: string;
  trustLevel?: TrustLevel;
  capabilities?: string[];
  restrictions?: string[];
  metadata?: Record<string, unknown>;
}

/** 인메모리 파트너 저장소 */
const partnerStore: PartnerEntry[] = [];

/**
 * 파트너를 신뢰 등록소에 등록한다.
 * @param input 등록할 파트너 정보
 * @returns 등록된 파트너 항목
 * @throws 이미 등록된 파트너 ID인 경우
 */
export function registerPartner(input: RegisterPartnerInput): PartnerEntry {
  const existing = partnerStore.find((p) => p.partnerId === input.partnerId);
  if (existing) {
    throw new Error(`파트너 '${input.partnerId}'는 이미 등록되어 있습니다.`);
  }

  const now = new Date();
  const entry: PartnerEntry = {
    partnerId: input.partnerId,
    orgName: input.orgName,
    trustLevel: input.trustLevel ?? "PROBATIONARY",
    registeredAt: now,
    lastVerifiedAt: now,
    capabilities: input.capabilities ?? [],
    restrictions: input.restrictions ?? [],
    metadata: input.metadata ?? {},
  };

  partnerStore.push(entry);
  return entry;
}

/**
 * 파트너의 신뢰 수준을 변경한다.
 * @param partnerId 대상 파트너 ID
 * @param newLevel 새 신뢰 수준
 * @returns 갱신된 파트너 항목
 * @throws 파트너를 찾을 수 없는 경우
 */
export function updateTrustLevel(
  partnerId: string,
  newLevel: TrustLevel,
): PartnerEntry {
  const entry = partnerStore.find((p) => p.partnerId === partnerId);
  if (!entry) {
    throw new Error(`파트너 '${partnerId}'를 찾을 수 없습니다.`);
  }

  entry.trustLevel = newLevel;
  entry.lastVerifiedAt = new Date();
  return entry;
}

/**
 * 파트너 정보를 조회한다.
 * @param partnerId 조회할 파트너 ID
 * @returns 파트너 항목 또는 undefined
 */
export function getPartner(partnerId: string): PartnerEntry | undefined {
  return partnerStore.find((p) => p.partnerId === partnerId);
}

/**
 * 특정 신뢰 수준의 파트너 목록을 반환한다.
 * @param level 조회할 신뢰 수준
 * @returns 해당 수준의 파트너 배열
 */
export function listByTrustLevel(level: TrustLevel): PartnerEntry[] {
  return partnerStore.filter((p) => p.trustLevel === level);
}

/**
 * 파트너를 일시 정지 상태로 전환한다.
 * @param partnerId 대상 파트너 ID
 * @param reason 정지 사유
 * @returns 갱신된 파트너 항목
 */
export function suspendPartner(
  partnerId: string,
  reason: string,
): PartnerEntry {
  const entry = partnerStore.find((p) => p.partnerId === partnerId);
  if (!entry) {
    throw new Error(`파트너 '${partnerId}'를 찾을 수 없습니다.`);
  }

  entry.trustLevel = "SUSPENDED";
  entry.metadata = { ...entry.metadata, suspendReason: reason };
  entry.lastVerifiedAt = new Date();
  return entry;
}

/**
 * 파트너의 신뢰를 영구적으로 철회한다.
 * @param partnerId 대상 파트너 ID
 * @param reason 철회 사유
 * @returns 갱신된 파트너 항목
 */
export function revokePartner(partnerId: string, reason: string): PartnerEntry {
  const entry = partnerStore.find((p) => p.partnerId === partnerId);
  if (!entry) {
    throw new Error(`파트너 '${partnerId}'를 찾을 수 없습니다.`);
  }

  entry.trustLevel = "REVOKED";
  entry.metadata = { ...entry.metadata, revokeReason: reason };
  entry.lastVerifiedAt = new Date();
  return entry;
}

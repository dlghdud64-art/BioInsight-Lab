/**
 * @module consent-revocation
 * @description 데이터 동의/철회 관리
 *
 * 연합 네트워크 파트너 간 데이터 공유, 벤치마킹, 감사 접근 등에 대한
 * 동의를 부여하고 철회하는 프로세스를 관리한다.
 */

/** 동의 범위 */
export type ConsentScope =
  | "EVIDENCE_SHARING"
  | "BENCHMARKING"
  | "AUDIT_ACCESS"
  | "POLICY_SYNC"
  | "FULL_FEDERATION";

/** 동의 기록 */
export interface ConsentRecord {
  id: string;
  grantorId: string;
  granteeId: string;
  scope: ConsentScope;
  grantedAt: Date;
  revokedAt: Date | null;
  active: boolean;
}

/** 동의 부여 요청 */
export interface GrantConsentInput {
  grantorId: string;
  granteeId: string;
  scope: ConsentScope;
}

/** 동의 이력 조회 결과 */
export interface ConsentAuditEntry {
  consentId: string;
  action: "GRANTED" | "REVOKED";
  performedAt: Date;
  scope: ConsentScope;
  grantorId: string;
  granteeId: string;
}

/** 인메모리 동의 저장소 */
const consentStore: ConsentRecord[] = [];

/** 감사 이력 저장소 */
const consentAuditLog: ConsentAuditEntry[] = [];

/** 고유 ID 생성 */
let consentSeq = 0;
function nextConsentId(): string {
  consentSeq += 1;
  return `consent-${consentSeq}`;
}

/**
 * 데이터 동의를 부여한다.
 * @param input 동의 부여 정보
 * @returns 생성된 동의 기록
 * @throws 동일 범위의 활성 동의가 이미 존재하는 경우
 */
export function grantConsent(input: GrantConsentInput): ConsentRecord {
  const existing = consentStore.find(
    (c) =>
      c.grantorId === input.grantorId &&
      c.granteeId === input.granteeId &&
      c.scope === input.scope &&
      c.active,
  );

  if (existing) {
    throw new Error(
      `'${input.grantorId}'에서 '${input.granteeId}'로의 '${input.scope}' 동의가 이미 활성 상태입니다.`,
    );
  }

  const now = new Date();
  const record: ConsentRecord = {
    id: nextConsentId(),
    grantorId: input.grantorId,
    granteeId: input.granteeId,
    scope: input.scope,
    grantedAt: now,
    revokedAt: null,
    active: true,
  };

  consentStore.push(record);
  consentAuditLog.push({
    consentId: record.id,
    action: "GRANTED",
    performedAt: now,
    scope: record.scope,
    grantorId: record.grantorId,
    granteeId: record.granteeId,
  });

  return record;
}

/**
 * 동의를 철회한다.
 * @param consentId 철회할 동의 ID
 * @returns 철회된 동의 기록
 * @throws 동의 기록을 찾을 수 없거나 이미 비활성인 경우
 */
export function revokeConsent(consentId: string): ConsentRecord {
  const record = consentStore.find((c) => c.id === consentId);
  if (!record) {
    throw new Error(`동의 기록 '${consentId}'을(를) 찾을 수 없습니다.`);
  }
  if (!record.active) {
    throw new Error("이미 비활성 상태인 동의입니다.");
  }

  const now = new Date();
  record.active = false;
  record.revokedAt = now;

  consentAuditLog.push({
    consentId: record.id,
    action: "REVOKED",
    performedAt: now,
    scope: record.scope,
    grantorId: record.grantorId,
    granteeId: record.granteeId,
  });

  return record;
}

/**
 * 특정 범위의 동의 존재 여부를 확인한다.
 * @param grantorId 동의 부여자 ID
 * @param granteeId 동의 수혜자 ID
 * @param scope 확인할 범위
 * @returns 활성 동의 존재 여부
 */
export function checkConsent(
  grantorId: string,
  granteeId: string,
  scope: ConsentScope,
): boolean {
  return consentStore.some(
    (c) =>
      c.grantorId === grantorId &&
      c.granteeId === granteeId &&
      c.scope === scope &&
      c.active,
  );
}

/**
 * 특정 파트너 간의 활성 동의 목록을 반환한다.
 * @param grantorId 동의 부여자 ID (선택)
 * @param granteeId 동의 수혜자 ID (선택)
 * @returns 활성 동의 배열
 */
export function getActiveConsents(
  grantorId?: string,
  granteeId?: string,
): ConsentRecord[] {
  return consentStore.filter((c) => {
    if (!c.active) return false;
    if (grantorId && c.grantorId !== grantorId) return false;
    if (granteeId && c.granteeId !== granteeId) return false;
    return true;
  });
}

/**
 * 동의 감사 이력을 조회한다.
 * @param grantorId 동의 부여자 ID (선택)
 * @param granteeId 동의 수혜자 ID (선택)
 * @returns 감사 이력 배열
 */
export function auditConsentHistory(
  grantorId?: string,
  granteeId?: string,
): ConsentAuditEntry[] {
  return consentAuditLog.filter((entry) => {
    if (grantorId && entry.grantorId !== grantorId) return false;
    if (granteeId && entry.granteeId !== granteeId) return false;
    return true;
  });
}

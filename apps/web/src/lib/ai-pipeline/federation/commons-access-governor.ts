/**
 * @module commons-access-governor
 * @description 커먼즈 접근 통제 게이트웨이
 *
 * 신뢰 커먼즈 자산에 대한 접근을 성숙도 지수, 기여 실적,
 * 기관 상태 등 다층적 기준으로 통제한다.
 * 정지된 기관, 성숙도 미달 기관, 기여 부족 기관은 접근이 제한된다.
 */

import type { MemberStatus } from './interinstitutional-registry';

/** 접근 목적 */
export type AccessPurpose =
  | 'BENCHMARKING'
  | 'REMEDIATION'
  | 'COMPLIANCE_MAPPING'
  | 'RESEARCH'
  | 'AUDIT_PREPARATION';

/** 접근 거부 사유 */
export type AccessDenialReason =
  | 'INSUFFICIENT_MATURITY'
  | 'PURPOSE_MISMATCH'
  | 'SCOPE_EXCEEDED'
  | 'SUSPENDED_MEMBER'
  | 'CONTRIBUTION_DEFICIT';

/** 접근 허가 기록 */
export interface AccessGrant {
  /** 허가 고유 ID */
  id: string;
  /** 요청 기관 ID */
  institutionId: string;
  /** 대상 자산 ID */
  assetId: string;
  /** 접근 목적 */
  purpose: AccessPurpose;
  /** 허가 일시 */
  grantedAt: Date;
  /** 만료 일시 */
  expiresAt: Date;
  /** 철회 여부 */
  revoked: boolean;
}

/** 접근 요청 결과 */
export interface AccessRequestResult {
  /** 허가 여부 */
  granted: boolean;
  /** 거부 사유 (허가 시 null) */
  denialReason: AccessDenialReason | null;
  /** 허가 기록 (거부 시 null) */
  grant: AccessGrant | null;
}

/** 접근 로그 항목 */
export interface AccessLogEntry {
  /** 기관 ID */
  institutionId: string;
  /** 자산 ID */
  assetId: string;
  /** 접근 목적 */
  purpose: AccessPurpose;
  /** 허가 여부 */
  granted: boolean;
  /** 거부 사유 */
  denialReason: AccessDenialReason | null;
  /** 기록 일시 */
  timestamp: Date;
}

// ── 인메모리 저장소 ──
const grants: AccessGrant[] = [];
const accessLog: AccessLogEntry[] = [];

/** 성숙도 최소 임계값 */
const MATURITY_THRESHOLD = 40;
/** 기여 최소 건수 */
const MIN_CONTRIBUTION_COUNT = 1;

/**
 * 접근을 요청한다. 다층 검증을 거쳐 허가 또는 거부를 결정한다.
 *
 * @param params 요청 파라미터
 * @returns 접근 요청 결과
 */
export function requestAccess(params: {
  id: string;
  institutionId: string;
  assetId: string;
  purpose: AccessPurpose;
  memberStatus: MemberStatus;
  maturityIndex: number;
  contributionCount: number;
  durationMs?: number;
}): AccessRequestResult {
  const logEntry: AccessLogEntry = {
    institutionId: params.institutionId,
    assetId: params.assetId,
    purpose: params.purpose,
    granted: false,
    denialReason: null,
    timestamp: new Date(),
  };

  // 정지된 기관 → 거부
  if (params.memberStatus === 'SUSPENDED' || params.memberStatus === 'EXPELLED') {
    logEntry.denialReason = 'SUSPENDED_MEMBER';
    accessLog.push(logEntry);
    return { granted: false, denialReason: 'SUSPENDED_MEMBER', grant: null };
  }

  // 성숙도 미달 → 거부
  if (params.maturityIndex < MATURITY_THRESHOLD) {
    logEntry.denialReason = 'INSUFFICIENT_MATURITY';
    accessLog.push(logEntry);
    return { granted: false, denialReason: 'INSUFFICIENT_MATURITY', grant: null };
  }

  // 기여 부족 → 제한 접근만 허용 (여기서는 거부)
  if (params.contributionCount < MIN_CONTRIBUTION_COUNT) {
    logEntry.denialReason = 'CONTRIBUTION_DEFICIT';
    accessLog.push(logEntry);
    return { granted: false, denialReason: 'CONTRIBUTION_DEFICIT', grant: null };
  }

  // 허가
  const duration = params.durationMs ?? 24 * 60 * 60 * 1000; // 기본 24시간
  const grant: AccessGrant = {
    id: params.id,
    institutionId: params.institutionId,
    assetId: params.assetId,
    purpose: params.purpose,
    grantedAt: new Date(),
    expiresAt: new Date(Date.now() + duration),
    revoked: false,
  };

  grants.push(grant);
  logEntry.granted = true;
  accessLog.push(logEntry);

  return { granted: true, denialReason: null, grant: { ...grant } };
}

/**
 * 접근을 직접 허가한다. (관리자용)
 * @param grant 허가 기록
 */
export function grantAccess(grant: AccessGrant): AccessGrant {
  grants.push({ ...grant });
  accessLog.push({
    institutionId: grant.institutionId,
    assetId: grant.assetId,
    purpose: grant.purpose,
    granted: true,
    denialReason: null,
    timestamp: new Date(),
  });
  return { ...grant };
}

/**
 * 접근을 철회한다.
 * @param grantId 허가 ID
 */
export function revokeAccess(grantId: string): boolean {
  const grant = grants.find((g) => g.id === grantId);
  if (!grant) return false;
  grant.revoked = true;
  return true;
}

/**
 * 현재 유효한 접근 권한이 있는지 확인한다.
 * @param institutionId 기관 ID
 * @param assetId 자산 ID
 */
export function checkAccess(institutionId: string, assetId: string): boolean {
  const now = new Date();
  return grants.some(
    (g) =>
      g.institutionId === institutionId &&
      g.assetId === assetId &&
      !g.revoked &&
      g.expiresAt > now,
  );
}

/**
 * 접근 로그를 반환한다.
 * @param institutionId 필터: 기관 ID (선택)
 */
export function getAccessLog(institutionId?: string): AccessLogEntry[] {
  if (institutionId) {
    return accessLog
      .filter((l) => l.institutionId === institutionId)
      .map((l) => ({ ...l }));
  }
  return accessLog.map((l) => ({ ...l }));
}

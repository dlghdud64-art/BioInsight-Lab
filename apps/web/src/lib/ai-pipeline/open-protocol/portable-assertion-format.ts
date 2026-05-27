/**
 * @module portable-assertion-format
 * @description 포터블 주장 포맷
 *
 * 발행자의 내부 DB에 접근하지 않고도 독립적으로 검증 가능한 자기 완결형 주장 포맷을 정의한다.
 * 모든 주장은 만료, 철회, 제한 사항을 내장하며, 무결성 증명을 포함한다.
 */

/** 참여자 계층 (발행 권한 결정용) */
export type IssuerTier =
  | "OBSERVER"
  | "CONSUMER"
  | "VERIFIED_PARTICIPANT"
  | "ASSERTION_ISSUER"
  | "PROTOCOL_STEWARD";

/** 주장 내 개별 클레임 */
export interface Claim {
  /** 클레임 유형 */
  type: string;
  /** 클레임 값 */
  value: unknown;
  /** 클레임 근거 */
  basis: string;
}

/** 포터블 주장 */
export interface PortableAssertion {
  /** 주장 고유 식별자 */
  assertionId: string;
  /** 발행자 ID */
  issuerId: string;
  /** 발행자 계층 */
  issuerTier: IssuerTier;
  /** 적용 범위 */
  scope: string;
  /** 클레임 목록 */
  claims: Claim[];
  /** 무결성 증명 (해시 등) */
  integrityProof: string;
  /** 발행 시각 */
  issuedAt: number;
  /** 만료 시각 */
  expiresAt: number;
  /** 철회 확인 링크 */
  revocationLink: string;
  /** 제한 사항 목록 */
  limitations: string[];
}

// --- 인메모리 저장소 ---
const assertionStore: PortableAssertion[] = [];
const revokedAssertionIds: Set<string> = new Set();

/**
 * 무결성 증명을 생성한다 (간소화된 해시 구현).
 * @param data - 해시 대상 문자열
 * @returns 해시 문자열
 */
function computeIntegrityProof(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `proof-${Math.abs(hash).toString(16)}`;
}

/**
 * 포터블 주장을 생성한다. 자기 완결형으로 외부 DB 없이 검증 가능.
 * @param params - 주장 생성 파라미터
 * @returns 생성된 포터블 주장
 */
export function createAssertion(
  params: Omit<PortableAssertion, "assertionId" | "integrityProof" | "issuedAt">
): PortableAssertion {
  const assertionId = `pa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const issuedAt = Date.now();

  const proofData = JSON.stringify({
    assertionId,
    issuerId: params.issuerId,
    claims: params.claims,
    issuedAt,
  });

  const assertion: PortableAssertion = {
    ...params,
    assertionId,
    issuedAt,
    integrityProof: computeIntegrityProof(proofData),
  };
  assertionStore.push(assertion);
  return assertion;
}

/**
 * 직렬화된 주장 문자열을 파싱한다.
 * @param serialized - JSON 직렬화된 주장 문자열
 * @returns 파싱된 포터블 주장 또는 null
 */
export function parseAssertion(serialized: string): PortableAssertion | null {
  try {
    const parsed = JSON.parse(serialized) as PortableAssertion;
    if (!parsed.assertionId || !parsed.issuerId || !parsed.claims) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 주장의 구조적 유효성을 검증한다.
 * @param assertion - 검증할 주장
 * @returns 유효 여부 및 오류 목록
 */
export function validateAssertion(
  assertion: PortableAssertion
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!assertion.assertionId) errors.push("주장 ID가 누락되었습니다.");
  if (!assertion.issuerId) errors.push("발행자 ID가 누락되었습니다.");
  if (!assertion.issuerTier) errors.push("발행자 계층이 누락되었습니다.");
  if (!assertion.claims || assertion.claims.length === 0) {
    errors.push("클레임이 하나 이상 필요합니다.");
  }
  if (!assertion.integrityProof) errors.push("무결성 증명이 누락되었습니다.");
  if (!assertion.revocationLink) errors.push("철회 링크가 누락되었습니다.");
  if (assertion.expiresAt <= assertion.issuedAt) {
    errors.push("만료 시각이 발행 시각보다 이후여야 합니다.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 주장이 만료되었는지 확인한다.
 * @param assertion - 확인할 주장
 * @returns 만료 여부
 */
export function isExpired(assertion: PortableAssertion): boolean {
  return Date.now() > assertion.expiresAt;
}

/**
 * 주장이 철회되었는지 확인한다.
 * @param assertionId - 확인할 주장 ID
 * @returns 철회 여부
 */
export function isRevoked(assertionId: string): boolean {
  return revokedAssertionIds.has(assertionId);
}

/**
 * 주장을 철회 상태로 표시한다 (내부 사용).
 * @param assertionId - 철회할 주장 ID
 */
export function markRevoked(assertionId: string): void {
  revokedAssertionIds.add(assertionId);
}

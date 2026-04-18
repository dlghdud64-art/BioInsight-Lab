/**
 * @module attestation-engine
 * @description 외부 인증 발급/검증 엔진
 *
 * 연합 네트워크 파트너 간 품질 준수, 프로세스 무결성, 데이터 정확도,
 * 안전 기록 등에 대한 인증(attestation)을 발급하고 검증한다.
 */

/** 인증 유형 */
export type AttestationType =
  | "QUALITY_COMPLIANCE"
  | "PROCESS_INTEGRITY"
  | "DATA_ACCURACY"
  | "SAFETY_RECORD";

/** 인증 클레임 */
export interface AttestationClaim {
  field: string;
  value: string;
  evidence: string;
}

/** 인증서 */
export interface Attestation {
  id: string;
  type: AttestationType;
  issuerId: string;
  subjectId: string;
  claims: AttestationClaim[];
  issuedAt: Date;
  expiresAt: Date;
  signature: string;
  revoked: boolean;
}

/** 인증 발급 요청 */
export interface IssueAttestationInput {
  type: AttestationType;
  issuerId: string;
  subjectId: string;
  claims: AttestationClaim[];
  validityDays: number;
}

/** 인증 검증 결과 */
export interface VerificationResult {
  valid: boolean;
  reasons: string[];
  verifiedAt: Date;
}

/** 인메모리 인증서 저장소 */
const attestationStore: Attestation[] = [];

/** 고유 ID 생성 */
let attestationSeq = 0;
function nextAttestationId(): string {
  attestationSeq += 1;
  return `attest-${attestationSeq}`;
}

/**
 * 인증 서명을 생성한다. (데모용 단순 서명)
 * @param issuerId 발급자 ID
 * @param subjectId 대상 ID
 * @param type 인증 유형
 * @returns 서명 문자열
 */
function generateSignature(
  issuerId: string,
  subjectId: string,
  type: string,
): string {
  const raw = `${issuerId}:${subjectId}:${type}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash = hash & hash;
  }
  return `sig-${Math.abs(hash).toString(16).padStart(12, "0")}`;
}

/**
 * 새 인증서를 발급한다.
 * @param input 인증 발급 정보
 * @returns 발급된 인증서
 */
export function issueAttestation(input: IssueAttestationInput): Attestation {
  if (input.claims.length === 0) {
    throw new Error("인증서에는 최소 1개 이상의 클레임이 필요합니다.");
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + input.validityDays);

  const attestation: Attestation = {
    id: nextAttestationId(),
    type: input.type,
    issuerId: input.issuerId,
    subjectId: input.subjectId,
    claims: [...input.claims],
    issuedAt: now,
    expiresAt,
    signature: generateSignature(
      input.issuerId,
      input.subjectId,
      input.type,
    ),
    revoked: false,
  };

  attestationStore.push(attestation);
  return attestation;
}

/**
 * 인증서의 유효성을 검증한다.
 * @param attestationId 검증할 인증서 ID
 * @returns 검증 결과
 */
export function verifyAttestation(
  attestationId: string,
): VerificationResult {
  const attestation = attestationStore.find((a) => a.id === attestationId);
  const reasons: string[] = [];

  if (!attestation) {
    reasons.push(`인증서 '${attestationId}'을(를) 찾을 수 없습니다.`);
    return { valid: false, reasons, verifiedAt: new Date() };
  }

  if (attestation.revoked) {
    reasons.push("인증서가 철회되었습니다.");
  }

  if (new Date() > attestation.expiresAt) {
    reasons.push("인증서가 만료되었습니다.");
  }

  if (!attestation.signature || attestation.signature.length === 0) {
    reasons.push("유효한 서명이 없습니다.");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    verifiedAt: new Date(),
  };
}

/**
 * 인증서를 철회한다.
 * @param attestationId 철회할 인증서 ID
 * @returns 철회된 인증서
 * @throws 인증서를 찾을 수 없는 경우
 */
export function revokeAttestation(attestationId: string): Attestation {
  const attestation = attestationStore.find((a) => a.id === attestationId);
  if (!attestation) {
    throw new Error(`인증서 '${attestationId}'을(를) 찾을 수 없습니다.`);
  }

  attestation.revoked = true;
  return attestation;
}

/**
 * 특정 대상에 대한 유효한 인증서 목록을 반환한다.
 * @param subjectId 대상 ID
 * @returns 유효한 인증서 배열
 */
export function getValidAttestations(subjectId: string): Attestation[] {
  const now = new Date();
  return attestationStore.filter(
    (a) =>
      a.subjectId === subjectId &&
      !a.revoked &&
      now <= a.expiresAt,
  );
}

/**
 * @module open-evidence-envelope
 * @description 공개 증적 봉투
 *
 * 증적 데이터를 봉인(seal)하고, 무결성을 검증하며, 필요에 따라 편집(redaction)할 수 있는
 * 자기 완결형 증적 봉투를 제공한다. 각 봉투는 철회 가능하며, 인증 체인을 포함한다.
 */

/** 편집 프로필 — 증적 내 민감 필드 편집 정책 */
export interface RedactionProfile {
  /** 편집 수준 (0: 없음, 1: 최소, 2: 표준, 3: 최대) */
  level: number;
  /** 편집된 필드 목록 */
  redactedFields: string[];
  /** 편집 사유 */
  justification: string;
}

/** 인증 체인 항목 */
export interface AttestationEntry {
  /** 인증자 ID */
  attesterId: string;
  /** 인증 시각 */
  attestedAt: number;
  /** 인증 서명 (간소화) */
  signature: string;
}

/** 증적 봉투 */
export interface EvidenceEnvelope {
  /** 봉투 고유 식별자 */
  envelopeId: string;
  /** 발행자 ID */
  issuerId: string;
  /** 증적 유형 */
  evidenceType: string;
  /** 원본 콘텐츠 해시 */
  contentHash: string;
  /** 편집 프로필 */
  redactionProfile: RedactionProfile;
  /** 인증 체인 */
  attestationChain: AttestationEntry[];
  /** 발행 시각 */
  issuedAt: number;
  /** 만료 시각 */
  expiresAt: number;
  /** 철회 확인 링크 */
  revocationLink: string;
}

// --- 인메모리 저장소 ---
const envelopeStore: EvidenceEnvelope[] = [];
const revokedEnvelopeIds: Set<string> = new Set();

/**
 * 콘텐츠 해시를 계산한다.
 * @param content - 해시 대상 문자열
 * @returns 해시 문자열
 */
function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `hash-${Math.abs(hash).toString(16)}`;
}

/**
 * 증적 봉투를 봉인(생성)한다.
 * @param issuerId - 발행자 ID
 * @param evidenceType - 증적 유형
 * @param content - 원본 콘텐츠
 * @param redactionProfile - 편집 프로필
 * @param expiresAt - 만료 시각
 * @param revocationLink - 철회 확인 링크
 * @returns 봉인된 증적 봉투
 */
export function sealEnvelope(
  issuerId: string,
  evidenceType: string,
  content: string,
  redactionProfile: RedactionProfile,
  expiresAt: number,
  revocationLink: string
): EvidenceEnvelope {
  const envelope: EvidenceEnvelope = {
    envelopeId: `env-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    issuerId,
    evidenceType,
    contentHash: computeHash(content),
    redactionProfile,
    attestationChain: [
      {
        attesterId: issuerId,
        attestedAt: Date.now(),
        signature: computeHash(`${issuerId}-${content}-${Date.now()}`),
      },
    ],
    issuedAt: Date.now(),
    expiresAt,
    revocationLink,
  };
  envelopeStore.push(envelope);
  return envelope;
}

/**
 * 봉투를 ID로 조회한다.
 * @param envelopeId - 봉투 ID
 * @returns 증적 봉투 또는 null
 */
export function openEnvelope(envelopeId: string): EvidenceEnvelope | null {
  return envelopeStore.find((e) => e.envelopeId === envelopeId) ?? null;
}

/**
 * 봉투의 무결성을 검증한다.
 * @param envelope - 검증할 봉투
 * @param originalContent - 원본 콘텐츠 (해시 비교용)
 * @returns 무결성 검증 결과
 */
export function verifyIntegrity(
  envelope: EvidenceEnvelope,
  originalContent: string
): { intact: boolean; details: string } {
  const expectedHash = computeHash(originalContent);
  const intact = envelope.contentHash === expectedHash;
  return {
    intact,
    details: intact
      ? "무결성 검증 통과: 콘텐츠 해시 일치"
      : "무결성 검증 실패: 콘텐츠 해시 불일치",
  };
}

/**
 * 봉투의 철회 상태를 확인한다.
 * @param envelopeId - 봉투 ID
 * @returns 철회 여부
 */
export function checkRevocation(envelopeId: string): boolean {
  return revokedEnvelopeIds.has(envelopeId);
}

/**
 * 봉투에 편집 프로필을 적용한다.
 * @param envelopeId - 대상 봉투 ID
 * @param redactionProfile - 새 편집 프로필
 * @returns 업데이트된 봉투 또는 null
 */
export function applyRedaction(
  envelopeId: string,
  redactionProfile: RedactionProfile
): EvidenceEnvelope | null {
  const envelope = envelopeStore.find((e) => e.envelopeId === envelopeId);
  if (!envelope) return null;
  envelope.redactionProfile = redactionProfile;
  return envelope;
}

/**
 * 봉투를 철회 상태로 표시한다 (내부 사용).
 * @param envelopeId - 철회할 봉투 ID
 */
export function markEnvelopeRevoked(envelopeId: string): void {
  revokedEnvelopeIds.add(envelopeId);
}

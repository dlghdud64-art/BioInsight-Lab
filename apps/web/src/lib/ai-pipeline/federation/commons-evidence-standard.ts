/**
 * @module commons-evidence-standard
 * @description 연합 증적 표준
 *
 * 연합 기관 간 공유되는 증적의 표준화 포맷을 정의하고,
 * 검증·난독화·증명 체인 확인 로직을 제공한다.
 * 유효한 증명 체인이 없는 증적은 거부한다.
 */

/** 난독화 수준 */
export type RedactionLevel = 'NONE' | 'PARTIAL' | 'HEAVY' | 'ANONYMIZED';

/** 증명 체인 항목 */
export interface AttestationChainEntry {
  /** 증명자 ID */
  attesterId: string;
  /** 증명 일시 */
  attestedAt: Date;
  /** 증명 해시 */
  hash: string;
  /** 이전 해시 (체인 연결) */
  previousHash: string | null;
}

/** 표준화된 증적 포맷 */
export interface StandardizedFormat {
  /** 스키마 버전 */
  schemaVersion: string;
  /** 증적 유형 */
  evidenceType: string;
  /** 난독화 수준 */
  redactionLevel: RedactionLevel;
  /** 증명 체인 */
  attestationChain: AttestationChainEntry[];
  /** 내용 해시 */
  contentHash: string;
  /** 메타데이터 */
  metadata: Record<string, string>;
}

/** 증적 검증 결과 */
export interface EvidenceValidation {
  /** 유효 여부 */
  valid: boolean;
  /** 에러 목록 */
  errors: string[];
  /** 경고 목록 */
  warnings: string[];
}

/** 난독화 프로필 */
export interface RedactionProfile {
  /** 대상 난독화 수준 */
  targetLevel: RedactionLevel;
  /** 제거 대상 필드 목록 */
  fieldsToRedact: string[];
  /** 익명화 대상 식별자 목록 */
  identifiersToAnonymize: string[];
}

/** 현재 스키마 버전 */
const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * 원시 증적 데이터를 표준 포맷으로 변환한다.
 *
 * @param params 표준화 입력
 * @returns 표준화된 증적
 */
export function standardizeEvidence(params: {
  evidenceType: string;
  content: string;
  redactionLevel: RedactionLevel;
  attestationChain: AttestationChainEntry[];
  metadata?: Record<string, string>;
}): StandardizedFormat {
  if (!params.attestationChain || params.attestationChain.length === 0) {
    throw new Error('증명 체인이 없는 증적은 표준화할 수 없습니다.');
  }

  // 간이 해시 생성 (실제로는 crypto 사용)
  const contentHash = simpleHash(params.content);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    evidenceType: params.evidenceType,
    redactionLevel: params.redactionLevel,
    attestationChain: params.attestationChain.map((e) => ({ ...e })),
    contentHash,
    metadata: { ...params.metadata },
  };
}

/**
 * 표준 포맷에 대한 검증을 수행한다.
 *
 * @param evidence 검증 대상 증적
 * @returns 검증 결과
 */
export function validateAgainstStandard(evidence: StandardizedFormat): EvidenceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 스키마 버전 확인
  if (!evidence.schemaVersion) {
    errors.push('스키마 버전이 누락됨');
  }

  // 증적 유형 확인
  if (!evidence.evidenceType || evidence.evidenceType.trim().length === 0) {
    errors.push('증적 유형이 누락됨');
  }

  // 내용 해시 확인
  if (!evidence.contentHash || evidence.contentHash.trim().length === 0) {
    errors.push('내용 해시가 누락됨');
  }

  // 증명 체인 검증 — 필수
  if (!evidence.attestationChain || evidence.attestationChain.length === 0) {
    errors.push('유효한 증명 체인이 없음 — 거부됨');
  } else {
    // 체인 무결성 확인
    for (let i = 1; i < evidence.attestationChain.length; i++) {
      const current = evidence.attestationChain[i];
      const previous = evidence.attestationChain[i - 1];
      if (current.previousHash !== previous.hash) {
        errors.push(`증명 체인 ${i}번째 항목의 previousHash 불일치`);
      }
    }

    // 첫 항목의 previousHash는 null이어야 함
    if (evidence.attestationChain[0].previousHash !== null) {
      warnings.push('증명 체인 첫 항목의 previousHash가 null이 아님');
    }
  }

  // 난독화 수준 경고
  if (evidence.redactionLevel === 'NONE') {
    warnings.push('난독화 미적용 — 민감 정보 포함 가능성 확인 필요');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 난독화 프로필을 적용하여 증적을 변환한다.
 *
 * @param evidence 원본 증적
 * @param profile 난독화 프로필
 * @returns 난독화된 증적
 */
export function applyRedactionProfile(
  evidence: StandardizedFormat,
  profile: RedactionProfile,
): StandardizedFormat {
  const redacted = { ...evidence, metadata: { ...evidence.metadata } };

  // 메타데이터에서 대상 필드 제거
  for (const field of profile.fieldsToRedact) {
    if (field in redacted.metadata) {
      redacted.metadata[field] = '[REDACTED]';
    }
  }

  // 식별자 익명화 (증명 체인의 attesterId)
  redacted.attestationChain = evidence.attestationChain.map((entry) => {
    const anonymized = { ...entry };
    if (profile.identifiersToAnonymize.includes(entry.attesterId)) {
      anonymized.attesterId = `ANON_${simpleHash(entry.attesterId).slice(0, 8)}`;
    }
    return anonymized;
  });

  redacted.redactionLevel = profile.targetLevel;

  return redacted;
}

/**
 * 증명 체인의 무결성을 검증한다.
 *
 * @param chain 증명 체인
 * @returns 무결성 검증 결과
 */
export function verifyAttestationChain(
  chain: AttestationChainEntry[],
): { valid: boolean; brokenAt: number | null } {
  if (!chain || chain.length === 0) {
    return { valid: false, brokenAt: 0 };
  }

  for (let i = 1; i < chain.length; i++) {
    if (chain[i].previousHash !== chain[i - 1].hash) {
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true, brokenAt: null };
}

/** 간이 해시 함수 (데모용) */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

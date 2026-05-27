/**
 * @module evidence-standardization
 * @description 증거 표준화 엔진 — 다양한 소스에서 수집된 증거를 표준 형식으로 변환하고 보존 정책을 적용하는 엔진
 */

/** 증거 형식 */
export type EvidenceFormat = 'STRUCTURED_JSON' | 'NARRATIVE' | 'METRIC_SNAPSHOT' | 'LOG_EXTRACT' | 'ATTESTATION';

/** 증거 무결성 정보 */
export interface EvidenceIntegrity {
  /** 해시 알고리즘 */
  algorithm: string;
  /** 해시 값 */
  hash: string;
  /** 검증 일시 */
  verifiedAt: Date;
}

/** 표준화된 증거 */
export interface StandardizedEvidence {
  /** 증거 ID */
  id: string;
  /** 증거 형식 */
  format: EvidenceFormat;
  /** 소스 시스템 */
  sourceSystem: string;
  /** 수집 일시 */
  collectedAt: Date;
  /** 보존 기간 (일) */
  retentionDays: number;
  /** 무결성 정보 */
  integrity: EvidenceIntegrity;
  /** 증거 내용 */
  content: unknown;
}

/** 형식 검증 결과 */
export interface FormatValidationResult {
  /** 유효 여부 */
  valid: boolean;
  /** 검증 오류 목록 */
  errors: string[];
}

/** 증거 카탈로그 항목 */
export interface EvidenceCatalogEntry {
  /** 증거 ID */
  id: string;
  /** 증거 형식 */
  format: EvidenceFormat;
  /** 소스 시스템 */
  sourceSystem: string;
  /** 수집 일시 */
  collectedAt: Date;
  /** 보존 만료 일시 */
  retentionExpiresAt: Date;
  /** 만료 여부 */
  expired: boolean;
}

/** 인메모리 증거 저장소 */
const evidenceStore: StandardizedEvidence[] = [];

/**
 * 간단한 해시 함수 (데모용, 실제 환경에서는 crypto 사용)
 */
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * 원시 증거를 표준 형식으로 변환한다.
 * @param params 증거 파라미터
 * @returns 표준화된 증거
 */
export function standardizeEvidence(params: {
  id: string;
  format: EvidenceFormat;
  sourceSystem: string;
  retentionDays: number;
  content: unknown;
}): StandardizedEvidence {
  const now = new Date();
  const contentStr = JSON.stringify(params.content);
  const evidence: StandardizedEvidence = {
    id: params.id,
    format: params.format,
    sourceSystem: params.sourceSystem,
    collectedAt: now,
    retentionDays: params.retentionDays,
    integrity: {
      algorithm: 'simple-hash',
      hash: simpleHash(contentStr),
      verifiedAt: now,
    },
    content: params.content,
  };

  const idx = evidenceStore.findIndex((e) => e.id === params.id);
  if (idx !== -1) {
    evidenceStore[idx] = evidence;
  } else {
    evidenceStore.push(evidence);
  }

  return evidence;
}

/**
 * 증거 형식의 유효성을 검증한다.
 * @param evidence 검증할 증거
 * @returns 형식 검증 결과
 */
export function validateFormat(evidence: StandardizedEvidence): FormatValidationResult {
  const errors: string[] = [];

  if (!evidence.id) errors.push('증거 ID가 누락되었습니다.');
  if (!evidence.format) errors.push('증거 형식이 누락되었습니다.');
  if (!evidence.sourceSystem) errors.push('소스 시스템이 누락되었습니다.');
  if (!evidence.collectedAt) errors.push('수집 일시가 누락되었습니다.');
  if (evidence.retentionDays <= 0) errors.push('보존 기간은 양수여야 합니다.');
  if (!evidence.integrity?.hash) errors.push('무결성 해시가 누락되었습니다.');
  if (evidence.content === undefined || evidence.content === null) errors.push('증거 내용이 누락되었습니다.');

  return { valid: errors.length === 0, errors };
}

/**
 * 보존 정책을 적용하여 만료된 증거를 제거한다.
 * @param referenceDate 기준 일시 (기본: 현재)
 * @returns 제거된 증거 수
 */
export function applyRetentionPolicy(referenceDate?: Date): number {
  const now = referenceDate ?? new Date();
  let removed = 0;

  for (let i = evidenceStore.length - 1; i >= 0; i--) {
    const evidence = evidenceStore[i];
    const expiresAt = new Date(evidence.collectedAt);
    expiresAt.setDate(expiresAt.getDate() + evidence.retentionDays);

    if (now > expiresAt) {
      evidenceStore.splice(i, 1);
      removed++;
    }
  }

  return removed;
}

/**
 * 현재 저장된 증거의 카탈로그를 반환한다.
 * @returns 증거 카탈로그 항목 배열
 */
export function getEvidenceCatalog(): EvidenceCatalogEntry[] {
  const now = new Date();
  return evidenceStore.map((e) => {
    const retentionExpiresAt = new Date(e.collectedAt);
    retentionExpiresAt.setDate(retentionExpiresAt.getDate() + e.retentionDays);
    return {
      id: e.id,
      format: e.format,
      sourceSystem: e.sourceSystem,
      collectedAt: e.collectedAt,
      retentionExpiresAt,
      expired: now > retentionExpiresAt,
    };
  });
}

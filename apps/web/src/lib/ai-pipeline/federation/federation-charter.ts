/**
 * @module federation-charter
 * @description 연합 헌장 및 거버넌스 계약
 *
 * Phase V: Inter-Institutional Stewardship Federation
 * 연합에 참여하는 기관들이 공유하는 헌장(Charter)을 정의하고,
 * 서명·철회·준수 여부 검증 로직을 제공한다.
 * 미서명 또는 철회된 기관은 즉시 SUSPENDED 상태로 전환된다.
 */

/** 헌장 섹션 분류 */
export type CharterSection =
  | 'SHARED_MISSION'
  | 'SAFETY_OBLIGATIONS'
  | 'DISPUTE_RULES'
  | 'MEMBERSHIP_CRITERIA'
  | 'EXIT_PROTOCOL';

/** 서명 상태 */
export type SignatureStatus = 'PENDING' | 'SIGNED' | 'REVOKED';

/** 헌장 조항 */
export interface CharterArticle {
  /** 조항 고유 ID */
  id: string;
  /** 소속 섹션 */
  section: CharterSection;
  /** 조항 제목 */
  title: string;
  /** 조항 내용 */
  content: string;
  /** 필수 조항 여부 — true이면 미준수 시 즉시 위반 판정 */
  mandatory: boolean;
  /** 조항 버전 */
  version: number;
}

/** 헌장 서명 기록 */
export interface CharterSignature {
  /** 서명 기관 ID */
  institutionId: string;
  /** 서명 일시 */
  signedAt: Date;
  /** 서명자 식별자 */
  signedBy: string;
  /** 서명한 헌장 버전 */
  version: number;
  /** 서명 상태 */
  status: SignatureStatus;
}

// ── 인메모리 저장소 ──

/** 헌장 조항 저장소 */
const charterArticles: CharterArticle[] = [];

/** 서명 기록 저장소 */
const charterSignatures: CharterSignature[] = [];

/**
 * 현재 헌장의 전체 조항 목록을 반환한다.
 * @returns 헌장 조항 배열
 */
export function getCharter(): CharterArticle[] {
  return [...charterArticles];
}

/**
 * 헌장 조항을 추가한다.
 * @param article 추가할 조항
 */
export function addCharterArticle(article: CharterArticle): void {
  const existing = charterArticles.find((a) => a.id === article.id);
  if (existing) {
    throw new Error(`이미 존재하는 조항 ID: ${article.id}`);
  }
  charterArticles.push({ ...article });
}

/**
 * 기관이 헌장에 서명한다.
 * @param institutionId 서명 기관 ID
 * @param signedBy 서명자 식별자
 * @param version 서명 대상 헌장 버전
 * @returns 생성된 서명 기록
 */
export function signCharter(
  institutionId: string,
  signedBy: string,
  version: number,
): CharterSignature {
  // 이미 유효한 서명이 있는지 확인
  const existing = charterSignatures.find(
    (s) => s.institutionId === institutionId && s.status === 'SIGNED' && s.version === version,
  );
  if (existing) {
    throw new Error(`기관 ${institutionId}은(는) 이미 버전 ${version} 헌장에 서명함`);
  }

  const signature: CharterSignature = {
    institutionId,
    signedAt: new Date(),
    signedBy,
    version,
    status: 'SIGNED',
  };
  charterSignatures.push(signature);
  return { ...signature };
}

/**
 * 서명을 철회한다.
 * 철회 즉시 해당 기관은 SUSPENDED 대상이 된다.
 * @param institutionId 철회 기관 ID
 * @param version 철회 대상 헌장 버전
 * @returns 철회 결과
 */
export function revokeSignature(
  institutionId: string,
  version: number,
): { revoked: boolean; reason: string } {
  const sig = charterSignatures.find(
    (s) => s.institutionId === institutionId && s.version === version && s.status === 'SIGNED',
  );
  if (!sig) {
    return { revoked: false, reason: `기관 ${institutionId}의 유효한 서명을 찾을 수 없음` };
  }
  sig.status = 'REVOKED';
  return { revoked: true, reason: '서명 철회됨 — 즉시 SUSPENDED 상태 전환 대상' };
}

/**
 * 기관의 헌장 준수 여부를 검증한다.
 * @param institutionId 검증 대상 기관 ID
 * @returns 준수 여부와 위반 항목
 */
export function validateCharterCompliance(institutionId: string): {
  compliant: boolean;
  violations: string[];
} {
  const latestVersion = charterArticles.reduce((max, a) => Math.max(max, a.version), 0);
  if (latestVersion === 0) {
    return { compliant: true, violations: [] };
  }

  const sig = charterSignatures.find(
    (s) =>
      s.institutionId === institutionId &&
      s.version === latestVersion &&
      s.status === 'SIGNED',
  );

  const violations: string[] = [];

  if (!sig) {
    violations.push(`최신 헌장 버전(v${latestVersion})에 대한 유효한 서명 없음`);
  }

  // 필수 조항 존재 여부 확인
  const mandatoryArticles = charterArticles.filter((a) => a.mandatory && a.version <= latestVersion);
  if (mandatoryArticles.length > 0 && !sig) {
    violations.push(`필수 조항 ${mandatoryArticles.length}건에 대한 서명 미비`);
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * 헌장 위반 여부를 판별한다.
 * 미서명 또는 철회 상태이면 위반으로 판정한다.
 * @param institutionId 판별 대상 기관 ID
 * @returns 위반 여부
 */
export function isCharterViolation(institutionId: string): boolean {
  const { compliant } = validateCharterCompliance(institutionId);
  return !compliant;
}

/**
 * 특정 기관의 서명 이력을 반환한다.
 * @param institutionId 기관 ID
 * @returns 서명 기록 배열
 */
export function getSignatureHistory(institutionId: string): CharterSignature[] {
  return charterSignatures
    .filter((s) => s.institutionId === institutionId)
    .map((s) => ({ ...s }));
}

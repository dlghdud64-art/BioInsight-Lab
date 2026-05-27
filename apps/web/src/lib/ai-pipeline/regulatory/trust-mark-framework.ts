/**
 * @module trust-mark-framework
 * @description 신뢰 마크 프레임워크 — 규제 준수 수준에 따른 신뢰 마크 발급, 검증, 갱신 및 이력 관리 엔진
 */

/** 신뢰 마크 등급 */
export type TrustMarkLevel = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PENDING';

/** 신뢰 마크 */
export interface TrustMark {
  /** 마크 ID */
  id: string;
  /** 등급 */
  level: TrustMarkLevel;
  /** 발급 대상 */
  issuedTo: string;
  /** 발급 일시 */
  issuedAt: Date;
  /** 유효 기한 */
  validUntil: Date;
  /** 적용 범위 */
  scope: string;
  /** 검증 URL */
  verificationUrl: string;
  /** 활성 상태 */
  active: boolean;
  /** 취소 일시 */
  revokedAt: Date | null;
}

/** 인메모리 신뢰 마크 저장소 */
const trustMarkStore: TrustMark[] = [];

/**
 * 신뢰 마크를 발급한다.
 * @param params 발급 파라미터
 * @returns 발급된 신뢰 마크
 */
export function issueTrustMark(params: {
  id: string;
  level: TrustMarkLevel;
  issuedTo: string;
  validUntil: Date;
  scope: string;
  verificationUrl: string;
}): TrustMark {
  const mark: TrustMark = {
    ...params,
    issuedAt: new Date(),
    active: true,
    revokedAt: null,
  };
  trustMarkStore.push(mark);
  return mark;
}

/**
 * 신뢰 마크의 유효성을 검증한다.
 * @param markId 마크 ID
 * @returns 검증 결과 { valid, reason }
 */
export function verifyTrustMark(markId: string): { valid: boolean; reason: string } {
  const mark = trustMarkStore.find((m) => m.id === markId);
  if (!mark) return { valid: false, reason: '신뢰 마크를 찾을 수 없습니다.' };
  if (!mark.active) return { valid: false, reason: '신뢰 마크가 비활성 상태입니다.' };
  if (mark.revokedAt) return { valid: false, reason: '신뢰 마크가 취소되었습니다.' };
  if (new Date() > mark.validUntil) return { valid: false, reason: '신뢰 마크가 만료되었습니다.' };

  return { valid: true, reason: '유효한 신뢰 마크입니다.' };
}

/**
 * 신뢰 마크를 취소한다.
 * @param markId 마크 ID
 * @returns 취소된 신뢰 마크 또는 null
 */
export function revokeTrustMark(markId: string): TrustMark | null {
  const mark = trustMarkStore.find((m) => m.id === markId);
  if (!mark) return null;

  mark.active = false;
  mark.revokedAt = new Date();
  return mark;
}

/**
 * 신뢰 마크를 갱신한다.
 * @param markId 기존 마크 ID
 * @param newValidUntil 새로운 유효 기한
 * @param newLevel 새로운 등급 (선택)
 * @returns 갱신된 신뢰 마크 또는 null
 */
export function renewTrustMark(
  markId: string,
  newValidUntil: Date,
  newLevel?: TrustMarkLevel
): TrustMark | null {
  const mark = trustMarkStore.find((m) => m.id === markId);
  if (!mark) return null;

  mark.validUntil = newValidUntil;
  mark.active = true;
  mark.revokedAt = null;
  if (newLevel) mark.level = newLevel;

  return mark;
}

/**
 * 신뢰 마크 이력을 반환한다.
 * @param issuedTo 발급 대상 (선택, 미지정 시 전체)
 * @returns 신뢰 마크 배열 (최신순)
 */
export function getTrustMarkHistory(issuedTo?: string): TrustMark[] {
  const marks = issuedTo
    ? trustMarkStore.filter((m) => m.issuedTo === issuedTo)
    : [...trustMarkStore];
  return marks.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}

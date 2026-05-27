/**
 * @module shared-trust-commons
 * @description 영속적 신뢰 커먼즈
 *
 * 연합 기관들이 공유하는 신뢰 자산 저장소.
 * 원시 데이터는 절대 저장하지 않으며, 모든 자산은 반드시
 * attestationHash를 포함해야 한다.
 */

/** 신뢰 자산 유형 */
export type TrustAssetType =
  | 'ATTESTED_CONTROL_SUMMARY'
  | 'SHARED_ANOMALY_SIGNATURE'
  | 'REMEDIATION_PATTERN'
  | 'COMPLIANCE_TEMPLATE'
  | 'BENCHMARK_INSIGHT';

/** 신뢰 자산 */
export interface TrustAsset {
  /** 자산 고유 ID */
  id: string;
  /** 자산 유형 */
  type: TrustAssetType;
  /** 기여 기관 ID */
  contributorId: string;
  /** 자산 내용 (증명된 요약만 허용, 원시 데이터 불가) */
  content: string;
  /** 증명 해시 — 반드시 존재해야 함 */
  attestationHash: string;
  /** 증명 일시 */
  attestedAt: Date;
  /** 접근 횟수 */
  accessCount: number;
  /** 만료 일시 (null이면 무기한) */
  expiresAt: Date | null;
  /** 퇴역 여부 */
  retired: boolean;
}

// ── 인메모리 저장소 ──
const trustAssets: TrustAsset[] = [];

/**
 * 신뢰 자산을 기여한다.
 * CRITICAL: attestationHash가 없으면 거부한다.
 *
 * @param params 자산 기여 파라미터
 * @returns 등록된 자산
 */
export function contributeAsset(params: {
  id: string;
  type: TrustAssetType;
  contributorId: string;
  content: string;
  attestationHash: string;
  expiresAt?: Date | null;
}): TrustAsset {
  // attestationHash 필수 검증
  if (!params.attestationHash || params.attestationHash.trim().length === 0) {
    throw new Error('CRITICAL: attestationHash가 없는 자산은 커먼즈에 기여할 수 없습니다. 원시 데이터 저장 금지.');
  }

  const existing = trustAssets.find((a) => a.id === params.id);
  if (existing) {
    throw new Error(`이미 존재하는 자산 ID: ${params.id}`);
  }

  const asset: TrustAsset = {
    id: params.id,
    type: params.type,
    contributorId: params.contributorId,
    content: params.content,
    attestationHash: params.attestationHash,
    attestedAt: new Date(),
    accessCount: 0,
    expiresAt: params.expiresAt ?? null,
    retired: false,
  };

  trustAssets.push(asset);
  return { ...asset };
}

/**
 * 자산을 조회한다. 접근 횟수를 증가시킨다.
 * @param assetId 자산 ID
 * @returns 자산 또는 null
 */
export function getAsset(assetId: string): TrustAsset | null {
  const asset = trustAssets.find((a) => a.id === assetId && !a.retired);
  if (!asset) return null;

  // 만료 확인
  if (asset.expiresAt && asset.expiresAt < new Date()) {
    return null;
  }

  asset.accessCount += 1;
  return { ...asset };
}

/**
 * 자산을 검색한다.
 * @param filters 검색 필터
 * @returns 매칭된 자산 배열
 */
export function searchAssets(filters: {
  type?: TrustAssetType;
  contributorId?: string;
  keyword?: string;
}): TrustAsset[] {
  const now = new Date();
  return trustAssets
    .filter((a) => {
      if (a.retired) return false;
      if (a.expiresAt && a.expiresAt < now) return false;
      if (filters.type && a.type !== filters.type) return false;
      if (filters.contributorId && a.contributorId !== filters.contributorId) return false;
      if (filters.keyword && !a.content.includes(filters.keyword)) return false;
      return true;
    })
    .map((a) => ({ ...a }));
}

/**
 * 자산을 퇴역시킨다.
 * @param assetId 자산 ID
 */
export function retireAsset(assetId: string): boolean {
  const asset = trustAssets.find((a) => a.id === assetId);
  if (!asset) return false;
  asset.retired = true;
  return true;
}

/**
 * 기관별 기여 통계를 반환한다.
 * @param contributorId 기관 ID
 */
export function getContributionStats(contributorId: string): {
  totalContributed: number;
  activeAssets: number;
  retiredAssets: number;
  totalAccessCount: number;
} {
  const contributed = trustAssets.filter((a) => a.contributorId === contributorId);
  const active = contributed.filter((a) => !a.retired);
  const retired = contributed.filter((a) => a.retired);
  const totalAccessCount = contributed.reduce((sum, a) => sum + a.accessCount, 0);

  return {
    totalContributed: contributed.length,
    activeAssets: active.length,
    retiredAssets: retired.length,
    totalAccessCount,
  };
}

/**
 * @module regulatory-variance
 * @description 규제 분산 관리 — 관할권 간 규제 차이를 식별·비교·해결하는 순수 함수 모듈
 */

/** 규제 분산 유형 */
export type VarianceType =
  | 'DATA_RETENTION'
  | 'CONSENT_REQUIREMENTS'
  | 'BREACH_NOTIFICATION'
  | 'RIGHT_TO_ERASURE'
  | 'AI_REGULATION';

/** 규제 분산 정보 */
export interface RegulatoryVariance {
  /** 분산 고유 ID */
  id: string;
  /** 분산 유형 */
  type: VarianceType;
  /** 관할권 A ID */
  jurisdictionA: string;
  /** 관할권 B ID */
  jurisdictionB: string;
  /** 차이 설명 */
  description: string;
  /** 해결 방안 */
  resolution: string;
  /** 영향도 (1~10) */
  impact: number;
}

/** 분산 매트릭스 항목 */
export interface VarianceMatrixEntry {
  jurisdictionA: string;
  jurisdictionB: string;
  variances: RegulatoryVariance[];
  totalImpact: number;
}

/** 인메모리 분산 저장소 */
const varianceStore: RegulatoryVariance[] = [];

let varianceCounter = 0;

/**
 * 두 관할권 간 규제 분산을 식별·등록한다.
 * @param params 분산 정보 (id 제외)
 * @returns 등록된 분산 정보
 */
export function identifyVariances(
  params: Omit<RegulatoryVariance, 'id'>,
): RegulatoryVariance {
  const variance: RegulatoryVariance = {
    ...params,
    id: `rv-${++varianceCounter}`,
  };
  varianceStore.push(variance);
  return variance;
}

/**
 * 분산에 대한 해결 방안을 갱신한다.
 * @param varianceId 분산 ID
 * @param resolution 해결 방안
 * @returns 갱신된 분산 정보 또는 undefined
 */
export function resolveVariance(
  varianceId: string,
  resolution: string,
): RegulatoryVariance | undefined {
  const v = varianceStore.find((item) => item.id === varianceId);
  if (!v) return undefined;
  v.resolution = resolution;
  return { ...v };
}

/**
 * 전체 관할권 쌍에 대한 분산 매트릭스를 생성한다.
 * @returns 분산 매트릭스 배열
 */
export function getVarianceMatrix(): VarianceMatrixEntry[] {
  const pairMap = new Map<string, RegulatoryVariance[]>();

  for (const v of varianceStore) {
    const key = [v.jurisdictionA, v.jurisdictionB].sort().join('|');
    if (!pairMap.has(key)) {
      pairMap.set(key, []);
    }
    pairMap.get(key)!.push(v);
  }

  const matrix: VarianceMatrixEntry[] = [];
  pairMap.forEach((variances: RegulatoryVariance[], key: string) => {
    const [a, b] = key.split('|');
    matrix.push({
      jurisdictionA: a,
      jurisdictionB: b,
      variances,
      totalImpact: variances.reduce((sum: number, v: RegulatoryVariance) => sum + v.impact, 0),
    });
  });

  return matrix;
}

/**
 * 주어진 분산 유형에 대해 가장 높은 기준을 적용하는 관할권을 반환한다.
 * @param type 분산 유형
 * @returns 가장 높은 기준의 관할권 ID 또는 undefined
 */
export function getHighestStandard(type: VarianceType): string | undefined {
  const relevant = varianceStore.filter((v) => v.type === type);
  if (relevant.length === 0) return undefined;

  // 영향도가 가장 높은 분산에서 관할권 A를 최고 기준으로 간주
  const sorted = [...relevant].sort((a, b) => b.impact - a.impact);
  return sorted[0].jurisdictionA;
}

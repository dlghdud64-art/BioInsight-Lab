/**
 * @module operator-readiness-index
 * @description 운영자 준비도 지수 — 운영자의 기술적, 절차적, 리더십, 위기 관리, 도메인 지식 역량을 평가하고 인증합니다.
 */

/** 준비도 평가 차원 */
export type ReadinessDimension =
  | 'TECHNICAL'
  | 'PROCEDURAL'
  | 'LEADERSHIP'
  | 'CRISIS_MANAGEMENT'
  | 'DOMAIN_KNOWLEDGE';

/** 준비도 점수 */
export interface ReadinessScore {
  /** 운영자 ID */
  operatorId: string;
  /** 평가 차원 */
  dimension: ReadinessDimension;
  /** 점수 (0-100) */
  score: number;
  /** 평가 일시 */
  assessedAt: Date;
  /** 보유 인증 목록 */
  certifications: string[];
  /** 역량 격차 목록 */
  gaps: string[];
}

/** 운영자 준비도 프로파일 */
export interface ReadinessProfile {
  /** 운영자 ID */
  operatorId: string;
  /** 차원별 점수 */
  scores: ReadinessScore[];
  /** 전체 준비도 (가중 평균) */
  overallReadiness: number;
  /** 최종 평가 일시 */
  lastAssessedAt: Date;
  /** 인증 여부 */
  certified: boolean;
}

/** 인메모리 점수 저장소 */
const scoreStore: ReadinessScore[] = [];
/** 인증된 운영자 집합 */
const certifiedOperators = new Set<string>();

const ALL_DIMENSIONS: ReadinessDimension[] = [
  'TECHNICAL',
  'PROCEDURAL',
  'LEADERSHIP',
  'CRISIS_MANAGEMENT',
  'DOMAIN_KNOWLEDGE',
];

/**
 * 운영자의 특정 차원 준비도를 평가합니다.
 * @param operatorId - 운영자 ID
 * @param dimension - 평가 차원
 * @param score - 점수 (0-100)
 * @param certifications - 보유 인증
 * @param gaps - 역량 격차
 * @returns 준비도 점수
 */
export function assessReadiness(
  operatorId: string,
  dimension: ReadinessDimension,
  score: number,
  certifications: string[] = [],
  gaps: string[] = []
): ReadinessScore {
  const clampedScore = Math.max(0, Math.min(100, score));
  const entry: ReadinessScore = {
    operatorId,
    dimension,
    score: clampedScore,
    assessedAt: new Date(),
    certifications: [...certifications],
    gaps: [...gaps],
  };
  scoreStore.push(entry);
  return { ...entry };
}

/**
 * 운영자의 전체 준비도 프로파일을 조회합니다.
 * @param operatorId - 운영자 ID
 * @returns 준비도 프로파일
 */
export function getReadinessProfile(operatorId: string): ReadinessProfile {
  const latestScores = new Map<ReadinessDimension, ReadinessScore>();

  for (const s of scoreStore) {
    if (s.operatorId !== operatorId) continue;
    const existing = latestScores.get(s.dimension);
    if (!existing || s.assessedAt > existing.assessedAt) {
      latestScores.set(s.dimension, s);
    }
  }

  const scores = Array.from(latestScores.values()).map((s) => ({ ...s }));
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  const overallReadiness = scores.length > 0 ? total / scores.length : 0;
  const lastAssessedAt =
    scores.length > 0
      ? new Date(Math.max(...scores.map((s) => s.assessedAt.getTime())))
      : new Date();

  return {
    operatorId,
    scores,
    overallReadiness: Math.round(overallReadiness * 100) / 100,
    lastAssessedAt,
    certified: certifiedOperators.has(operatorId),
  };
}

/**
 * 운영자의 역량 격차를 식별합니다.
 * @param operatorId - 운영자 ID
 * @param threshold - 최소 기준 점수 (기본값 70)
 * @returns 차원별 격차 목록
 */
export function identifyGaps(
  operatorId: string,
  threshold: number = 70
): Array<{ dimension: ReadinessDimension; currentScore: number; gap: number; details: string[] }> {
  const profile = getReadinessProfile(operatorId);
  const gaps: Array<{
    dimension: ReadinessDimension;
    currentScore: number;
    gap: number;
    details: string[];
  }> = [];

  for (const dim of ALL_DIMENSIONS) {
    const score = profile.scores.find((s) => s.dimension === dim);
    const current = score?.score ?? 0;
    if (current < threshold) {
      gaps.push({
        dimension: dim,
        currentScore: current,
        gap: threshold - current,
        details: score?.gaps ?? [`${dim} 차원의 평가가 필요합니다.`],
      });
    }
  }

  return gaps;
}

/**
 * 운영자를 인증합니다.
 * @param operatorId - 운영자 ID
 * @param minimumScore - 최소 인증 점수 (기본값 70)
 * @returns 인증 결과
 */
export function certifyOperator(
  operatorId: string,
  minimumScore: number = 70
): { certified: boolean; reason: string } {
  const profile = getReadinessProfile(operatorId);

  if (profile.scores.length < ALL_DIMENSIONS.length) {
    return {
      certified: false,
      reason: `모든 차원(${ALL_DIMENSIONS.length}개)에 대한 평가가 필요합니다. 현재 ${profile.scores.length}개 완료.`,
    };
  }

  const belowThreshold = profile.scores.filter(
    (s) => s.score < minimumScore
  );
  if (belowThreshold.length > 0) {
    return {
      certified: false,
      reason: `${belowThreshold.map((s) => s.dimension).join(', ')} 차원이 최소 기준(${minimumScore})에 미달합니다.`,
    };
  }

  certifiedOperators.add(operatorId);
  return { certified: true, reason: '모든 차원에서 기준을 충족하여 인증되었습니다.' };
}

/**
 * 팀 전체의 준비도를 조회합니다.
 * @param operatorIds - 팀원 ID 목록
 * @returns 팀 준비도 요약
 */
export function getTeamReadiness(operatorIds: string[]): {
  teamSize: number;
  averageReadiness: number;
  certifiedCount: number;
  dimensionAverages: Record<ReadinessDimension, number>;
  riskOperators: string[];
} {
  const profiles = operatorIds.map((id) => getReadinessProfile(id));
  const totalReadiness = profiles.reduce(
    (sum, p) => sum + p.overallReadiness,
    0
  );

  const dimTotals: Record<ReadinessDimension, { sum: number; count: number }> =
    {} as Record<ReadinessDimension, { sum: number; count: number }>;
  for (const dim of ALL_DIMENSIONS) {
    dimTotals[dim] = { sum: 0, count: 0 };
  }

  for (const p of profiles) {
    for (const s of p.scores) {
      dimTotals[s.dimension].sum += s.score;
      dimTotals[s.dimension].count += 1;
    }
  }

  const dimensionAverages = {} as Record<ReadinessDimension, number>;
  for (const dim of ALL_DIMENSIONS) {
    dimensionAverages[dim] =
      dimTotals[dim].count > 0
        ? Math.round((dimTotals[dim].sum / dimTotals[dim].count) * 100) / 100
        : 0;
  }

  const riskOperators = profiles
    .filter((p) => p.overallReadiness < 50)
    .map((p) => p.operatorId);

  return {
    teamSize: operatorIds.length,
    averageReadiness:
      profiles.length > 0
        ? Math.round((totalReadiness / profiles.length) * 100) / 100
        : 0,
    certifiedCount: profiles.filter((p) => p.certified).length,
    dimensionAverages,
    riskOperators,
  };
}

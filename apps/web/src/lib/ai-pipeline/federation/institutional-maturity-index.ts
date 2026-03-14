/**
 * @module institutional-maturity-index
 * @description 기관 성숙도 지수
 *
 * 5개 차원(위기대응, 증적품질, 승계준비, 컴플라이언스, 기여수준)에 대한
 * 가중 평가를 수행하여 기관 등급을 자동 산정한다.
 */

/** 성숙도 등급 */
export type MaturityGrade =
  | 'FEDERATION_READY'
  | 'WATCH_REQUIRED'
  | 'IMPROVEMENT_NEEDED'
  | 'AT_RISK'
  | 'SUSPENDED';

/** 성숙도 차원 */
export type MaturityDimension =
  | 'CRISIS_RESPONSE'
  | 'EVIDENCE_QUALITY'
  | 'SUCCESSION_READINESS'
  | 'COMPLIANCE_POSTURE'
  | 'CONTRIBUTION_LEVEL';

/** 차원별 점수 */
export interface DimensionScore {
  /** 차원 */
  dimension: MaturityDimension;
  /** 점수 (0–100) */
  score: number;
  /** 가중치 */
  weight: number;
  /** 상세 설명 */
  details: string;
}

/** 성숙도 평가 결과 */
export interface MaturityAssessment {
  /** 대상 기관 ID */
  institutionId: string;
  /** 산정 등급 */
  grade: MaturityGrade;
  /** 차원별 점수 */
  dimensions: DimensionScore[];
  /** 종합 점수 (0–100) */
  overallScore: number;
  /** 평가 일시 */
  assessedAt: Date;
  /** 다음 평가 예정일 */
  nextAssessmentDue: Date;
}

/** 개선 영역 */
export interface ImprovementArea {
  /** 차원 */
  dimension: MaturityDimension;
  /** 현재 점수 */
  currentScore: number;
  /** 목표 점수 */
  targetScore: number;
  /** 권고 조치 */
  recommendation: string;
}

// ── 인메모리 저장소 ──
const assessments: MaturityAssessment[] = [];

/** 차원별 기본 가중치 */
const DIMENSION_WEIGHTS: Record<MaturityDimension, number> = {
  CRISIS_RESPONSE: 0.25,
  EVIDENCE_QUALITY: 0.20,
  SUCCESSION_READINESS: 0.20,
  COMPLIANCE_POSTURE: 0.20,
  CONTRIBUTION_LEVEL: 0.15,
};

/**
 * 점수 기반 등급 자동 산정
 */
function calculateGrade(score: number): MaturityGrade {
  if (score >= 80) return 'FEDERATION_READY';
  if (score >= 65) return 'WATCH_REQUIRED';
  if (score >= 50) return 'IMPROVEMENT_NEEDED';
  if (score >= 30) return 'AT_RISK';
  return 'SUSPENDED';
}

/**
 * 기관 성숙도를 평가한다.
 * 5개 차원에 대한 가중 점수를 집계하여 등급을 자동 산정한다.
 *
 * @param params 평가 입력
 * @returns 성숙도 평가 결과
 */
export function assessMaturity(params: {
  institutionId: string;
  scores: Record<MaturityDimension, { score: number; details: string }>;
  assessmentIntervalDays?: number;
}): MaturityAssessment {
  const dimensions: DimensionScore[] = [];

  for (const dim of Object.keys(DIMENSION_WEIGHTS) as MaturityDimension[]) {
    const input = params.scores[dim];
    dimensions.push({
      dimension: dim,
      score: Math.max(0, Math.min(100, input.score)),
      weight: DIMENSION_WEIGHTS[dim],
      details: input.details,
    });
  }

  // 가중 종합 점수
  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  const grade = calculateGrade(overallScore);
  const intervalDays = params.assessmentIntervalDays ?? 30;

  const assessment: MaturityAssessment = {
    institutionId: params.institutionId,
    grade,
    dimensions,
    overallScore,
    assessedAt: new Date(),
    nextAssessmentDue: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
  };

  assessments.push(assessment);
  return cloneAssessment(assessment);
}

/**
 * 기관의 성숙도 프로필(최신 평가)을 반환한다.
 *
 * @param institutionId 기관 ID
 */
export function getMaturityProfile(institutionId: string): MaturityAssessment | null {
  const filtered = assessments.filter((a) => a.institutionId === institutionId);
  if (filtered.length === 0) return null;
  return cloneAssessment(filtered[filtered.length - 1]);
}

/**
 * 기관의 성숙도 추이를 반환한다.
 *
 * @param institutionId 기관 ID
 * @param limit 최대 반환 건수
 */
export function getMaturityTrend(
  institutionId: string,
  limit: number = 10,
): MaturityAssessment[] {
  return assessments
    .filter((a) => a.institutionId === institutionId)
    .slice(-limit)
    .map(cloneAssessment);
}

/**
 * 개선이 필요한 영역을 식별한다.
 *
 * @param institutionId 기관 ID
 * @param targetGrade 목표 등급
 */
export function identifyImprovementAreas(
  institutionId: string,
  targetGrade: MaturityGrade = 'FEDERATION_READY',
): ImprovementArea[] {
  const profile = getMaturityProfile(institutionId);
  if (!profile) return [];

  const targetScore = targetGrade === 'FEDERATION_READY' ? 80
    : targetGrade === 'WATCH_REQUIRED' ? 65
    : targetGrade === 'IMPROVEMENT_NEEDED' ? 50
    : 30;

  const areas: ImprovementArea[] = [];
  for (const dim of profile.dimensions) {
    if (dim.score < targetScore) {
      areas.push({
        dimension: dim.dimension,
        currentScore: dim.score,
        targetScore,
        recommendation: `${dim.dimension} 차원의 점수를 ${dim.score}에서 ${targetScore}로 향상 필요`,
      });
    }
  }

  return areas;
}

/** 평가 깊은 복사 */
function cloneAssessment(a: MaturityAssessment): MaturityAssessment {
  return {
    ...a,
    dimensions: a.dimensions.map((d) => ({ ...d })),
  };
}

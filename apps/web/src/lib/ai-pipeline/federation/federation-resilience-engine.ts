/**
 * @module federation-resilience-engine
 * @description 연합 회복력 엔진
 *
 * 연합 네트워크의 회복력을 다차원으로 평가하고,
 * 공통 모드 리스크를 감지하며, 스튜어드십 갭이 감지되면
 * 연합 확장 속도를 조절한다.
 */

/** 회복력 지표 */
export type ResilienceMetric =
  | 'STEWARDSHIP_COVERAGE'
  | 'COMMON_MODE_RISK'
  | 'EXPANSION_VELOCITY'
  | 'DEPENDENCY_CONCENTRATION'
  | 'SUCCESSION_READINESS';

/** 취약점 */
export interface Vulnerability {
  /** 관련 지표 */
  metric: ResilienceMetric;
  /** 취약점 설명 */
  description: string;
  /** 심각도 (1–10) */
  severity: number;
  /** 영향받는 기관 ID 목록 */
  affectedInstitutions: string[];
}

/** 권고 사항 */
export interface Recommendation {
  /** 관련 지표 */
  metric: ResilienceMetric;
  /** 권고 내용 */
  action: string;
  /** 우선순위 (HIGH, MEDIUM, LOW) */
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** 지표 점수 */
export interface MetricScore {
  /** 지표 이름 */
  metric: ResilienceMetric;
  /** 점수 (0–100) */
  score: number;
  /** 상세 설명 */
  details: string;
}

/** 회복력 평가 결과 */
export interface ResilienceAssessment {
  /** 네트워크 종합 점수 (0–100) */
  networkScore: number;
  /** 개별 지표 점수 */
  metrics: MetricScore[];
  /** 감지된 취약점 */
  vulnerabilities: Vulnerability[];
  /** 권고 사항 */
  recommendations: Recommendation[];
  /** 평가 일시 */
  assessedAt: Date;
}

/** 공통 모드 리스크 */
export interface CommonModeRisk {
  /** 리스크 ID */
  id: string;
  /** 리스크 설명 */
  description: string;
  /** 영향받는 기관 수 */
  affectedCount: number;
  /** 영향받는 기관 ID 목록 */
  affectedInstitutions: string[];
  /** 감지 일시 */
  detectedAt: Date;
}

/** 확장 조절 결과 */
export interface ExpansionThrottleResult {
  /** 조절 적용 여부 */
  throttled: boolean;
  /** 사유 */
  reason: string;
  /** 권장 최대 확장 속도 (기관 수/월) */
  maxExpansionRate: number;
}

// ── 인메모리 저장소 ──
const assessmentHistory: ResilienceAssessment[] = [];
const detectedRisks: CommonModeRisk[] = [];

/**
 * 네트워크 회복력을 평가한다.
 *
 * @param params 평가 입력 데이터
 * @returns 회복력 평가 결과
 */
export function assessNetworkResilience(params: {
  /** 전체 기관 수 */
  totalMembers: number;
  /** 스튜어드십 담당 기관 수 */
  stewardshipCoveredMembers: number;
  /** 승계 계획 보유 기관 수 */
  successionReadyMembers: number;
  /** 공통 의존성 기관 수 (동일 인프라 사용) */
  sharedDependencyMembers: number;
  /** 최근 1개월 신규 가입 기관 수 */
  recentExpansionCount: number;
  /** 공통 모드 리스크 건수 */
  commonModeRiskCount: number;
}): ResilienceAssessment {
  const metrics: MetricScore[] = [];
  const vulnerabilities: Vulnerability[] = [];
  const recommendations: Recommendation[] = [];

  // 1. 스튜어드십 커버리지
  const stewardshipRatio = params.totalMembers > 0
    ? (params.stewardshipCoveredMembers / params.totalMembers) * 100
    : 0;
  metrics.push({
    metric: 'STEWARDSHIP_COVERAGE',
    score: Math.round(stewardshipRatio),
    details: `${params.stewardshipCoveredMembers}/${params.totalMembers} 기관 커버됨`,
  });
  if (stewardshipRatio < 80) {
    vulnerabilities.push({
      metric: 'STEWARDSHIP_COVERAGE',
      description: '스튜어드십 커버리지 부족',
      severity: stewardshipRatio < 50 ? 9 : 6,
      affectedInstitutions: [],
    });
    recommendations.push({
      metric: 'STEWARDSHIP_COVERAGE',
      action: '스튜어드십 미커버 기관에 대한 담당자 지정 필요',
      priority: stewardshipRatio < 50 ? 'HIGH' : 'MEDIUM',
    });
  }

  // 2. 공통 모드 리스크
  const commonModeScore = Math.max(0, 100 - params.commonModeRiskCount * 20);
  metrics.push({
    metric: 'COMMON_MODE_RISK',
    score: commonModeScore,
    details: `공통 모드 리스크 ${params.commonModeRiskCount}건 감지`,
  });
  if (params.commonModeRiskCount > 0) {
    vulnerabilities.push({
      metric: 'COMMON_MODE_RISK',
      description: `${params.commonModeRiskCount}건의 공통 모드 리스크 존재`,
      severity: Math.min(10, params.commonModeRiskCount * 3),
      affectedInstitutions: [],
    });
  }

  // 3. 확장 속도
  const expansionScore = params.recentExpansionCount <= 2 ? 100
    : params.recentExpansionCount <= 5 ? 70
    : 40;
  metrics.push({
    metric: 'EXPANSION_VELOCITY',
    score: expansionScore,
    details: `최근 1개월 ${params.recentExpansionCount}개 기관 가입`,
  });

  // 4. 의존성 집중도
  const depRatio = params.totalMembers > 0
    ? ((params.totalMembers - params.sharedDependencyMembers) / params.totalMembers) * 100
    : 100;
  metrics.push({
    metric: 'DEPENDENCY_CONCENTRATION',
    score: Math.round(depRatio),
    details: `${params.sharedDependencyMembers}개 기관이 공통 인프라에 의존`,
  });

  // 5. 승계 준비도
  const successionRatio = params.totalMembers > 0
    ? (params.successionReadyMembers / params.totalMembers) * 100
    : 0;
  metrics.push({
    metric: 'SUCCESSION_READINESS',
    score: Math.round(successionRatio),
    details: `${params.successionReadyMembers}/${params.totalMembers} 기관 승계 계획 보유`,
  });
  if (successionRatio < 60) {
    recommendations.push({
      metric: 'SUCCESSION_READINESS',
      action: '승계 계획 미수립 기관에 대한 즉각적 조치 필요',
      priority: 'HIGH',
    });
  }

  // 종합 점수
  const networkScore = Math.round(
    metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length,
  );

  const assessment: ResilienceAssessment = {
    networkScore,
    metrics,
    vulnerabilities,
    recommendations,
    assessedAt: new Date(),
  };

  assessmentHistory.push(assessment);
  return assessment;
}

/**
 * 공통 모드 리스크를 감지한다.
 *
 * @param institutions 기관 목록 (ID와 의존성 정보)
 * @returns 감지된 공통 모드 리스크 목록
 */
export function detectCommonModeRisks(
  institutions: Array<{ id: string; dependencies: string[] }>,
): CommonModeRisk[] {
  const depMap = new Map<string, string[]>();

  for (const inst of institutions) {
    for (const dep of inst.dependencies) {
      const list = depMap.get(dep) ?? [];
      list.push(inst.id);
      depMap.set(dep, list);
    }
  }

  const risks: CommonModeRisk[] = [];
  for (const [dep, affectedIds] of Array.from(depMap.entries())) {
    if (affectedIds.length >= 2) {
      const risk: CommonModeRisk = {
        id: `CMR_${dep}`,
        description: `의존성 '${dep}'에 ${affectedIds.length}개 기관 동시 의존`,
        affectedCount: affectedIds.length,
        affectedInstitutions: [...affectedIds],
        detectedAt: new Date(),
      };
      risks.push(risk);
      detectedRisks.push(risk);
    }
  }

  return risks;
}

/**
 * 스튜어드십 갭 감지 시 연합 확장 속도를 조절한다.
 *
 * @param stewardshipGapDetected 스튜어드십 갭 감지 여부
 * @param currentExpansionRate 현재 확장 속도 (기관 수/월)
 * @returns 조절 결과
 */
export function throttleExpansion(
  stewardshipGapDetected: boolean,
  currentExpansionRate: number,
): ExpansionThrottleResult {
  if (stewardshipGapDetected) {
    return {
      throttled: true,
      reason: '스튜어드십 갭이 감지되어 확장 속도를 제한합니다',
      maxExpansionRate: Math.max(1, Math.floor(currentExpansionRate * 0.3)),
    };
  }

  return {
    throttled: false,
    reason: '스튜어드십 갭 없음 — 정상 확장 가능',
    maxExpansionRate: currentExpansionRate,
  };
}

/**
 * 회복력 평가 추이를 반환한다.
 *
 * @param limit 최대 반환 건수
 */
export function getResilienceTrend(limit: number = 10): ResilienceAssessment[] {
  return assessmentHistory
    .slice(-limit)
    .map((a) => ({
      ...a,
      metrics: a.metrics.map((m) => ({ ...m })),
      vulnerabilities: a.vulnerabilities.map((v) => ({ ...v, affectedInstitutions: [...v.affectedInstitutions] })),
      recommendations: a.recommendations.map((r) => ({ ...r })),
    }));
}

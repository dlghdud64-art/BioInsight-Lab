/**
 * @module succession-simulation
 * @description 승계 시뮬레이션 — 계획적 전환, 갑작스러운 이탈, 팀 재구성, 성장 확장, 위기 로테이션 등 다양한 승계 시나리오를 시뮬레이션합니다.
 */

/** 시뮬레이션 시나리오 */
export type SimulationScenario =
  | 'PLANNED_TRANSITION'
  | 'SUDDEN_DEPARTURE'
  | 'TEAM_RESTRUCTURE'
  | 'GROWTH_SCALING'
  | 'CRISIS_ROTATION';

/** 시뮬레이션 결과 */
export interface SimulationResult {
  /** 시나리오 ID */
  scenarioId: string;
  /** 시나리오 유형 */
  scenario: SimulationScenario;
  /** 준비도 점수 (0-100) */
  readinessScore: number;
  /** 식별된 격차 */
  gaps: string[];
  /** 권고 사항 */
  recommendations: string[];
  /** 시뮬레이션 실행 일시 */
  simulatedAt: Date;
}

/** 핵심 인력 위험 정보 */
export interface KeyPersonRisk {
  /** 인력 식별자 */
  personId: string;
  /** 역할 */
  role: string;
  /** 위험 수준 (0-100, 높을수록 위험) */
  riskScore: number;
  /** 위험 요인 */
  riskFactors: string[];
  /** 후보 후임자 수 */
  successorCount: number;
}

/** 승계 계획 */
export interface SuccessionPlan {
  /** 대상 역할 */
  role: string;
  /** 현임자 */
  incumbent: string;
  /** 후임 후보 목록 */
  successors: Array<{ personId: string; readiness: number; timeline: string }>;
  /** 개발 계획 */
  developmentActions: string[];
  /** 생성 일시 */
  createdAt: Date;
}

/** 인메모리 시뮬레이션 결과 저장소 */
const resultStore: SimulationResult[] = [];

/** 시나리오별 기본 가중치 */
const scenarioWeights: Record<SimulationScenario, { timeWeight: number; complexityWeight: number }> = {
  PLANNED_TRANSITION: { timeWeight: 0.3, complexityWeight: 0.3 },
  SUDDEN_DEPARTURE: { timeWeight: 0.9, complexityWeight: 0.7 },
  TEAM_RESTRUCTURE: { timeWeight: 0.5, complexityWeight: 0.8 },
  GROWTH_SCALING: { timeWeight: 0.4, complexityWeight: 0.6 },
  CRISIS_ROTATION: { timeWeight: 0.8, complexityWeight: 0.5 },
};

/**
 * 승계 시뮬레이션을 실행합니다.
 * @param scenario - 시나리오 유형
 * @param params - 시뮬레이션 입력 파라미터
 * @returns 시뮬레이션 결과
 */
export function runSimulation(
  scenario: SimulationScenario,
  params: {
    teamSize: number;
    coveredRoles: number;
    avgReadiness: number;
    documentationLevel: number;
  }
): SimulationResult {
  const weights = scenarioWeights[scenario];

  // 준비도 점수 계산
  const coverageScore = params.teamSize > 0
    ? (params.coveredRoles / params.teamSize) * 100
    : 0;
  const readinessAdjustment = params.avgReadiness * (1 - weights.complexityWeight);
  const docAdjustment = params.documentationLevel * 0.2;
  const timeAdjustment = (1 - weights.timeWeight) * 20;

  const readinessScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (coverageScore * 0.3 + readinessAdjustment + docAdjustment + timeAdjustment) * 100
      ) / 100
    )
  );

  const gaps: string[] = [];
  const recommendations: string[] = [];

  if (coverageScore < 80) {
    gaps.push('일부 핵심 역할에 후임 후보가 부족합니다.');
    recommendations.push('모든 핵심 역할에 최소 1명의 후임 후보를 지정하세요.');
  }
  if (params.avgReadiness < 60) {
    gaps.push('전체 팀의 평균 준비도가 낮습니다.');
    recommendations.push('역량 개발 프로그램을 강화하세요.');
  }
  if (params.documentationLevel < 50) {
    gaps.push('프로세스 문서화 수준이 미흡합니다.');
    recommendations.push('핵심 프로세스에 대한 문서화를 진행하세요.');
  }
  if (scenario === 'SUDDEN_DEPARTURE' && coverageScore < 100) {
    gaps.push('갑작스러운 이탈 시 즉시 대응 가능한 인력이 부족합니다.');
    recommendations.push('크로스 트레이닝 프로그램을 도입하세요.');
  }

  const result: SimulationResult = {
    scenarioId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scenario,
    readinessScore,
    gaps,
    recommendations,
    simulatedAt: new Date(),
  };
  resultStore.push(result);
  return { ...result };
}

/**
 * 여러 시나리오의 시뮬레이션 결과를 비교합니다.
 * @param scenarioIds - 비교할 시나리오 ID 목록
 * @returns 비교 결과
 */
export function compareScenarios(scenarioIds: string[]): {
  scenarios: SimulationResult[];
  bestCase: SimulationResult | null;
  worstCase: SimulationResult | null;
  averageReadiness: number;
} {
  const scenarios = resultStore
    .filter((r) => scenarioIds.includes(r.scenarioId))
    .map((r) => ({ ...r }));

  if (scenarios.length === 0) {
    return { scenarios: [], bestCase: null, worstCase: null, averageReadiness: 0 };
  }

  const sorted = [...scenarios].sort(
    (a, b) => b.readinessScore - a.readinessScore
  );
  const total = scenarios.reduce((s, r) => s + r.readinessScore, 0);

  return {
    scenarios,
    bestCase: { ...sorted[0] },
    worstCase: { ...sorted[sorted.length - 1] },
    averageReadiness: Math.round((total / scenarios.length) * 100) / 100,
  };
}

/**
 * 승계 계획을 생성합니다.
 * @param role - 대상 역할
 * @param incumbent - 현임자
 * @param successors - 후임 후보 목록
 * @param developmentActions - 개발 활동
 * @returns 승계 계획
 */
export function generateSuccessionPlan(
  role: string,
  incumbent: string,
  successors: Array<{ personId: string; readiness: number; timeline: string }>,
  developmentActions: string[] = []
): SuccessionPlan {
  const autoActions: string[] = [];

  const lowReadiness = successors.filter((s) => s.readiness < 50);
  if (lowReadiness.length > 0) {
    autoActions.push(
      `${lowReadiness.length}명의 후보에 대한 집중 역량 개발 프로그램 필요`
    );
  }
  if (successors.length < 2) {
    autoActions.push('최소 2명의 후임 후보 확보 권장');
  }
  if (successors.length === 0) {
    autoActions.push('즉시 후임 후보 발굴 및 육성 시작');
  }

  return {
    role,
    incumbent,
    successors: successors.map((s) => ({ ...s })),
    developmentActions: [...developmentActions, ...autoActions],
    createdAt: new Date(),
  };
}

/**
 * 핵심 인력 위험을 식별합니다.
 * @param personnel - 인력 정보 목록
 * @returns 핵심 인력 위험 목록 (위험도 내림차순)
 */
export function identifyKeyPersonRisks(
  personnel: Array<{
    personId: string;
    role: string;
    tenure: number;
    uniqueSkills: number;
    successorCount: number;
    criticalProcesses: number;
  }>
): KeyPersonRisk[] {
  return personnel
    .map((p) => {
      const riskFactors: string[] = [];
      let riskScore = 0;

      if (p.successorCount === 0) {
        riskScore += 40;
        riskFactors.push('후임 후보가 없음');
      } else if (p.successorCount === 1) {
        riskScore += 15;
        riskFactors.push('후임 후보가 1명뿐임');
      }

      if (p.uniqueSkills > 3) {
        riskScore += 25;
        riskFactors.push(`${p.uniqueSkills}개의 고유 역량 보유`);
      }

      if (p.criticalProcesses > 2) {
        riskScore += 20;
        riskFactors.push(`${p.criticalProcesses}개의 핵심 프로세스 담당`);
      }

      if (p.tenure > 5) {
        riskScore += 15;
        riskFactors.push(`장기 재직(${p.tenure}년) — 암묵 지식 집중 위험`);
      }

      return {
        personId: p.personId,
        role: p.role,
        riskScore: Math.min(100, riskScore),
        riskFactors,
        successorCount: p.successorCount,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

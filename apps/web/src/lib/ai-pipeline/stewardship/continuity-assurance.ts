/**
 * @module continuity-assurance
 * @description 연속성 보증 — 핵심 인력 이탈, 팀 전환, 기술 마이그레이션, 벤더 퇴출, 규제 변경 등 다양한 시나리오에 대한 연속성 계획을 관리합니다.
 */

/** 연속성 시나리오 */
export type ContinuityScenario =
  | 'KEY_PERSON_DEPARTURE'
  | 'TEAM_TRANSITION'
  | 'TECHNOLOGY_MIGRATION'
  | 'VENDOR_EXIT'
  | 'REGULATORY_CHANGE';

/** 위험 수준 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 완화 단계 */
export interface MitigationStep {
  /** 단계 순서 */
  order: number;
  /** 단계 설명 */
  description: string;
  /** 담당자 */
  assignee: string;
  /** 완료 여부 */
  completed: boolean;
}

/** 연속성 계획 */
export interface ContinuityPlan {
  /** 고유 식별자 */
  id: string;
  /** 시나리오 유형 */
  scenario: ContinuityScenario;
  /** 위험 수준 */
  riskLevel: RiskLevel;
  /** 완화 단계 목록 */
  mitigationSteps: MitigationStep[];
  /** 계획 소유자 */
  owner: string;
  /** 최근 테스트 일시 */
  testedAt: Date | null;
  /** 테스트 결과 */
  testResult: string | null;
  /** 다음 테스트 예정일 */
  nextTestDue: Date | null;
  /** 생성 일시 */
  createdAt: Date;
}

/** 인메모리 계획 저장소 */
const planStore: ContinuityPlan[] = [];

/**
 * 새로운 연속성 계획을 생성합니다.
 * @param params - 계획 생성 정보
 * @returns 생성된 연속성 계획
 */
export function createPlan(
  params: Pick<ContinuityPlan, 'scenario' | 'riskLevel' | 'owner'> & {
    mitigationSteps?: Omit<MitigationStep, 'completed'>[];
    nextTestDue?: Date;
  }
): ContinuityPlan {
  const plan: ContinuityPlan = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scenario: params.scenario,
    riskLevel: params.riskLevel,
    mitigationSteps: (params.mitigationSteps ?? []).map((s) => ({
      ...s,
      completed: false,
    })),
    owner: params.owner,
    testedAt: null,
    testResult: null,
    nextTestDue: params.nextTestDue ?? null,
    createdAt: new Date(),
  };
  planStore.push(plan);
  return { ...plan };
}

/**
 * 연속성 계획을 테스트합니다.
 * @param planId - 계획 ID
 * @param result - 테스트 결과
 * @param nextTestDue - 다음 테스트 예정일
 * @returns 업데이트된 계획 또는 null
 */
export function testPlan(
  planId: string,
  result: string,
  nextTestDue?: Date
): ContinuityPlan | null {
  const plan = planStore.find((p) => p.id === planId);
  if (!plan) return null;

  plan.testedAt = new Date();
  plan.testResult = result;
  if (nextTestDue) {
    plan.nextTestDue = nextTestDue;
  }
  return { ...plan };
}

/**
 * 연속성 계획을 업데이트합니다.
 * @param planId - 계획 ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트된 계획 또는 null
 */
export function updatePlan(
  planId: string,
  updates: Partial<Pick<ContinuityPlan, 'riskLevel' | 'owner' | 'mitigationSteps'>>
): ContinuityPlan | null {
  const plan = planStore.find((p) => p.id === planId);
  if (!plan) return null;

  if (updates.riskLevel) plan.riskLevel = updates.riskLevel;
  if (updates.owner) plan.owner = updates.owner;
  if (updates.mitigationSteps) plan.mitigationSteps = [...updates.mitigationSteps];

  return { ...plan };
}

/**
 * 연속성 대시보드 정보를 조회합니다.
 * @returns 연속성 대시보드 요약
 */
export function getContinuityDashboard(): {
  totalPlans: number;
  byScenario: Record<ContinuityScenario, number>;
  byRiskLevel: Record<RiskLevel, number>;
  overdueTests: ContinuityPlan[];
  overallScore: number;
} {
  const now = new Date();
  const scenarios: ContinuityScenario[] = [
    'KEY_PERSON_DEPARTURE',
    'TEAM_TRANSITION',
    'TECHNOLOGY_MIGRATION',
    'VENDOR_EXIT',
    'REGULATORY_CHANGE',
  ];
  const riskLevels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  const byScenario = {} as Record<ContinuityScenario, number>;
  for (const s of scenarios) {
    byScenario[s] = planStore.filter((p) => p.scenario === s).length;
  }

  const byRiskLevel = {} as Record<RiskLevel, number>;
  for (const r of riskLevels) {
    byRiskLevel[r] = planStore.filter((p) => p.riskLevel === r).length;
  }

  const overdueTests = planStore
    .filter((p) => p.nextTestDue && p.nextTestDue < now)
    .map((p) => ({ ...p }));

  // 전체 점수 계산: 테스트된 계획 비율 + 위험 수준 가중치
  const testedCount = planStore.filter((p) => p.testedAt !== null).length;
  const testedRatio =
    planStore.length > 0 ? testedCount / planStore.length : 0;
  const overdueRatio =
    planStore.length > 0 ? 1 - overdueTests.length / planStore.length : 1;
  const overallScore =
    Math.round(((testedRatio * 0.6 + overdueRatio * 0.4) * 100) * 100) / 100;

  return {
    totalPlans: planStore.length,
    byScenario,
    byRiskLevel,
    overdueTests,
    overallScore,
  };
}

/**
 * 연속성 계획의 격차를 식별합니다.
 * @returns 미비 시나리오 및 개선 권고
 */
export function identifyGaps(): Array<{
  scenario: ContinuityScenario;
  issue: string;
  recommendation: string;
}> {
  const scenarios: ContinuityScenario[] = [
    'KEY_PERSON_DEPARTURE',
    'TEAM_TRANSITION',
    'TECHNOLOGY_MIGRATION',
    'VENDOR_EXIT',
    'REGULATORY_CHANGE',
  ];

  const gaps: Array<{
    scenario: ContinuityScenario;
    issue: string;
    recommendation: string;
  }> = [];

  for (const scenario of scenarios) {
    const plans = planStore.filter((p) => p.scenario === scenario);

    if (plans.length === 0) {
      gaps.push({
        scenario,
        issue: '해당 시나리오에 대한 연속성 계획이 없습니다.',
        recommendation: `'${scenario}' 시나리오에 대한 연속성 계획을 수립하세요.`,
      });
      continue;
    }

    const untestedPlans = plans.filter((p) => p.testedAt === null);
    if (untestedPlans.length > 0) {
      gaps.push({
        scenario,
        issue: `${untestedPlans.length}개의 계획이 테스트되지 않았습니다.`,
        recommendation: '모든 연속성 계획에 대해 정기적인 테스트를 수행하세요.',
      });
    }

    const criticalPlans = plans.filter((p) => p.riskLevel === 'CRITICAL');
    const emptyMitigation = criticalPlans.filter(
      (p) => p.mitigationSteps.length === 0
    );
    if (emptyMitigation.length > 0) {
      gaps.push({
        scenario,
        issue: '중대 위험 계획에 완화 단계가 없습니다.',
        recommendation: '중대 위험 계획에 대한 구체적인 완화 단계를 정의하세요.',
      });
    }
  }

  return gaps;
}

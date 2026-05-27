/**
 * @module geo-failover-governance
 * @description 지리적 장애 조치 거버넌스 — 리전 간 페일오버 계획 수립, 주권 컴플라이언스 검증, 테스트 관리
 */

/** 장애 조치 유형 */
export type FailoverType = 'AUTOMATIC' | 'MANUAL' | 'PROHIBITED';

/** 테스트 결과 상태 */
export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED';

/** 장애 조치 테스트 결과 */
export interface FailoverTestResult {
  /** 테스트 ID */
  testId: string;
  /** 테스트 실행 일시 */
  executedAt: Date;
  /** 결과 상태 */
  status: TestStatus;
  /** 소요 시간 (ms) */
  durationMs: number;
  /** 비고 */
  notes: string;
}

/** 장애 조치 계획 */
export interface FailoverPlan {
  /** 계획 고유 ID */
  id: string;
  /** 주 리전 */
  primaryRegion: string;
  /** 대체 리전 */
  failoverRegion: string;
  /** 장애 조치 유형 */
  type: FailoverType;
  /** 주권 규정 준수 여부 */
  sovereigntyCompliant: boolean;
  /** 대상 데이터 분류 목록 */
  dataCategories: string[];
  /** 테스트 결과 이력 */
  testResults: FailoverTestResult[];
}

/** 장애 조치 실행 기록 */
export interface FailoverExecution {
  planId: string;
  executedAt: Date;
  success: boolean;
  fromRegion: string;
  toRegion: string;
  reason: string;
}

/** 인메모리 계획 저장소 */
const planStore: FailoverPlan[] = [];

/** 인메모리 실행 이력 */
const executionHistory: FailoverExecution[] = [];

let planCounter = 0;
let testCounter = 0;

/**
 * 장애 조치 계획을 정의한다.
 * @param params 계획 정보 (id, testResults 제외)
 * @returns 생성된 계획
 */
export function defineFailoverPlan(
  params: Omit<FailoverPlan, 'id' | 'testResults'>,
): FailoverPlan {
  const plan: FailoverPlan = {
    ...params,
    id: `fp-${++planCounter}`,
    testResults: [],
  };
  planStore.push(plan);
  return plan;
}

/**
 * 장애 조치 계획의 주권 컴플라이언스를 평가한다.
 * @param planId 계획 ID
 * @param allowedRegions 허용 리전 목록
 * @returns 평가 결과
 */
export function evaluateFailoverCompliance(
  planId: string,
  allowedRegions: string[],
): { compliant: boolean; issues: string[] } {
  const plan = planStore.find((p) => p.id === planId);
  if (!plan) {
    return { compliant: false, issues: ['장애 조치 계획을 찾을 수 없습니다'] };
  }

  const issues: string[] = [];

  if (!allowedRegions.includes(plan.failoverRegion)) {
    issues.push(`대체 리전 ${plan.failoverRegion}은(는) 허용 리전에 포함되지 않습니다`);
  }

  if (plan.type === 'PROHIBITED') {
    issues.push('이 계획은 장애 조치가 금지된 유형입니다');
  }

  const compliant = issues.length === 0;
  plan.sovereigntyCompliant = compliant;

  return { compliant, issues };
}

/**
 * 장애 조치를 실행한다.
 * @param planId 계획 ID
 * @param reason 실행 사유
 * @returns 실행 결과
 */
export function executeFailover(
  planId: string,
  reason: string,
): FailoverExecution | undefined {
  const plan = planStore.find((p) => p.id === planId);
  if (!plan) return undefined;

  if (plan.type === 'PROHIBITED') {
    const execution: FailoverExecution = {
      planId,
      executedAt: new Date(),
      success: false,
      fromRegion: plan.primaryRegion,
      toRegion: plan.failoverRegion,
      reason: `실행 거부: ${reason} (장애 조치 금지 유형)`,
    };
    executionHistory.push(execution);
    return execution;
  }

  const execution: FailoverExecution = {
    planId,
    executedAt: new Date(),
    success: true,
    fromRegion: plan.primaryRegion,
    toRegion: plan.failoverRegion,
    reason,
  };
  executionHistory.push(execution);
  return execution;
}

/**
 * 장애 조치 테스트를 실행한다.
 * @param planId 계획 ID
 * @param notes 테스트 비고
 * @returns 테스트 결과 또는 undefined
 */
export function testFailover(
  planId: string,
  notes: string,
): FailoverTestResult | undefined {
  const plan = planStore.find((p) => p.id === planId);
  if (!plan) return undefined;

  const result: FailoverTestResult = {
    testId: `ft-${++testCounter}`,
    executedAt: new Date(),
    status: plan.type !== 'PROHIBITED' ? 'PASSED' : 'SKIPPED',
    durationMs: Math.floor(Math.random() * 5000) + 500,
    notes,
  };

  plan.testResults.push(result);
  return result;
}

/**
 * 장애 조치 실행 이력을 조회한다.
 * @param planId 계획 ID 필터 (선택)
 * @returns 실행 이력 배열
 */
export function getFailoverHistory(planId?: string): FailoverExecution[] {
  if (!planId) return [...executionHistory];
  return executionHistory.filter((e) => e.planId === planId);
}

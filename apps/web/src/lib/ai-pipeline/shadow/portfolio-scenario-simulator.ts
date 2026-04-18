/**
 * Strategic Command Layer (Phase P) — What-if 시뮬레이션 엔진
 * 사전 정의된 시나리오 또는 커스텀 시나리오로 포트폴리오 영향을 예측한다.
 * 인메모리 순수 연산, DB 의존성 없음.
 */

/** 시나리오 정의 */
export interface Scenario {
  scenarioId: string;
  name: string;
  /** 각 지표에 대한 조정값 (예: { budgetMultiplier: 0.8, volumeMultiplier: 2.0 }) */
  adjustments: Record<string, number>;
  /** 예상 처리량 변화율 */
  expectedThroughput: number;
  /** 예상 사고 확률 변화율 */
  expectedIncidentProbability: number;
  /** 예상 비용 변화 (양수 = 증가, 음수 = 감소) */
  expectedCostDelta: number;
}

/** 시뮬레이션 결과 */
export interface SimulationResult {
  scenarioId: string;
  metrics: {
    throughput: number;
    incidentProbability: number;
    costDelta: number;
    reviewCapacity: number;
    automationCoverage: number;
  };
  warnings: string[];
  recommendations: string[];
}

/** 사전 정의 시나리오 목록 */
export const PREDEFINED_SCENARIOS: Record<string, Scenario> = {
  /** 예산 20% 삭감 시나리오 */
  BUDGET_CUT_20: {
    scenarioId: 'BUDGET_CUT_20',
    name: '예산 20% 삭감',
    adjustments: {
      budgetMultiplier: 0.8,
      tokenBudgetMultiplier: 0.75,
      reviewCapacityMultiplier: 0.85,
    },
    expectedThroughput: -15,
    expectedIncidentProbability: 10,
    expectedCostDelta: -20,
  },
  /** ERP 시스템 장애 시나리오 */
  ERP_OUTAGE: {
    scenarioId: 'ERP_OUTAGE',
    name: 'ERP 시스템 장애',
    adjustments: {
      automationAvailability: 0.0,
      manualFallbackLoad: 3.0,
      reviewCapacityMultiplier: 0.5,
    },
    expectedThroughput: -70,
    expectedIncidentProbability: 40,
    expectedCostDelta: 150,
  },
  /** 문서량 2배 증가 시나리오 */
  DOUBLE_VOLUME: {
    scenarioId: 'DOUBLE_VOLUME',
    name: '문서량 2배 증가',
    adjustments: {
      volumeMultiplier: 2.0,
      reviewCapacityMultiplier: 1.0,
      tokenBudgetMultiplier: 1.5,
    },
    expectedThroughput: 80,
    expectedIncidentProbability: 15,
    expectedCostDelta: 90,
  },
  /** 신규 벤더 대량 유입 시나리오 */
  NEW_VENDOR_SURGE: {
    scenarioId: 'NEW_VENDOR_SURGE',
    name: '신규 벤더 대량 유입',
    adjustments: {
      vendorDiversity: 3.0,
      unknownFormatRate: 0.4,
      reviewCapacityMultiplier: 0.7,
    },
    expectedThroughput: -10,
    expectedIncidentProbability: 25,
    expectedCostDelta: 35,
  },
};

/**
 * 시나리오를 실행하여 예상 결과를 산출한다.
 * 인메모리 순수 연산 (production: DB-backed).
 */
export function runSimulation(scenario: Scenario): SimulationResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 기본 지표 (정규화된 기준값)
  const baseThroughput = 100;
  const baseIncidentProb = 0.03;
  const baseReviewCapacity = 100;
  const baseAutomationCoverage = 0.75;

  // 조정값 적용
  const budgetMult = scenario.adjustments['budgetMultiplier'] ?? 1.0;
  const volumeMult = scenario.adjustments['volumeMultiplier'] ?? 1.0;
  const reviewCapMult = scenario.adjustments['reviewCapacityMultiplier'] ?? 1.0;
  const automationAvail = scenario.adjustments['automationAvailability'] ?? 1.0;
  const unknownFormatRate = scenario.adjustments['unknownFormatRate'] ?? 0.0;

  // 처리량 계산
  const throughput = baseThroughput * volumeMult * automationAvail * Math.min(budgetMult, 1.2);

  // 사고 확률 계산 (예산 삭감, 볼륨 증가, 미지 포맷 증가 시 악화)
  const incidentProbability = Math.min(
    1.0,
    baseIncidentProb *
      (1 / Math.max(budgetMult, 0.3)) *
      Math.sqrt(volumeMult) *
      (1 + unknownFormatRate)
  );

  // 리뷰 용량 계산
  const reviewCapacity = baseReviewCapacity * reviewCapMult;

  // 자동화 커버리지 계산
  const automationCoverage = baseAutomationCoverage * automationAvail * Math.min(budgetMult, 1.0);

  // 비용 변화 계산
  const costDelta = scenario.expectedCostDelta;

  // 경고 생성
  if (incidentProbability > 0.1) {
    warnings.push('사고 확률이 10%를 초과합니다 — 즉시 대응 계획 필요');
  }
  if (reviewCapacity < 50) {
    warnings.push('리뷰 용량이 기준의 50% 미만 — 병목 예상');
  }
  if (automationCoverage < 0.3) {
    warnings.push('자동화 커버리지가 30% 미만으로 하락 — 수동 부담 급증 예상');
  }
  if (throughput > 180) {
    warnings.push('처리량이 기준의 180%를 초과 — 품질 저하 위험');
  }

  // 권고사항 생성
  if (incidentProbability > 0.05) {
    recommendations.push('리뷰 인력 증원 또는 자동화 정책 강화 권고');
  }
  if (budgetMult < 0.85) {
    recommendations.push('핵심 문서 유형에 예산 집중 배분 권고');
  }
  if (unknownFormatRate > 0.2) {
    recommendations.push('신규 포맷 학습 파이프라인 우선 구축 권고');
  }
  if (automationCoverage < 0.5) {
    recommendations.push('수동 처리 대비 인력 확보 필요');
  }

  return {
    scenarioId: scenario.scenarioId,
    metrics: {
      throughput: Math.round(throughput * 100) / 100,
      incidentProbability: Math.round(incidentProbability * 10000) / 10000,
      costDelta,
      reviewCapacity: Math.round(reviewCapacity * 100) / 100,
      automationCoverage: Math.round(automationCoverage * 1000) / 1000,
    },
    warnings,
    recommendations,
  };
}

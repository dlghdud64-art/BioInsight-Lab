/**
 * 접근 형평성 감시기
 *
 * 참여자 간 접근 형평성을 측정하고,
 * 저전력 참여자가 검토 큐에서 기아 상태에 빠지면
 * 즉시 교정적 재배분을 요구한다.
 */

/** 형평성 지표 */
export type EquityMetric =
  | 'QUEUE_WAIT_TIME_RATIO'
  | 'APPROVAL_RATE_DISPARITY'
  | 'RESOURCE_ALLOCATION_GINI'
  | 'STARVATION_RISK';

/** 교정 조치 */
export type CorrectionAction =
  | 'CORRECTIVE_REALLOCATION_REQUIRED'
  | 'MONITORING'
  | 'HEALTHY';

/** 형평성 경보 심각도 */
export type EquityAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 형평성 경보 */
export interface EquityAlert {
  /** 경보 ID */
  id: string;
  /** 형평성 지표 */
  metric: EquityMetric;
  /** 영향받는 참여자 목록 */
  affectedParticipants: string[];
  /** 심각도 */
  severity: EquityAlertSeverity;
  /** 필요한 교정 조치 */
  correctionNeeded: CorrectionAction;
  /** 감지 시점 */
  detectedAt: string;
}

/** 형평성 측정 입력 */
export interface EquityMeasurementInput {
  /** 참여자 ID */
  participantId: string;
  /** 큐 대기 시간 (ms) */
  queueWaitTimeMs: number;
  /** 승인율 (0~1) */
  approvalRate: number;
  /** 자원 배분량 */
  resourceAllocation: number;
  /** 저전력 참여자 여부 */
  isLowPower: boolean;
}

/** 형평성 측정 결과 */
export interface EquityMeasurement {
  metric: EquityMetric;
  value: number;
  threshold: number;
  breached: boolean;
  action: CorrectionAction;
}

/** 형평성 추세 항목 */
export interface EquityTrendEntry {
  measurements: EquityMeasurement[];
  alerts: EquityAlert[];
  overallAction: CorrectionAction;
  timestamp: string;
}

// ─── 인메모리 저장소 ───

const equityAlerts: EquityAlert[] = [];
const equityTrend: EquityTrendEntry[] = [];
let nextEquityAlertId = 1;

// 형평성 임계값
const THRESHOLDS = {
  QUEUE_WAIT_TIME_RATIO: 3.0,       // 저전력 참여자 대기시간이 평균의 3배 초과
  APPROVAL_RATE_DISPARITY: 0.3,     // 승인율 격차 30% 초과
  RESOURCE_ALLOCATION_GINI: 0.5,    // 지니계수 0.5 초과
  STARVATION_RISK: 0.7,             // 기아 위험 점수 0.7 초과
} as const;

/**
 * 형평성을 측정한다.
 * @param inputs 참여자별 형평성 측정 입력 배열
 * @returns 형평성 측정 결과 배열
 */
export function measureEquity(
  inputs: EquityMeasurementInput[]
): EquityMeasurement[] {
  const measurements: EquityMeasurement[] = [];

  // 큐 대기 시간 비율 측정
  const avgWaitTime =
    inputs.reduce((s, i) => s + i.queueWaitTimeMs, 0) / Math.max(inputs.length, 1);
  const lowPowerInputs = inputs.filter((i) => i.isLowPower);
  const lowPowerAvgWait =
    lowPowerInputs.reduce((s, i) => s + i.queueWaitTimeMs, 0) /
    Math.max(lowPowerInputs.length, 1);
  const waitRatio = avgWaitTime > 0 ? lowPowerAvgWait / avgWaitTime : 1;

  measurements.push({
    metric: 'QUEUE_WAIT_TIME_RATIO',
    value: waitRatio,
    threshold: THRESHOLDS.QUEUE_WAIT_TIME_RATIO,
    breached: waitRatio > THRESHOLDS.QUEUE_WAIT_TIME_RATIO,
    action:
      waitRatio > THRESHOLDS.QUEUE_WAIT_TIME_RATIO
        ? 'CORRECTIVE_REALLOCATION_REQUIRED'
        : 'HEALTHY',
  });

  // 승인율 격차 측정
  const approvalRates = inputs.map((i) => i.approvalRate);
  const maxApproval = Math.max(...approvalRates, 0);
  const minApproval = Math.min(...approvalRates, 0);
  const disparity = maxApproval - minApproval;

  measurements.push({
    metric: 'APPROVAL_RATE_DISPARITY',
    value: disparity,
    threshold: THRESHOLDS.APPROVAL_RATE_DISPARITY,
    breached: disparity > THRESHOLDS.APPROVAL_RATE_DISPARITY,
    action:
      disparity > THRESHOLDS.APPROVAL_RATE_DISPARITY ? 'MONITORING' : 'HEALTHY',
  });

  // 자원 배분 지니계수 측정
  const gini = computeGini(inputs.map((i) => i.resourceAllocation));
  measurements.push({
    metric: 'RESOURCE_ALLOCATION_GINI',
    value: gini,
    threshold: THRESHOLDS.RESOURCE_ALLOCATION_GINI,
    breached: gini > THRESHOLDS.RESOURCE_ALLOCATION_GINI,
    action:
      gini > THRESHOLDS.RESOURCE_ALLOCATION_GINI
        ? 'CORRECTIVE_REALLOCATION_REQUIRED'
        : 'HEALTHY',
  });

  // 기아 위험 측정
  const starvationScore = computeStarvationScore(inputs);
  measurements.push({
    metric: 'STARVATION_RISK',
    value: starvationScore,
    threshold: THRESHOLDS.STARVATION_RISK,
    breached: starvationScore > THRESHOLDS.STARVATION_RISK,
    action:
      starvationScore > THRESHOLDS.STARVATION_RISK
        ? 'CORRECTIVE_REALLOCATION_REQUIRED'
        : starvationScore > 0.4
          ? 'MONITORING'
          : 'HEALTHY',
  });

  return measurements;
}

/**
 * 저전력 참여자의 기아 상태를 탐지한다.
 * @param inputs 참여자별 형평성 측정 입력 배열
 * @returns 기아 상태인 참여자 ID 배열
 */
export function detectStarvation(
  inputs: EquityMeasurementInput[]
): string[] {
  const avgWaitTime =
    inputs.reduce((s, i) => s + i.queueWaitTimeMs, 0) / Math.max(inputs.length, 1);

  const starving = inputs.filter(
    (i) =>
      i.isLowPower &&
      i.queueWaitTimeMs > avgWaitTime * THRESHOLDS.QUEUE_WAIT_TIME_RATIO
  );

  if (starving.length > 0) {
    const alert: EquityAlert = {
      id: `EQ-${String(nextEquityAlertId++).padStart(6, '0')}`,
      metric: 'STARVATION_RISK',
      affectedParticipants: starving.map((s) => s.participantId),
      severity: starving.length > 3 ? 'CRITICAL' : 'HIGH',
      correctionNeeded: 'CORRECTIVE_REALLOCATION_REQUIRED',
      detectedAt: new Date().toISOString(),
    };
    equityAlerts.push(alert);
  }

  return starving.map((s) => s.participantId);
}

/**
 * 교정적 재배분을 트리거한다.
 * @param affectedParticipants 영향받는 참여자 ID 배열
 * @returns 교정 경보
 */
export function triggerCorrectiveReallocation(
  affectedParticipants: string[]
): EquityAlert {
  const alert: EquityAlert = {
    id: `EQ-${String(nextEquityAlertId++).padStart(6, '0')}`,
    metric: 'STARVATION_RISK',
    affectedParticipants,
    severity: 'CRITICAL',
    correctionNeeded: 'CORRECTIVE_REALLOCATION_REQUIRED',
    detectedAt: new Date().toISOString(),
  };

  equityAlerts.push(alert);
  return { ...alert };
}

/**
 * 형평성 추세를 반환한다.
 * @returns 형평성 추세 이력
 */
export function getEquityTrend(): ReadonlyArray<EquityTrendEntry> {
  return [...equityTrend];
}

// ─── 내부 헬퍼 ───

function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let sumOfDifferences = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfDifferences += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return sumOfDifferences / (2 * n * n * mean);
}

function computeStarvationScore(inputs: EquityMeasurementInput[]): number {
  const lowPower = inputs.filter((i) => i.isLowPower);
  if (lowPower.length === 0) return 0;

  const avgAllocation =
    inputs.reduce((s, i) => s + i.resourceAllocation, 0) /
    Math.max(inputs.length, 1);
  const avgLowPowerAllocation =
    lowPower.reduce((s, i) => s + i.resourceAllocation, 0) /
    Math.max(lowPower.length, 1);

  if (avgAllocation === 0) return 0;
  const ratio = 1 - avgLowPowerAllocation / avgAllocation;
  return Math.min(1, Math.max(0, ratio));
}

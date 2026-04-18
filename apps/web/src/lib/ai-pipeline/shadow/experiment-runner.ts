/**
 * experiment-runner.ts
 * 완화(loosening) 제안을 위한 안전한 실험 파이프라인.
 * OFFLINE_REPLAY → SHADOW_SIMULATION → RESTRICTED_CANARY 3단계를 모두
 * 통과해야만 승인 가능. falseSafeDelta > 0 이면 즉시 실패 처리.
 */

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** 실험 단계 — 반드시 순서대로 진행 */
export type ExperimentStage =
  | "OFFLINE_REPLAY"
  | "SHADOW_SIMULATION"
  | "RESTRICTED_CANARY";

/** 실험 상태 */
export type ExperimentStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "APPROVED"
  | "REJECTED";

/** 메트릭 스냅샷 */
export interface MetricsSnapshot {
  accuracy: number;       // 정확도 (0-1)
  costPerDoc: number;     // 문서당 비용 (USD)
  latencyMs: number;      // 평균 지연시간 (ms)
  falseSafeRate: number;  // 위양성 안전 비율 (0-1)
}

/** 실험 정의 */
export interface Experiment {
  experimentId: string;
  proposalId: string;
  proposalType: string;
  stage: ExperimentStage;
  status: ExperimentStatus;
  baselineMetrics: MetricsSnapshot | null;
  candidateMetrics: MetricsSnapshot | null;
  costDelta: number | null;       // 비용 변화량
  latencyDelta: number | null;    // 지연 변화량
  falseSafeDelta: number | null;  // 위양성 변화량 — 0 초과 시 즉시 실패
  startedAt: Date;
  completedAt: Date | null;
}

/** 실험 비교 결과 */
export interface ExperimentComparisonResult {
  experimentId: string;
  stage: ExperimentStage;
  status: ExperimentStatus;
  baselineMetrics: MetricsSnapshot | null;
  candidateMetrics: MetricsSnapshot | null;
  costDelta: number | null;
  latencyDelta: number | null;
  falseSafeDelta: number | null;
  passedAllStages: boolean;
}

// ──────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────

/** 단계 진행 순서 */
const STAGE_ORDER: ExperimentStage[] = [
  "OFFLINE_REPLAY",
  "SHADOW_SIMULATION",
  "RESTRICTED_CANARY",
];

// ──────────────────────────────────────────────
// 인메모리 저장소 (production: DB-backed)
// ──────────────────────────────────────────────
const experimentStore: Map<string, Experiment> = new Map();

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 단계별 메트릭 시뮬레이션 (스켈레톤)
 * TODO: 실제 구현 시 오프라인 리플레이 / 섀도 시뮬 / 카나리 실행
 */
function simulateStageMetrics(_stage: ExperimentStage): {
  baseline: MetricsSnapshot;
  candidate: MetricsSnapshot;
} {
  const baseline: MetricsSnapshot = {
    accuracy: 0.95,
    costPerDoc: 0.12,
    latencyMs: 850,
    falseSafeRate: 0.0,
  };
  const candidate: MetricsSnapshot = {
    accuracy: 0.95,
    costPerDoc: 0.10,
    latencyMs: 780,
    falseSafeRate: 0.0, // 기본값 — 실제 실행 시 계산
  };
  return { baseline, candidate };
}

// ──────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────

/**
 * 실험 생성 — 첫 번째 단계(OFFLINE_REPLAY)에서 대기 상태로 시작
 */
export function createExperiment(
  proposalId: string,
  proposalType: string
): Experiment {
  const experiment: Experiment = {
    experimentId: generateId("exp"),
    proposalId,
    proposalType,
    stage: "OFFLINE_REPLAY",
    status: "PENDING",
    baselineMetrics: null,
    candidateMetrics: null,
    costDelta: null,
    latencyDelta: null,
    falseSafeDelta: null,
    startedAt: new Date(),
    completedAt: null,
  };

  experimentStore.set(experiment.experimentId, experiment);
  return experiment;
}

/**
 * 실험 단계 진행
 * HARD RULE: 3단계 모두 통과해야 승인. falseSafeDelta > 0 → 즉시 FAILED
 */
export function advanceExperiment(experimentId: string): Experiment {
  const experiment = experimentStore.get(experimentId);
  if (!experiment) {
    throw new Error(`[experiment-runner] 실험 ID를 찾을 수 없음: ${experimentId}`);
  }

  if (experiment.status === "FAILED" || experiment.status === "REJECTED") {
    throw new Error(
      `[experiment-runner] 이미 종료된 실험은 진행 불가: ${experiment.status}`
    );
  }

  // 현재 단계 실행
  experiment.status = "RUNNING";
  const { baseline, candidate } = simulateStageMetrics(experiment.stage);

  experiment.baselineMetrics = baseline;
  experiment.candidateMetrics = candidate;
  experiment.costDelta = candidate.costPerDoc - baseline.costPerDoc;
  experiment.latencyDelta = candidate.latencyMs - baseline.latencyMs;
  experiment.falseSafeDelta = candidate.falseSafeRate - baseline.falseSafeRate;

  // ── HARD RULE: falseSafeDelta > 0 → 즉시 실패 ──
  if (experiment.falseSafeDelta > 0) {
    experiment.status = "FAILED";
    experiment.completedAt = new Date();
    experimentStore.set(experimentId, experiment);
    return experiment;
  }

  // 현재 단계 인덱스 확인
  const currentIdx = STAGE_ORDER.indexOf(experiment.stage);

  if (currentIdx < STAGE_ORDER.length - 1) {
    // 다음 단계로 진행
    experiment.stage = STAGE_ORDER[currentIdx + 1];
    experiment.status = "PENDING";
  } else {
    // 모든 단계 통과 → 완료
    experiment.status = "COMPLETED";
    experiment.completedAt = new Date();
  }

  experimentStore.set(experimentId, experiment);
  return experiment;
}

/**
 * 실험 결과 비교 데이터 반환
 */
export function getExperimentResults(
  experimentId: string
): ExperimentComparisonResult {
  const experiment = experimentStore.get(experimentId);
  if (!experiment) {
    throw new Error(`[experiment-runner] 실험 ID를 찾을 수 없음: ${experimentId}`);
  }

  const passedAllStages =
    experiment.status === "COMPLETED" &&
    experiment.stage === "RESTRICTED_CANARY" &&
    (experiment.falseSafeDelta === null || experiment.falseSafeDelta <= 0);

  return {
    experimentId: experiment.experimentId,
    stage: experiment.stage,
    status: experiment.status,
    baselineMetrics: experiment.baselineMetrics,
    candidateMetrics: experiment.candidateMetrics,
    costDelta: experiment.costDelta,
    latencyDelta: experiment.latencyDelta,
    falseSafeDelta: experiment.falseSafeDelta,
    passedAllStages,
  };
}

/**
 * 전체 실험 목록 조회
 */
export function listExperiments(): Experiment[] {
  return Array.from(experimentStore.values());
}

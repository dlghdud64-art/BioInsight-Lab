/**
 * @module multi-crisis-simulator
 * @description 복합 위기 오케스트레이터 — 8대 스트레스 시나리오와
 * degraded mode, deadlock breaker, partition reconciliation, refoundation trigger를
 * 통합하여 전체 시스템 회복력을 종합 판정한다.
 *
 * 스트레스 테스트 + 거버넌스 정렬 + 코어 불변량 검증을 단일 파이프라인으로 엮는다.
 */

import type {
  ScenarioExecutionResult,
  StressCategory,
} from "./resilience-stress-tester";

import type {
  DegradedModeState,
  CoreInvariantCheck,
  RefoundationTriggerResult,
} from "./systemic-resilience-simulation";

import type {
  RoleMisalignmentIncident,
} from "./role-misalignment-detector";

import type {
  AdjudicationCase,
} from "./borderline-adjudication-protocol";

// ─────────────────────────────────────────────
// 1. 통합 시뮬레이션 결과
// ─────────────────────────────────────────────

/** 위기 단계(Phase) */
export type CrisisPhase =
  | "INJECTION"          // 위기 주입
  | "DETECTION"          // 탐지
  | "CONTAINMENT"        // 격리
  | "ASSESSMENT"         // 평가
  | "RECOVERY"           // 회복
  | "POST_MORTEM";       // 사후 분석

/** 통합 위기 이벤트 타임라인 엔트리 */
export interface CrisisTimelineEntry {
  /** 이벤트 순서 */
  order: number;
  /** 위기 단계 */
  phase: CrisisPhase;
  /** 이벤트 설명 */
  description: string;
  /** 발생 시각 */
  timestamp: Date;
  /** 코어 불변량 유지 여부 */
  coreInvariantsMaintained: boolean;
  /** fail-open 발생 여부 */
  failOpenOccurred: boolean;
}

/** 통합 시뮬레이션 결과 */
export interface IntegratedSimulationResult {
  /** 시뮬레이션 ID */
  simulationId: string;
  /** 실행 시각 */
  executedAt: Date;

  // ── 스트레스 테스트 결과 ──
  /** 8대 시나리오 결과 */
  stressResults: ScenarioExecutionResult[];
  /** 스트레스 카테고리별 통과 여부 */
  categoryPassMap: Record<StressCategory, boolean>;

  // ── 거버넌스 정렬 결과 ──
  /** 역할 혼선 인시던트 */
  roleMisalignments: RoleMisalignmentIncident[];
  /** 경계선 판정 케이스 */
  borderlineCases: AdjudicationCase[];

  // ── 시스템 회복력 결과 ──
  /** Degraded Mode 전이 이력 */
  degradedModeHistory: Array<{ from: DegradedModeState; to: DegradedModeState; trigger: string }>;
  /** 코어 불변량 검증 결과 */
  coreInvariantChecks: CoreInvariantCheck[];
  /** Refoundation 트리거 결과 */
  refoundationResult: RefoundationTriggerResult | null;

  // ── 타임라인 ──
  /** 위기 이벤트 타임라인 */
  timeline: CrisisTimelineEntry[];

  // ── 종합 판정 ──
  /** 전체 통과 여부 */
  overallPassed: boolean;
  /** 발견된 취약점 종합 */
  allVulnerabilities: string[];
}

// ─────────────────────────────────────────────
// 2. 오케스트레이터
// ─────────────────────────────────────────────

/** 시뮬레이션 저장소 (production: DB-backed) */
const simulationStore: IntegratedSimulationResult[] = [];

/**
 * 통합 시뮬레이션을 구성한다.
 * 각 모듈의 결과를 수집하여 타임라인으로 엮는다.
 */
export function assembleIntegratedSimulation(params: {
  stressResults: ScenarioExecutionResult[];
  roleMisalignments: RoleMisalignmentIncident[];
  borderlineCases: AdjudicationCase[];
  degradedModeHistory: Array<{ from: DegradedModeState; to: DegradedModeState; trigger: string }>;
  coreInvariantChecks: CoreInvariantCheck[];
  refoundationResult: RefoundationTriggerResult | null;
}): IntegratedSimulationResult {
  const now = new Date();

  // 카테고리별 통과 맵
  const categoryPassMap: Record<StressCategory, boolean> = {
    REPEATED_DISGUISED: true,
    CONCURRENCY: true,
    ROLE_CONFUSION: true,
    EMERGENCY_PRESSURE: true,
    PARTIAL_DEGRADATION: true,
    MULTI_SCOPE_CONTAMINATION: true,
    BORDERLINE_TENSION: true,
    SEMANTIC_WIDENING: true,
  };

  for (const result of params.stressResults) {
    if (!result.passed) {
      categoryPassMap[result.category] = false;
    }
  }

  // 타임라인 생성
  const timeline: CrisisTimelineEntry[] = [];
  let order = 0;

  // Phase 1: Injection
  for (const sr of params.stressResults) {
    timeline.push({
      order: order++,
      phase: "INJECTION",
      description: `스트레스 시나리오 ${sr.scenarioId} 주입 — ${sr.category}`,
      timestamp: sr.executedAt,
      coreInvariantsMaintained: true,
      failOpenOccurred: false,
    });
  }

  // Phase 2: Detection
  for (const sr of params.stressResults) {
    const breachCount = sr.requestResults.filter((r) => r.blocked).length;
    timeline.push({
      order: order++,
      phase: "DETECTION",
      description: `${sr.scenarioId}: ${breachCount}건 침해 탐지`,
      timestamp: sr.executedAt,
      coreInvariantsMaintained: sr.requestResults.every((r) => !r.failOpenOccurred),
      failOpenOccurred: sr.requestResults.some((r) => r.failOpenOccurred),
    });
  }

  // Phase 3: Containment
  for (const dm of params.degradedModeHistory) {
    timeline.push({
      order: order++,
      phase: "CONTAINMENT",
      description: `Degraded Mode 전이: ${dm.from} → ${dm.to} (${dm.trigger})`,
      timestamp: now,
      coreInvariantsMaintained: true,
      failOpenOccurred: false,
    });
  }

  // Role misalignments
  for (const rm of params.roleMisalignments) {
    timeline.push({
      order: order++,
      phase: "DETECTION",
      description: `역할 혼선 탐지: ${rm.type} — ${rm.detail}`,
      timestamp: rm.detectedAt,
      coreInvariantsMaintained: true,
      failOpenOccurred: false,
    });
  }

  // Phase 4: Assessment
  for (const ci of params.coreInvariantChecks) {
    timeline.push({
      order: order++,
      phase: "ASSESSMENT",
      description: `코어 불변량 검증: ${ci.passed ? "PASS" : "FAIL"} (state=${ci.degradedModeState})`,
      timestamp: ci.checkedAt,
      coreInvariantsMaintained: ci.passed,
      failOpenOccurred: ci.failOpenDetected,
    });
  }

  // Phase 5: Refoundation check
  if (params.refoundationResult) {
    timeline.push({
      order: order++,
      phase: params.refoundationResult.triggered ? "CONTAINMENT" : "ASSESSMENT",
      description: params.refoundationResult.triggered
        ? `REFOUNDATION_REQUIRED 발동 — score=${params.refoundationResult.scoreBreakdown.totalScore}`
        : `Refoundation 미발동 — score=${params.refoundationResult.scoreBreakdown.totalScore}`,
      timestamp: now,
      coreInvariantsMaintained: true,
      failOpenOccurred: false,
    });
  }

  // Phase 6: Post-mortem
  timeline.push({
    order: order++,
    phase: "POST_MORTEM",
    description: "사후 분석 완료 — 취약점 집계 및 하드닝 권고 생성",
    timestamp: now,
    coreInvariantsMaintained: true,
    failOpenOccurred: false,
  });

  // 종합 판정
  const allVulnerabilities: string[] = params.stressResults.flatMap((r) => r.vulnerabilities);
  if (params.roleMisalignments.length > 0) allVulnerabilities.push("ROLE_MISALIGNMENT_DETECTED");

  const overallPassed =
    params.stressResults.every((r) => r.passed) &&
    params.coreInvariantChecks.every((c) => c.passed) &&
    timeline.every((t) => !t.failOpenOccurred) &&
    (!params.refoundationResult || !params.refoundationResult.adHocCollapse);

  const result: IntegratedSimulationResult = {
    simulationId: `INTSIM-${Date.now()}`,
    executedAt: now,
    stressResults: params.stressResults,
    categoryPassMap,
    roleMisalignments: params.roleMisalignments,
    borderlineCases: params.borderlineCases,
    degradedModeHistory: params.degradedModeHistory,
    coreInvariantChecks: params.coreInvariantChecks,
    refoundationResult: params.refoundationResult,
    timeline,
    overallPassed,
    allVulnerabilities: Array.from(new Set(allVulnerabilities)),
  };

  simulationStore.push(result);
  return result;
}

/** 시뮬레이션 저장소 조회 */
export function getIntegratedSimulations(): IntegratedSimulationResult[] {
  return [...simulationStore];
}

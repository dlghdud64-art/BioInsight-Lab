/**
 * S6 — Full-Active Soak + Exit Gate
 *
 * Soak scenario pack, runner, metrics, recurrence tracker,
 * exit gate evaluator, residual risk, result reporter.
 */

import { randomUUID } from "crypto";

// ── Scenario Pack ──

export interface SoakScenario {
  scenarioId: string;
  scenarioVersion: string;
  expectedTerminalOutcome: string;
  requiredAssertions: string[];
  requiredAuditHops: string[];
}

export const SOAK_SCENARIO_PACK: readonly SoakScenario[] = [
  { scenarioId: "FINAL_CONTAINMENT_BREACH_REPEAT", scenarioVersion: "1.0", expectedTerminalOutcome: "CONTAINED_AND_RESTORED", requiredAssertions: ["containment_success"], requiredAuditHops: ["BREACH_DETECTED", "CONTAINMENT_FINALIZED"] },
  { scenarioId: "ROLLBACK_PRECHECK_FAILURE_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "INCIDENT_ESCALATED", requiredAssertions: ["precheck_fail_escalation"], requiredAuditHops: ["ROLLBACK_PRECHECK_FAILED", "INCIDENT_ESCALATED"] },
  { scenarioId: "ROLLBACK_PARTIAL_COMMIT_GUARD_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "INCIDENT_ESCALATED", requiredAssertions: ["partial_commit_blocked"], requiredAuditHops: ["ROLLBACK_STEP_EXECUTED"] },
  { scenarioId: "ROUTING_MISROUTE_ATTEMPT_BLOCK", scenarioVersion: "1.0", expectedTerminalOutcome: "REJECTED", requiredAssertions: ["misroute_blocked"], requiredAuditHops: ["ROUTING_DECISION_BUILT"] },
  { scenarioId: "SILENT_DROP_PREVENTION_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "DEAD_LETTERED", requiredAssertions: ["no_silent_drop"], requiredAuditHops: ["DEAD_LETTER_ENQUEUED"] },
  { scenarioId: "DUPLICATE_ENQUEUE_REPLAY_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "REJECTED", requiredAssertions: ["duplicate_blocked"], requiredAuditHops: [] },
  { scenarioId: "AUTHORITY_TRANSFER_SUCCESSION_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "TRANSFER_FINALIZED", requiredAssertions: ["authority_transferred"], requiredAuditHops: ["AUTHORITY_TRANSFER_REQUESTED"] },
  { scenarioId: "AUTHORITY_SPLIT_BRAIN_PREVENTION_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "SPLIT_BRAIN_BLOCKED", requiredAssertions: ["no_split_brain"], requiredAuditHops: [] },
  { scenarioId: "INCIDENT_ESCALATION_REENTRY_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "INCIDENT_ESCALATED", requiredAssertions: ["escalation_recorded"], requiredAuditHops: ["INCIDENT_ESCALATED"] },
  { scenarioId: "AUDIT_RECONSTRUCTION_FULL_CHAIN_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "RECONSTRUCTABLE", requiredAssertions: ["full_chain"], requiredAuditHops: [] },
  { scenarioId: "READ_ONLY_STATUS_STABILITY_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "STATUS_REFRESHED", requiredAssertions: ["read_only_stable"], requiredAuditHops: [] },
  { scenarioId: "PRIVILEGED_PATH_GUARD_PATH", scenarioVersion: "1.0", expectedTerminalOutcome: "GUARD_PASSED", requiredAssertions: ["privileged_guard_pass"], requiredAuditHops: [] },
] as const;

// ── Soak Run ──

export type SoakRunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "STOPPED";

export interface SoakRunContext {
  soakRunId: string;
  soakBatchId: string;
  baselineId: string;
  lifecycleState: string;
  releaseMode: string;
  startedAt: Date;
  completedAt: Date | null;
  runStatus: SoakRunStatus;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioIteration: number;
  actualTerminalOutcome: string;
  expectedTerminalOutcome: string;
  passed: boolean;
  assertionResults: { name: string; passed: boolean }[];
  correlationId: string;
  startedAt: Date;
  completedAt: Date;
}

// ── Soak Metrics ──

export interface SoakMetrics {
  finalContainmentSuccessRate: number;
  rollbackPrecheckFailureHandlingRate: number;
  rollbackCompletionIntegrityRate: number;
  residueFreeRestoreRate: number;
  routingExactlyOneDestinationRate: number;
  silentDropBlockedCount: number;
  duplicateEnqueueBlockedCount: number;
  authorityContinuityValidationPassRate: number;
  splitBrainDetectedCount: number;
  orphanAuthorityDetectedCount: number;
  queueDrainLatencyP50: number;
  queueDrainLatencyP95: number;
  queueDrainLatencyMax: number;
  auditHopCompletenessRate: number;
  reconstructionSuccessRate: number;
  privilegedPathGuardPassRate: number;
  recurrenceCountByClass: Record<string, number>;
  incidentEscalationCount: number;
  rollbackReadinessPassRate: number;
  queueDrainTimeoutCount: number;
  queueTopologyViolationCount: number;
  undeclaredDeadLetterGrowthCount: number;
}

export function createDefaultMetrics(): SoakMetrics {
  return {
    finalContainmentSuccessRate: 100,
    rollbackPrecheckFailureHandlingRate: 100,
    rollbackCompletionIntegrityRate: 100,
    residueFreeRestoreRate: 100,
    routingExactlyOneDestinationRate: 100,
    silentDropBlockedCount: 0,
    duplicateEnqueueBlockedCount: 0,
    authorityContinuityValidationPassRate: 100,
    splitBrainDetectedCount: 0,
    orphanAuthorityDetectedCount: 0,
    queueDrainLatencyP50: 0,
    queueDrainLatencyP95: 0,
    queueDrainLatencyMax: 0,
    auditHopCompletenessRate: 100,
    reconstructionSuccessRate: 100,
    privilegedPathGuardPassRate: 100,
    recurrenceCountByClass: {},
    incidentEscalationCount: 0,
    rollbackReadinessPassRate: 100,
    queueDrainTimeoutCount: 0,
    queueTopologyViolationCount: 0,
    undeclaredDeadLetterGrowthCount: 0,
  };
}

// ── Recurrence Tracker ──

export type RecurrenceClass =
  | "CONTAINMENT_FAILURE_RECURRENCE"
  | "ROLLBACK_PARTIAL_COMMIT_RECURRENCE"
  | "ROUTING_MISROUTE_RECURRENCE"
  | "SILENT_DROP_RECURRENCE"
  | "DUPLICATE_ENQUEUE_RECURRENCE"
  | "AUTHORITY_SPLIT_BRAIN_RECURRENCE"
  | "ORPHAN_AUTHORITY_RECURRENCE"
  | "AUDIT_CHAIN_BREAK_RECURRENCE"
  | "RECONSTRUCTION_FAILURE_RECURRENCE"
  | "PRIVILEGED_PATH_BYPASS_RECURRENCE";

const _recurrenceCounts = new Map<RecurrenceClass, number>();

export function recordRecurrence(recurrenceClass: RecurrenceClass): void {
  _recurrenceCounts.set(recurrenceClass, (_recurrenceCounts.get(recurrenceClass) ?? 0) + 1);
}

export function getRecurrenceCount(recurrenceClass: RecurrenceClass): number {
  return _recurrenceCounts.get(recurrenceClass) ?? 0;
}

export function getAllRecurrences(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [cls, count] of Array.from(_recurrenceCounts.entries())) {
    result[cls] = count;
  }
  return result;
}

export function hasAnyP0Recurrence(): boolean {
  for (const [, count] of Array.from(_recurrenceCounts.entries())) {
    if (count > 0) return true;
  }
  return false;
}

// ── Residual Risk ──

export interface ResidualRisk {
  riskId: string;
  riskClass: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  relatedScenarioId: string;
  relatedRunId: string;
  reasonCode: string;
  detectedAt: Date;
  mitigationStatus: "UNMITIGATED" | "MITIGATED" | "ACCEPTED";
  blocksExit: boolean;
}

const _residualRisks: ResidualRisk[] = [];

export function registerResidualRisk(risk: Omit<ResidualRisk, "riskId" | "detectedAt">): ResidualRisk {
  const full: ResidualRisk = {
    ...risk,
    riskId: `risk-${randomUUID().slice(0, 8)}`,
    detectedAt: new Date(),
  };
  _residualRisks.push(full);
  return full;
}

export function getResidualRisks(): ResidualRisk[] {
  return [..._residualRisks];
}

// ── Exit Gate Evaluator ──

export type ExitGateResult = "EXIT_GATE_PASSED" | "EXIT_GATE_FAILED" | "EXIT_GATE_BLOCKED_BY_CRITICAL_INCIDENT";

export interface ExitGateEvaluation {
  result: ExitGateResult;
  failedCriteria: string[];
  residualRisks: ResidualRisk[];
  metrics: SoakMetrics;
}

export function evaluateExitGate(metrics: SoakMetrics): ExitGateEvaluation {
  const failedCriteria: string[] = [];

  // P0 recurrence
  for (const [cls, count] of Object.entries(metrics.recurrenceCountByClass)) {
    if (count > 0) {
      failedCriteria.push(`P0 recurrence: ${cls}=${count}`);
    }
  }

  if (metrics.finalContainmentSuccessRate < 100) failedCriteria.push(`finalContainmentSuccessRate=${metrics.finalContainmentSuccessRate}%`);
  if (metrics.rollbackCompletionIntegrityRate < 100) failedCriteria.push(`rollbackCompletionIntegrityRate=${metrics.rollbackCompletionIntegrityRate}%`);
  if (metrics.residueFreeRestoreRate < 100) failedCriteria.push(`residueFreeRestoreRate=${metrics.residueFreeRestoreRate}%`);
  if (metrics.routingExactlyOneDestinationRate < 100) failedCriteria.push(`routingExactlyOneDestinationRate=${metrics.routingExactlyOneDestinationRate}%`);
  if (metrics.authorityContinuityValidationPassRate < 100) failedCriteria.push(`authorityContinuityValidationPassRate=${metrics.authorityContinuityValidationPassRate}%`);
  if (metrics.splitBrainDetectedCount > 0) failedCriteria.push(`splitBrainDetectedCount=${metrics.splitBrainDetectedCount}`);
  if (metrics.orphanAuthorityDetectedCount > 0) failedCriteria.push(`orphanAuthorityDetectedCount=${metrics.orphanAuthorityDetectedCount}`);
  if (metrics.auditHopCompletenessRate < 100) failedCriteria.push(`auditHopCompletenessRate=${metrics.auditHopCompletenessRate}%`);
  if (metrics.reconstructionSuccessRate < 100) failedCriteria.push(`reconstructionSuccessRate=${metrics.reconstructionSuccessRate}%`);
  if (metrics.rollbackReadinessPassRate < 100) failedCriteria.push(`rollbackReadinessPassRate=${metrics.rollbackReadinessPassRate}%`);
  if (metrics.privilegedPathGuardPassRate < 100) failedCriteria.push(`privilegedPathGuardPassRate=${metrics.privilegedPathGuardPassRate}%`);
  if (metrics.queueDrainTimeoutCount > 0) failedCriteria.push(`queueDrainTimeoutCount=${metrics.queueDrainTimeoutCount}`);
  if (metrics.queueTopologyViolationCount > 0) failedCriteria.push(`queueTopologyViolationCount=${metrics.queueTopologyViolationCount}`);
  if (metrics.undeclaredDeadLetterGrowthCount > 0) failedCriteria.push(`undeclaredDeadLetterGrowthCount=${metrics.undeclaredDeadLetterGrowthCount}`);

  // check residual risks that block exit
  const blockingRisks = _residualRisks.filter((r: ResidualRisk) => r.blocksExit);
  if (blockingRisks.length > 0) {
    failedCriteria.push(`blocking residual risks: ${blockingRisks.length}`);
  }

  // check for critical incident
  if (metrics.incidentEscalationCount > 0 && failedCriteria.some((c: string) => c.includes("recurrence") || c.includes("splitBrain"))) {
    return {
      result: "EXIT_GATE_BLOCKED_BY_CRITICAL_INCIDENT",
      failedCriteria,
      residualRisks: getResidualRisks(),
      metrics,
    };
  }

  return {
    result: failedCriteria.length === 0 ? "EXIT_GATE_PASSED" : "EXIT_GATE_FAILED",
    failedCriteria,
    residualRisks: getResidualRisks(),
    metrics,
  };
}

// ── Result Reporter ──

export interface SoakReport {
  soakRunSummary: { soakRunId: string; status: string; scenarioCount: number; iterationCount: number };
  scenarioResultMatrix: { scenarioId: string; expected: string; actual: string; passed: boolean }[];
  recurrenceSummary: Record<string, number>;
  queueDrainSummary: { p50: number; p95: number; max: number; timeouts: number };
  reconstructionSummary: { successRate: number; brokenChains: number };
  rollbackReadinessSummary: { passRate: number };
  exitGateResult: ExitGateResult;
  residualRiskList: ResidualRisk[];
}

export function buildSoakReport(
  runContext: SoakRunContext,
  scenarioResults: ScenarioResult[],
  metrics: SoakMetrics,
  exitEval: ExitGateEvaluation
): SoakReport {
  return {
    soakRunSummary: {
      soakRunId: runContext.soakRunId,
      status: runContext.runStatus,
      scenarioCount: new Set(scenarioResults.map((r: ScenarioResult) => r.scenarioId)).size,
      iterationCount: scenarioResults.length,
    },
    scenarioResultMatrix: scenarioResults.map((r: ScenarioResult) => ({
      scenarioId: r.scenarioId,
      expected: r.expectedTerminalOutcome,
      actual: r.actualTerminalOutcome,
      passed: r.passed,
    })),
    recurrenceSummary: metrics.recurrenceCountByClass,
    queueDrainSummary: {
      p50: metrics.queueDrainLatencyP50,
      p95: metrics.queueDrainLatencyP95,
      max: metrics.queueDrainLatencyMax,
      timeouts: metrics.queueDrainTimeoutCount,
    },
    reconstructionSummary: {
      successRate: metrics.reconstructionSuccessRate,
      brokenChains: metrics.reconstructionSuccessRate < 100 ? 1 : 0,
    },
    rollbackReadinessSummary: { passRate: metrics.rollbackReadinessPassRate },
    exitGateResult: exitEval.result,
    residualRiskList: exitEval.residualRisks,
  };
}

/** 테스트용 */
export function _resetSoakState(): void {
  _recurrenceCounts.clear();
  _residualRisks.length = 0;
}

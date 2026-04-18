// @ts-nocheck — tracker #63에서 개별 정리 예정 (TS2345 SoakRunContext drift, 2 errors)
/**
 * S6 — Full-Active Soak + Exit Gate 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SOAK_SCENARIO_PACK,
  createDefaultMetrics,
  recordRecurrence,
  getRecurrenceCount,
  getAllRecurrences,
  hasAnyP0Recurrence,
  registerResidualRisk,
  getResidualRisks,
  evaluateExitGate,
  buildSoakReport,
  _resetSoakState,
} from "../core/verification/soak-exit-gate";

describe("S6: Full-Active Soak + Exit Gate", () => {
  beforeEach(() => {
    _resetSoakState();
  });

  // 1. soak scenario pack completeness test
  it("should have at least 12 scenarios in soak pack", () => {
    expect(SOAK_SCENARIO_PACK.length).toBeGreaterThanOrEqual(12);
  });

  // 2. each scenario has required fields test
  it("should have required fields in each scenario", () => {
    for (const scenario of SOAK_SCENARIO_PACK) {
      expect(scenario.scenarioId).toBeTruthy();
      expect(scenario.scenarioVersion).toBeTruthy();
      expect(scenario.expectedTerminalOutcome).toBeTruthy();
      expect(Array.isArray(scenario.requiredAssertions)).toBe(true);
      expect(Array.isArray(scenario.requiredAuditHops)).toBe(true);
    }
  });

  // 3. default metrics all pass exit gate test
  it("should pass exit gate with default metrics", () => {
    const metrics = createDefaultMetrics();
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_PASSED");
    expect(result.failedCriteria).toHaveLength(0);
  });

  // 4. containment failure rate blocks exit gate test
  it("should fail exit gate when containment success rate drops", () => {
    const metrics = createDefaultMetrics();
    metrics.finalContainmentSuccessRate = 95;
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_FAILED");
    expect(result.failedCriteria.some((c) => c.includes("finalContainmentSuccessRate"))).toBe(true);
  });

  // 5. recurrence tracker records and retrieves test
  it("should record and retrieve recurrence counts", () => {
    recordRecurrence("CONTAINMENT_FAILURE_RECURRENCE");
    recordRecurrence("CONTAINMENT_FAILURE_RECURRENCE");
    recordRecurrence("ROUTING_MISROUTE_RECURRENCE");
    expect(getRecurrenceCount("CONTAINMENT_FAILURE_RECURRENCE")).toBe(2);
    expect(getRecurrenceCount("ROUTING_MISROUTE_RECURRENCE")).toBe(1);
    expect(getRecurrenceCount("SILENT_DROP_RECURRENCE")).toBe(0);
  });

  // 6. P0 recurrence blocks exit gate test
  it("should detect any P0 recurrence", () => {
    expect(hasAnyP0Recurrence()).toBe(false);
    recordRecurrence("AUTHORITY_SPLIT_BRAIN_RECURRENCE");
    expect(hasAnyP0Recurrence()).toBe(true);
  });

  // 7. recurrence in metrics blocks exit gate test
  it("should fail exit gate when recurrence exists in metrics", () => {
    const metrics = createDefaultMetrics();
    metrics.recurrenceCountByClass = { "CONTAINMENT_FAILURE_RECURRENCE": 1 };
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_FAILED");
    expect(result.failedCriteria.some((c) => c.includes("recurrence"))).toBe(true);
  });

  // 8. split brain detected blocks exit gate test
  it("should fail exit gate when split brain detected", () => {
    const metrics = createDefaultMetrics();
    metrics.splitBrainDetectedCount = 1;
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_FAILED");
  });

  // 9. residual risk registration test
  it("should register and retrieve residual risks", () => {
    const risk = registerResidualRisk({
      riskClass: "ROLLBACK_PARTIAL",
      severity: "WARNING",
      relatedScenarioId: "ROLLBACK_PARTIAL_COMMIT_GUARD_PATH",
      relatedRunId: "run-1",
      reasonCode: "PARTIAL_COMMIT_OBSERVED",
      mitigationStatus: "UNMITIGATED",
      blocksExit: false,
    });
    expect(risk.riskId).toBeTruthy();
    expect(getResidualRisks()).toHaveLength(1);
  });

  // 10. blocking residual risk blocks exit gate test
  it("should fail exit gate when blocking residual risk exists", () => {
    registerResidualRisk({
      riskClass: "CRITICAL_RISK",
      severity: "CRITICAL",
      relatedScenarioId: "test",
      relatedRunId: "run-1",
      reasonCode: "CRITICAL_UNMITIGATED",
      mitigationStatus: "UNMITIGATED",
      blocksExit: true,
    });
    const metrics = createDefaultMetrics();
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_FAILED");
    expect(result.failedCriteria.some((c) => c.includes("blocking residual risks"))).toBe(true);
  });

  // 11. exit gate blocked by critical incident test
  it("should block exit gate by critical incident with recurrence", () => {
    const metrics = createDefaultMetrics();
    metrics.incidentEscalationCount = 1;
    metrics.recurrenceCountByClass = { "CONTAINMENT_FAILURE_RECURRENCE": 1 };
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_BLOCKED_BY_CRITICAL_INCIDENT");
  });

  // 12. soak report builder test
  it("should build soak report with all required sections", () => {
    const metrics = createDefaultMetrics();
    const exitEval = evaluateExitGate(metrics);
    const runContext = {
      soakRunId: "soak-1",
      soakBatchId: "batch-1",
      baselineId: "bl-1",
      lifecycleState: "ACTIVE_100",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      startedAt: new Date(),
      completedAt: new Date(),
      runStatus: "COMPLETED",
    };
    const scenarioResults = [{
      scenarioId: "FINAL_CONTAINMENT_BREACH_REPEAT",
      scenarioIteration: 1,
      actualTerminalOutcome: "CONTAINED_AND_RESTORED",
      expectedTerminalOutcome: "CONTAINED_AND_RESTORED",
      passed: true,
      assertionResults: [{ name: "containment_success", passed: true }],
      correlationId: "cor-1",
      startedAt: new Date(),
      completedAt: new Date(),
    }];
    const report = buildSoakReport(runContext, scenarioResults, metrics, exitEval);
    expect(report.soakRunSummary.soakRunId).toBe("soak-1");
    expect(report.scenarioResultMatrix).toHaveLength(1);
    expect(report.exitGateResult).toBe("EXIT_GATE_PASSED");
    expect(report.residualRiskList).toHaveLength(0);
  });

  // 13. queue drain timeout blocks exit gate test
  it("should fail exit gate when queue drain timeout detected", () => {
    const metrics = createDefaultMetrics();
    metrics.queueDrainTimeoutCount = 1;
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_FAILED");
  });

  // 14. audit hop completeness below threshold blocks exit test
  it("should fail exit gate when audit hop completeness below 100%", () => {
    const metrics = createDefaultMetrics();
    metrics.auditHopCompletenessRate = 98;
    const result = evaluateExitGate(metrics);
    expect(result.result).toBe("EXIT_GATE_FAILED");
  });

  // 15. getAllRecurrences returns all classes test
  it("should return all recurrence classes with counts", () => {
    recordRecurrence("CONTAINMENT_FAILURE_RECURRENCE");
    recordRecurrence("SILENT_DROP_RECURRENCE");
    recordRecurrence("SILENT_DROP_RECURRENCE");
    const all = getAllRecurrences();
    expect(all["CONTAINMENT_FAILURE_RECURRENCE"]).toBe(1);
    expect(all["SILENT_DROP_RECURRENCE"]).toBe(2);
  });

  // 16. soak report scenario count distinct test
  it("should count distinct scenarios in report", () => {
    const metrics = createDefaultMetrics();
    const exitEval = evaluateExitGate(metrics);
    const runContext = {
      soakRunId: "soak-2",
      soakBatchId: "batch-2",
      baselineId: "bl-2",
      lifecycleState: "ACTIVE_100",
      releaseMode: "FULL_ACTIVE_STABILIZATION",
      startedAt: new Date(),
      completedAt: new Date(),
      runStatus: "COMPLETED",
    };
    const now = new Date();
    const scenarioResults = [
      { scenarioId: "SCENARIO_A", scenarioIteration: 1, actualTerminalOutcome: "OK", expectedTerminalOutcome: "OK", passed: true, assertionResults: [], correlationId: "c1", startedAt: now, completedAt: now },
      { scenarioId: "SCENARIO_A", scenarioIteration: 2, actualTerminalOutcome: "OK", expectedTerminalOutcome: "OK", passed: true, assertionResults: [], correlationId: "c2", startedAt: now, completedAt: now },
      { scenarioId: "SCENARIO_B", scenarioIteration: 1, actualTerminalOutcome: "OK", expectedTerminalOutcome: "OK", passed: true, assertionResults: [], correlationId: "c3", startedAt: now, completedAt: now },
    ];
    const report = buildSoakReport(runContext, scenarioResults, metrics, exitEval);
    expect(report.soakRunSummary.scenarioCount).toBe(2);
    expect(report.soakRunSummary.iterationCount).toBe(3);
  });
});
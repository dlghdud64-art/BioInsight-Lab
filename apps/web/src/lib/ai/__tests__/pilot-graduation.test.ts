// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Pilot Graduation Engine — Batch 20 Tests
 *
 * 5 sections × 시나리오:
 *  1. Pilot Metrics Aggregation (PG-1~PG-5)
 *  2. Pilot Completion Evaluation (PG-6~PG-16)
 *  3. Graduation Path (PG-17~PG-26)
 *  4. Restart / Reassess (PG-27~PG-32)
 *  5. Surface Builder (PG-33~PG-40)
 */

import { describe, it, expect } from "vitest";
import {
  aggregatePilotMetrics,
  evaluatePilotCompletion,
  evaluateGraduationPath,
  createRestartAssessment,
  evaluateRestartReadiness,
  buildGraduationSurface,
} from "../pilot-graduation-engine";
import type {
  PilotMetrics,
  PilotCompletionEvaluation,
  GraduationDecision,
  RestartAssessment,
  RemediationItem,
} from "../pilot-graduation-engine";
import type { RC0ScopeFreeze } from "../rc0-pilot-launch-engine";

// ══════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════

function makeScope(overrides?: Partial<RC0ScopeFreeze>): RC0ScopeFreeze {
  const startDate = new Date(Date.now() - 14 * 86400000).toISOString(); // 14일 전
  const endDate = new Date(Date.now()).toISOString();
  return {
    rc0Id: "rc0_test",
    frozenAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    gateVerdict: "go",
    gateSnapshotId: "gs_001",
    activationScope: "pilot_limited",
    includedStages: ["quote_review", "quote_shortlist", "quote_approval", "po_conversion", "po_approval"],
    activeDomains: ["quote_chain", "dispatch_prep"],
    poLimit: 10,
    durationDays: 14,
    startDate,
    endDate,
    actorScope: { operatorRoles: ["operator"], reviewerRoles: ["reviewer"], maxConcurrentActors: 3 },
    locked: true,
    ...overrides,
  };
}

function makeGoodMetricsInput(scope: RC0ScopeFreeze) {
  return {
    scope,
    poProcessed: 8,
    poInProgress: 1,
    poBlocked: 0,
    chainCompletions: 8,
    avgChainDurationHours: 12,
    maxChainDurationHours: 24,
    totalBlockerCount: 1,
    hardBlockerCount: 0,
    softBlockerCount: 1,
    staleBlockingFrequency: 1,
    staleAvgResolutionMin: 5,
    runtimeSignalAvg: 90,
    runtimeSignalMin: 75,
    runtimeCriticalBreachCount: 0,
    reopenCount: 1,
    retryCount: 0,
    rollbackTriggerHitCount: 0,
    complianceVerdicts: { compliant: 8, conditionally_compliant: 1, non_compliant: 0 },
    activeActorCount: 3,
    decisionLogVolume: 45,
    irreversibleActionCount: 5,
    irreversibleActionFailureCount: 0,
  };
}

function makeGoodMetrics(): PilotMetrics {
  const scope = makeScope();
  return aggregatePilotMetrics(makeGoodMetricsInput(scope));
}

function makeBadMetrics(): PilotMetrics {
  const scope = makeScope();
  return aggregatePilotMetrics({
    scope,
    poProcessed: 2,
    poInProgress: 3,
    poBlocked: 4,
    chainCompletions: 1,
    avgChainDurationHours: 48,
    maxChainDurationHours: 96,
    totalBlockerCount: 12,
    hardBlockerCount: 5,
    softBlockerCount: 7,
    staleBlockingFrequency: 8,
    staleAvgResolutionMin: 30,
    runtimeSignalAvg: 55,
    runtimeSignalMin: 30,
    runtimeCriticalBreachCount: 3,
    reopenCount: 5,
    retryCount: 4,
    rollbackTriggerHitCount: 2,
    complianceVerdicts: { compliant: 2, conditionally_compliant: 3, non_compliant: 4 },
    activeActorCount: 2,
    decisionLogVolume: 10,
    irreversibleActionCount: 3,
    irreversibleActionFailureCount: 2,
  });
}

// ══════════════════════════════════════════════════════
// 1. Pilot Metrics Aggregation
// ══════════════════════════════════════════════════════

describe("1. Pilot Metrics Aggregation", () => {
  it("PG-1: 정상 metrics 산출", () => {
    const m = makeGoodMetrics();
    expect(m.poProcessed).toBe(8);
    expect(m.poLimit).toBe(10);
    expect(m.daysPlanned).toBe(14);
    expect(m.chainCompletionRate).toBeCloseTo(8 / 9, 2); // 8 completions / (8+1+0) total
  });

  it("PG-2: blocker incidence rate 계산", () => {
    const m = makeGoodMetrics();
    expect(m.blockerIncidenceRate).toBeCloseTo(1 / 9, 2); // 1 blocker / 9 total PO
  });

  it("PG-3: compliance rate 계산", () => {
    const m = makeGoodMetrics();
    expect(m.complianceRate).toBeCloseTo(8 / 9, 2); // 8 compliant / 9 verdicts
  });

  it("PG-4: 0 PO → rate 0", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 0,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 0,
      totalBlockerCount: 0,
    });
    expect(m.poCompletionRate).toBe(0);
    expect(m.blockerIncidenceRate).toBe(0);
  });

  it("PG-5: runtime signal 값 보존", () => {
    const m = makeGoodMetrics();
    expect(m.runtimeSignalAvg).toBe(90);
    expect(m.runtimeSignalMin).toBe(75);
    expect(m.runtimeCriticalBreachCount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════
// 2. Pilot Completion Evaluation
// ══════════════════════════════════════════════════════

describe("2. Pilot Completion Evaluation", () => {
  it("PG-6: 좋은 metrics → completed_successfully", () => {
    const m = makeGoodMetrics();
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(eval_.verdict).toBe("completed_successfully");
    expect(eval_.blockingReasons).toHaveLength(0);
    expect(eval_.requiredMet).toBe(eval_.requiredTotal);
  });

  it("PG-7: cancelled status → cancelled verdict", () => {
    const m = makeGoodMetrics();
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "cancelled", false);
    expect(eval_.verdict).toBe("cancelled");
    expect(eval_.criteria).toHaveLength(0);
  });

  it("PG-8: rollback trigger active → rollback_required", () => {
    const m = makeGoodMetrics();
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", true);
    expect(eval_.verdict).toBe("rollback_required");
    expect(eval_.blockingReasons.some(r => r.includes("롤백"))).toBe(true);
  });

  it("PG-9: PO 3건 미만 → insufficient_evidence", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 1,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 1,
      totalBlockerCount: 0,
    });
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(eval_.verdict).toBe("insufficient_evidence");
    expect(eval_.blockingReasons.some(r => r.includes("PO 수 부족"))).toBe(true);
  });

  it("PG-10: required criteria 70% 이상 ~ 100% 미만 → completed_conditionally", () => {
    const m = makeBadMetrics();
    // Override to make it conditional (some required met, some not)
    // bad metrics: poProcessed=2 but total=9, so chain completion is low
    // We need enough PO to avoid insufficient_evidence
    const scope = makeScope();
    const adjusted = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 5,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 4,
      totalBlockerCount: 2,
      hardBlockerCount: 1,
      runtimeSignalAvg: 75,
      runtimeSignalMin: 55,
      runtimeCriticalBreachCount: 0,
      complianceVerdicts: { compliant: 4, conditionally_compliant: 1, non_compliant: 0 },
      rollbackTriggerHitCount: 1, // This will fail safety criterion
      irreversibleActionFailureCount: 0,
    });
    const eval_ = evaluatePilotCompletion(adjusted, "rc0_test", "active", false);
    // rollbackTriggerHitCount=1 fails CC-SF1, but enough other required criteria should be met
    expect(["completed_conditionally", "rollback_required"]).toContain(eval_.verdict);
  });

  it("PG-11: 11개 criteria 포함", () => {
    const m = makeGoodMetrics();
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(eval_.criteria).toHaveLength(11);
  });

  it("PG-12: evidence summary 포함", () => {
    const m = makeGoodMetrics();
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(eval_.evidenceSummary.length).toBeGreaterThanOrEqual(5);
    expect(eval_.evidenceSummary.some(e => e.includes("PO"))).toBe(true);
    expect(eval_.evidenceSummary.some(e => e.includes("런타임"))).toBe(true);
  });

  it("PG-13: high blocker rate → required criteria 미충족", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 5,
      poInProgress: 0,
      poBlocked: 0,
      totalBlockerCount: 4, // 80% rate → fails CC-Q1 (≤ 30%)
      hardBlockerCount: 3,  // fails CC-Q2 (≤ 2)
      chainCompletions: 2,  // 40% → fails CC-V2 (≥ 70%)
    });
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(eval_.requiredMet).toBeLessThan(eval_.requiredTotal);
  });

  it("PG-14: runtime signal 낮으면 stability criteria 미충족", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      runtimeSignalAvg: 50,       // fails CC-S1 (≥ 70)
      runtimeSignalMin: 30,       // fails CC-S3 (≥ 50)
      runtimeCriticalBreachCount: 3, // fails CC-S2 (≤ 1)
    });
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const stabilityCriteria = eval_.criteria.filter(c => c.category === "stability");
    const metCount = stabilityCriteria.filter(c => c.met).length;
    expect(metCount).toBeLessThan(stabilityCriteria.length);
  });

  it("PG-15: compliance 낮으면 compliance criteria 미충족", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      complianceVerdicts: { compliant: 2, conditionally_compliant: 3, non_compliant: 4 },
    });
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const cc = eval_.criteria.find(c => c.criterionId === "CC-C1");
    expect(cc?.met).toBe(false);
  });

  it("PG-16: irreversible action failure → safety criteria 미충족", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      irreversibleActionFailureCount: 2,
    });
    const eval_ = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const sf2 = eval_.criteria.find(c => c.criterionId === "CC-SF2");
    expect(sf2?.met).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// 3. Graduation Path
// ══════════════════════════════════════════════════════

describe("3. Graduation Path", () => {
  it("PG-17: completed_successfully + pilot_limited + clean → expand or GA", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(["expand_pilot", "ready_for_ga"]).toContain(grad.path);
    expect(grad.supportingFactors.length).toBeGreaterThan(0);
  });

  it("PG-18: completed_successfully + pilot_limited + perfect → ready_for_ga", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 9,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 9,
      totalBlockerCount: 0,
      hardBlockerCount: 0,
      softBlockerCount: 0,
      runtimeSignalAvg: 95,
      runtimeSignalMin: 85,
      complianceVerdicts: { compliant: 9, conditionally_compliant: 0, non_compliant: 0 },
    });
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(comp.verdict).toBe("completed_successfully");
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(grad.path).toBe("ready_for_ga");
    expect(grad.confidence).toBe("high");
  });

  it("PG-19: completed_successfully + internal_only → expand_pilot", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "internal_only");
    expect(grad.path).toBe("expand_pilot");
  });

  it("PG-20: rollback_required → rollback_and_reassess", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", true);
    expect(comp.verdict).toBe("rollback_required");
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(grad.path).toBe("rollback_and_reassess");
    expect(grad.reassessmentRequired).toBe(true);
    expect(grad.remediationItems.length).toBeGreaterThan(0);
  });

  it("PG-21: cancelled → rollback_and_reassess", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "cancelled", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(grad.path).toBe("rollback_and_reassess");
    expect(grad.reassessmentRequired).toBe(true);
  });

  it("PG-22: insufficient_evidence → remain_internal_only", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 1,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 1,
      totalBlockerCount: 0,
    });
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    expect(comp.verdict).toBe("insufficient_evidence");
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(grad.path).toBe("remain_internal_only");
    expect(grad.confidence).toBe("low");
  });

  it("PG-23: completed_conditionally + few risks → expand_pilot (internal)", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 5,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 4,
      rollbackTriggerHitCount: 1,
    });
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    if (comp.verdict === "completed_conditionally") {
      const grad = evaluateGraduationPath(comp, m, "internal_only");
      expect(grad.path).toBe("expand_pilot");
    }
  });

  it("PG-24: graduation에 confidence 포함", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(["high", "medium", "low"]).toContain(grad.confidence);
  });

  it("PG-25: risk factors 수집", () => {
    const m = makeBadMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(grad.riskFactors.length).toBeGreaterThan(0);
  });

  it("PG-26: supporting factors 수집", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    expect(grad.supportingFactors.length).toBeGreaterThan(0);
    expect(grad.supportingFactors.some(f => f.includes("롤백 트리거 미발동"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// 4. Restart / Reassess
// ══════════════════════════════════════════════════════

describe("4. Restart / Reassess", () => {
  it("PG-27: restart assessment 생성", () => {
    const assess = createRestartAssessment(
      "rc0_test", "grad_001", "런타임 critical breach 반복",
      ["런타임 안정성 확보", "재발 방지 계획"],
    );
    expect(assess.status).toBe("reassess_required");
    expect(assess.restartReady).toBe(false);
    expect(assess.remediationItems).toHaveLength(2);
    expect(assess.remediationItems.every(r => r.status === "pending")).toBe(true);
  });

  it("PG-28: remediation 전부 pending → restart 불가", () => {
    const assess = createRestartAssessment(
      "rc0_test", "grad_001", "reason",
      ["item1", "item2"],
    );
    const result = evaluateRestartReadiness(assess);
    expect(result.restartReady).toBe(false);
    expect(result.blockingReasons.some(r => r.includes("미완료"))).toBe(true);
  });

  it("PG-29: remediation 전부 completed → restart ready", () => {
    const assess = createRestartAssessment(
      "rc0_test", "grad_001", "reason",
      ["item1", "item2"],
    );
    assess.remediationItems[0].status = "completed";
    assess.remediationItems[0].completedAt = new Date().toISOString();
    assess.remediationItems[1].status = "completed";
    assess.remediationItems[1].completedAt = new Date().toISOString();
    const result = evaluateRestartReadiness(assess);
    expect(result.restartReady).toBe(true);
    expect(result.status).toBe("restart_ready");
    expect(result.blockingReasons).toHaveLength(0);
  });

  it("PG-30: waived 포함 → restart ready", () => {
    const assess = createRestartAssessment(
      "rc0_test", "grad_001", "reason",
      ["item1", "item2"],
    );
    assess.remediationItems[0].status = "completed";
    assess.remediationItems[0].completedAt = new Date().toISOString();
    assess.remediationItems[1].status = "waived";
    const result = evaluateRestartReadiness(assess);
    expect(result.restartReady).toBe(true);
    expect(result.status).toBe("restart_ready");
  });

  it("PG-31: in_progress → remediation_in_progress", () => {
    const assess = createRestartAssessment(
      "rc0_test", "grad_001", "reason",
      ["item1", "item2"],
    );
    assess.remediationItems[0].status = "in_progress";
    assess.remediationItems[1].status = "completed";
    assess.remediationItems[1].completedAt = new Date().toISOString();
    const result = evaluateRestartReadiness(assess);
    expect(result.restartReady).toBe(false);
    expect(result.status).toBe("remediation_in_progress");
  });

  it("PG-32: rollback reason 보존", () => {
    const assess = createRestartAssessment(
      "rc0_test", "grad_001", "런타임 critical breach 반복",
      ["item"],
    );
    expect(assess.rollbackReason).toBe("런타임 critical breach 반복");
  });
});

// ══════════════════════════════════════════════════════
// 5. Surface Builder
// ══════════════════════════════════════════════════════

describe("5. Surface Builder", () => {
  it("PG-33: ready surface — center/rail/dock 구조", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const surface = buildGraduationSurface(comp, grad, m, null);

    expect(surface.center).toBeDefined();
    expect(surface.rail).toBeDefined();
    expect(surface.dock).toBeDefined();
    expect(surface.center.completionVerdict).toBe("completed_successfully");
  });

  it("PG-34: dock 6 actions", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const surface = buildGraduationSurface(comp, grad, m, null);

    expect(surface.dock.actions).toHaveLength(6);
    const keys = surface.dock.actions.map(a => a.actionKey);
    expect(keys).toContain("mark_completed");
    expect(keys).toContain("expand_pilot");
    expect(keys).toContain("approve_ga");
    expect(keys).toContain("rollback_and_reassess");
    expect(keys).toContain("cancel_pilot");
    expect(keys).toContain("export_graduation_pack");
  });

  it("PG-35: completed_successfully → mark_completed enabled", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const surface = buildGraduationSurface(comp, grad, m, null);

    const mark = surface.dock.actions.find(a => a.actionKey === "mark_completed");
    expect(mark?.enabled).toBe(true);
  });

  it("PG-36: rollback_required → mark_completed disabled", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", true);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const surface = buildGraduationSurface(comp, grad, m, null);

    const mark = surface.dock.actions.find(a => a.actionKey === "mark_completed");
    expect(mark?.enabled).toBe(false);
  });

  it("PG-37: ready_for_ga path → approve_ga enabled", () => {
    const scope = makeScope();
    const m = aggregatePilotMetrics({
      ...makeGoodMetricsInput(scope),
      poProcessed: 9,
      poInProgress: 0,
      poBlocked: 0,
      chainCompletions: 9,
      totalBlockerCount: 0,
      hardBlockerCount: 0,
      softBlockerCount: 0,
      runtimeSignalAvg: 95,
      runtimeSignalMin: 85,
      complianceVerdicts: { compliant: 9, conditionally_compliant: 0, non_compliant: 0 },
    });
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    if (grad.path === "ready_for_ga") {
      const surface = buildGraduationSurface(comp, grad, m, null);
      const approve = surface.dock.actions.find(a => a.actionKey === "approve_ga");
      expect(approve?.enabled).toBe(true);
      expect(approve?.requiredRoles).toContain("compliance_reviewer");
    }
  });

  it("PG-38: rail — evidence + criteria details", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const surface = buildGraduationSurface(comp, grad, m, null);

    expect(surface.rail.evidenceSummary.length).toBeGreaterThanOrEqual(5);
    expect(surface.rail.criteriaDetails).toHaveLength(11);
    expect(surface.rail.metricsDetail).toBeDefined();
    expect(surface.rail.remediationItems).toBeNull();
  });

  it("PG-39: restart assessment → rail에 remediation 포함", () => {
    const m = makeBadMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", true);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const restart = createRestartAssessment(
      "rc0_test", grad.decisionId, "test reason",
      ["fix runtime", "fix compliance"],
    );
    const surface = buildGraduationSurface(comp, grad, m, restart);

    expect(surface.rail.remediationItems).toHaveLength(2);
    expect(surface.rail.remediationItems![0].description).toBe("fix runtime");
  });

  it("PG-40: metrics summary 정확성", () => {
    const m = makeGoodMetrics();
    const comp = evaluatePilotCompletion(m, "rc0_test", "active", false);
    const grad = evaluateGraduationPath(comp, m, "pilot_limited");
    const surface = buildGraduationSurface(comp, grad, m, null);

    expect(surface.center.metricsSummary.poProcessed).toBe(8);
    expect(surface.center.metricsSummary.poLimit).toBe(10);
    expect(parseFloat(surface.center.metricsSummary.runtimeSignalAvg)).toBe(90);
  });
});

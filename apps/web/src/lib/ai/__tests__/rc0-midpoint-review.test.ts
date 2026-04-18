// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * RC0 Midpoint Review Engine — Test Suite (Batch 21)
 *
 * 30 scenarios: MP-1 ~ MP-30
 *
 * Groups:
 * A. Non-compliance review (MP-1 ~ MP-5)
 * B. Soft blocker pattern (MP-6 ~ MP-11)
 * C. Dwell risk (MP-12 ~ MP-17)
 * D. Graduation projection (MP-18 ~ MP-23)
 * E. Surface / handoff / export (MP-24 ~ MP-30)
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { GovernanceDomain } from "../governance-event-bus";
import type { QuoteChainStage } from "../quote-approval-governance-engine";
import type { PilotMetrics, PilotCompletionEvaluation, GraduationDecision } from "../pilot-graduation-engine";
import { evaluatePilotCompletion, evaluateGraduationPath } from "../pilot-graduation-engine";
import type { RC0ScopeFreeze } from "../rc0-pilot-launch-engine";

import {
  analyzeNonComplianceCase,
  analyzeSoftBlockerPattern,
  analyzeDwellRisk,
  projectGraduation,
  buildMidpointActionPlan,
  assessMidpointVerdict,
  buildHandoffToken,
  buildExportPack,
  buildMidpointReviewSurface,
  type NonComplianceCaseInput,
  type NonComplianceCaseReview,
  type SoftBlockerEntry,
  type InProgressCaseInput,
  type SoftBlockerPatternSummary,
  type DwellRiskSummary,
  type GraduationProjection,
  type MidpointActionPlan,
  type MidpointVerdict,
} from "../rc0-midpoint-review-engine";

// ── Helpers ──

function makeScope(overrides?: Partial<RC0ScopeFreeze>): RC0ScopeFreeze {
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 86400000); // 3 days ago
  const end = new Date(start.getTime() + 14 * 86400000);
  return {
    rc0Id: "rc0_test",
    frozenAt: new Date(start.getTime() - 60000).toISOString(),
    gateVerdict: "go",
    gateSnapshotId: "gs_test",
    activationScope: "pilot_limited",
    includedStages: ["quote_review", "quote_shortlist", "quote_approval", "po_conversion", "po_approval", "po_send_readiness", "po_created", "dispatch_prep", "sent", "supplier_confirmed", "receiving_prep", "stock_release", "reorder_decision"],
    activeDomains: ["quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"],
    poLimit: 20,
    durationDays: 14,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    actorScope: {
      operatorRoles: ["procurement_operator"],
      reviewerRoles: ["compliance_reviewer"],
      maxConcurrentActors: 5,
    },
    locked: true,
    ...overrides,
  };
}

function makeGoodMetrics(overrides?: Partial<PilotMetrics>): PilotMetrics {
  return {
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 11 * 86400000).toISOString(),
    daysElapsed: 3,
    daysPlanned: 14,
    poProcessed: 18,
    poLimit: 20,
    poCompletionRate: 0.8,
    poInProgress: 2,
    poBlocked: 0,
    chainCompletionRate: 0.8,
    avgChainDurationHours: 8.5,
    maxChainDurationHours: 24,
    blockerIncidenceRate: 0.15,
    totalBlockerCount: 3,
    hardBlockerCount: 0,
    softBlockerCount: 3,
    staleBlockingFrequency: 1,
    staleAvgResolutionMin: 3.2,
    runtimeSignalAvg: 91.5,
    runtimeSignalMin: 78,
    runtimeCriticalBreachCount: 0,
    reopenCount: 2,
    retryCount: 1,
    rollbackTriggerHitCount: 0,
    complianceVerdictDistribution: { compliant: 17, conditionally_compliant: 2, non_compliant: 1 },
    complianceRate: 0.85,
    activeActorCount: 4,
    decisionLogVolume: 87,
    irreversibleActionCount: 22,
    irreversibleActionFailureCount: 0,
    ...overrides,
  };
}

function makeNonComplianceInput(overrides?: Partial<NonComplianceCaseInput>): NonComplianceCaseInput {
  return {
    caseId: "case_nc_001",
    poNumber: "PO-010",
    domain: "receiving_prep" as GovernanceDomain,
    stage: "receiving_prep" as QuoteChainStage,
    actor: "operator_A",
    decisionType: "compliance_check",
    verdict: "non_compliant",
    eventHistory: [
      { eventType: "stale_detected", timestamp: new Date().toISOString(), detail: "stale context during receiving check" },
      { eventType: "handoff_break", timestamp: new Date().toISOString(), detail: "handoff chain gap at dispatch → receiving" },
    ],
    relatedBlockerIds: ["blk_001"],
    staleEvents: 1,
    handoffBreaks: 1,
    dataQualityFlags: [],
    ...overrides,
  };
}

function makeSoftBlocker(overrides?: Partial<SoftBlockerEntry>): SoftBlockerEntry {
  return {
    blockerId: "blk_001",
    caseId: "case_001",
    poNumber: "PO-005",
    domain: "dispatch_prep" as GovernanceDomain,
    stage: "dispatch_prep" as QuoteChainStage,
    blockerType: "missing_document",
    actor: "operator_A",
    resolvedAt: null,
    durationMin: null,
    ...overrides,
  };
}

function makeInProgressCase(overrides?: Partial<InProgressCaseInput>): InProgressCaseInput {
  return {
    caseId: "case_ip_001",
    poNumber: "PO-019",
    currentStage: "supplier_confirmed" as QuoteChainStage,
    domain: "supplier_confirmation" as GovernanceDomain,
    enteredStageAt: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 hours ago
    expectedMaxDwellHours: 24,
    staleFlag: false,
    linkedBlockerIds: [],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// A. Non-compliance review (MP-1 ~ MP-5)
// ══════════════════════════════════════════════════════

describe("A. Non-compliance Case Review", () => {
  it("MP-1: non-compliant case gets root cause category", () => {
    const input = makeNonComplianceInput();
    const result = analyzeNonComplianceCase(input);
    expect(result.rootCauseCategory).toBeDefined();
    expect(["policy", "stale_context", "handoff", "compliance_gap", "operator_error", "data_quality", "unknown"]).toContain(result.rootCauseCategory);
    expect(result.caseId).toBe("case_nc_001");
  });

  it("MP-2: stale + handoff lineage reflects in root cause recommendation", () => {
    const input = makeNonComplianceInput({
      staleEvents: 2,
      handoffBreaks: 1,
    });
    const result = analyzeNonComplianceCase(input);
    // stale + handoff → handoff takes priority
    expect(result.rootCauseCategory).toBe("handoff");
    expect(result.remediationRecommendation).toContain("handoff");
  });

  it("MP-3: evidence links (lineage) are not empty", () => {
    const input = makeNonComplianceInput();
    const result = analyzeNonComplianceCase(input);
    expect(result.lineage.length).toBeGreaterThan(0);
    expect(result.triggeredBy).not.toBe("");
  });

  it("MP-4: data quality flags drive root cause to data_quality", () => {
    const input = makeNonComplianceInput({
      staleEvents: 0,
      handoffBreaks: 0,
      relatedBlockerIds: [],
      dataQualityFlags: ["missing_field", "format_error"],
    });
    const result = analyzeNonComplianceCase(input);
    expect(result.rootCauseCategory).toBe("data_quality");
    expect(result.remediationRecommendation).toContain("데이터 품질");
  });

  it("MP-5: empty event history yields unknown with non-empty trigger", () => {
    const input = makeNonComplianceInput({
      eventHistory: [],
      staleEvents: 0,
      handoffBreaks: 0,
      relatedBlockerIds: [],
      dataQualityFlags: [],
    });
    const result = analyzeNonComplianceCase(input);
    expect(result.rootCauseCategory).toBe("unknown");
    expect(result.triggeredBy).toBe("이벤트 이력 없음");
  });
});

// ══════════════════════════════════════════════════════
// B. Soft blocker pattern (MP-6 ~ MP-11)
// ══════════════════════════════════════════════════════

describe("B. Soft Blocker Pattern", () => {
  it("MP-6: repeated same domain+stage+type is detected as pattern", () => {
    const blockers = [
      makeSoftBlocker({ blockerId: "b1", caseId: "c1" }),
      makeSoftBlocker({ blockerId: "b2", caseId: "c2" }),
    ];
    const result = analyzeSoftBlockerPattern(blockers);
    expect(result.repeatedPatterns.length).toBeGreaterThan(0);
    expect(result.repeatedPatterns[0].count).toBe(2);
  });

  it("MP-7: actor concentration detected when one actor has >40%", () => {
    const blockers = [
      makeSoftBlocker({ blockerId: "b1", actor: "operator_A" }),
      makeSoftBlocker({ blockerId: "b2", actor: "operator_A" }),
      makeSoftBlocker({ blockerId: "b3", actor: "operator_B" }),
    ];
    const result = analyzeSoftBlockerPattern(blockers);
    expect(result.actorConcentration.length).toBeGreaterThan(0);
    expect(result.actorConcentration[0].actor).toBe("operator_A");
    expect(result.actorConcentration[0].share).toBeGreaterThan(0.4);
  });

  it("MP-8: domain/stage distribution is calculated", () => {
    const blockers = [
      makeSoftBlocker({ blockerId: "b1", domain: "dispatch_prep" as GovernanceDomain, stage: "dispatch_prep" as QuoteChainStage }),
      makeSoftBlocker({ blockerId: "b2", domain: "quote_chain" as GovernanceDomain, stage: "quote_approval" as QuoteChainStage }),
      makeSoftBlocker({ blockerId: "b3", domain: "dispatch_prep" as GovernanceDomain, stage: "po_created" as QuoteChainStage }),
    ];
    const result = analyzeSoftBlockerPattern(blockers);
    expect(result.byDomain["dispatch_prep"]).toBe(2);
    expect(result.byDomain["quote_chain"]).toBe(1);
    expect(Object.keys(result.byStage).length).toBe(3);
  });

  it("MP-9: single blocker does not trigger repeated pattern (no over-detection)", () => {
    const blockers = [makeSoftBlocker({ blockerId: "b_single" })];
    const result = analyzeSoftBlockerPattern(blockers);
    expect(result.repeatedPatterns.length).toBe(0);
    expect(result.recommendedAction).toContain("단발성");
  });

  it("MP-10: concentration score calculated (Herfindahl)", () => {
    const blockers = [
      makeSoftBlocker({ blockerId: "b1" }),
      makeSoftBlocker({ blockerId: "b2" }),
      makeSoftBlocker({ blockerId: "b3" }),
    ];
    const result = analyzeSoftBlockerPattern(blockers);
    expect(result.concentrationScore).toBeGreaterThan(0);
    // All same path → concentration = 1.0
    expect(result.concentrationScore).toBe(1);
  });

  it("MP-11: empty blockers produce clean empty result", () => {
    const result = analyzeSoftBlockerPattern([]);
    expect(result.totalCount).toBe(0);
    expect(result.repeatedPatterns).toEqual([]);
    expect(result.actorConcentration).toEqual([]);
    expect(result.concentrationScore).toBe(0);
    expect(result.topRepeatedPath).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// C. Dwell risk (MP-12 ~ MP-17)
// ══════════════════════════════════════════════════════

describe("C. Dwell Risk", () => {
  it("MP-12: normal dwell within threshold", () => {
    const cases = [
      makeInProgressCase({
        enteredStageAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2h ago
        expectedMaxDwellHours: 24,
      }),
    ];
    const result = analyzeDwellRisk(cases);
    expect(result.cases[0].riskLevel).toBe("normal");
    expect(result.aggregate.normal).toBe(1);
  });

  it("MP-13: threshold exceeded → at_risk", () => {
    const cases = [
      makeInProgressCase({
        enteredStageAt: new Date(Date.now() - 30 * 3600000).toISOString(), // 30h, threshold 24h
        expectedMaxDwellHours: 24,
      }),
    ];
    const result = analyzeDwellRisk(cases);
    expect(result.cases[0].riskLevel).toBe("at_risk");
  });

  it("MP-14: stale flag escalates risk level", () => {
    const cases = [
      makeInProgressCase({
        enteredStageAt: new Date(Date.now() - 6 * 3600000).toISOString(), // 6h, ratio=0.25 → normal
        expectedMaxDwellHours: 24,
        staleFlag: true, // escalates normal → watch
      }),
    ];
    const result = analyzeDwellRisk(cases);
    expect(result.cases[0].riskLevel).toBe("watch");
    expect(result.cases[0].staleFlag).toBe(true);
  });

  it("MP-15: blocker linkage escalates risk", () => {
    const cases = [
      makeInProgressCase({
        enteredStageAt: new Date(Date.now() - 18 * 3600000).toISOString(), // 18h, ratio=0.75 → watch
        expectedMaxDwellHours: 24,
        linkedBlockerIds: ["blk_linked"],
      }),
    ];
    const result = analyzeDwellRisk(cases);
    // watch → at_risk due to blocker linkage
    expect(result.cases[0].riskLevel).toBe("at_risk");
    expect(result.cases[0].blockerLinkage).toBe(true);
  });

  it("MP-16: oldest in-progress case is computed", () => {
    const cases = [
      makeInProgressCase({
        caseId: "newer",
        enteredStageAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      }),
      makeInProgressCase({
        caseId: "older",
        enteredStageAt: new Date(Date.now() - 20 * 3600000).toISOString(),
      }),
    ];
    const result = analyzeDwellRisk(cases);
    expect(result.oldestInProgressCase?.caseId).toBe("older");
  });

  it("MP-17: empty in-progress produces clean summary", () => {
    const result = analyzeDwellRisk([]);
    expect(result.totalInProgress).toBe(0);
    expect(result.cases).toEqual([]);
    expect(result.oldestInProgressCase).toBeNull();
    expect(result.likelyGraduationImpact).toContain("없음");
  });
});

// ══════════════════════════════════════════════════════
// D. Graduation projection (MP-18 ~ MP-23)
// ══════════════════════════════════════════════════════

describe("D. Graduation Projection", () => {
  it("MP-18: daysElapsed insufficient → current=conditional", () => {
    const metrics = makeGoodMetrics({ daysElapsed: 3 });
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");
    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    expect(projection.currentVerdict).toBe("completed_conditionally");
  });

  it("MP-19: same metrics + daysElapsed>=7 → projected success or expand", () => {
    const metrics = makeGoodMetrics({ daysElapsed: 3 });
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");
    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    // Projected should improve when time constraint is removed
    expect(["completed_successfully", "completed_conditionally"]).toContain(projection.projectedVerdict);
    expect(projection.timeResolvedBlockers.length).toBeGreaterThan(0);
  });

  it("MP-20: non-time blocker persists in projection", () => {
    const metrics = makeGoodMetrics({ daysElapsed: 3, poProcessed: 2 }); // PO < 3
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");
    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    // PO insufficiency persists even with time
    expect(projection.persistentBlockers.length).toBeGreaterThan(0);
  });

  it("MP-21: policy unchanged — projection only simulates evidence", () => {
    const metrics = makeGoodMetrics({ daysElapsed: 3 });
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");
    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    expect(projection.assumptions.length).toBeGreaterThan(0);
    expect(projection.assumptions.some(a => a.includes("metrics"))).toBe(true);
  });

  it("MP-22: daysElapsed 7+ with good metrics → expansion plausible", () => {
    const metrics = makeGoodMetrics({ daysElapsed: 8 });
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");
    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    // Already past the evidence window
    expect(projection.expansionPlausible).toBe(true);
  });

  it("MP-23: daysElapsed 7+ with degraded metrics → expansion blocked", () => {
    const metrics = makeGoodMetrics({
      daysElapsed: 8,
      runtimeSignalAvg: 55,        // below 70 threshold
      complianceRate: 0.6,          // below 80%
      rollbackTriggerHitCount: 1,   // safety fail
    });
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");
    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    expect(projection.expansionPlausible).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// E. Surface / Handoff / Export (MP-24 ~ MP-30)
// ══════════════════════════════════════════════════════

describe("E. Surface / Handoff / Export", () => {
  // Reusable test data
  function buildFullScenario() {
    const metrics = makeGoodMetrics({ daysElapsed: 3 });
    const scope = makeScope();
    const completion = evaluatePilotCompletion(metrics, "rc0_test", "active", false);
    const graduation = evaluateGraduationPath(completion, metrics, "pilot_limited");

    const ncInput = makeNonComplianceInput();
    const ncReview = analyzeNonComplianceCase(ncInput);

    const blockers = [
      makeSoftBlocker({ blockerId: "b1" }),
      makeSoftBlocker({ blockerId: "b2" }),
      makeSoftBlocker({ blockerId: "b3" }),
    ];
    const blockerPattern = analyzeSoftBlockerPattern(blockers);

    const dwellCases = [
      makeInProgressCase({ caseId: "ip1" }),
      makeInProgressCase({ caseId: "ip2", staleFlag: true }),
    ];
    const dwellRisk = analyzeDwellRisk(dwellCases);

    const projection = projectGraduation(metrics, completion, graduation, scope, []);

    const verdict = assessMidpointVerdict(metrics, [ncReview], blockerPattern, dwellRisk);
    const actionPlan = buildMidpointActionPlan([ncReview], blockerPattern, dwellRisk, projection);
    const exportPack = buildExportPack(metrics, [ncReview], blockerPattern, dwellRisk, projection, actionPlan, scope);
    const handoffToken = buildHandoffToken(scope, metrics, projection, [ncReview], blockerPattern, dwellRisk);

    return {
      metrics, scope, completion, graduation, ncReview, blockerPattern,
      dwellRisk, projection, verdict, actionPlan, exportPack, handoffToken,
    };
  }

  it("MP-24: center/rail/dock structure verified", () => {
    const s = buildFullScenario();
    const surface = buildMidpointReviewSurface(
      s.verdict, s.metrics, [s.ncReview], s.blockerPattern,
      s.dwellRisk, s.projection, s.actionPlan, s.exportPack,
    );

    // center
    expect(surface.center.midpointVerdict).toBeDefined();
    expect(surface.center.currentVerdictLabel).toBeDefined();
    expect(surface.center.projectedVerdictLabel).toBeDefined();
    expect(surface.center.nonComplianceSummary.count).toBe(1);
    expect(surface.center.blockerPatternSummary.total).toBe(3);
    expect(surface.center.dwellRiskSummary.total).toBe(2);

    // rail
    expect(surface.rail.evidenceLinks.length).toBeGreaterThan(0);
    expect(surface.rail.daysElapsed).toBe(3);
    expect(surface.rail.daysPlanned).toBe(14);

    // dock — all 6 actions
    expect(surface.dock.actions.length).toBe(6);
  });

  it("MP-25: dashboard handoff token has required fields", () => {
    const s = buildFullScenario();

    expect(s.handoffToken.pilotId).toBe("rc0_test");
    expect(s.handoffToken.scopeId).toBe("rc0_test");
    expect(s.handoffToken.reviewTimestamp).toBeDefined();
    expect(s.handoffToken.daysElapsed).toBe(3);
    expect(s.handoffToken.projectedVerdict).toBeDefined();
    expect(s.handoffToken.projectedPath).toBeDefined();
    expect(s.handoffToken.originMode).toBe("midpoint_review");
  });

  it("MP-26: audit review handoff token includes non-compliance case IDs", () => {
    const s = buildFullScenario();
    expect(s.handoffToken.nonComplianceCaseIds).toContain("case_nc_001");
  });

  it("MP-27: graduation review handoff token includes projected path", () => {
    const s = buildFullScenario();
    expect(["remain_internal_only", "expand_pilot", "ready_for_ga", "rollback_and_reassess"]).toContain(s.handoffToken.projectedPath);
  });

  it("MP-28: export pack has all required fields", () => {
    const s = buildFullScenario();

    expect(s.exportPack.currentMetrics).toBeDefined();
    expect(s.exportPack.nonComplianceCaseReviews.length).toBe(1);
    expect(s.exportPack.softBlockerPatternSummary.totalCount).toBe(3);
    expect(s.exportPack.dwellRiskSummary.totalInProgress).toBe(2);
    expect(s.exportPack.graduationProjection).toBeDefined();
    expect(s.exportPack.actionPlan).toBeDefined();
    expect(s.exportPack.evidenceLinks.length).toBeGreaterThan(0);
    expect(s.exportPack.generatedAt).toBeDefined();
    expect(s.exportPack.grammarVersion).toBe("batch-21");
    expect(s.exportPack.pilotScopeId).toBe("rc0_test");
  });

  it("MP-29: rollback trigger active → midpoint verdict risk_increasing", () => {
    const metrics = makeGoodMetrics({ rollbackTriggerHitCount: 1 });
    const verdict = assessMidpointVerdict(metrics, [], analyzeSoftBlockerPattern([]), analyzeDwellRisk([]));
    expect(verdict).toBe("risk_increasing");
  });

  it("MP-30: all zeros — stable_but_insufficient_time when days<50%", () => {
    const metrics = makeGoodMetrics({ daysElapsed: 3 });
    const verdict = assessMidpointVerdict(metrics, [], analyzeSoftBlockerPattern([]), analyzeDwellRisk([]));
    expect(verdict).toBe("stable_but_insufficient_time");
  });
});

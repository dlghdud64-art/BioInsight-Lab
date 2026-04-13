// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Batch 15 — Pilot Monitoring & Audit Handoff Pack Tests
 *
 * PM1-PM30: 30 scenarios
 *
 * Handoff tokens, rollback trigger evaluator, health summary, monitoring surface
 */
import { describe, it, expect } from "vitest";
import {
  buildPilotDashboardHandoff,
  buildPilotAuditHandoff,
  evaluateRollbackTriggers,
  buildActivePilotHealthSummary,
  buildPilotMonitoringSurface,
  type RollbackEvaluationInput,
  type AuditReviewMode,
} from "../pilot-monitoring-engine";
import {
  createPilotPlan,
  checkChecklistItem,
  activatePilot,
  type PilotPlan,
} from "../pilot-activation-engine";
import {
  evaluateReleaseReadiness,
  type ReleaseReadinessContext,
} from "../release-readiness-engine";
import {
  buildAppRuntimeSignalReport,
  type AppRuntimeContext,
} from "../app-runtime-signal-provider";
import type { ComplianceSnapshot } from "../governance-audit-engine";

// ── Helpers ──

const ALL_DOMAINS = [
  "quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation",
  "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
] as const;

function makeFullContext(): ReleaseReadinessContext {
  return {
    implementedEngines: [...ALL_DOMAINS],
    enginesConsumingGrammar: [...ALL_DOMAINS],
    surfacesConsumingGrammar: ["a", "b", "c", "d", "e", "f", "g", "h"],
    totalSurfaces: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    testFiles: ["t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    eventBusWiredDomains: [...ALL_DOMAINS.slice(1, 6)],
    invalidationRuleCount: 15,
    hardeningPipelineExists: true,
    architectureDocExists: true,
    grammarDocExists: true,
  };
}

function makeHealthyAppContext(): AppRuntimeContext {
  return {
    enginesWithGrammarImport: [...ALL_DOMAINS],
    allImplementedEngines: [...ALL_DOMAINS],
    surfacesWithGrammarImport: ["a", "b", "c", "d", "e", "f", "g", "h"],
    allSurfaces: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    remainingHardcodedLabelCount: 0,
    actionsWithHardeningPipeline: [
      "send_now", "cancel_dispatch_prep", "accept_response", "reject_response",
      "confirm_receipt", "cancel_receiving", "release_stock", "partial_release",
      "cancel_release", "require_reorder", "require_expedite", "mark_no_action",
      "procurement_reentry", "cancel_reorder",
    ],
    concurrencyGuardExists: true,
    idempotencyGuardExists: true,
    errorTrackerExists: true,
    eventBus: { publish: () => {}, subscribe: () => "", unsubscribe: () => {}, getHistory: () => [], clearHistory: () => {}, getSubscriptionCount: () => 8 } as any,
    subscribedDomains: [...ALL_DOMAINS],
    invalidationRuleCount: 18,
    staleDetectionDomains: [...ALL_DOMAINS],
    decisionLogStoreExists: true,
    auditAutoAttachActive: true,
    complianceSnapshotStoreExists: true,
    complianceSnapshotIntervalMin: 30,
    activePilotPlan: null,
    pilotRoleGatingConfigured: true,
    pilotConfirmationDialogEnforced: true,
    rollbackTriggersComplete: true,
    monitoringConfigured: true,
  };
}

function makeActivePlan(): PilotPlan {
  const result = evaluateReleaseReadiness(makeFullContext());
  let plan = createPilotPlan({ readinessResult: result });
  for (const item of plan.checklist.filter(i => i.required)) {
    plan = checkChecklistItem(plan, item.itemId, "op");
  }
  return activatePilot(plan);
}

function makeSnapshot(verdict: "compliant" | "non_compliant" | "needs_review"): ComplianceSnapshot {
  return {
    snapshotId: `snap_${Math.random().toString(36).slice(2, 6)}`,
    capturedAt: new Date().toISOString(),
    trigger: "scheduled",
    triggeredBy: "system",
    poNumber: "PO-001",
    caseId: "CASE-001",
    currentStageLabel: "발송 준비",
    currentStatusLabel: "검토 필요",
    activeBlockerCount: 0,
    hardBlockerCount: 0,
    softBlockerCount: 0,
    activeDomains: ["dispatch_prep"],
    domainStatuses: [],
    verdict,
    verdictReason: "test",
    chainProgress: 50,
  } as any;
}

function makeRollbackInput(overrides: Partial<RollbackEvaluationInput> = {}): RollbackEvaluationInput {
  return {
    signalReport: buildAppRuntimeSignalReport(makeHealthyAppContext()),
    complianceSnapshots: [],
    activeBlockerCount: 0,
    chainBlockedDurationMs: 0,
    irreversibleActionFailureCount: 0,
    staleBlockingUnresolved: false,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Handoff Tokens
// ══════════════════════════════════════════════════════

describe("Handoff Tokens", () => {
  it("PM1: dashboard handoff에 pilot scope 보존", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const handoff = buildPilotDashboardHandoff(plan, report, rollback, ["PO-001"]);
    expect(handoff.kind).toBe("pilot_to_dashboard");
    expect(handoff.pilotId).toBe(plan.planId);
    expect(handoff.originMode).toBe("pilot_monitoring");
    expect(handoff.activeScope.activePoIds).toEqual(["PO-001"]);
    expect(handoff.activeScope.activeDomains.length).toBe(8);
  });

  it("PM2: dashboard handoff에 runtime signal snapshot 포함", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const handoff = buildPilotDashboardHandoff(plan, report, rollback);
    expect(handoff.runtimeSignalSnapshot.overallHealthy).toBe(true);
    expect(handoff.runtimeSignalSnapshot.criticalIssueCount).toBe(0);
    expect(handoff.runtimeSignalSnapshot.calculatedAt).toBeTruthy();
  });

  it("PM3: audit handoff에 review mode 보존", () => {
    const plan = makeActivePlan();
    const handoff = buildPilotAuditHandoff(plan, "compliance_review");
    expect(handoff.kind).toBe("pilot_to_audit");
    expect(handoff.reviewMode).toBe("compliance_review");
  });

  it("PM4: audit handoff에 compliance summary 포함", () => {
    const plan = makeActivePlan();
    const snapshots = [makeSnapshot("compliant"), makeSnapshot("non_compliant"), makeSnapshot("compliant")];
    const handoff = buildPilotAuditHandoff(plan, "period_review", {}, snapshots);
    expect(handoff.complianceSummary.totalSnapshots).toBe(3);
    expect(handoff.complianceSummary.nonCompliantCount).toBe(1);
  });

  it("PM5: audit handoff case_review mode 지원", () => {
    const plan = makeActivePlan();
    const handoff = buildPilotAuditHandoff(plan, "case_review", { caseIds: ["CASE-1"] });
    expect(handoff.scope.caseIds).toEqual(["CASE-1"]);
  });

  it("PM6: audit handoff decision_trace mode 지원", () => {
    const plan = makeActivePlan();
    const handoff = buildPilotAuditHandoff(plan, "decision_trace", { correlationIds: ["COR-1"] });
    expect(handoff.scope.correlationIds).toEqual(["COR-1"]);
  });
});

// ══════════════════════════════════════════════════════
// Rollback Trigger Evaluator
// ══════════════════════════════════════════════════════

describe("Rollback Trigger Evaluator", () => {
  it("PM7: 정상 상태 → none", () => {
    const plan = makeActivePlan();
    const result = evaluateRollbackTriggers(plan, makeRollbackInput());
    expect(result.recommendation).toBe("none");
    expect(result.triggersHit).toHaveLength(0);
  });

  it("PM8: critical signal → rollback_recommended", () => {
    const unhealthyCtx = makeHealthyAppContext();
    unhealthyCtx.eventBus = null;
    unhealthyCtx.concurrencyGuardExists = false;
    unhealthyCtx.idempotencyGuardExists = false;
    unhealthyCtx.errorTrackerExists = false;
    unhealthyCtx.actionsWithHardeningPipeline = [];
    const report = buildAppRuntimeSignalReport(unhealthyCtx);
    const plan = makeActivePlan();
    const result = evaluateRollbackTriggers(plan, makeRollbackInput({ signalReport: report }));
    expect(result.recommendation).not.toBe("none");
    expect(result.triggersHit.some(t => t.triggerId === "RBT-1")).toBe(true);
  });

  it("PM9: 비준수 급증 → rollback trigger", () => {
    const plan = makeActivePlan();
    const snapshots = [
      makeSnapshot("non_compliant"),
      makeSnapshot("non_compliant"),
      makeSnapshot("compliant"),
    ];
    const result = evaluateRollbackTriggers(plan, makeRollbackInput({ complianceSnapshots: snapshots }));
    // 비준수 66% > 임계 10% → trigger
    expect(result.triggersHit.some(t => t.triggerId === "RBT-2")).toBe(true);
  });

  it("PM10: chain blocked 30분 이상 → watch 이상", () => {
    const plan = makeActivePlan();
    const result = evaluateRollbackTriggers(plan, makeRollbackInput({ chainBlockedDurationMs: 35 * 60 * 1000 }));
    expect(result.triggersHit.some(t => t.triggerId === "RBT-3")).toBe(true);
    expect(result.recommendation).not.toBe("none");
  });

  it("PM11: stale blocking → watch 이상", () => {
    const plan = makeActivePlan();
    const result = evaluateRollbackTriggers(plan, makeRollbackInput({ staleBlockingUnresolved: true }));
    expect(result.triggersHit.some(t => t.triggerId === "RBT-4")).toBe(true);
  });

  it("PM12: irreversible failure 초과 → critical trigger", () => {
    const plan = makeActivePlan();
    const result = evaluateRollbackTriggers(plan, makeRollbackInput({ irreversibleActionFailureCount: 10 }));
    expect(result.triggersHit.some(t => t.triggerId === "RBT-5")).toBe(true);
  });

  it("PM13: critical 2개 이상 → rollback_required", () => {
    const plan = makeActivePlan();
    const snapshots = Array(5).fill(null).map(() => makeSnapshot("non_compliant"));
    const unhealthyCtx = makeHealthyAppContext();
    unhealthyCtx.eventBus = null;
    unhealthyCtx.actionsWithHardeningPipeline = [];
    const report = buildAppRuntimeSignalReport(unhealthyCtx);
    const result = evaluateRollbackTriggers(plan, makeRollbackInput({
      signalReport: report,
      complianceSnapshots: snapshots,
    }));
    expect(result.recommendation).toBe("rollback_required");
  });

  it("PM14: signal freshness 추적", () => {
    const plan = makeActivePlan();
    const result = evaluateRollbackTriggers(plan, makeRollbackInput());
    expect(result.signalAge.calculatedAt).toBeTruthy();
    expect(result.signalAge.ageMs).toBeGreaterThanOrEqual(0);
  });
});

// ══════════════════════════════════════════════════════
// Active Pilot Health Summary
// ══════════════════════════════════════════════════════

describe("Active Pilot Health Summary", () => {
  it("PM15: checklist health와 operational health 분리", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    expect(health.checklistHealth.status).toBe("complete");
    expect(health.operationalHealth.overallHealthy).toBe(true);
    // 분리 확인: 서로 다른 객체
    expect(health.checklistHealth).not.toBe(health.operationalHealth);
  });

  it("PM16: compliance health 계산", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const snapshots = [makeSnapshot("compliant"), makeSnapshot("compliant"), makeSnapshot("non_compliant")];
    const health = buildActivePilotHealthSummary(plan, report, rollback, snapshots);
    expect(health.complianceHealth.complianceRate).toBe(67);
    expect(health.complianceHealth.nonCompliantCount).toBe(1);
  });

  it("PM17: rollback status 반영", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput({ staleBlockingUnresolved: true }));
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    expect(health.rollbackStatus.recommendation).toBe("watch");
  });

  it("PM18: signal freshness 포함", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    expect(health.signalFreshness.calculatedAt).toBeTruthy();
  });

  it("PM19: recent critical events 포함", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const events = [{ eventType: "blocker_added", domain: "dispatch_prep" as const, occurredAt: new Date().toISOString(), detail: "test" }];
    const health = buildActivePilotHealthSummary(plan, report, rollback, [], events);
    expect(health.recentCriticalEvents).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════
// Monitoring Surface
// ══════════════════════════════════════════════════════

describe("Monitoring Surface", () => {
  it("PM20: surface center에 splitView 포함", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    expect(surface.center.splitView.setupComplete).toBe(true);
    expect(surface.center.splitView.operationalHealthy).toBe(true);
    expect(surface.center.splitView.rollbackSafe).toBe(true);
  });

  it("PM21: rail에 shortcuts 포함 (dashboard + audit)", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    const targets = surface.rail.shortcuts.map(s => s.target);
    expect(targets).toContain("dashboard");
    expect(targets).toContain("audit_case");
    expect(targets).toContain("audit_period");
    expect(targets).toContain("audit_compliance");
  });

  it("PM22: dock에 6개 action 포함", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    expect(surface.dock.actions).toHaveLength(6);
    const keys = surface.dock.actions.map(a => a.actionKey);
    expect(keys).toContain("open_dashboard");
    expect(keys).toContain("open_audit_review");
    expect(keys).toContain("rollback_pilot");
  });

  it("PM23: irreversible action에 requiresConfirmation true", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    const irreversibles = ["activate_pilot", "complete_pilot", "rollback_pilot", "cancel_pilot"];
    for (const key of irreversibles) {
      const action = surface.dock.actions.find(a => a.actionKey === key);
      expect(action?.requiresConfirmation).toBe(true);
    }
  });

  it("PM24: navigation action에 requiresConfirmation false", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    const navActions = ["open_dashboard", "open_audit_review"];
    for (const key of navActions) {
      const action = surface.dock.actions.find(a => a.actionKey === key);
      expect(action?.requiresConfirmation).toBe(false);
    }
  });

  it("PM25: rollback_required 시 complete_pilot disabled", () => {
    const plan = makeActivePlan();
    const unhealthyCtx = makeHealthyAppContext();
    unhealthyCtx.eventBus = null;
    unhealthyCtx.actionsWithHardeningPipeline = [];
    const report = buildAppRuntimeSignalReport(unhealthyCtx);
    const snapshots = Array(5).fill(null).map(() => makeSnapshot("non_compliant"));
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput({ signalReport: report, complianceSnapshots: snapshots }));
    const health = buildActivePilotHealthSummary(plan, report, rollback, snapshots);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    const complete = surface.dock.actions.find(a => a.actionKey === "complete_pilot");
    expect(complete?.enabled).toBe(false);
  });

  it("PM26: stale warning rail에 표시", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    // stale signal을 시뮬레이션하려면 evaluatedAt을 과거로 설정
    const oldReport = { ...report, evaluatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() };
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput({ signalReport: oldReport }));
    const health = buildActivePilotHealthSummary(plan, oldReport, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    expect(surface.rail.staleWarning).toBeTruthy();
  });

  it("PM27: active pilot에서 dashboard/audit shortcuts enabled", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    expect(surface.rail.shortcuts.find(s => s.target === "dashboard")?.enabled).toBe(true);
    expect(surface.rail.shortcuts.find(s => s.target === "audit_case")?.enabled).toBe(true);
  });

  it("PM28: role gating — requiredRoles 포함", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    const rollbackAction = surface.dock.actions.find(a => a.actionKey === "rollback_pilot");
    expect(rollbackAction?.requiredRoles.length).toBeGreaterThan(0);
  });

  it("PM29: compliance summary 텍스트 정확", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const snapshots = [makeSnapshot("compliant"), makeSnapshot("non_compliant")];
    const health = buildActivePilotHealthSummary(plan, report, rollback, snapshots);
    const surface = buildPilotMonitoringSurface(plan, health, rollback);
    expect(surface.rail.complianceSummary).toContain("50%");
    expect(surface.rail.complianceSummary).toContain("비준수 1건");
  });

  it("PM30: decision trace shortcut — trace ID 없으면 disabled", () => {
    const plan = makeActivePlan();
    const report = buildAppRuntimeSignalReport(makeHealthyAppContext());
    const rollback = evaluateRollbackTriggers(plan, makeRollbackInput());
    const health = buildActivePilotHealthSummary(plan, report, rollback, []);
    const surface = buildPilotMonitoringSurface(plan, health, rollback, []);
    expect(surface.rail.shortcuts.find(s => s.target === "audit_decision_trace")?.enabled).toBe(false);
  });
});

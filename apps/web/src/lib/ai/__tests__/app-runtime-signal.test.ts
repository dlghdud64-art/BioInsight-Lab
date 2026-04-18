/**
 * Batch 14 — Runtime Signal Wiring Pack Tests
 *
 * RT1-RT30: 30 scenarios
 *
 * RS-1: Grammar Consumption Coverage
 * RS-2: Hardening Pipeline Coverage
 * RS-3: Event Bus Wiring Health
 * RS-4: Audit/Compliance Wiring Health
 * RS-5: Pilot Execution Readiness
 * Integration: report aggregation + adapter + surface wiring
 */
import { describe, it, expect } from "vitest";
import {
  checkGrammarCoverage,
  checkMutationPipelineCoverage,
  checkEventBusHealth,
  checkComplianceWiringHealth,
  checkPilotActivationSafety,
  buildAppRuntimeSignalReport,
  createAppRuntimeSignalProvider,
  buildReleaseReadinessContextFromApp,
  type AppRuntimeContext,
} from "../app-runtime-signal-provider";
import {
  evaluateReleaseReadiness,
  buildReleaseReadinessSurface,
  checkRuntimeSignalHealth,
} from "../release-readiness-engine";

// ── Helpers ──

const ALL_DOMAINS = [
  "quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation",
  "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
] as const;

function makeHealthyContext(): AppRuntimeContext {
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

function makeUnhealthyContext(): AppRuntimeContext {
  return {
    enginesWithGrammarImport: ["quote_chain"],
    allImplementedEngines: [...ALL_DOMAINS],
    surfacesWithGrammarImport: ["a"],
    allSurfaces: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    remainingHardcodedLabelCount: 12,
    actionsWithHardeningPipeline: [],
    concurrencyGuardExists: false,
    idempotencyGuardExists: false,
    errorTrackerExists: false,
    eventBus: null,
    subscribedDomains: [],
    invalidationRuleCount: 2,
    staleDetectionDomains: [],
    decisionLogStoreExists: false,
    auditAutoAttachActive: false,
    complianceSnapshotStoreExists: false,
    complianceSnapshotIntervalMin: 0,
    activePilotPlan: null,
    pilotRoleGatingConfigured: false,
    pilotConfirmationDialogEnforced: false,
    rollbackTriggersComplete: false,
    monitoringConfigured: false,
  };
}

// ══════════════════════════════════════════════════════
// RS-1: Grammar Consumption Coverage
// ══════════════════════════════════════════════════════

describe("RS-1: Grammar Consumption Coverage", () => {
  it("RT1: 전량 소비 시 passed + score 100", () => {
    const result = checkGrammarCoverage(makeHealthyContext());
    expect(result.signalId).toBe("RS-1");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("RT2: engine 미소비 시 critical + issue 포함", () => {
    const ctx = makeHealthyContext();
    ctx.enginesWithGrammarImport = ["quote_chain"];
    const result = checkGrammarCoverage(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("critical");
    expect(result.issues.some(i => i.includes("engine grammar 미소비"))).toBe(true);
  });

  it("RT3: surface 소비율 80% 미만 시 warning", () => {
    const ctx = makeHealthyContext();
    ctx.surfacesWithGrammarImport = ["a", "b"];
    const result = checkGrammarCoverage(ctx);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes("surface grammar 소비율"))).toBe(true);
  });

  it("RT4: hardcoded label 잔존 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.remainingHardcodedLabelCount = 5;
    const result = checkGrammarCoverage(ctx);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes("hardcoded"))).toBe(true);
  });

  it("RT5: remediation 메시지 존재 (실패 시)", () => {
    const result = checkGrammarCoverage(makeUnhealthyContext());
    expect(result.remediation).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════
// RS-2: Hardening Pipeline Coverage
// ══════════════════════════════════════════════════════

describe("RS-2: Hardening Pipeline Coverage", () => {
  it("RT6: 전량 보호 시 passed", () => {
    const result = checkMutationPipelineCoverage(makeHealthyContext());
    expect(result.signalId).toBe("RS-2");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("RT7: 미보호 irreversible action 존재 시 critical", () => {
    const ctx = makeHealthyContext();
    ctx.actionsWithHardeningPipeline = [];
    const result = checkMutationPipelineCoverage(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("critical");
    expect(result.issues.some(i => i.includes("비보호"))).toBe(true);
  });

  it("RT8: guard 누락 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.concurrencyGuardExists = false;
    const result = checkMutationPipelineCoverage(ctx);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes("ConcurrencyGuard"))).toBe(true);
  });

  it("RT9: 부분 보호 시 score < 100", () => {
    const ctx = makeHealthyContext();
    ctx.actionsWithHardeningPipeline = ["send_now", "cancel_dispatch_prep"];
    const result = checkMutationPipelineCoverage(ctx);
    expect(result.score).toBeLessThan(100);
  });
});

// ══════════════════════════════════════════════════════
// RS-3: Event Bus Wiring Health
// ══════════════════════════════════════════════════════

describe("RS-3: Event Bus Wiring Health", () => {
  it("RT10: 전량 구독 + 충분한 rule 시 passed", () => {
    const result = checkEventBusHealth(makeHealthyContext());
    expect(result.signalId).toBe("RS-3");
    expect(result.passed).toBe(true);
  });

  it("RT11: event bus 없으면 critical", () => {
    const ctx = makeHealthyContext();
    ctx.eventBus = null;
    const result = checkEventBusHealth(ctx);
    expect(result.severity).toBe("critical");
    expect(result.issues.some(i => i.includes("인스턴스 없음"))).toBe(true);
  });

  it("RT12: domain 미구독 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.subscribedDomains = ["quote_chain"];
    const result = checkEventBusHealth(ctx);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes("미구독"))).toBe(true);
  });

  it("RT13: invalidation rule 부족 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.invalidationRuleCount = 5;
    const result = checkEventBusHealth(ctx);
    expect(result.passed).toBe(false);
  });

  it("RT14: stale detection 과반 미설정 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.staleDetectionDomains = ["quote_chain"];
    const result = checkEventBusHealth(ctx);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.includes("stale"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// RS-4: Audit/Compliance Wiring Health
// ══════════════════════════════════════════════════════

describe("RS-4: Audit/Compliance Wiring Health", () => {
  it("RT15: 전량 구성 시 passed", () => {
    const result = checkComplianceWiringHealth(makeHealthyContext());
    expect(result.signalId).toBe("RS-4");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("RT16: decision log 미생성 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.decisionLogStoreExists = false;
    const result = checkComplianceWiringHealth(ctx);
    expect(result.issues.some(i => i.includes("DecisionLogStore"))).toBe(true);
  });

  it("RT17: auto-attach 미연결 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.auditAutoAttachActive = false;
    const result = checkComplianceWiringHealth(ctx);
    expect(result.issues.some(i => i.includes("auto-attach"))).toBe(true);
  });

  it("RT18: snapshot auto-trigger 미설정 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.complianceSnapshotIntervalMin = 0;
    const result = checkComplianceWiringHealth(ctx);
    expect(result.issues.some(i => i.includes("auto-trigger"))).toBe(true);
  });

  it("RT19: 1개만 구성 시 critical", () => {
    const ctx = makeUnhealthyContext();
    ctx.decisionLogStoreExists = true;
    const result = checkComplianceWiringHealth(ctx);
    expect(result.severity).toBe("critical");
  });
});

// ══════════════════════════════════════════════════════
// RS-5: Pilot Execution Readiness
// ══════════════════════════════════════════════════════

describe("RS-5: Pilot Execution Readiness", () => {
  it("RT20: 전량 구성 시 passed", () => {
    const result = checkPilotActivationSafety(makeHealthyContext());
    expect(result.signalId).toBe("RS-5");
    expect(result.passed).toBe(true);
  });

  it("RT21: role gating 미구성 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.pilotRoleGatingConfigured = false;
    const result = checkPilotActivationSafety(ctx);
    expect(result.issues.some(i => i.includes("role gating"))).toBe(true);
  });

  it("RT22: confirmation dialog 미강제 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.pilotConfirmationDialogEnforced = false;
    const result = checkPilotActivationSafety(ctx);
    expect(result.issues.some(i => i.includes("confirmation"))).toBe(true);
  });

  it("RT23: rollback trigger 불완전 시 issue", () => {
    const ctx = makeHealthyContext();
    ctx.rollbackTriggersComplete = false;
    const result = checkPilotActivationSafety(ctx);
    expect(result.issues.some(i => i.includes("rollback"))).toBe(true);
  });

  it("RT24: 1개만 구성 시 critical", () => {
    const result = checkPilotActivationSafety(makeUnhealthyContext());
    expect(result.severity).toBe("critical");
  });
});

// ══════════════════════════════════════════════════════
// Integration: Report + Adapter + Surface
// ══════════════════════════════════════════════════════

describe("Integration: Report + Adapter + Surface", () => {
  it("RT25: healthy context → overallHealthy true", () => {
    const report = buildAppRuntimeSignalReport(makeHealthyContext());
    expect(report.signals).toHaveLength(5);
    expect(report.overallHealthy).toBe(true);
    expect(report.criticalIssues).toHaveLength(0);
    expect(report.overallScore).toBeGreaterThanOrEqual(80);
  });

  it("RT26: unhealthy context → overallHealthy false + critical issues", () => {
    const report = buildAppRuntimeSignalReport(makeUnhealthyContext());
    expect(report.overallHealthy).toBe(false);
    expect(report.criticalIssues.length).toBeGreaterThan(0);
  });

  it("RT27: adapter로 ReleaseReadinessContext 생성 가능", () => {
    const ctx = buildReleaseReadinessContextFromApp(makeHealthyContext());
    expect(ctx.implementedEngines).toHaveLength(8);
    expect(ctx.hardeningPipelineExists).toBe(true);
    const result = evaluateReleaseReadiness(ctx);
    expect(result.verdict).toBeDefined();
  });

  it("RT28: adapter로 RuntimeSignalProvider 생성 후 checkRuntimeSignalHealth 호환", () => {
    const provider = createAppRuntimeSignalProvider(makeHealthyContext());
    const health = checkRuntimeSignalHealth(provider);
    expect(health).toHaveLength(5);
    expect(health.every(h => h.healthy)).toBe(true);
  });

  it("RT29: surface에 runtimeSignals 포함 (연결 시)", () => {
    const ctx = buildReleaseReadinessContextFromApp(makeHealthyContext());
    const result = evaluateReleaseReadiness(ctx);
    const provider = createAppRuntimeSignalProvider(makeHealthyContext());
    const signals = checkRuntimeSignalHealth(provider);
    const surface = buildReleaseReadinessSurface(result, signals);
    expect(surface.rail.runtimeSignals).not.toBeNull();
    expect(surface.rail.runtimeSignals).toHaveLength(5);
  });

  it("RT30: surface에 runtimeSignals null (미연결 시)", () => {
    const ctx = buildReleaseReadinessContextFromApp(makeHealthyContext());
    const result = evaluateReleaseReadiness(ctx);
    const surface = buildReleaseReadinessSurface(result);
    expect(surface.rail.runtimeSignals).toBeNull();
  });
});

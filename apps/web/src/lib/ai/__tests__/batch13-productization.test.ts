// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Batch 13 — Final Productization Cleanup Pack Tests
 *
 * B13-1 ~ B13-22: 22 scenarios
 *
 * Part A: Visibility gating
 * Part B: Runtime signal provider
 * Part C: Pilot activation surface/workbench contract
 */
import { describe, it, expect } from "vitest";
import {
  getVisibleStages,
  getStageLabel,
  CHAIN_STAGE_GRAMMAR,
  type StageGrammar,
} from "../governance-grammar-registry";
import {
  evaluateReleaseReadiness,
  buildRuntimeReadinessContext,
  checkRuntimeSignalHealth,
  type RuntimeSignalProvider,
  type ReleaseReadinessContext,
} from "../release-readiness-engine";
import {
  createPilotPlan,
  checkChecklistItem,
  uncheckChecklistItem,
  activatePilot,
  completePilot,
  rollbackPilot,
  cancelPilot,
  buildPilotActivationSurface,
} from "../pilot-activation-engine";

// ── Helpers ──

function makeFullContext(): ReleaseReadinessContext {
  return {
    implementedEngines: ["quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"],
    enginesConsumingGrammar: ["quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"],
    surfacesConsumingGrammar: ["a", "b", "c", "d", "e", "f", "g", "h"],
    totalSurfaces: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    testFiles: ["t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    eventBusWiredDomains: ["dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_execution", "stock_release"],
    invalidationRuleCount: 15,
    hardeningPipelineExists: true,
    architectureDocExists: true,
    grammarDocExists: true,
  };
}

function makeFullReadinessResult() {
  return evaluateReleaseReadiness(makeFullContext());
}

function makeRuntimeProvider(overrides: Partial<RuntimeSignalProvider> = {}): RuntimeSignalProvider {
  return {
    scanImplementedEngines: () => ["quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"],
    scanEngineGrammarConsumption: () => ["quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"],
    scanSurfaceGrammarConsumption: () => ({ consuming: ["a", "b", "c", "d", "e", "f", "g", "h"], total: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] }),
    scanTestFiles: () => ["t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    scanEventBusWiring: () => ({ wiredDomains: ["dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_execution", "stock_release"], invalidationRuleCount: 15 }),
    checkHardeningPipeline: () => true,
    checkDocs: () => ({ architecture: true, grammar: true }),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Part A: Visibility Gating
// ══════════════════════════════════════════════════════

describe("Part A: Visibility Gating", () => {
  it("B13-1: 모든 stage에 visibility 필드 존재", () => {
    for (const stage of CHAIN_STAGE_GRAMMAR) {
      expect(stage.visibility).toBeDefined();
      expect(["ga", "pilot", "hidden"]).toContain(stage.visibility);
    }
  });

  it("B13-2: getVisibleStages('ga')는 ga stage만 반환", () => {
    const gaStages = getVisibleStages("ga");
    expect(gaStages.length).toBeGreaterThan(0);
    for (const s of gaStages) {
      expect(s.visibility).toBe("ga");
    }
  });

  it("B13-3: getVisibleStages('pilot')는 ga + pilot stage 반환, hidden 제외", () => {
    const pilotStages = getVisibleStages("pilot");
    for (const s of pilotStages) {
      expect(s.visibility).not.toBe("hidden");
    }
    const gaStages = getVisibleStages("ga");
    expect(pilotStages.length).toBeGreaterThanOrEqual(gaStages.length);
  });

  it("B13-4: getStageLabel은 visibility와 무관하게 모든 stage label 반환", () => {
    for (const stage of CHAIN_STAGE_GRAMMAR) {
      const label = getStageLabel(stage.stage);
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("B13-5: visibility 값 분포 — ga가 다수, hidden이 없거나 소수", () => {
    const gaCount = CHAIN_STAGE_GRAMMAR.filter(s => s.visibility === "ga").length;
    const hiddenCount = CHAIN_STAGE_GRAMMAR.filter(s => s.visibility === "hidden").length;
    expect(gaCount).toBeGreaterThan(hiddenCount);
  });
});

// ══════════════════════════════════════════════════════
// Part B: Runtime Signal Provider
// ══════════════════════════════════════════════════════

describe("Part B: Runtime Signal Provider", () => {
  it("B13-6: buildRuntimeReadinessContext가 유효한 context 구성", () => {
    const ctx = buildRuntimeReadinessContext(makeRuntimeProvider());
    expect(ctx.implementedEngines.length).toBe(8);
    expect(ctx.enginesConsumingGrammar.length).toBe(8);
    expect(ctx.surfacesConsumingGrammar.length).toBe(8);
    expect(ctx.totalSurfaces.length).toBe(10);
    expect(ctx.testFiles.length).toBe(7);
    expect(ctx.hardeningPipelineExists).toBe(true);
  });

  it("B13-7: runtime context로 evaluateReleaseReadiness 실행 가능", () => {
    const ctx = buildRuntimeReadinessContext(makeRuntimeProvider());
    const result = evaluateReleaseReadiness(ctx);
    expect(result.verdict).toBeDefined();
    expect(result.totalChecks).toBe(14);
  });

  it("B13-8: 불완전한 provider로 blocked verdict", () => {
    const ctx = buildRuntimeReadinessContext(makeRuntimeProvider({
      scanImplementedEngines: () => ["quote_chain"],
      checkHardeningPipeline: () => false,
    }));
    const result = evaluateReleaseReadiness(ctx);
    expect(result.verdict).toBe("blocked");
    expect(result.failed).toBeGreaterThan(0);
  });

  it("B13-9: checkRuntimeSignalHealth 5개 signal 반환", () => {
    const health = checkRuntimeSignalHealth(makeRuntimeProvider());
    expect(health.length).toBe(5);
    expect(health.every(h => h.signalId.startsWith("RS-"))).toBe(true);
  });

  it("B13-10: 완전한 provider면 모든 signal healthy", () => {
    const health = checkRuntimeSignalHealth(makeRuntimeProvider());
    expect(health.every(h => h.healthy)).toBe(true);
  });

  it("B13-11: engine 부족 시 RS-1 unhealthy", () => {
    const health = checkRuntimeSignalHealth(makeRuntimeProvider({
      scanImplementedEngines: () => ["quote_chain"],
    }));
    const rs1 = health.find(h => h.signalId === "RS-1");
    expect(rs1?.healthy).toBe(false);
  });

  it("B13-12: grammar 소비 부족 시 RS-2 unhealthy", () => {
    const health = checkRuntimeSignalHealth(makeRuntimeProvider({
      scanEngineGrammarConsumption: () => [],
    }));
    const rs2 = health.find(h => h.signalId === "RS-2");
    expect(rs2?.healthy).toBe(false);
  });

  it("B13-13: hardening 미구현 시 RS-5 unhealthy", () => {
    const health = checkRuntimeSignalHealth(makeRuntimeProvider({
      checkHardeningPipeline: () => false,
    }));
    const rs5 = health.find(h => h.signalId === "RS-5");
    expect(rs5?.healthy).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// Part C: Pilot Activation Surface/Workbench Contract
// ══════════════════════════════════════════════════════

describe("Part C: Pilot Activation Workbench Contract", () => {
  it("B13-14: surface center에 category breakdown 포함", () => {
    const result = makeFullReadinessResult();
    const plan = createPilotPlan({ readinessResult: result });
    const surface = buildPilotActivationSurface(plan);
    expect(surface.center.categoryBreakdown.length).toBe(4);
    const categories = surface.center.categoryBreakdown.map(c => c.category);
    expect(categories).toContain("기술 검증");
    expect(categories).toContain("운영 준비");
  });

  it("B13-15: draft 상태에서 check/uncheck enabled, activate disabled", () => {
    const result = makeFullReadinessResult();
    const plan = createPilotPlan({ readinessResult: result });
    const surface = buildPilotActivationSurface(plan);
    const checkAction = surface.dock.actions.find(a => a.actionKey === "check_item");
    const activateAction = surface.dock.actions.find(a => a.actionKey === "activate_pilot");
    expect(checkAction?.enabled).toBe(true);
    expect(activateAction?.enabled).toBe(false);
  });

  it("B13-16: 모든 필수 항목 체크 시 ready_to_activate로 전환", () => {
    const result = makeFullReadinessResult();
    let plan = createPilotPlan({ readinessResult: result });
    const requiredItems = plan.checklist.filter(i => i.required);
    for (const item of requiredItems) {
      plan = checkChecklistItem(plan, item.itemId, "operator");
    }
    expect(plan.status).toBe("ready_to_activate");
  });

  it("B13-17: ready_to_activate에서 activate_pilot enabled", () => {
    const result = makeFullReadinessResult();
    let plan = createPilotPlan({ readinessResult: result });
    for (const item of plan.checklist.filter(i => i.required)) {
      plan = checkChecklistItem(plan, item.itemId, "operator");
    }
    const surface = buildPilotActivationSurface(plan);
    const activateAction = surface.dock.actions.find(a => a.actionKey === "activate_pilot");
    expect(activateAction?.enabled).toBe(true);
  });

  it("B13-18: active 상태에서 complete/rollback enabled, activate disabled", () => {
    const result = makeFullReadinessResult();
    let plan = createPilotPlan({ readinessResult: result });
    for (const item of plan.checklist.filter(i => i.required)) {
      plan = checkChecklistItem(plan, item.itemId, "operator");
    }
    plan = activatePilot(plan);
    const surface = buildPilotActivationSurface(plan);
    expect(surface.dock.actions.find(a => a.actionKey === "complete_pilot")?.enabled).toBe(true);
    expect(surface.dock.actions.find(a => a.actionKey === "rollback_pilot")?.enabled).toBe(true);
    expect(surface.dock.actions.find(a => a.actionKey === "activate_pilot")?.enabled).toBe(false);
  });

  it("B13-19: completed 상태에서 cancel 불가", () => {
    const result = makeFullReadinessResult();
    let plan = createPilotPlan({ readinessResult: result });
    for (const item of plan.checklist.filter(i => i.required)) {
      plan = checkChecklistItem(plan, item.itemId, "operator");
    }
    plan = activatePilot(plan);
    plan = completePilot(plan);
    const surface = buildPilotActivationSurface(plan);
    expect(surface.dock.actions.find(a => a.actionKey === "cancel_pilot")?.enabled).toBe(false);
  });

  it("B13-20: rail에 rollback trigger summary 포함", () => {
    const result = makeFullReadinessResult();
    const plan = createPilotPlan({ readinessResult: result });
    const surface = buildPilotActivationSurface(plan);
    expect(surface.rail.rollbackTriggerSummary.length).toBe(3);
  });

  it("B13-21: rail monitoring config에 올바른 기본값", () => {
    const result = makeFullReadinessResult();
    const plan = createPilotPlan({ readinessResult: result });
    const surface = buildPilotActivationSurface(plan);
    expect(surface.rail.monitoringConfig.complianceSnapshotIntervalMin).toBe(30);
    expect(surface.rail.monitoringConfig.alertThresholds.blockerCountMax).toBe(5);
  });

  it("B13-22: checklist progress 계산 정확", () => {
    const result = makeFullReadinessResult();
    let plan = createPilotPlan({ readinessResult: result });
    const surface0 = buildPilotActivationSurface(plan);
    expect(surface0.center.checklistProgress.progressPercent).toBe(0);

    // Check half the required items
    const required = plan.checklist.filter(i => i.required);
    const half = Math.floor(required.length / 2);
    for (let i = 0; i < half; i++) {
      plan = checkChecklistItem(plan, required[i].itemId, "op");
    }
    const surfaceHalf = buildPilotActivationSurface(plan);
    expect(surfaceHalf.center.checklistProgress.requiredChecked).toBe(half);
    expect(surfaceHalf.center.checklistProgress.progressPercent).toBeGreaterThan(0);
    expect(surfaceHalf.center.checklistProgress.progressPercent).toBeLessThan(100);
  });
});

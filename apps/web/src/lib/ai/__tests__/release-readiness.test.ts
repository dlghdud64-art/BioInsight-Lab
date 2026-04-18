// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Release Readiness + Pilot Activation Tests
 *
 * RR1-RR30: 30 scenarios
 */
import { describe, it, expect } from "vitest";
import {
  evaluateReleaseReadiness,
  buildReleaseReadinessSurface,
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
    surfacesConsumingGrammar: ["dispatch-prep-workbench", "receiving-governance-workbench", "stock-release-governance-workbench", "reorder-decision-governance-workbench", "supplier-confirmation-workbench", "procurement-dashboard-workbench", "audit-review-workbench", "quote-chain-workbenches"],
    totalSurfaces: ["dispatch-prep-workbench", "receiving-governance-workbench", "stock-release-governance-workbench", "reorder-decision-governance-workbench", "supplier-confirmation-workbench", "procurement-dashboard-workbench", "audit-review-workbench", "quote-chain-workbenches", "variance-disposition-workbench", "dispatch-execution-workbench"],
    testFiles: ["governance-event-bus.test.ts", "procurement-dashboard.test.ts", "governance-hardening.test.ts", "governance-grammar.test.ts", "governance-audit.test.ts", "governance-reporting.test.ts", "release-readiness.test.ts"],
    eventBusWiredDomains: ["dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_execution", "stock_release"],
    invalidationRuleCount: 15,
    hardeningPipelineExists: true,
    architectureDocExists: true,
    grammarDocExists: true,
  };
}

function makeMinimalContext(): ReleaseReadinessContext {
  return {
    implementedEngines: ["quote_chain"],
    enginesConsumingGrammar: [],
    surfacesConsumingGrammar: [],
    totalSurfaces: ["workbench-a"],
    testFiles: [],
    eventBusWiredDomains: [],
    invalidationRuleCount: 2,
    hardeningPipelineExists: false,
    architectureDocExists: false,
    grammarDocExists: false,
  };
}

// ══════════════════════════════════════════════════════
// Section 1: Release Readiness Gate
// ══════════════════════════════════════════════════════

describe("Release Readiness Gate", () => {
  it("RR1: full context passes all checks → ready", () => {
    const result = evaluateReleaseReadiness(makeFullContext());
    expect(result.verdict).toBe("ready");
    expect(result.failed).toBe(0);
    expect(result.readinessScore).toBe(100);
  });

  it("RR2: minimal context fails → blocked", () => {
    const result = evaluateReleaseReadiness(makeMinimalContext());
    expect(result.verdict).toBe("blocked");
    expect(result.failed).toBeGreaterThan(0);
    expect(result.readinessScore).toBeLessThan(50);
  });

  it("RR3: grammar registry integrity always passes (it's validated live)", () => {
    const result = evaluateReleaseReadiness(makeFullContext());
    const grammarCheck = result.checks.find(c => c.checkId === "GI-1");
    expect(grammarCheck).toBeDefined();
    expect(grammarCheck!.status).toBe("pass");
  });

  it("RR4: 13 stage check passes", () => {
    const result = evaluateReleaseReadiness(makeFullContext());
    const stageCheck = result.checks.find(c => c.checkId === "GI-2");
    expect(stageCheck!.status).toBe("pass");
  });

  it("RR5: irreversible action protection passes", () => {
    const result = evaluateReleaseReadiness(makeFullContext());
    const protectionCheck = result.checks.find(c => c.checkId === "GI-5");
    expect(protectionCheck!.status).toBe("pass");
  });

  it("RR6: missing engines → fail", () => {
    const ctx = makeFullContext();
    ctx.implementedEngines = ["quote_chain", "dispatch_prep"];
    const result = evaluateReleaseReadiness(ctx);
    const engineCheck = result.checks.find(c => c.checkId === "EC-1");
    expect(engineCheck!.status).toBe("fail");
  });

  it("RR7: engines not consuming grammar → warning", () => {
    const ctx = makeFullContext();
    ctx.enginesConsumingGrammar = ["quote_chain"];
    const result = evaluateReleaseReadiness(ctx);
    const grammarCheck = result.checks.find(c => c.checkId === "EC-2");
    expect(grammarCheck!.status).toBe("warning");
  });

  it("RR8: low surface grammar consumption → fail", () => {
    const ctx = makeFullContext();
    ctx.surfacesConsumingGrammar = ["workbench-a"];
    const result = evaluateReleaseReadiness(ctx);
    const surfaceCheck = result.checks.find(c => c.checkId === "SC-1");
    expect(surfaceCheck!.status).toBe("fail");
  });

  it("RR9: no hardening pipeline → fail", () => {
    const ctx = makeFullContext();
    ctx.hardeningPipelineExists = false;
    const result = evaluateReleaseReadiness(ctx);
    const hardCheck = result.checks.find(c => c.checkId === "HP-1");
    expect(hardCheck!.status).toBe("fail");
  });

  it("RR10: missing docs → warning", () => {
    const ctx = makeFullContext();
    ctx.architectureDocExists = false;
    const result = evaluateReleaseReadiness(ctx);
    const docCheck = result.checks.find(c => c.checkId === "DC-1");
    expect(docCheck!.status).toBe("warning");
  });

  it("RR11: severity labels come from grammar", () => {
    const result = evaluateReleaseReadiness(makeMinimalContext());
    for (const check of result.checks) {
      expect(["정보", "주의", "심각"]).toContain(check.severityLabel);
    }
  });

  it("RR12: blockers array = failed checks", () => {
    const result = evaluateReleaseReadiness(makeMinimalContext());
    expect(result.blockers.length).toBe(result.failed);
    for (const b of result.blockers) {
      expect(b.status).toBe("fail");
    }
  });

  it("RR13: summary message reflects verdict", () => {
    const ready = evaluateReleaseReadiness(makeFullContext());
    expect(ready.summaryMessage).toContain("통과");

    const blocked = evaluateReleaseReadiness(makeMinimalContext());
    expect(blocked.summaryMessage).toContain("불가");
  });
});

// ══════════════════════════════════════════════════════
// Section 2: Release Readiness Surface
// ══════════════════════════════════════════════════════

describe("Release Readiness Surface", () => {
  it("RR14: builds center/rail/dock structure", () => {
    const result = evaluateReleaseReadiness(makeFullContext());
    const surface = buildReleaseReadinessSurface(result);

    expect(surface.center.result.verdict).toBe("ready");
    expect(surface.center.categoryBreakdown.length).toBeGreaterThan(0);
    expect(surface.rail.stageLabels.length).toBe(13);
    expect(surface.dock.actions.length).toBe(4);
  });

  it("RR15: proceed_to_pilot disabled when blocked", () => {
    const result = evaluateReleaseReadiness(makeMinimalContext());
    const surface = buildReleaseReadinessSurface(result);

    const pilotAction = surface.dock.actions.find(a => a.actionKey === "proceed_to_pilot");
    expect(pilotAction!.enabled).toBe(false);
  });

  it("RR16: proceed_to_pilot enabled when ready", () => {
    const result = evaluateReleaseReadiness(makeFullContext());
    const surface = buildReleaseReadinessSurface(result);

    const pilotAction = surface.dock.actions.find(a => a.actionKey === "proceed_to_pilot");
    expect(pilotAction!.enabled).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// Section 3: Pilot Plan
// ══════════════════════════════════════════════════════

describe("Pilot Plan", () => {
  it("RR17: createPilotPlan produces valid plan", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({ readinessResult: readiness });

    expect(plan.status).toBe("draft");
    expect(plan.planId).toMatch(/^pilot_/);
    expect(plan.includedStages.length).toBe(13);
    expect(plan.activeDomains.length).toBe(8);
    expect(plan.checklist.length).toBeGreaterThan(0);
    expect(plan.rollbackPlan.triggers.length).toBeGreaterThan(0);
    expect(plan.rollbackPlan.steps.length).toBeGreaterThan(0);
  });

  it("RR18: default checklist has all categories", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({ readinessResult: readiness });

    const categories = new Set(plan.checklist.map(i => i.category));
    expect(categories).toContain("technical");
    expect(categories).toContain("operational");
    expect(categories).toContain("compliance");
    expect(categories).toContain("communication");
  });

  it("RR19: custom scope limits stages and domains", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({
      readinessResult: readiness,
      includedStages: ["dispatch_prep", "sent"],
      activeDomains: ["dispatch_prep", "dispatch_execution"],
      poCountLimit: 5,
    });

    expect(plan.includedStages.length).toBe(2);
    expect(plan.activeDomains.length).toBe(2);
    expect(plan.poCountLimit).toBe(5);
  });

  it("RR20: stage labels from grammar in pilot plan", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({ readinessResult: readiness });

    const dispatchStage = plan.includedStages.find(s => s.stage === "dispatch_prep");
    expect(dispatchStage!.stageLabel).toBe("발송 전 최종 검증");
  });
});

// ══════════════════════════════════════════════════════
// Section 4: Checklist Management
// ══════════════════════════════════════════════════════

describe("Pilot Checklist", () => {
  it("RR21: checking item updates status", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    let plan = createPilotPlan({ readinessResult: readiness });

    plan = checkChecklistItem(plan, "CK-T1", "admin");
    const item = plan.checklist.find(i => i.itemId === "CK-T1");
    expect(item!.checked).toBe(true);
    expect(item!.checkedBy).toBe("admin");
    expect(plan.status).toBe("checklist_in_progress");
  });

  it("RR22: unchecking item resets to checklist_in_progress", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    let plan = createPilotPlan({ readinessResult: readiness });

    plan = checkChecklistItem(plan, "CK-T1", "admin");
    plan = uncheckChecklistItem(plan, "CK-T1");
    const item = plan.checklist.find(i => i.itemId === "CK-T1");
    expect(item!.checked).toBe(false);
    expect(plan.status).toBe("checklist_in_progress");
  });

  it("RR23: all required items checked → ready_to_activate", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    let plan = createPilotPlan({ readinessResult: readiness });

    const requiredItems = plan.checklist.filter(i => i.required);
    for (const item of requiredItems) {
      plan = checkChecklistItem(plan, item.itemId, "admin");
    }
    expect(plan.status).toBe("ready_to_activate");
  });
});

// ══════════════════════════════════════════════════════
// Section 5: Pilot Lifecycle
// ══════════════════════════════════════════════════════

describe("Pilot Lifecycle", () => {
  function makeReadyPlan() {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    let plan = createPilotPlan({ readinessResult: readiness });
    const requiredItems = plan.checklist.filter(i => i.required);
    for (const item of requiredItems) {
      plan = checkChecklistItem(plan, item.itemId, "admin");
    }
    return plan;
  }

  it("RR24: activate from ready_to_activate", () => {
    const plan = makeReadyPlan();
    const activated = activatePilot(plan);
    expect(activated.status).toBe("active");
  });

  it("RR25: cannot activate from draft", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({ readinessResult: readiness });
    const result = activatePilot(plan);
    expect(result.status).toBe("draft"); // unchanged
  });

  it("RR26: complete from active", () => {
    const plan = makeReadyPlan();
    const active = activatePilot(plan);
    const completed = completePilot(active);
    expect(completed.status).toBe("completed");
  });

  it("RR27: rollback from active", () => {
    const plan = makeReadyPlan();
    const active = activatePilot(plan);
    const rolledBack = rollbackPilot(active);
    expect(rolledBack.status).toBe("rolled_back");
  });

  it("RR28: cancel from any non-terminal state", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({ readinessResult: readiness });
    const cancelled = cancelPilot(plan);
    expect(cancelled.status).toBe("cancelled");
  });

  it("RR29: cannot cancel completed plan", () => {
    const plan = makeReadyPlan();
    const active = activatePilot(plan);
    const completed = completePilot(active);
    const result = cancelPilot(completed);
    expect(result.status).toBe("completed"); // unchanged
  });
});

// ══════════════════════════════════════════════════════
// Section 6: Pilot Activation Surface
// ══════════════════════════════════════════════════════

describe("Pilot Activation Surface", () => {
  it("RR30: builds center/rail/dock", () => {
    const readiness = evaluateReleaseReadiness(makeFullContext());
    const plan = createPilotPlan({ readinessResult: readiness });
    const surface = buildPilotActivationSurface(plan);

    expect(surface.center.checklistProgress.total).toBeGreaterThan(0);
    expect(surface.center.categoryBreakdown.length).toBe(4);
    expect(surface.rail.readinessScore).toBe(100);
    expect(surface.rail.includedStageLabels.length).toBe(13);
    expect(surface.rail.rollbackTriggerSummary.length).toBeGreaterThan(0);
    expect(surface.dock.actions.length).toBe(7);

    // activate not enabled for draft
    const activateAction = surface.dock.actions.find(a => a.actionKey === "activate_pilot");
    expect(activateAction!.enabled).toBe(false);
  });
});

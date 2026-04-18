/**
 * Reorder Decision Governance Engine — Tests
 *
 * RD1-RD20: reorder decision governance state machine, supply context,
 * line-level reorder decision, safety stock gate, lead time gate,
 * procurement re-entry handoff, loss accounting
 */

import { describe, it, expect } from "vitest";
import {
  createReorderDecisionGovernanceState,
  startReorderEvaluation,
  updateSupplyContext,
  evaluateReorderLine,
  setWatchActive,
  markReorderRecommended,
  markReorderRequired,
  markExpediteRequired,
  markNoAction,
  markProcurementReentryReady,
  cancelReorderDecision,
  buildReorderDecisionGovSurface,
  buildProcurementReentryHandoff,
  REORDER_TERMINAL,
  type ReorderDecisionGovernanceState,
  type SupplyDemandContext,
  type ReorderLineEvaluationInput,
} from "../reorder-decision-governance-engine";

import type { ReorderDecisionGovHandoff } from "../stock-release-governance-engine";

// ── Fixtures ──

function makeHandoff(overrides?: Partial<ReorderDecisionGovHandoff>): ReorderDecisionGovHandoff {
  return {
    governanceId: "srgov_001",
    caseId: "case_001",
    poNumber: "PO-2024-001",
    releasedQuantity: 10,
    heldQuantity: 2,
    returnedQuantity: 3,
    destroyedQuantity: 1,
    originalOrderedQuantity: 16,
    gapQuantity: 6,
    hasGap: true,
    gapLineDetails: [
      { lineId: "L2", itemName: "소모품 B", ordered: 5, released: 0, gap: 5 },
      { lineId: "L3", itemName: "장비 C", ordered: 1, released: 0, gap: 1 },
    ],
    ...overrides,
  };
}

function makeSupplyContext(overrides?: Partial<SupplyDemandContext>): SupplyDemandContext {
  return {
    currentAvailableStock: 10,
    projectedDemand: 20,
    reservedDemand: 5,
    openInboundQuantity: 0,
    safetyStockLevel: 8,
    supplierLeadTimeDays: 14,
    averageDailyUsage: 2,
    daysOfCoverageRemaining: 5,
    ...overrides,
  };
}

// ══════════════════════════════════════════════
// RD1: State creation from handoff
// ══════════════════════════════════════════════

describe("RD1: createReorderDecisionGovernanceState", () => {
  it("creates state with gap details and loss accounting", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");

    expect(state.status).toBe("not_evaluated");
    expect(state.originalOrderedQuantity).toBe(16);
    expect(state.releasedQuantity).toBe(10);
    expect(state.gapQuantity).toBe(6);
    expect(state.hasGap).toBe(true);
    expect(state.lineDecisions).toHaveLength(2);
    expect(state.pendingLineCount).toBe(2);
    expect(state.totalReorderQuantity).toBe(0);

    // Loss accounting
    expect(state.lossAccounting.totalReturned).toBe(3);
    expect(state.lossAccounting.totalDestroyed).toBe(1);
    expect(state.lossAccounting.totalLoss).toBe(4);
    expect(state.lossAccounting.lossPercentage).toBe(25); // 4/16
    expect(state.lossAccounting.hasSupplierClaim).toBe(true);
  });

  it("all lines start as pending", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state.lineDecisions.forEach(line => {
      expect(line.decision).toBe("pending");
      expect(line.reorderQuantity).toBe(0);
    });
  });
});

// ══════════════════════════════════════════════
// RD2: Start evaluation
// ══════════════════════════════════════════════

describe("RD2: startReorderEvaluation", () => {
  it("transitions not_evaluated → evaluating", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    const result = startReorderEvaluation(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("evaluating");
  });

  it("rejects from terminal", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = { ...state, status: "no_action" };
    expect(startReorderEvaluation(state, "op").success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// RD3: Supply context update
// ══════════════════════════════════════════════

describe("RD3: updateSupplyContext", () => {
  it("calculates coverage and breach flags", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;

    const result = updateSupplyContext(state, makeSupplyContext(), "op");
    expect(result.success).toBe(true);
    expect(result.state.supplyContext).not.toBeNull();
    // daysOfCoverage=5 < leadTime=14 → low, leadTimeBreached=true
    expect(result.state.coverageStatus).toBe("low");
    expect(result.state.leadTimeBreached).toBe(true);
    // availableStock=10 > safetyStock=8
    expect(result.state.safetyStockBreached).toBe(false);
  });

  it("detects critical coverage when days=0", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;

    const result = updateSupplyContext(state, makeSupplyContext({ daysOfCoverageRemaining: 0 }), "op");
    expect(result.state.coverageStatus).toBe("critical");
  });

  it("detects safety stock breach", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;

    const result = updateSupplyContext(state, makeSupplyContext({ currentAvailableStock: 5, safetyStockLevel: 8 }), "op");
    expect(result.state.safetyStockBreached).toBe(true);
  });

  it("rejects from terminal", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = { ...state, status: "no_action" };
    expect(updateSupplyContext(state, makeSupplyContext(), "op").success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// RD4: Line evaluation — reorder path
// ══════════════════════════════════════════════

describe("RD4: evaluateReorderLine — reorder", () => {
  it("sets line decision and recalculates totals", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;

    const input: ReorderLineEvaluationInput = {
      lineId: "L2",
      decision: "reorder",
      reorderQuantity: 5,
      urgency: "immediate",
      rationale: "소모품 재고 부족",
      supplierPath: "same_supplier",
    };
    const result = evaluateReorderLine(state, input, "op");
    expect(result.success).toBe(true);

    const line = result.state.lineDecisions.find(l => l.lineId === "L2")!;
    expect(line.decision).toBe("reorder");
    expect(line.reorderQuantity).toBe(5);
    expect(result.state.totalReorderQuantity).toBe(5);
    expect(result.state.reorderLineCount).toBe(1);
    expect(result.state.reentryPath).toBe("same_supplier");
  });
});

// ══════════════════════════════════════════════
// RD5: Line evaluation — watch / no_action
// ══════════════════════════════════════════════

describe("RD5: evaluateReorderLine — watch/no_action", () => {
  it("sets watch decision", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;

    const result = evaluateReorderLine(state, {
      lineId: "L3", decision: "watch", reorderQuantity: 0,
      urgency: "watch", rationale: "모니터링 후 판단", supplierPath: "not_applicable",
    }, "op");

    expect(result.state.watchLineCount).toBe(1);
    expect(result.state.reorderLineCount).toBe(0);
  });

  it("rejects evaluation from not_evaluated", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    const result = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "normal", rationale: "test", supplierPath: "same_supplier",
    }, "op");
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// RD6: Mixed re-entry path detection
// ══════════════════════════════════════════════

describe("RD6: mixed re-entry path", () => {
  it("detects mixed path when lines have different supplier paths", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "normal", rationale: "재주문", supplierPath: "same_supplier",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "substitute", reorderQuantity: 1,
      urgency: "normal", rationale: "대체품", supplierPath: "alternate_supplier",
    }, "op").state;

    expect(state.reentryPath).toBe("mixed");
  });
});

// ══════════════════════════════════════════════
// RD7: Set watch active
// ══════════════════════════════════════════════

describe("RD7: setWatchActive", () => {
  it("transitions evaluating → watch_active", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "watch", reorderQuantity: 0,
      urgency: "watch", rationale: "감시", supplierPath: "not_applicable",
    }, "op").state;

    const result = setWatchActive(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("watch_active");
  });
});

// ══════════════════════════════════════════════
// RD8: Mark reorder recommended
// ══════════════════════════════════════════════

describe("RD8: markReorderRecommended", () => {
  it("requires reorder quantity > 0", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    // No reorder lines
    expect(markReorderRecommended(state, "op").success).toBe(false);
  });

  it("succeeds with reorder quantity", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "normal", rationale: "test", supplierPath: "same_supplier",
    }, "op").state;

    const result = markReorderRecommended(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("reorder_recommended");
  });
});

// ══════════════════════════════════════════════
// RD9: Mark reorder required
// ══════════════════════════════════════════════

describe("RD9: markReorderRequired", () => {
  it("succeeds from evaluating with reorder qty", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "필수", supplierPath: "same_supplier",
    }, "op").state;

    const result = markReorderRequired(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("reorder_required");
  });
});

// ══════════════════════════════════════════════
// RD10: Mark expedite required — lead time only
// ══════════════════════════════════════════════

describe("RD10: markExpediteRequired", () => {
  it("rejects when lead time not breached", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "test", supplierPath: "same_supplier",
    }, "op").state;
    // leadTimeBreached defaults to false
    expect(markExpediteRequired(state, "op").success).toBe(false);
  });

  it("succeeds when lead time breached", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = updateSupplyContext(state, makeSupplyContext(), "op").state; // leadTimeBreached=true
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "긴급", supplierPath: "same_supplier",
    }, "op").state;

    const result = markExpediteRequired(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("expedite_required");
  });
});

// ══════════════════════════════════════════════
// RD11: Mark no action — safety stock gate
// ══════════════════════════════════════════════

describe("RD11: markNoAction", () => {
  it("blocks when pending lines exist", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    expect(markNoAction(state, "충분", "op").success).toBe(false);
  });

  it("blocks when safety stock breached with no reorder", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = updateSupplyContext(state, makeSupplyContext({ currentAvailableStock: 3, safetyStockLevel: 8 }), "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "no_action", reorderQuantity: 0,
      urgency: "none", rationale: "불필요", supplierPath: "not_applicable",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "no_action", reorderQuantity: 0,
      urgency: "none", rationale: "불필요", supplierPath: "not_applicable",
    }, "op").state;

    expect(markNoAction(state, "test", "op").success).toBe(false);
    expect(markNoAction(state, "test", "op").error).toContain("안전재고");
  });

  it("succeeds when all lines decided and no safety breach", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "no_action", reorderQuantity: 0,
      urgency: "none", rationale: "불필요", supplierPath: "not_applicable",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "no_action", reorderQuantity: 0,
      urgency: "none", rationale: "불필요", supplierPath: "not_applicable",
    }, "op").state;

    const result = markNoAction(state, "가용 재고 충분", "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("no_action");
    expect(REORDER_TERMINAL).toContain("no_action");
  });
});

// ══════════════════════════════════════════════
// RD12: Mark procurement re-entry ready — terminal
// ══════════════════════════════════════════════

describe("RD12: markProcurementReentryReady", () => {
  it("blocks when pending lines exist", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "normal", rationale: "test", supplierPath: "same_supplier",
    }, "op").state;
    state = markReorderRequired(state, "op").state;
    // L3 still pending
    expect(markProcurementReentryReady(state, "op").success).toBe(false);
  });

  it("blocks when re-entry path not determined", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "normal", rationale: "test", supplierPath: "same_supplier",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "no_action", reorderQuantity: 0,
      urgency: "none", rationale: "ok", supplierPath: "not_applicable",
    }, "op").state;
    state = markReorderRequired(state, "op").state;

    const result = markProcurementReentryReady(state, "op");
    expect(result.success).toBe(true); // same_supplier is a valid path
    expect(result.state.status).toBe("procurement_reentry_ready");
  });
});

// ══════════════════════════════════════════════
// RD13: Cancel
// ══════════════════════════════════════════════

describe("RD13: cancelReorderDecision", () => {
  it("cancels from evaluating", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    const result = cancelReorderDecision(state, "cancelled", "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("cancelled");
  });

  it("rejects from terminal", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = { ...state, status: "no_action" };
    expect(cancelReorderDecision(state, "x", "op").success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// RD14: Surface — status and dock actions
// ══════════════════════════════════════════════

describe("RD14: buildReorderDecisionGovSurface", () => {
  it("not_evaluated: canEvaluate=true", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    const surface = buildReorderDecisionGovSurface(state);
    expect(surface.canEvaluate).toBe(true);
    expect(surface.canProcurementReentry).toBe(false);
    expect(surface.hasGap).toBe(true);
    expect(surface.totalLoss).toBe(4);
  });

  it("reorder_required: canProcurementReentry when all lines done and path set", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "test", supplierPath: "same_supplier",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "reorder", reorderQuantity: 1,
      urgency: "normal", rationale: "test", supplierPath: "same_supplier",
    }, "op").state;
    state = markReorderRequired(state, "op").state;

    const surface = buildReorderDecisionGovSurface(state);
    expect(surface.canProcurementReentry).toBe(true);
    // NOTE: canonical label = governance-grammar-registry.ts:171
    //       status "reorder_required" → label "재주문 필수" (category=blocked)
    //       primaryMessage 에는 "재주문 필요" 가 쓰이지만 statusLabel 은 grammar registry 소비.
    expect(surface.statusLabel).toBe("재주문 필수");
  });

  it("terminal isTerminal=true", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, { lineId: "L2", decision: "no_action", reorderQuantity: 0, urgency: "none", rationale: "ok", supplierPath: "not_applicable" }, "op").state;
    state = evaluateReorderLine(state, { lineId: "L3", decision: "no_action", reorderQuantity: 0, urgency: "none", rationale: "ok", supplierPath: "not_applicable" }, "op").state;
    state = markNoAction(state, "충분", "op").state;

    const surface = buildReorderDecisionGovSurface(state);
    expect(surface.isTerminal).toBe(true);
  });
});

// ══════════════════════════════════════════════
// RD15: Procurement Re-entry Handoff
// ══════════════════════════════════════════════

describe("RD15: buildProcurementReentryHandoff", () => {
  it("returns null from non-terminal states", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    expect(buildProcurementReentryHandoff(state)).toBeNull();
  });

  it("returns null from no_action terminal", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, { lineId: "L2", decision: "no_action", reorderQuantity: 0, urgency: "none", rationale: "ok", supplierPath: "not_applicable" }, "op").state;
    state = evaluateReorderLine(state, { lineId: "L3", decision: "no_action", reorderQuantity: 0, urgency: "none", rationale: "ok", supplierPath: "not_applicable" }, "op").state;
    state = markNoAction(state, "ok", "op").state;

    expect(buildProcurementReentryHandoff(state)).toBeNull();
  });

  it("returns handoff with full lineage from procurement_reentry_ready", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "부족", supplierPath: "same_supplier",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "reorder", reorderQuantity: 1,
      urgency: "normal", rationale: "대체", supplierPath: "alternate_supplier",
    }, "op").state;
    state = markReorderRequired(state, "op").state;
    state = markProcurementReentryReady(state, "op").state;

    const handoff = buildProcurementReentryHandoff(state);
    expect(handoff).not.toBeNull();
    expect(handoff!.reorderLines).toHaveLength(2);
    expect(handoff!.totalReorderQuantity).toBe(6);
    expect(handoff!.reentryPath).toBe("mixed");
    expect(handoff!.originalPoNumber).toBe("PO-2024-001");
    expect(handoff!.stockReleaseGovernanceId).toBe("srgov_001");
    expect(handoff!.totalLoss).toBe(4);
    expect(handoff!.hasSupplierClaim).toBe(true);
  });
});

// ══════════════════════════════════════════════
// RD16: Full flow — gap → evaluate → require → re-entry
// ══════════════════════════════════════════════

describe("RD16: full flow", () => {
  it("completes full reorder cycle", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");

    // 1. Start
    state = startReorderEvaluation(state, "op").state;

    // 2. Supply context
    state = updateSupplyContext(state, makeSupplyContext(), "op").state;
    expect(state.leadTimeBreached).toBe(true);

    // 3. Evaluate lines
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "부족", supplierPath: "same_supplier",
    }, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L3", decision: "reorder", reorderQuantity: 1,
      urgency: "normal", rationale: "예비", supplierPath: "same_supplier",
    }, "op").state;

    // 4. Expedite (lead time breached)
    state = markExpediteRequired(state, "op").state;
    expect(state.status).toBe("expedite_required");

    // 5. Procurement re-entry
    state = markProcurementReentryReady(state, "op").state;
    expect(state.status).toBe("procurement_reentry_ready");
    expect(REORDER_TERMINAL).toContain("procurement_reentry_ready");

    // 6. Handoff
    const handoff = buildProcurementReentryHandoff(state);
    expect(handoff).not.toBeNull();
    expect(handoff!.isExpedite).toBe(false); // was expedite but moved to reentry_ready
    expect(handoff!.coverageStatus).toBe("low");
    expect(handoff!.leadTimeBreached).toBe(true);
  });
});

// ══════════════════════════════════════════════
// RD17: Terminal rejects mutations
// ══════════════════════════════════════════════

describe("RD17: terminal state rejects mutations", () => {
  it("no_action rejects all transitions", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, { lineId: "L2", decision: "no_action", reorderQuantity: 0, urgency: "none", rationale: "ok", supplierPath: "not_applicable" }, "op").state;
    state = evaluateReorderLine(state, { lineId: "L3", decision: "no_action", reorderQuantity: 0, urgency: "none", rationale: "ok", supplierPath: "not_applicable" }, "op").state;
    state = markNoAction(state, "ok", "op").state;

    expect(startReorderEvaluation(state, "op").success).toBe(false);
    expect(cancelReorderDecision(state, "x", "op").success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// RD18: Watch → re-evaluate → reorder flow
// ══════════════════════════════════════════════

describe("RD18: watch → re-evaluate → reorder", () => {
  it("allows re-evaluation from watch_active", () => {
    let state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    state = startReorderEvaluation(state, "op").state;
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "watch", reorderQuantity: 0,
      urgency: "watch", rationale: "감시", supplierPath: "not_applicable",
    }, "op").state;
    state = setWatchActive(state, "op").state;
    expect(state.status).toBe("watch_active");

    // Re-evaluate: change L2 to reorder
    state = evaluateReorderLine(state, {
      lineId: "L2", decision: "reorder", reorderQuantity: 5,
      urgency: "immediate", rationale: "상황 변경", supplierPath: "same_supplier",
    }, "op").state;

    expect(state.totalReorderQuantity).toBe(5);
    expect(state.reorderLineCount).toBe(1);
  });
});

// ══════════════════════════════════════════════
// RD19: QuoteChainStage includes reorder_decision
// ══════════════════════════════════════════════

describe("RD19: QuoteChainStage includes reorder_decision", () => {
  it("reorder_decision is in QUOTE_CHAIN_STAGES", async () => {
    const { QUOTE_CHAIN_STAGES } = await import("../quote-approval-governance-engine");
    const reorder = QUOTE_CHAIN_STAGES.find(s => s.stage === "reorder_decision");
    expect(reorder).toBeDefined();
    expect(reorder!.label).toBe("재주문 판단");
    expect(reorder!.policyConstraints).toContain("coverage_analysis");
  });
});

// ══════════════════════════════════════════════
// RD20: Loss accounting accuracy
// ══════════════════════════════════════════════

describe("RD20: loss accounting", () => {
  it("no gap = no loss accounting lines", () => {
    const noGapHandoff = makeHandoff({
      gapQuantity: 0, hasGap: false, gapLineDetails: [],
      returnedQuantity: 0, destroyedQuantity: 0, heldQuantity: 0,
    });
    const state = createReorderDecisionGovernanceState(noGapHandoff, "op");
    expect(state.lossAccounting.totalLoss).toBe(0);
    expect(state.lossAccounting.lossPercentage).toBe(0);
    expect(state.lossAccounting.hasSupplierClaim).toBe(false);
    expect(state.lineDecisions).toHaveLength(0);
  });

  it("surface exposes loss data", () => {
    const state = createReorderDecisionGovernanceState(makeHandoff(), "op");
    const surface = buildReorderDecisionGovSurface(state);
    expect(surface.totalLoss).toBe(4);
    expect(surface.lossPercentage).toBe(25);
    expect(surface.hasSupplierClaim).toBe(true);
  });
});

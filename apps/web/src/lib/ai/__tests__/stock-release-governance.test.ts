// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Stock Release Governance Engine — Tests
 *
 * SR1-SR20: stock release governance state machine, hold management,
 * line-level release, review gates, handoff gating, reorder gap detection
 */

import { describe, it, expect } from "vitest";
import {
  createStockReleaseGovernanceState,
  startEvaluation,
  evaluateReleaseLine,
  placeHold,
  resolveHold,
  completeReview,
  markPartiallyReleased,
  markReleased,
  cancelStockRelease,
  buildStockReleaseGovSurface,
  buildAvailableStockHandoff,
  buildReorderDecisionHandoff,
  RELEASE_TERMINAL,
  type StockReleaseGovernanceState,
  type StockReleaseGovStatus,
  type StockHold,
  type LineEvaluationInput,
} from "../stock-release-governance-engine";

import type { StockReleaseGateHandoff } from "../receiving-execution-governance-engine";

// ── Fixture ──

function makeHandoff(overrides?: Partial<StockReleaseGateHandoff>): StockReleaseGateHandoff {
  return {
    receivingExecutionId: "re_001",
    caseId: "case_001",
    poNumber: "PO-2024-001",
    receivingPrepStateId: "rps_001",
    confirmationGovernanceId: "cg_001",
    executionLinkageId: "el_001",
    poCreatedObjectId: "poc_001",
    receivingSite: "본사 연구동",
    storageLocation: "냉장실 B",
    acceptedLines: [
      { lineId: "L1", itemName: "시약 A", receivedQuantity: 10, lotNumber: "LOT-001", expiryDate: "2025-12-31" },
      { lineId: "L2", itemName: "소모품 B", receivedQuantity: 5, lotNumber: "LOT-002", expiryDate: "2026-06-30" },
      { lineId: "L3", itemName: "장비 C", receivedQuantity: 1, lotNumber: "", expiryDate: null },
    ],
    discrepancyCount: 0,
    quarantinedLineCount: 0,
    ...overrides,
  };
}

// ══════════════════════════════════════════════
// SR1: State creation from handoff
// ══════════════════════════════════════════════

describe("SR1: createStockReleaseGovernanceState", () => {
  it("creates state with all lines held and releasable=0", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "operator_1");

    expect(state.status).toBe("not_evaluated");
    expect(state.releaseLines).toHaveLength(3);
    expect(state.totalReceivedQuantity).toBe(16); // 10+5+1
    expect(state.totalReleasableQuantity).toBe(0);
    expect(state.totalHeldQuantity).toBe(16);
    expect(state.activeHolds).toHaveLength(0);
    expect(state.qualityReviewComplete).toBe(false);
    expect(state.safetyReviewComplete).toBe(false);
    expect(state.complianceReviewComplete).toBe(false);
    expect(state.releaseCompleteness).toBe(0);

    // All lines start held
    state.releaseLines.forEach(line => {
      expect(line.releasableQuantity).toBe(0);
      expect(line.heldQuantity).toBe(line.receivedQuantity);
      expect(line.releaseDecision).toBe("pending");
      expect(line.qualityStatus).toBe("pending");
    });
  });

  it("preserves chain linkage from handoff", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    expect(state.poNumber).toBe("PO-2024-001");
    expect(state.receivingExecutionId).toBe("re_001");
    expect(state.confirmationGovernanceId).toBe("cg_001");
    expect(state.poCreatedObjectId).toBe("poc_001");
  });

  it("lot without lotNumber starts with lotTraceValid=false for empty lot", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    const lineC = state.releaseLines.find(l => l.lineId === "L3")!;
    expect(lineC.lotTraceValid).toBe(false);

    const lineA = state.releaseLines.find(l => l.lineId === "L1")!;
    expect(lineA.lotTraceValid).toBe(true);
  });
});

// ══════════════════════════════════════════════
// SR2: Start evaluation
// ══════════════════════════════════════════════

describe("SR2: startEvaluation", () => {
  it("transitions not_evaluated → evaluating", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    const result = startEvaluation(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("evaluating");
  });

  it("rejects from terminal status", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = { ...state, status: "released" };
    const result = startEvaluation(state, "op");
    expect(result.success).toBe(false);
    expect(result.error).toContain("terminal");
  });
});

// ══════════════════════════════════════════════
// SR3: Line evaluation — release path
// ══════════════════════════════════════════════

describe("SR3: evaluateReleaseLine — release", () => {
  it("releases line when all gates pass", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const input: LineEvaluationInput = {
      lineId: "L1",
      expiryValid: true,
      lotTraceValid: true,
      qualityStatus: "passed",
      releaseDecision: "release",
    };
    const result = evaluateReleaseLine(state, input, "op");
    expect(result.success).toBe(true);

    const line = result.state.releaseLines.find(l => l.lineId === "L1")!;
    expect(line.releasableQuantity).toBe(10);
    expect(line.heldQuantity).toBe(0);
    expect(line.holdReasons).toHaveLength(0);
    expect(result.state.totalReleasableQuantity).toBe(10);
  });
});

// ══════════════════════════════════════════════
// SR4: Line evaluation — hold path
// ══════════════════════════════════════════════

describe("SR4: evaluateReleaseLine — hold", () => {
  it("holds line when expiry is invalid", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const input: LineEvaluationInput = {
      lineId: "L1",
      expiryValid: false,
      lotTraceValid: true,
      qualityStatus: "passed",
      releaseDecision: "pending",
    };
    const result = evaluateReleaseLine(state, input, "op");
    expect(result.success).toBe(true);

    const line = result.state.releaseLines.find(l => l.lineId === "L1")!;
    expect(line.releasableQuantity).toBe(0);
    expect(line.heldQuantity).toBe(10);
    expect(line.holdReasons).toContain("유효기한 검증 실패");
  });

  it("holds line when quality fails", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const result = evaluateReleaseLine(state, {
      lineId: "L2", expiryValid: true, lotTraceValid: true,
      qualityStatus: "failed", releaseDecision: "pending",
    }, "op");

    const line = result.state.releaseLines.find(l => l.lineId === "L2")!;
    expect(line.holdReasons).toContain("품질 검증 실패");
    expect(line.releasableQuantity).toBe(0);
  });

  it("rejects evaluation from not_evaluated status", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    const result = evaluateReleaseLine(state, {
      lineId: "L1", expiryValid: true, lotTraceValid: true,
      qualityStatus: "passed", releaseDecision: "release",
    }, "op");
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// SR5: Line evaluation — return/destroy
// ══════════════════════════════════════════════

describe("SR5: evaluateReleaseLine — return/destroy", () => {
  it("marks line as return with zero quantities", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const result = evaluateReleaseLine(state, {
      lineId: "L1", expiryValid: false, lotTraceValid: false,
      qualityStatus: "failed", releaseDecision: "return",
    }, "op");

    const line = result.state.releaseLines.find(l => l.lineId === "L1")!;
    expect(line.releasableQuantity).toBe(0);
    expect(line.heldQuantity).toBe(0); // neither releasable nor held — returned
    expect(line.holdReasons).toContain("공급사 반품");
  });

  it("marks line as destroy", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const result = evaluateReleaseLine(state, {
      lineId: "L3", expiryValid: false, lotTraceValid: false,
      qualityStatus: "failed", releaseDecision: "destroy",
    }, "op");

    const line = result.state.releaseLines.find(l => l.lineId === "L3")!;
    expect(line.holdReasons).toContain("폐기");
  });
});

// ══════════════════════════════════════════════
// SR6: Place hold
// ══════════════════════════════════════════════

describe("SR6: placeHold", () => {
  it("places hold and transitions to hold_active", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const result = placeHold(state, {
      type: "quality_review",
      severity: "hard",
      affectedLineIds: ["L1"],
      reason: "품질 검사 미완료",
      placedBy: "op",
    }, "op");

    expect(result.success).toBe(true);
    expect(result.state.status).toBe("hold_active");
    expect(result.state.activeHolds).toHaveLength(1);
    expect(result.state.hasUnresolvedHolds).toBe(true);
  });

  it("rejects hold on terminal state", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = { ...state, status: "released" };

    const result = placeHold(state, {
      type: "safety_review", severity: "hard",
      affectedLineIds: ["L1"], reason: "test", placedBy: "op",
    }, "op");

    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// SR7: Resolve hold
// ══════════════════════════════════════════════

describe("SR7: resolveHold", () => {
  it("resolves hold and moves to resolved list", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    const holdResult = placeHold(state, {
      type: "quality_review", severity: "hard",
      affectedLineIds: ["L1"], reason: "QC pending", placedBy: "op",
    }, "op");
    state = holdResult.state;
    const holdId = state.activeHolds[0].holdId;

    const result = resolveHold(state, holdId, "released", "QC 통과", "op");
    expect(result.success).toBe(true);
    expect(result.state.activeHolds).toHaveLength(0);
    expect(result.state.resolvedHolds).toHaveLength(1);
    expect(result.state.hasUnresolvedHolds).toBe(false);
  });

  it("rejects for unknown hold ID", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    const result = resolveHold(state, "unknown_id", "released", "test", "op");
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// SR8: Complete reviews
// ══════════════════════════════════════════════

describe("SR8: completeReview", () => {
  it("marks quality review complete", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    const result = completeReview(state, "quality", "op");
    expect(result.state.qualityReviewComplete).toBe(true);
    expect(result.state.safetyReviewComplete).toBe(false);
  });

  it("marks all three reviews independently", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = completeReview(state, "quality", "op").state;
    state = completeReview(state, "safety", "op").state;
    state = completeReview(state, "compliance", "op").state;
    expect(state.qualityReviewComplete).toBe(true);
    expect(state.safetyReviewComplete).toBe(true);
    expect(state.complianceReviewComplete).toBe(true);
  });
});

// ══════════════════════════════════════════════
// SR9: Mark partially released
// ══════════════════════════════════════════════

describe("SR9: markPartiallyReleased", () => {
  it("allows partial release when some lines are releasable", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, {
      lineId: "L1", expiryValid: true, lotTraceValid: true,
      qualityStatus: "passed", releaseDecision: "release",
    }, "op").state;

    const result = markPartiallyReleased(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("partially_released");
  });

  it("rejects partial release when totalReleasable is 0", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    const result = markPartiallyReleased(state, "op");
    expect(result.success).toBe(false);
    expect(result.error).toContain("수량 0");
  });
});

// ══════════════════════════════════════════════
// SR10: Mark released (full) — terminal
// ══════════════════════════════════════════════

describe("SR10: markReleased", () => {
  it("blocks release when unresolved holds exist", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    // Evaluate all lines as release
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    // Place a hold
    state = placeHold(state, { type: "safety_review", severity: "hard", affectedLineIds: ["L1"], reason: "safety check", placedBy: "op" }, "op").state;

    const result = markReleased(state, "op");
    expect(result.success).toBe(false);
    expect(result.error).toContain("미해결 hold");
  });

  it("blocks release when pending lines exist", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    // Only evaluate 2 of 3 lines
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;

    const result = markReleased(state, "op");
    expect(result.success).toBe(false);
    expect(result.error).toContain("미평가 라인");
  });

  it("allows full release when all lines decided and no holds", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;

    const result = markReleased(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("released");
    expect(RELEASE_TERMINAL).toContain("released");
  });
});

// ══════════════════════════════════════════════
// SR11: Cancel
// ══════════════════════════════════════════════

describe("SR11: cancelStockRelease", () => {
  it("cancels from evaluating", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    const result = cancelStockRelease(state, "no longer needed", "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("cancelled");
  });

  it("rejects cancel from terminal", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = { ...state, status: "released" };
    const result = cancelStockRelease(state, "try cancel", "op");
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// SR12: Surface — status labels and dock actions
// ══════════════════════════════════════════════

describe("SR12: buildStockReleaseGovSurface", () => {
  it("not_evaluated surface: canEvaluate=true, canFullRelease=false", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    const surface = buildStockReleaseGovSurface(state);

    expect(surface.status).toBe("not_evaluated");
    expect(surface.statusLabel).toBe("미평가");
    expect(surface.canEvaluate).toBe(true);
    expect(surface.canFullRelease).toBe(false);
    expect(surface.canPartialRelease).toBe(false);
    expect(surface.isTerminal).toBe(false);
    expect(surface.totalReceived).toBe(16);
    expect(surface.pendingCount).toBe(0); // all lines start pending but counted differently
  });

  it("evaluating surface with all lines released: canFullRelease=true", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;

    const surface = buildStockReleaseGovSurface(state);
    expect(surface.canFullRelease).toBe(true);
    expect(surface.completeness).toBe(100);
  });

  it("hold_active surface: hasUnresolvedHolds=true", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = placeHold(state, { type: "quality_review", severity: "hard", affectedLineIds: ["L1"], reason: "test", placedBy: "op" }, "op").state;

    const surface = buildStockReleaseGovSurface(state);
    expect(surface.hasUnresolvedHolds).toBe(true);
    expect(surface.activeHoldCount).toBe(1);
  });

  it("released surface: isTerminal=true", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = markReleased(state, "op").state;

    const surface = buildStockReleaseGovSurface(state);
    expect(surface.isTerminal).toBe(true);
    expect(surface.statusLabel).toBe("릴리즈 완료");
  });
});

// ══════════════════════════════════════════════
// SR13: Available Stock Handoff — only from released/partially_released
// ══════════════════════════════════════════════

describe("SR13: buildAvailableStockHandoff", () => {
  it("returns null from not_evaluated", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    expect(buildAvailableStockHandoff(state)).toBeNull();
  });

  it("returns null from evaluating", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    expect(buildAvailableStockHandoff(state)).toBeNull();
  });

  it("returns handoff from released state", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = markReleased(state, "op").state;

    const handoff = buildAvailableStockHandoff(state);
    expect(handoff).not.toBeNull();
    expect(handoff!.releasedLines).toHaveLength(3);
    expect(handoff!.totalReleasedQuantity).toBe(16);
    expect(handoff!.receivingSite).toBe("본사 연구동");
    expect(handoff!.poNumber).toBe("PO-2024-001");
  });

  it("returns handoff from partially_released with only released lines", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    // L2 and L3 remain pending
    state = markPartiallyReleased(state, "op").state;

    const handoff = buildAvailableStockHandoff(state);
    expect(handoff).not.toBeNull();
    expect(handoff!.releasedLines).toHaveLength(1);
    expect(handoff!.totalReleasedQuantity).toBe(10);
  });
});

// ══════════════════════════════════════════════
// SR14: Reorder Decision Handoff — gap detection
// ══════════════════════════════════════════════

describe("SR14: buildReorderDecisionHandoff", () => {
  it("returns null from non-released state", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    expect(buildReorderDecisionHandoff(state, 20)).toBeNull();
  });

  it("detects gap when released < ordered", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    // Release L1 (10), return L2 (5), destroy L3 (1)
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: false, lotTraceValid: true, qualityStatus: "failed", releaseDecision: "return" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: false, lotTraceValid: false, qualityStatus: "failed", releaseDecision: "destroy" }, "op").state;
    state = markReleased(state, "op").state;

    const handoff = buildReorderDecisionHandoff(state, 20);
    expect(handoff).not.toBeNull();
    expect(handoff!.hasGap).toBe(true);
    expect(handoff!.gapQuantity).toBe(10); // ordered 20, released 10
    expect(handoff!.releasedQuantity).toBe(10);
    expect(handoff!.returnedQuantity).toBe(5);
    expect(handoff!.destroyedQuantity).toBe(1);
    expect(handoff!.gapLineDetails.length).toBeGreaterThan(0);
  });

  it("no gap when released = ordered", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = markReleased(state, "op").state;

    const handoff = buildReorderDecisionHandoff(state, 16);
    expect(handoff!.hasGap).toBe(false);
    expect(handoff!.gapQuantity).toBe(0);
  });
});

// ══════════════════════════════════════════════
// SR15: Full flow — evaluate → hold → resolve → release
// ══════════════════════════════════════════════

describe("SR15: full flow — evaluate → hold → resolve → release", () => {
  it("completes full cycle", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");

    // 1. Start evaluation
    state = startEvaluation(state, "op").state;
    expect(state.status).toBe("evaluating");

    // 2. Evaluate lines — L1 passes, L2 fails quality
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "failed", releaseDecision: "hold", holdReasons: ["품질 불합격"] }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;

    // 3. Place quality hold on L2
    state = placeHold(state, { type: "quality_review", severity: "hard", affectedLineIds: ["L2"], reason: "QC failed", placedBy: "op" }, "op").state;
    expect(state.status).toBe("hold_active");

    // 4. Resolve hold — reclassify L2
    const holdId = state.activeHolds[0].holdId;
    state = resolveHold(state, holdId, "reclassified", "재검사 후 통과", "op").state;
    expect(state.hasUnresolvedHolds).toBe(false);

    // 5. Re-evaluate L2 as release
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;

    // 6. Complete reviews
    state = completeReview(state, "quality", "op").state;
    state = completeReview(state, "safety", "op").state;
    state = completeReview(state, "compliance", "op").state;

    // 7. Full release
    const releaseResult = markReleased(state, "op");
    expect(releaseResult.success).toBe(true);
    expect(releaseResult.state.status).toBe("released");
    expect(releaseResult.state.totalReleasableQuantity).toBe(16);

    // 8. Handoff valid
    const handoff = buildAvailableStockHandoff(releaseResult.state);
    expect(handoff).not.toBeNull();
    expect(handoff!.releasedLines).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════
// SR16: Terminal state rejects all mutations
// ══════════════════════════════════════════════

describe("SR16: terminal state rejects mutations", () => {
  it("released rejects start/cancel/hold", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = markReleased(state, "op").state;

    expect(startEvaluation(state, "op").success).toBe(false);
    expect(cancelStockRelease(state, "x", "op").success).toBe(false);
    expect(placeHold(state, { type: "quality_review", severity: "hard", affectedLineIds: ["L1"], reason: "x", placedBy: "op" }, "op").success).toBe(false);
  });
});

// ══════════════════════════════════════════════
// SR17: Partial release → continue evaluation → full release
// ══════════════════════════════════════════════

describe("SR17: partial → full release flow", () => {
  it("allows re-evaluation after partial release", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    // Release L1 only
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = markPartiallyReleased(state, "op").state;
    expect(state.status).toBe("partially_released");

    // Continue evaluating remaining lines
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L3", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;

    // Full release
    const result = markReleased(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("released");
  });
});

// ══════════════════════════════════════════════
// SR18: QuoteChainStage includes stock_release
// ══════════════════════════════════════════════

describe("SR18: QuoteChainStage includes stock_release", () => {
  it("stock_release is in QUOTE_CHAIN_STAGES", async () => {
    const { QUOTE_CHAIN_STAGES } = await import("../quote-approval-governance-engine");
    const stockRelease = QUOTE_CHAIN_STAGES.find(s => s.stage === "stock_release");
    expect(stockRelease).toBeDefined();
    expect(stockRelease!.label).toBe("재고 릴리즈");
    expect(stockRelease!.riskTier).toBe("tier2_org_impact");
    expect(stockRelease!.policyConstraints).toContain("quality_gate");
  });
});

// ══════════════════════════════════════════════
// SR19: received ≠ available — lines start held
// ══════════════════════════════════════════════

describe("SR19: received ≠ available contract", () => {
  it("all lines start with heldQuantity = receivedQuantity", () => {
    const state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state.releaseLines.forEach(line => {
      expect(line.releasableQuantity).toBe(0);
      expect(line.heldQuantity).toBe(line.receivedQuantity);
    });
    expect(state.totalReleasableQuantity).toBe(0);
    expect(state.totalHeldQuantity).toBe(state.totalReceivedQuantity);
  });

  it("release only moves quantity through evaluation gate", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;

    // Before evaluation: no releasable
    expect(state.totalReleasableQuantity).toBe(0);

    // After release evaluation
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    expect(state.totalReleasableQuantity).toBe(10);
    expect(state.totalHeldQuantity).toBe(6); // 5+1 remaining
  });
});

// ══════════════════════════════════════════════
// SR20: Surface line decisions reflect engine state
// ══════════════════════════════════════════════

describe("SR20: surface lineDecisions accuracy", () => {
  it("surface reflects mixed line decisions", () => {
    let state = createStockReleaseGovernanceState(makeHandoff(), "op");
    state = startEvaluation(state, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L1", expiryValid: true, lotTraceValid: true, qualityStatus: "passed", releaseDecision: "release" }, "op").state;
    state = evaluateReleaseLine(state, { lineId: "L2", expiryValid: false, lotTraceValid: true, qualityStatus: "hold", releaseDecision: "hold", holdReasons: ["유효기한 문제"] }, "op").state;

    const surface = buildStockReleaseGovSurface(state);
    const l1 = surface.lineDecisions.find(l => l.lineId === "L1")!;
    const l2 = surface.lineDecisions.find(l => l.lineId === "L2")!;
    const l3 = surface.lineDecisions.find(l => l.lineId === "L3")!;

    expect(l1.decision).toBe("release");
    expect(l1.releasable).toBe(10);
    expect(l2.decision).toBe("hold");
    expect(l2.holdReasons).toContain("유효기한 문제");
    expect(l3.decision).toBe("pending");
  });
});

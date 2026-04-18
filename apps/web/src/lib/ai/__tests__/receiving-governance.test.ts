import { describe, it, expect } from "vitest";
import {
  createReceivingPreparationState,
  evaluateReceivingPreparation,
  scheduleReceiving,
  cancelReceivingPreparation,
  buildReceivingPrepSurface,
  buildReceivingExecutionHandoff,
  type CreateReceivingPrepInput,
  type EvaluateReceivingPrepInput,
} from "../receiving-preparation-governance-engine";
import {
  createReceivingExecutionGovernanceState,
  startReceivingGov,
  recordLineReceiptGov,
  markPartiallyReceivedGov,
  markReceivedGov,
  markDiscrepancyGov,
  quarantineReceiptGov,
  resolveDiscrepancyGov,
  cancelReceivingExecutionGov,
  buildReceivingExecutionGovSurface,
  buildStockReleaseGateHandoff,
  RECEIVING_GOV_TERMINAL,
  type GovReceivedLine,
} from "../receiving-execution-governance-engine";
import { buildReceivingPrepGovernanceHandoff } from "../supplier-confirmation-governance-engine";
import { QUOTE_CHAIN_STAGES, type QuoteChainStage } from "../quote-approval-governance-engine";

// ── Helper: supplier confirmation handoff (confirmed) ──

function makeConfirmedHandoff() {
  return {
    governanceId: "scgov_test",
    caseId: "case_rcv_test",
    poNumber: "PO-RCV-001",
    executionId: "exec_test",
    payloadSnapshotId: "snap_test",
    poCreatedObjectId: "po_test",
    confirmedLineItems: [
      { lineId: "L1", itemName: "시약 A", originalQuantity: 10, confirmedQuantity: 10, originalUnitPrice: 50000, confirmedUnitPrice: 50000, acceptance: "accepted" as const, supplierNote: "" },
      { lineId: "L2", itemName: "시약 B", originalQuantity: 5, confirmedQuantity: 4, originalUnitPrice: 100000, confirmedUnitPrice: 100000, acceptance: "changed" as const, supplierNote: "1개 부족" },
    ],
    confirmedDeliveryDate: "2026-04-15",
    acceptedChanges: [],
    handoffReadiness: "ready" as const,
  };
}

function makeReceivingPrepInput(overrides?: Partial<CreateReceivingPrepInput>): CreateReceivingPrepInput {
  return {
    handoff: makeConfirmedHandoff(),
    receivingSite: "본사 실험동",
    storageLocation: "냉장고 A-3",
    requiresColdChain: false,
    requiresHazardHandling: false,
    handlingInstructions: "",
    shipmentReference: "SHIP-001",
    trackingNumber: "TRK-12345",
    carrier: "CJ대한통운",
    requiredDocuments: ["packing_list"],
    receivedDocuments: ["packing_list"],
    receivingWindowStart: null,
    receivingWindowEnd: null,
    actor: "operator_kim",
    ...overrides,
  };
}

function makeGoodLine(lineId: string, expected: number, received: number): GovReceivedLine {
  return {
    lineId, itemName: `품목 ${lineId}`, expectedQuantity: expected, receivedQuantity: received,
    lotNumber: `LOT-${lineId}`, expiryDate: "2027-01-01",
    quantityMatch: expected === received ? "exact" : received > expected ? "over" : received === 0 ? "zero" : "under",
    hasDamage: false, damageDescription: "",
    hasExpiryIssue: false, expiryIssueDetail: "",
    documentMismatch: false, documentMismatchDetail: "",
    lineResult: "accepted", inspectionNote: "",
  };
}

// ══════════════════════════════════════════════
// R1: Confirmed → Receiving Prep 생성
// ══════════════════════════════════════════════

describe("Receiving Preparation Governance", () => {
  it("R1: confirmed handoff → receiving prep state 생성", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput());
    expect(state).not.toBeNull();
    expect(state!.readiness).toBe("not_evaluated");
    expect(state!.expectedLines).toHaveLength(2);
    expect(state!.expectedDeliveryDate).toBe("2026-04-15");
    expect(state!.confirmationGovernanceId).toBe("scgov_test");
  });

  it("R1b: non-ready handoff → null 반환", () => {
    const input = makeReceivingPrepInput();
    input.handoff.handoffReadiness = "pending";
    const state = createReceivingPreparationState(input);
    expect(state).toBeNull();
  });

  // R2: Evaluate readiness — all good → ready_to_receive
  it("R2: 모든 조건 충족 → ready_to_receive", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    expect(evaluated.readiness).toBe("ready_to_receive");
    expect(evaluated.hardBlockers).toHaveLength(0);
    expect(evaluated.allConfirmed).toBe(true);
  });

  // R3: Missing shipment ref → blocked
  it("R3: shipment reference 미입력 → blocked", () => {
    const input = makeReceivingPrepInput({ shipmentReference: "" });
    const state = createReceivingPreparationState(input)!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    expect(evaluated.readiness).toBe("blocked");
    expect(evaluated.hardBlockers.some(b => b.type === "missing_shipment_reference")).toBe(true);
  });

  // R4: Missing packing doc → blocked
  it("R4: packing 서류 누락 → blocked", () => {
    const input = makeReceivingPrepInput({ receivedDocuments: [] });
    const state = createReceivingPreparationState(input)!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    expect(evaluated.readiness).toBe("blocked");
    expect(evaluated.hardBlockers.some(b => b.type === "missing_packing_document")).toBe(true);
  });

  // R5: Cold chain requirement → hard blocker
  it("R5: 콜드체인 요건 → hard blocker", () => {
    const input = makeReceivingPrepInput({ requiresColdChain: true });
    const state = createReceivingPreparationState(input)!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    expect(evaluated.hardBlockers.some(b => b.type === "cold_chain_requirement")).toBe(true);
  });

  // R6: Partial shipment → soft blocker (needs_review)
  it("R6: 부분 배송 → needs_review (soft blocker)", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: true,
      actor: "op",
    });
    expect(evaluated.readiness).toBe("needs_review");
    expect(evaluated.softBlockers.some(b => b.type === "partial_shipment_declared")).toBe(true);
  });

  // R7: Schedule receiving
  it("R7: ready → scheduled", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    const scheduled = scheduleReceiving(evaluated, "2026-04-15T09:00:00Z", "op");
    expect(scheduled).not.toBeNull();
    expect(scheduled!.readiness).toBe("scheduled");
    expect(scheduled!.scheduledReceiveDate).toBe("2026-04-15T09:00:00Z");
  });

  // R8: Surface projection
  it("R8: surface projection 정확성", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    const surface = buildReceivingPrepSurface(evaluated);
    expect(surface.statusBadge).toBe("allowed");
    expect(surface.statusColor).toBe("emerald");
    expect(surface.canStartReceiving).toBe(true);
    expect(surface.expectedLineCount).toBe(2);
    expect(surface.expectedTotalAmount).toBeGreaterThan(0);
  });

  // R9: Execution handoff — only from ready/scheduled
  it("R9: ready → execution handoff 생성", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    const handoff = buildReceivingExecutionHandoff(evaluated);
    expect(handoff).not.toBeNull();
    expect(handoff!.expectedLines).toHaveLength(2);
  });

  it("R9b: blocked → execution handoff null", () => {
    const input = makeReceivingPrepInput({ shipmentReference: "" });
    const state = createReceivingPreparationState(input)!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    const handoff = buildReceivingExecutionHandoff(evaluated);
    expect(handoff).toBeNull();
  });

  // R10: Cancel
  it("R10: cancel receiving preparation", () => {
    const state = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    const cancelled = cancelReceivingPreparation(evaluated, "op");
    expect(cancelled).not.toBeNull();
    expect(cancelled!.readiness).toBe("cancelled");
  });
});

// ══════════════════════════════════════════════
// Receiving Execution Governance
// ══════════════════════════════════════════════

describe("Receiving Execution Governance", () => {
  function makeExecutionHandoff() {
    const prepState = createReceivingPreparationState(makeReceivingPrepInput())!;
    const evaluated = evaluateReceivingPreparation({
      state: prepState,
      supplierConfirmationComplete: true,
      destinationSiteValid: true,
      storageCapacityAvailable: true,
      isPartialShipment: false,
      actor: "op",
    });
    return buildReceivingExecutionHandoff(evaluated)!;
  }

  // RE1: Create execution state
  it("RE1: handoff → execution state 생성", () => {
    const handoff = makeExecutionHandoff();
    const state = createReceivingExecutionGovernanceState(handoff, "op");
    expect(state.status).toBe("awaiting_receipt");
    expect(state.expectedLines).toHaveLength(2);
    expect(state.totalExpectedQuantity).toBeGreaterThan(0);
    expect(state.receivedLines).toHaveLength(0);
  });

  // RE2: Start receiving
  it("RE2: awaiting → receiving_in_progress", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const result = startReceivingGov(state, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("receiving_in_progress");
    expect(result.state.receiptStartedAt).not.toBeNull();
  });

  // RE3: Record line receipt
  it("RE3: line receipt → completeness 업데이트", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const line = makeGoodLine("L1", 10, 10);
    const result = recordLineReceiptGov(started, line, "op");
    expect(result.success).toBe(true);
    expect(result.state.receivedLines).toHaveLength(1);
    expect(result.state.receiptCompleteness).toBeGreaterThan(0);
  });

  // RE4: Quantity mismatch → auto discrepancy
  it("RE4: 수량 불일치 → 자동 discrepancy 생성", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const shortLine: GovReceivedLine = {
      ...makeGoodLine("L1", 10, 7),
      quantityMatch: "under",
    };
    const result = recordLineReceiptGov(started, shortLine, "op");
    expect(result.state.discrepancies.some(d => d.type === "quantity_mismatch")).toBe(true);
    expect(result.state.hasUnresolvedDiscrepancies).toBe(true);
  });

  // RE5: Damage → auto discrepancy
  it("RE5: 파손 → 자동 discrepancy 생성", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const damagedLine: GovReceivedLine = {
      ...makeGoodLine("L1", 10, 10),
      hasDamage: true,
      damageDescription: "외포장 파손",
    };
    const result = recordLineReceiptGov(started, damagedLine, "op");
    expect(result.state.discrepancies.some(d => d.type === "damaged_goods")).toBe(true);
  });

  // RE6: Unresolved discrepancies → received 차단
  it("RE6: 미해결 불일치 → received 전이 차단", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const shortLine: GovReceivedLine = { ...makeGoodLine("L1", 10, 7), quantityMatch: "under" };
    const withDisc = recordLineReceiptGov(started, shortLine, "op").state;
    const result = markReceivedGov(withDisc, "op");
    expect(result.success).toBe(false);
    expect(result.error).toContain("미해결 불일치");
  });

  // RE7: Resolve discrepancy → allow received
  it("RE7: 불일치 해결 후 → received 가능", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    // Record all lines with good match
    const l1 = recordLineReceiptGov(started, makeGoodLine("L1", 10, 10), "op").state;
    const l2 = recordLineReceiptGov(l1, makeGoodLine("L2", 4, 4), "op").state;
    const result = markReceivedGov(l2, "op");
    expect(result.success).toBe(true);
    expect(result.state.status).toBe("received");
    expect(result.state.receiptCompletedAt).not.toBeNull();
  });

  // RE8: Quarantine
  it("RE8: discrepancy → quarantine 가능", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const disc = markDiscrepancyGov(started, "op");
    expect(disc.success).toBe(true);
    const qResult = quarantineReceiptGov(disc.state, ["L1"], "유효기한 의심", "op");
    expect(qResult.success).toBe(true);
    expect(qResult.state.status).toBe("quarantined");
    expect(qResult.state.quarantinedLineIds).toContain("L1");
  });

  // RE9: Terminal states reject transitions
  it("RE9: terminal 상태 → 전이 거부", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const l1 = recordLineReceiptGov(started, makeGoodLine("L1", 10, 10), "op").state;
    const l2 = recordLineReceiptGov(l1, makeGoodLine("L2", 4, 4), "op").state;
    const received = markReceivedGov(l2, "op").state;

    expect(startReceivingGov(received, "op").success).toBe(false);
    expect(cancelReceivingExecutionGov(received, "test", "op").success).toBe(false);
  });

  // RE10: Stock release handoff — only from received
  it("RE10: received → stock release handoff 생성", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const l1 = recordLineReceiptGov(started, makeGoodLine("L1", 10, 10), "op").state;
    const l2 = recordLineReceiptGov(l1, makeGoodLine("L2", 4, 4), "op").state;
    const received = markReceivedGov(l2, "op").state;

    const handoff = buildStockReleaseGateHandoff(received);
    expect(handoff).not.toBeNull();
    expect(handoff!.acceptedLines).toHaveLength(2);
    expect(handoff!.totalAcceptedQuantity).toBe(14);
  });

  it("RE10b: non-received → stock release handoff null", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    expect(buildStockReleaseGateHandoff(state)).toBeNull();
  });

  // RE11: Surface projection
  it("RE11: surface projection 정확도", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const surface = buildReceivingExecutionGovSurface(state);
    expect(surface.statusLabel).toBe("입고 대기");
    expect(surface.statusColor).toBe("blue");
    expect(surface.canStartReceiving).toBe(true);
    expect(surface.canRecordLine).toBe(false);
    expect(surface.lineDelta).toHaveLength(2);
    expect(surface.lineDelta[0].match).toBe("pending");
  });

  // RE12: Partially received → continue → complete
  it("RE12: 부분 입고 → 계속 → 완료", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const l1 = recordLineReceiptGov(started, makeGoodLine("L1", 10, 10), "op").state;
    const partial = markPartiallyReceivedGov(l1, "op");
    expect(partial.success).toBe(true);
    expect(partial.state.status).toBe("partially_received");

    const resumed = startReceivingGov(partial.state, "op");
    expect(resumed.success).toBe(true);
    const l2 = recordLineReceiptGov(resumed.state, makeGoodLine("L2", 4, 4), "op").state;
    const complete = markReceivedGov(l2, "op");
    expect(complete.success).toBe(true);
    expect(complete.state.status).toBe("received");
  });

  // RE13: QuoteChainStage includes receiving_prep
  it("RE13: QuoteChainStage에 receiving_prep 포함", () => {
    const stages = QUOTE_CHAIN_STAGES.map(s => s.stage);
    expect(stages).toContain("receiving_prep");
    const config = QUOTE_CHAIN_STAGES.find(s => s.stage === "receiving_prep");
    expect(config).toBeDefined();
    expect(config!.label).toBe("입고 준비");
  });

  // RE14: Resolve discrepancy then mark received
  it("RE14: 불일치 해결 → received 전이", () => {
    const state = createReceivingExecutionGovernanceState(makeExecutionHandoff(), "op");
    const started = startReceivingGov(state, "op").state;
    const shortLine: GovReceivedLine = { ...makeGoodLine("L1", 10, 7), quantityMatch: "under" };
    const l1 = recordLineReceiptGov(started, shortLine, "op").state;
    const l2 = recordLineReceiptGov(l1, makeGoodLine("L2", 4, 4), "op").state;

    // Has unresolved → can't complete
    expect(l2.hasUnresolvedDiscrepancies).toBe(true);

    // Resolve discrepancy
    const disc = l2.discrepancies.find(d => d.type === "quantity_mismatch")!;
    const resolved = resolveDiscrepancyGov(l2, disc.discrepancyId, "accepted_as_is", "부분 수량 수락", "op").state;
    expect(resolved.hasUnresolvedDiscrepancies).toBe(false);

    // Now can complete
    const complete = markReceivedGov(resolved, "op");
    expect(complete.success).toBe(true);
  });
});

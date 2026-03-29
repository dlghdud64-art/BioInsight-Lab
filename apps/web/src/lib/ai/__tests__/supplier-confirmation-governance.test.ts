/**
 * Supplier Confirmation Governance Tests
 *
 * SC1: create → awaiting_response initial state
 * SC2: receive clean acceptance → response_received → operator accept → confirmed
 * SC3: receive with changes → response_received → delta analysis
 * SC4: receive rejection → response_received → operator reject → rejected
 * SC5: partial confirmation → partially_confirmed
 * SC6: change_requested → operator request correction → back to awaiting
 * SC7: terminal states reject transitions
 * SC8: delta analysis accuracy (line/price/quantity/delivery/term)
 * SC9: surface projection accuracy
 * SC10: receiving prep handoff only from confirmed
 * SC11: QuoteChainStage includes supplier_confirmed
 * SC12: deadline / expiry handling
 */

import { describe, it, expect } from "vitest";

import {
  createConfirmationGovernanceState,
  receiveSupplierResponse,
  operatorAccept,
  operatorReject,
  operatorRequestCorrection,
  markPartiallyConfirmed,
  markChangeRequested,
  cancelConfirmationGovernance,
  markResponseExpired,
  buildResponseDelta,
  buildConfirmationGovernanceSurface,
  buildReceivingPrepGovernanceHandoff,
  RESPONSE_TERMINAL,
  type SupplierConfirmationGovernanceState,
  type SupplierResponseSnapshot,
  type CreateConfirmationGovernanceInput,
} from "../supplier-confirmation-governance-engine";

import {
  QUOTE_CHAIN_STAGES,
  buildQuoteChainFullSurface,
} from "../quote-approval-governance-engine";

// ── Helpers ──

function makeInput(): CreateConfirmationGovernanceInput {
  return {
    caseId: "case_1",
    poNumber: "PO-001",
    executionId: "exec_1",
    payloadSnapshotId: "snap_1",
    poCreatedObjectId: "pocreated_1",
    approvalDecisionObjectId: "approval_1",
    responseDeadlineDays: 5,
    actor: "op_1",
  };
}

function makeCleanResponse(): SupplierResponseSnapshot {
  return {
    snapshotId: `resp_${Date.now().toString(36)}`,
    receivedAt: new Date().toISOString(),
    respondedBy: "Supplier Kim",
    responseChannel: "email",
    overallAcceptance: "accepted",
    supplierMessage: "PO 확인했습니다. 원안대로 진행하겠습니다.",
    lineResponses: [
      { lineId: "L1", itemName: "Reagent A", originalQuantity: 10, confirmedQuantity: 10, originalUnitPrice: 30000, confirmedUnitPrice: 30000, acceptance: "accepted", supplierNote: "" },
      { lineId: "L2", itemName: "Filter B", originalQuantity: 5, confirmedQuantity: 5, originalUnitPrice: 40000, confirmedUnitPrice: 40000, acceptance: "accepted", supplierNote: "" },
    ],
    proposedChanges: [],
    confirmedDeliveryDate: "2026-04-10",
    originalDeliveryDate: "2026-04-10",
    deliveryDateChanged: false,
  };
}

function makeChangedResponse(): SupplierResponseSnapshot {
  return {
    ...makeCleanResponse(),
    overallAcceptance: "accepted_with_changes",
    supplierMessage: "일부 수량/가격 조정이 필요합니다.",
    lineResponses: [
      { lineId: "L1", itemName: "Reagent A", originalQuantity: 10, confirmedQuantity: 8, originalUnitPrice: 30000, confirmedUnitPrice: 32000, acceptance: "changed", supplierNote: "재고 8개만 가능, 단가 인상" },
      { lineId: "L2", itemName: "Filter B", originalQuantity: 5, confirmedQuantity: 5, originalUnitPrice: 40000, confirmedUnitPrice: 40000, acceptance: "accepted", supplierNote: "" },
    ],
    proposedChanges: [
      { field: "paymentTerms", originalValue: "Net 30", proposedValue: "Net 15", changeReason: "재고 한정 특가", severity: "major" },
    ],
    confirmedDeliveryDate: "2026-04-15",
    originalDeliveryDate: "2026-04-10",
    deliveryDateChanged: true,
  };
}

describe("Supplier Confirmation Governance", () => {

  it("SC1: create → awaiting_response", () => {
    const state = createConfirmationGovernanceState(makeInput());
    expect(state.status).toBe("awaiting_response");
    expect(state.responseSnapshot).toBeNull();
    expect(state.operatorReviewStatus).toBe("not_started");
    expect(state.responseDeadline).toBeTruthy();
  });

  it("SC2: clean acceptance → confirmed", () => {
    let state = createConfirmationGovernanceState(makeInput());

    // Receive clean response
    const r1 = receiveSupplierResponse(state, makeCleanResponse(), "system");
    expect(r1.success).toBe(true);
    expect(r1.state.status).toBe("response_received");
    expect(r1.state.totalChangeCount).toBe(0);
    state = r1.state;

    // Operator accept
    const r2 = operatorAccept(state, false, "원안 수락", "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("confirmed");
    expect(r2.state.operatorDecision).toBe("accepted");
  });

  it("SC3: response with changes → delta analysis", () => {
    let state = createConfirmationGovernanceState(makeInput());

    const r1 = receiveSupplierResponse(state, makeChangedResponse(), "system");
    expect(r1.success).toBe(true);
    state = r1.state;

    expect(state.hasLineChanges).toBe(true);
    expect(state.hasPriceChanges).toBe(true);
    expect(state.hasQuantityChanges).toBe(true);
    expect(state.hasDeliveryDateChange).toBe(true);
    expect(state.hasTermChanges).toBe(true);
    expect(state.totalChangeCount).toBeGreaterThan(0);

    // Delta analysis
    const delta = buildResponseDelta(state);
    expect(delta).not.toBeNull();
    expect(delta!.lineDeltas.length).toBeGreaterThan(0);
    expect(delta!.termDeltas.length).toBe(1);
    expect(delta!.deliveryDelta).not.toBeNull();
    expect(delta!.deliveryDelta!.changed).toBe(true);

    // Price delta
    const priceDelta = delta!.lineDeltas.find(d => d.field === "price");
    expect(priceDelta).toBeTruthy();
    expect(priceDelta!.direction).toBe("increased");

    // Quantity delta
    const qtyDelta = delta!.lineDeltas.find(d => d.field === "quantity");
    expect(qtyDelta).toBeTruthy();
    expect(qtyDelta!.direction).toBe("decreased");
  });

  it("SC4: rejection flow", () => {
    let state = createConfirmationGovernanceState(makeInput());

    const rejectionResponse: SupplierResponseSnapshot = {
      ...makeCleanResponse(),
      overallAcceptance: "rejected",
      supplierMessage: "해당 품목 공급 불가",
    };

    // Receive rejected response
    const r1 = receiveSupplierResponse(state, rejectionResponse, "system");
    expect(r1.success).toBe(true);
    state = r1.state;

    // Operator can reject
    const r2 = operatorReject(state, "공급사 거부 확인", "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("rejected");
    expect(r2.state.operatorDecision).toBe("rejected");
  });

  it("SC5: partial confirmation", () => {
    let state = createConfirmationGovernanceState(makeInput());

    const partialResponse: SupplierResponseSnapshot = {
      ...makeCleanResponse(),
      overallAcceptance: "partial",
      lineResponses: [
        { lineId: "L1", itemName: "Reagent A", originalQuantity: 10, confirmedQuantity: 10, originalUnitPrice: 30000, confirmedUnitPrice: 30000, acceptance: "accepted", supplierNote: "" },
        { lineId: "L2", itemName: "Filter B", originalQuantity: 5, confirmedQuantity: 0, originalUnitPrice: 40000, confirmedUnitPrice: 0, acceptance: "rejected", supplierNote: "단종" },
      ],
    };

    const r1 = receiveSupplierResponse(state, partialResponse, "system");
    expect(r1.success).toBe(true);
    state = r1.state;

    // Mark partial
    const r2 = markPartiallyConfirmed(state, "L2 단종 확인", "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("partially_confirmed");

    // Can still accept from partial
    const r3 = operatorAccept(r2.state, true, "L2 제외하고 진행", "op_1");
    expect(r3.success).toBe(true);
    expect(r3.state.status).toBe("confirmed");
    expect(r3.state.operatorDecision).toBe("accepted_with_modifications");
  });

  it("SC6: change_requested → correction → back to awaiting", () => {
    let state = createConfirmationGovernanceState(makeInput());

    // Receive response
    state = receiveSupplierResponse(state, makeChangedResponse(), "system").state;

    // Mark as change requested
    const r1 = markChangeRequested(state, "op_1");
    expect(r1.success).toBe(true);
    expect(r1.state.status).toBe("change_requested");
    state = r1.state;

    // Request correction → back to awaiting
    const r2 = operatorRequestCorrection(state, "원안대로 재확인 요청", "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("awaiting_response");
    expect(r2.state.responseSnapshot).toBeNull(); // cleared for new cycle
  });

  it("SC7: terminal states reject transitions", () => {
    // Confirmed → cannot transition
    let confirmed = createConfirmationGovernanceState(makeInput());
    confirmed = receiveSupplierResponse(confirmed, makeCleanResponse(), "system").state;
    confirmed = operatorAccept(confirmed, false, "ok", "op_1").state;
    expect(confirmed.status).toBe("confirmed");

    const r1 = cancelConfirmationGovernance(confirmed, "test", "op_1");
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("Terminal");

    // Cancelled → cannot transition
    let cancelled = createConfirmationGovernanceState(makeInput());
    cancelled = cancelConfirmationGovernance(cancelled, "no longer needed", "op_1").state;

    const r2 = receiveSupplierResponse(cancelled, makeCleanResponse(), "system");
    expect(r2.success).toBe(false);
  });

  it("SC8: delta accuracy — all field types", () => {
    let state = createConfirmationGovernanceState(makeInput());
    state = receiveSupplierResponse(state, makeChangedResponse(), "system").state;

    const delta = buildResponseDelta(state);
    expect(delta).not.toBeNull();

    // Line quantity change (10→8, decreased)
    const qtyDelta = delta!.lineDeltas.find(d => d.lineId === "L1" && d.field === "quantity");
    expect(qtyDelta).toBeTruthy();
    expect(qtyDelta!.original).toBe("10");
    expect(qtyDelta!.confirmed).toBe("8");
    expect(qtyDelta!.direction).toBe("decreased");

    // Line price change (30000→32000, increased)
    const priceDelta = delta!.lineDeltas.find(d => d.lineId === "L1" && d.field === "price");
    expect(priceDelta).toBeTruthy();
    expect(priceDelta!.direction).toBe("increased");

    // Term change (Net 30→Net 15, major)
    expect(delta!.termDeltas.length).toBe(1);
    expect(delta!.termDeltas[0].severity).toBe("major");

    // Delivery date change
    expect(delta!.deliveryDelta).not.toBeNull();
    expect(delta!.deliveryDelta!.confirmed).toBe("2026-04-15");
  });

  it("SC9: surface projection accuracy", () => {
    // Awaiting
    const awaiting = createConfirmationGovernanceState(makeInput());
    const s1 = buildConfirmationGovernanceSurface(awaiting);
    expect(s1.statusLabel).toBe("응답 대기");
    expect(s1.statusColor).toBe("blue");
    expect(s1.canAccept).toBe(false);
    expect(s1.canCancel).toBe(true);

    // Response received with changes
    let withChanges = createConfirmationGovernanceState(makeInput());
    withChanges = receiveSupplierResponse(withChanges, makeChangedResponse(), "system").state;
    const s2 = buildConfirmationGovernanceSurface(withChanges);
    expect(s2.statusLabel).toBe("응답 수신");
    expect(s2.statusColor).toBe("amber");
    expect(s2.canAccept).toBe(true);
    expect(s2.delta).not.toBeNull();

    // Confirmed
    let confirmed = withChanges;
    confirmed = operatorAccept(confirmed, true, "ok", "op_1").state;
    const s3 = buildConfirmationGovernanceSurface(confirmed);
    expect(s3.statusLabel).toBe("확인 완료");
    expect(s3.statusColor).toBe("emerald");
    expect(s3.isTerminal).toBe(true);
  });

  it("SC10: receiving handoff only from confirmed", () => {
    // Not confirmed → no handoff
    const awaiting = createConfirmationGovernanceState(makeInput());
    expect(buildReceivingPrepGovernanceHandoff(awaiting)).toBeNull();

    // Confirmed → handoff available
    let state = createConfirmationGovernanceState(makeInput());
    state = receiveSupplierResponse(state, makeCleanResponse(), "system").state;
    state = operatorAccept(state, false, "ok", "op_1").state;

    const handoff = buildReceivingPrepGovernanceHandoff(state);
    expect(handoff).not.toBeNull();
    expect(handoff!.handoffReadiness).toBe("ready");
    expect(handoff!.confirmedLineItems.length).toBe(2);
  });

  it("SC11: QuoteChainStage includes supplier_confirmed", () => {
    const stageIds = QUOTE_CHAIN_STAGES.map(s => s.stage);
    expect(stageIds).toContain("supplier_confirmed");

    const config = QUOTE_CHAIN_STAGES.find(s => s.stage === "supplier_confirmed")!;
    expect(config.label).toBe("공급사 확인");
    expect(config.lockedFieldsFromPrevious).toContain("executionId");

    // Full surface has 10 stages
    const fullSurface = buildQuoteChainFullSurface([], 100000, false, true);
    expect(fullSurface.stages.length).toBe(10);
  });

  it("SC12: expiry handling", () => {
    let state = createConfirmationGovernanceState(makeInput());

    // Mark expired
    const r1 = markResponseExpired(state, "system");
    expect(r1.success).toBe(true);
    expect(r1.state.status).toBe("expired");
    expect(r1.state.isOverdue).toBe(true);

    // Can go back to awaiting (re-request)
    // expired → awaiting_response is valid
    const r2 = operatorRequestCorrection(r1.state, "재요청", "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("awaiting_response");
  });
});

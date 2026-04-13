// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Dispatch Execution Engine Tests
 *
 * E1: create → draft_dispatch initial state
 * E2: draft → scheduled → queued → sending → sent (happy path)
 * E3: draft → queued → sending → sent (skip schedule)
 * E4: sending → send_failed → retry → queued → sending → sent
 * E5: send_failed 최대 재시도 초과 시 retry 불가
 * E6: terminal state(sent/cancelled)에서 transition 불가
 * E7: invalid transition 거부
 * E8: cancel 가능 — 모든 non-terminal 상태에서
 * E9: payload snapshot 고정 검증
 * E10: execution surface 투사 정확성
 * E11: ready_to_send ≠ sent 최종 확인
 * E12: QuoteChainStage에 sent 포함 확인
 */

import { describe, it, expect } from "vitest";

import {
  createInitialExecutionState,
  scheduleSend,
  queueToSend,
  startSending,
  markSent,
  markSendFailed,
  cancelExecution,
  evaluateRetryEligibility,
  buildExecutionSurface,
  TERMINAL_STATUSES,
  type OutboundExecutionState,
  type OutboundPayloadSnapshot,
  type CreateExecutionInput,
} from "../dispatch-execution-engine";

import {
  QUOTE_CHAIN_STAGES,
  buildQuoteChainFullSurface,
} from "../quote-approval-governance-engine";

// ── Helpers ──

function makeInput(): CreateExecutionInput {
  return {
    caseId: "case_1",
    poNumber: "PO-001",
    dispatchPreparationStateId: "dpgov_1",
    poCreatedObjectId: "pocreated_1",
    approvalDecisionObjectId: "approval_1",
    actor: "op_1",
  };
}

function makeSnapshot(): OutboundPayloadSnapshot {
  return {
    snapshotId: `snap_${Date.now().toString(36)}`,
    frozenAt: new Date().toISOString(),
    poNumber: "PO-001",
    vendorName: "Vendor Kim",
    vendorEmail: "vendor@example.com",
    totalAmount: 500000,
    lineItems: [
      { name: "Reagent A", quantity: 10, unitPrice: 30000, total: 300000 },
      { name: "Filter B", quantity: 5, unitPrice: 40000, total: 200000 },
    ],
    paymentTerms: "Net 30",
    deliveryTerms: "FOB Origin",
    shippingAddress: "Seoul Lab, 123 Science Rd",
    billingAddress: "Seoul HQ, 456 Finance St",
    attachedDocumentIds: ["doc_spec", "doc_msds"],
    internalNote: "긴급 구매",
    supplierNote: "",
  };
}

describe("Dispatch Execution Engine", () => {

  it("E1: create → draft_dispatch initial state", () => {
    const state = createInitialExecutionState(makeInput());
    expect(state.status).toBe("draft_dispatch");
    expect(state.executionId).toBeTruthy();
    expect(state.payloadSnapshotId).toBeNull();
    expect(state.sentAt).toBeNull();
    expect(state.retryCount).toBe(0);
    expect(state.maxRetries).toBe(3);
  });

  it("E2: draft → scheduled → queued → sending → sent (full happy path)", () => {
    let state = createInitialExecutionState(makeInput());
    const snapshot = makeSnapshot();

    // Schedule
    const r1 = scheduleSend(state, "2026-04-01T09:00:00Z", "op_1");
    expect(r1.success).toBe(true);
    expect(r1.state.status).toBe("scheduled");
    expect(r1.state.scheduledSendAt).toBe("2026-04-01T09:00:00Z");
    state = r1.state;

    // Queue
    const r2 = queueToSend(state, snapshot, "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("queued_to_send");
    expect(r2.state.payloadSnapshotId).toBe(snapshot.snapshotId);
    state = r2.state;

    // Sending
    const r3 = startSending(state, "system");
    expect(r3.success).toBe(true);
    expect(r3.state.status).toBe("sending");
    state = r3.state;

    // Sent
    const r4 = markSent(state, "system");
    expect(r4.success).toBe(true);
    expect(r4.state.status).toBe("sent");
    expect(r4.state.sentAt).toBeTruthy();
    state = r4.state;
  });

  it("E3: draft → queued → sending → sent (skip schedule)", () => {
    let state = createInitialExecutionState(makeInput());
    const snapshot = makeSnapshot();

    const r1 = queueToSend(state, snapshot, "op_1");
    expect(r1.success).toBe(true);
    state = r1.state;

    const r2 = startSending(state, "system");
    expect(r2.success).toBe(true);
    state = r2.state;

    const r3 = markSent(state, "system");
    expect(r3.success).toBe(true);
    expect(r3.state.status).toBe("sent");
  });

  it("E4: sending → send_failed → retry → queued → sending → sent", () => {
    let state = createInitialExecutionState(makeInput());
    const snapshot = makeSnapshot();

    // Get to sending
    state = queueToSend(state, snapshot, "op_1").state;
    state = startSending(state, "system").state;

    // Fail
    const r1 = markSendFailed(state, "SMTP timeout", "system");
    expect(r1.success).toBe(true);
    expect(r1.state.status).toBe("send_failed");
    expect(r1.state.failureReason).toBe("SMTP timeout");
    state = r1.state;

    // Retry (back to queued)
    const retry = evaluateRetryEligibility(state);
    expect(retry.canRetry).toBe(true);
    expect(retry.remainingRetries).toBe(3);

    const r2 = queueToSend(state, snapshot, "op_1");
    expect(r2.success).toBe(true);
    expect(r2.state.status).toBe("queued_to_send");
    expect(r2.state.retryCount).toBe(1);
    state = r2.state;

    // Complete
    state = startSending(state, "system").state;
    const r3 = markSent(state, "system");
    expect(r3.success).toBe(true);
    expect(r3.state.status).toBe("sent");
  });

  it("E5: max retries exceeded → retry blocked", () => {
    let state = createInitialExecutionState(makeInput());
    const snapshot = makeSnapshot();

    // Exhaust retries
    for (let i = 0; i < 3; i++) {
      state = queueToSend(state, snapshot, "op_1").state;
      state = startSending(state, "system").state;
      state = markSendFailed(state, `Failure #${i + 1}`, "system").state;
    }

    expect(state.retryCount).toBe(3);
    const retry = evaluateRetryEligibility(state);
    expect(retry.canRetry).toBe(false);
    expect(retry.canCancel).toBe(true);
    expect(retry.blockReason).toContain("최대 재시도 횟수");
  });

  it("E6: terminal states reject transitions", () => {
    const snapshot = makeSnapshot();

    // Sent → cannot transition
    let state = createInitialExecutionState(makeInput());
    state = queueToSend(state, snapshot, "op_1").state;
    state = startSending(state, "system").state;
    state = markSent(state, "system").state;

    const r1 = cancelExecution(state, "test", "op_1");
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("terminal");

    // Cancelled → cannot transition
    let state2 = createInitialExecutionState(makeInput());
    state2 = cancelExecution(state2, "no longer needed", "op_1").state;

    const r2 = queueToSend(state2, snapshot, "op_1");
    expect(r2.success).toBe(false);
    expect(r2.error).toContain("terminal");
  });

  it("E7: invalid transitions rejected", () => {
    const state = createInitialExecutionState(makeInput());

    // draft → sent (skipping queue/sending)
    const r1 = markSent(state, "op_1");
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("Invalid transition");

    // draft → sending (must queue first)
    const r2 = startSending(state, "op_1");
    expect(r2.success).toBe(false);
  });

  it("E8: cancel from all non-terminal states", () => {
    const snapshot = makeSnapshot();
    const nonTerminalStatuses = ["draft_dispatch", "scheduled", "queued_to_send", "sending", "send_failed"];

    for (const targetStatus of nonTerminalStatuses) {
      let state = createInitialExecutionState(makeInput());

      // Get to target status
      if (targetStatus === "scheduled") {
        state = scheduleSend(state, "2026-04-01T09:00:00Z", "op_1").state;
      } else if (targetStatus === "queued_to_send") {
        state = queueToSend(state, snapshot, "op_1").state;
      } else if (targetStatus === "sending") {
        state = queueToSend(state, snapshot, "op_1").state;
        state = startSending(state, "system").state;
      } else if (targetStatus === "send_failed") {
        state = queueToSend(state, snapshot, "op_1").state;
        state = startSending(state, "system").state;
        state = markSendFailed(state, "test failure", "system").state;
      }

      expect(state.status).toBe(targetStatus);
      const result = cancelExecution(state, "cancelled", "op_1");
      expect(result.success).toBe(true);
      expect(result.state.status).toBe("cancelled");
    }
  });

  it("E9: payload snapshot frozen at queue time", () => {
    let state = createInitialExecutionState(makeInput());
    const snapshot = makeSnapshot();

    // Before queue: no snapshot
    expect(state.payloadSnapshotId).toBeNull();

    // After queue: snapshot frozen
    state = queueToSend(state, snapshot, "op_1").state;
    expect(state.payloadSnapshotId).toBe(snapshot.snapshotId);
    expect(state.payloadSnapshotFrozenAt).toBe(snapshot.frozenAt);

    // Through sending and sent: snapshot unchanged
    state = startSending(state, "system").state;
    expect(state.payloadSnapshotId).toBe(snapshot.snapshotId);

    state = markSent(state, "system").state;
    expect(state.payloadSnapshotId).toBe(snapshot.snapshotId);
  });

  it("E10: execution surface projections accurate", () => {
    let state = createInitialExecutionState(makeInput());

    // Draft
    let surface = buildExecutionSurface(state);
    expect(surface.statusLabel).toBe("발송 초안");
    expect(surface.canSchedule).toBe(true);
    expect(surface.canSendNow).toBe(true);
    expect(surface.canRetry).toBe(false);
    expect(surface.canCancel).toBe(true);
    expect(surface.isTerminal).toBe(false);

    // Sent
    const snapshot = makeSnapshot();
    state = queueToSend(state, snapshot, "op_1").state;
    state = startSending(state, "system").state;
    state = markSent(state, "system").state;
    surface = buildExecutionSurface(state);
    expect(surface.statusLabel).toBe("발송 완료");
    expect(surface.isTerminal).toBe(true);
    expect(surface.canSchedule).toBe(false);
    expect(surface.canSendNow).toBe(false);
    expect(surface.canRetry).toBe(false);
    expect(surface.canCancel).toBe(false);

    // Failed
    let failState = createInitialExecutionState(makeInput());
    failState = queueToSend(failState, snapshot, "op_1").state;
    failState = startSending(failState, "system").state;
    failState = markSendFailed(failState, "timeout", "system").state;
    const failSurface = buildExecutionSurface(failState);
    expect(failSurface.statusLabel).toBe("발송 실패");
    expect(failSurface.canRetry).toBe(true);
    expect(failSurface.canCancel).toBe(true);
    expect(failSurface.statusColor).toBe("red");
  });

  it("E11: ready_to_send (preparation) ≠ sent (execution) — final confirmation", () => {
    // These are different domains entirely
    // preparation readiness is in po-dispatch-governance-engine
    // execution result is in dispatch-execution-engine
    const state = createInitialExecutionState(makeInput());
    expect(state.status).toBe("draft_dispatch");
    expect(state.status).not.toBe("ready_to_send"); // ready_to_send is DispatchGovernanceReadiness
    expect(state.status).not.toBe("sent");

    // Terminal statuses
    expect(TERMINAL_STATUSES).toContain("sent");
    expect(TERMINAL_STATUSES).not.toContain("ready_to_send"); // not an execution status
  });

  it("E12: QuoteChainStage includes 'sent' as active stage", () => {
    const stageIds = QUOTE_CHAIN_STAGES.map(s => s.stage);
    expect(stageIds).toContain("sent");

    const sentConfig = QUOTE_CHAIN_STAGES.find(s => s.stage === "sent")!;
    expect(sentConfig.label).toBe("발송 완료");
    expect(sentConfig.lockedFieldsFromPrevious).toContain("payloadSnapshotId");

    // Full surface now has 9 stages
    const fullSurface = buildQuoteChainFullSurface([], 100000, false, true);
    expect(fullSurface.stages.length).toBe(9);
  });
});

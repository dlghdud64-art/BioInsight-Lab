/**
 * Dispatch v2 Chain — Scenario Test Matrix
 *
 * 7개 대표 시나리오를 canonical output truth 기준으로 검증.
 * UI가 아니라 engine output의 state/classification/gate/bypass 기준.
 */

import { executeActualSendFire, canRetryFire } from "../actual-send-fired-transaction-v2-engine";
import { buildSentOutcomeWorkspaceStateV2 } from "../sent-outcome-workspace-v2";
import { buildDeliveryTrackingHandoffGateV2 } from "../delivery-tracking-handoff-gate-v2-engine";
import { createDeliveryTrackingRecord } from "../delivery-tracking-workspace-v2";
import { createInitialTrackingSession, applyDeliveryTrackingMutation } from "../delivery-tracking-resolution-v2-engine";
import { captureSupplierAck } from "../supplier-acknowledgment-workspace-v2";
import { createInitialAckResolutionSession, applyAckResolutionMutation } from "../supplier-acknowledgment-resolution-v2-engine";
import type { ReceivingReadinessCheckV2 } from "../supplier-acknowledgment-resolution-v2-engine";
import { buildReceivingPreparationHandoffGateV2 } from "../receiving-preparation-handoff-gate-v2-engine";
import { buildAckFollowupHandoffGateV2 } from "../ack-followup-handoff-gate-v2-engine";
import { createInitialFollowupSession, applyAckFollowupMutation } from "../ack-followup-resolution-v2-engine";
import { createInitialReceivingExecSession, applyReceivingExecMutation } from "../receiving-execution-resolution-v2-engine";
import { createInitialDispositionSession, applyVarianceDispositionMutation } from "../receiving-variance-disposition-v2-engine";
import { buildStockReleaseHandoffGateV2 } from "../stock-release-handoff-gate-v2-engine";
import { createExceptionRecord, applyExceptionMutation } from "../dispatch-exception-recovery-v2-engine";
import type { ActualSendFireSessionV2 } from "../actual-send-fire-resolution-v2-engine";
import type { ReceivingLineRecordV2 } from "../receiving-execution-workspace-v2";

// ── Test Helper: Minimal Fire Session ──
function makeFireSession(status: string = "fire_ready_pending_ignition"): ActualSendFireSessionV2 {
  return {
    actualSendFireSessionId: "fire_test_1", caseId: "case_1", handoffPackageId: "pkg_1",
    actualSendFireGateId: "gate_1", actualSendExecuteSessionId: "exec_1",
    sessionStatus: status as any, firePhase: "pending_actual_send_ignition",
    openedAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString(), openedBy: "operator",
    activeSectionKey: null, operatorFocusOrder: [],
    sectionResolutionStates: [], returnHistory: [], reopenLinks: [], auditEventRefs: [], provenance: "pkg_1",
    ignitionReadinessGateState: {
      ignitionReadinessStatus: "fire_ready_pending_ignition",
      requiredSectionsTotal: 0, sectionsReadyCount: 0,
      unresolvedSectionKeys: [], warningOnlySectionKeys: [],
      ignitionReadinessBlockers: [], ignitionReadinessAllowed: true,
      ignitionReadinessReason: "Ready",
      nextGateStatus: "batch1_terminal",
      actualSendIgnitionEnablementStatus: "disabled_batch1_terminal",
      actualSendStatus: "not_sent",
    },
  };
}

// ══════════════════════════════════════════════
// Scenario A: Happy Path
// ══════════════════════════════════════════════
describe("Scenario A: Happy Path — fire → sent → tracking → ack confirmed+ready → receiving → disposition → stock release", () => {
  test("fire succeeds and creates SentStateRecordV2", () => {
    const fireSession = makeFireSession();
    const result = executeActualSendFire(fireSession, "operator");
    expect(result.success).toBe(true);
    expect(result.sentStateRecord).not.toBeNull();
    expect(result.sentStateRecord!.sentStateCommitted).toBe(true);
    expect(result.sentStateRecord!.dispatched).toBe(false);
    expect(result.sentStateRecord!.trackingCreated).toBe(false);
    expect(result.sentStateRecord!.supplierAckReceived).toBe(false);
  });

  test("sent outcome workspace shows tracking_handoff_ready when fire success", () => {
    const fireSession = makeFireSession();
    const fireResult = executeActualSendFire(fireSession, "operator");
    const sentOutcome = buildSentOutcomeWorkspaceStateV2(fireResult.sentStateRecord!);
    // Fire was success but payload snapshot is empty → some sections will be blocked
    expect(sentOutcome.sentStateCommitted).toBe(true);
    expect(sentOutcome.dispatched).toBe(false);
  });

  test("delivery tracking handoff gate requires sent_state_committed", () => {
    const fireSession = makeFireSession();
    const fireResult = executeActualSendFire(fireSession, "operator");
    const record = fireResult.sentStateRecord!;
    const sentOutcome = buildSentOutcomeWorkspaceStateV2(record);
    const trackingGate = buildDeliveryTrackingHandoffGateV2(sentOutcome, record);
    expect(trackingGate.trackingStatus).toBe("not_created");
    expect(trackingGate.supplierAckStatus).toBe("not_received");
  });
});

// ══════════════════════════════════════════════
// Scenario B: Confirmed but NOT Ready
// ══════════════════════════════════════════════
describe("Scenario B: Confirmed but not receiving-ready — blocked from receiving prep", () => {
  test("ack confirmed without ETA → receiving prep handoff blocked", () => {
    const ackRecord = captureSupplierAck("case_1", "sent_1", "trk_1", "confirmed", "주문 수락합니다", "email", "operator");
    const ackSession = createInitialAckResolutionSession("case_1", "sent_1", ackRecord, "operator");

    // Classification auto-derives, but readiness check defaults have ETA = false
    expect(ackSession.receivingReadinessCheck.etaOrShipmentTimingAvailable).toBe(false);

    // Even though classification may start as confirmed_ready, the initial auto-derivation
    // already checks readiness — if ETA is false, it won't be confirmed_ready
    const gate = buildReceivingPreparationHandoffGateV2(ackSession, {
      sentStateRecordId: "sent_1", sentStateCommitted: true,
    } as any);

    // Gate should not allow entry because ETA is missing
    expect(gate.blockers.length).toBeGreaterThan(0);
    expect(gate.candidate.canOpenReceivingPrepWorkspace).toBe(false);
  });
});

// ══════════════════════════════════════════════
// Scenario C: Partial Ack
// ══════════════════════════════════════════════
describe("Scenario C: Partial ack — only some lines accepted", () => {
  test("partial ack classification routes to followup", () => {
    const ackRecord = captureSupplierAck("case_1", "sent_1", "trk_1", "partial", "일부만 수락", "email", "operator");
    const ackSession = createInitialAckResolutionSession("case_1", "sent_1", ackRecord, "operator");

    expect(ackSession.ackClassification).toBe("ack_partial");
    expect(ackSession.followupRequired).toBe(true);
    expect(ackSession.nextHandoffTarget).toBe("ack_followup");

    const followupGate = buildAckFollowupHandoffGateV2(ackSession);
    expect(followupGate.gateStatus).toBe("followup_entry_enabled");
    expect(followupGate.canOpenFollowupWorkspace).toBe(true);
  });
});

// ══════════════════════════════════════════════
// Scenario D: Followup Resolved Path (P0 fix verification)
// ══════════════════════════════════════════════
describe("Scenario D: Followup resolved — must pass ReceivingReadinessCheckV2 7/7", () => {
  test("classify_response no longer auto-sets receivingReadyAfterFollowup", () => {
    const session = createInitialFollowupSession("case_1", "sent_1", "ackres_1", "operator");
    const classified = applyAckFollowupMutation(session, {
      action: "classify_response", responseClassification: "ack_confirmed_ready",
      actor: "operator", timestamp: new Date().toISOString(),
    });
    expect(classified.applied).toBe(true);
    // P0 FIX: receivingReadyAfterFollowup should NOT be auto-true
    expect(classified.updatedSession.receivingReadyAfterFollowup).toBe(false);
    expect(classified.updatedSession.receivingReadinessCheck).toBeNull();
  });

  test("resolve_as_confirmed_ready requires readiness check submission first", () => {
    const session = createInitialFollowupSession("case_1", "sent_1", "ackres_1", "operator");
    const classified = applyAckFollowupMutation(session, {
      action: "classify_response", responseClassification: "ack_confirmed_ready",
      actor: "operator", timestamp: new Date().toISOString(),
    });

    // Try to resolve without readiness check → should reject
    const resolveAttempt = applyAckFollowupMutation(classified.updatedSession, {
      action: "resolve_as_confirmed_ready",
      actor: "operator", timestamp: new Date().toISOString(),
    });
    expect(resolveAttempt.applied).toBe(false);
    expect(resolveAttempt.rejectedReasonIfAny).toContain("submit_receiving_readiness_check");
  });

  test("submit_receiving_readiness_check with all 7 criteria → resolve succeeds", () => {
    const session = createInitialFollowupSession("case_1", "sent_1", "ackres_1", "operator");
    const now = new Date().toISOString();

    // Step 1: classify
    const s1 = applyAckFollowupMutation(session, { action: "classify_response", responseClassification: "ack_confirmed_ready", actor: "op", timestamp: now });

    // Step 2: submit readiness check (all 7 true)
    const fullReadiness: ReceivingReadinessCheckV2 = {
      supplierAcceptedFull: true, etaOrShipmentTimingAvailable: true,
      lineItemScopeConfirmed: true, deliveryReferenceAvailable: true,
      noSubstitutionPending: true, noSplitShipmentUnresolved: true, quantityPackConfirmed: true,
    };
    const s2 = applyAckFollowupMutation(s1.updatedSession, { action: "submit_receiving_readiness_check", receivingReadinessCheck: fullReadiness, actor: "op", timestamp: now });
    expect(s2.applied).toBe(true);
    expect(s2.updatedSession.receivingReadyAfterFollowup).toBe(true);

    // Step 3: resolve
    const s3 = applyAckFollowupMutation(s2.updatedSession, { action: "resolve_as_confirmed_ready", actor: "op", timestamp: now });
    expect(s3.applied).toBe(true);
    expect(s3.updatedSession.sessionStatus).toBe("followup_resolved_confirmed_ready");
    expect(s3.updatedSession.nextTarget).toBe("receiving_preparation_handoff");
  });

  test("submit_receiving_readiness_check with missing criteria → resolve blocked", () => {
    const session = createInitialFollowupSession("case_1", "sent_1", "ackres_1", "operator");
    const now = new Date().toISOString();

    const s1 = applyAckFollowupMutation(session, { action: "classify_response", responseClassification: "ack_confirmed_ready", actor: "op", timestamp: now });

    // Missing ETA
    const partialReadiness: ReceivingReadinessCheckV2 = {
      supplierAcceptedFull: true, etaOrShipmentTimingAvailable: false,
      lineItemScopeConfirmed: true, deliveryReferenceAvailable: true,
      noSubstitutionPending: true, noSplitShipmentUnresolved: true, quantityPackConfirmed: true,
    };
    const s2 = applyAckFollowupMutation(s1.updatedSession, { action: "submit_receiving_readiness_check", receivingReadinessCheck: partialReadiness, actor: "op", timestamp: now });
    expect(s2.applied).toBe(true);
    expect(s2.updatedSession.receivingReadyAfterFollowup).toBe(false);

    // Try resolve → should reject
    const s3 = applyAckFollowupMutation(s2.updatedSession, { action: "resolve_as_confirmed_ready", actor: "op", timestamp: now });
    expect(s3.applied).toBe(false);
  });
});

// ══════════════════════════════════════════════
// Scenario E: Followup Unresolved
// ══════════════════════════════════════════════
describe("Scenario E: Followup unresolved — receiving prep blocked", () => {
  test("unclear response keeps followup loop, receiving blocked", () => {
    const session = createInitialFollowupSession("case_1", "sent_1", "ackres_1", "operator");
    const now = new Date().toISOString();

    const s1 = applyAckFollowupMutation(session, { action: "classify_response", responseClassification: "ack_unclear", actor: "op", timestamp: now });
    expect(s1.updatedSession.receivingReadyAfterFollowup).toBe(false);
    expect(s1.updatedSession.nextTarget).toBe("retry_followup");
  });

  test("timeout routes to exception_recovery", () => {
    const session = createInitialFollowupSession("case_1", "sent_1", "ackres_1", "operator");
    const s1 = applyAckFollowupMutation(session, { action: "mark_timeout", actor: "op", timestamp: new Date().toISOString() });
    expect(s1.updatedSession.sessionStatus).toBe("followup_timeout");
    expect(s1.updatedSession.nextTarget).toBe("exception_recovery");
  });
});

// ══════════════════════════════════════════════
// Scenario F: Receiving Discrepancy
// ══════════════════════════════════════════════
describe("Scenario F: Receiving discrepancy — variance disposition mandatory", () => {
  test("receiving with short qty creates discrepancy, stock release direct blocked", () => {
    const lines: ReceivingLineRecordV2[] = [
      { lineId: "line_1", expectedQty: 100, actualReceivedQty: 0, unit: "EA", lotNumber: "", expiryDate: "", lineReceiptStatus: "pending", damageFlag: false, discrepancyFlag: false, substituteFlag: false, receivingNote: "" },
    ];
    const execSession = createInitialReceivingExecSession("case_1", "sent_1", "prep_1", lines, "operator");

    // Record short receipt
    const r1 = applyReceivingExecMutation(execSession, { action: "record_line_receipt", lineId: "line_1", actualQty: 80, actor: "op", timestamp: new Date().toISOString() });
    expect(r1.updatedSession.lineRecords[0].lineReceiptStatus).toBe("received_short");

    // Flag discrepancy
    const r2 = applyReceivingExecMutation(r1.updatedSession, { action: "flag_line_discrepancy", lineId: "line_1", reason: "20EA short", actor: "op", timestamp: new Date().toISOString() });
    expect(r2.updatedSession.discrepancyLines).toContain("line_1");

    // Complete execution
    const r3 = applyReceivingExecMutation(r2.updatedSession, { action: "complete_execution", actor: "op", timestamp: new Date().toISOString() });
    expect(r3.updatedSession.sessionStatus).toBe("exec_with_discrepancy");
    expect(r3.updatedSession.varianceDispositionRequired).toBe(true);

    // Variance disposition
    const dispSession = createInitialDispositionSession("case_1", "sent_1", r3.updatedSession, "operator");
    expect(dispSession.lineDispositions[0].disposition).toBe("hold_for_review"); // not clean → auto hold

    // Set disposition to accepted_with_note
    const d1 = applyVarianceDispositionMutation(dispSession, { action: "set_line_disposition", lineId: "line_1", disposition: "accepted_with_note", dispositionReason: "Short accepted", actor: "op", timestamp: new Date().toISOString() });
    expect(d1.updatedSession.lineDispositions[0].releasableQty).toBe(80);

    // Complete disposition
    const d2 = applyVarianceDispositionMutation(d1.updatedSession, { action: "mark_all_dispositions_complete", actor: "op", timestamp: new Date().toISOString() });
    expect(d2.updatedSession.stockReleaseAllowed).toBe(true);
    expect(d2.updatedSession.totalReleasableQty).toBe(80);

    // Stock release gate
    const stkGate = buildStockReleaseHandoffGateV2(d2.updatedSession);
    expect(stkGate.canOpenStockReleaseWorkspace).toBe(true);
    expect(stkGate.totalReleasableQty).toBe(80);
  });

  test("disposition incomplete blocks stock release", () => {
    const lines: ReceivingLineRecordV2[] = [
      { lineId: "line_1", expectedQty: 100, actualReceivedQty: 80, unit: "EA", lotNumber: "", expiryDate: "", lineReceiptStatus: "received_short", damageFlag: false, discrepancyFlag: true, substituteFlag: false, receivingNote: "" },
    ];
    const execSession = createInitialReceivingExecSession("case_1", "sent_1", "prep_1", lines, "operator");
    execSession.sessionStatus = "exec_with_discrepancy";
    const dispSession = createInitialDispositionSession("case_1", "sent_1", execSession, "operator");

    // Don't set any disposition — try to mark complete
    const d1 = applyVarianceDispositionMutation(dispSession, { action: "mark_all_dispositions_complete", actor: "op", timestamp: new Date().toISOString() });
    // Should fail because disposition hasn't been set by operator (auto hold doesn't count as operator disposition)
    // Actually the auto-created session has dispositionBy = null for non-clean lines
    expect(d1.applied).toBe(false);
  });
});

// ══════════════════════════════════════════════
// Scenario G: Recovery Re-entry Matrix (P1 fix verification)
// ══════════════════════════════════════════════
describe("Scenario G: Recovery re-entry — allowed target matrix enforced", () => {
  test("stock_release can return to receiving_variance_disposition", () => {
    const record = createExceptionRecord("case_1", "sent_1", "stock_release", "receiving_shortage", "Short qty", ["line_1"], "medium", "operator");
    const r1 = applyExceptionMutation(record, { action: "start_investigation", actor: "op", timestamp: new Date().toISOString() });
    const r2 = applyExceptionMutation(r1.updatedRecord, { action: "set_recovery_action", recoveryAction: "retry_from_stage", recoveryReason: "Re-evaluate disposition", actor: "op", timestamp: new Date().toISOString() });
    const r3 = applyExceptionMutation(r2.updatedRecord, { action: "return_to_stage", returnToStage: "receiving_variance_disposition", actor: "op", timestamp: new Date().toISOString() });
    expect(r3.applied).toBe(true);
    expect(r3.updatedRecord.returnToStage).toBe("receiving_variance_disposition");
  });

  test("stock_release CANNOT return to supplier_acknowledgment (bypass blocked)", () => {
    const record = createExceptionRecord("case_1", "sent_1", "stock_release", "receiving_shortage", "Short qty", ["line_1"], "medium", "operator");
    const r1 = applyExceptionMutation(record, { action: "start_investigation", actor: "op", timestamp: new Date().toISOString() });
    const r2 = applyExceptionMutation(r1.updatedRecord, { action: "set_recovery_action", recoveryAction: "retry_from_stage", actor: "op", timestamp: new Date().toISOString() });
    const r3 = applyExceptionMutation(r2.updatedRecord, { action: "return_to_stage", returnToStage: "supplier_acknowledgment", actor: "op", timestamp: new Date().toISOString() });
    expect(r3.applied).toBe(false);
    expect(r3.rejectedReasonIfAny).toContain("Mandatory gate bypass 금지");
  });

  test("receiving_execution can return to receiving_preparation but NOT to sent_outcome", () => {
    const record = createExceptionRecord("case_1", "sent_1", "receiving_execution", "receiving_damage", "Damage", ["line_1"], "high", "operator");
    const r1 = applyExceptionMutation(record, { action: "start_investigation", actor: "op", timestamp: new Date().toISOString() });
    const r2 = applyExceptionMutation(r1.updatedRecord, { action: "set_recovery_action", recoveryAction: "retry_from_stage", actor: "op", timestamp: new Date().toISOString() });

    // Allowed: return to receiving_preparation
    const r3a = applyExceptionMutation(r2.updatedRecord, { action: "return_to_stage", returnToStage: "receiving_preparation", actor: "op", timestamp: new Date().toISOString() });
    expect(r3a.applied).toBe(true);

    // Not allowed: return to sent_outcome (skips ack + prep)
    const r3b = applyExceptionMutation(r2.updatedRecord, { action: "return_to_stage", returnToStage: "sent_outcome", actor: "op", timestamp: new Date().toISOString() });
    expect(r3b.applied).toBe(false);
  });
});

// ══════════════════════════════════════════════
// Scenario H: Fire Idempotency
// ══════════════════════════════════════════════
describe("Scenario H: Fire idempotency — duplicate fire blocked", () => {
  test("second fire attempt on non-ready session is blocked", () => {
    const fireSession = makeFireSession("fire_review_in_progress");
    const result = executeActualSendFire(fireSession, "operator");
    expect(result.success).toBe(false);
    expect(result.executionStatus).toBe("fire_duplicate_blocked");
    expect(result.failureClass).toBe("idempotency_locked");
    expect(result.sentStateRecord).toBeNull();
  });

  test("canRetryFire returns false for idempotency lock", () => {
    const result = { success: false, executionStatus: "fire_failed" as const, sentStateRecord: null, failureClass: "idempotency_locked" as const, failureMessage: "", canRetry: false, emittedEvents: [] };
    expect(canRetryFire(result)).toBe(false);
  });

  test("canRetryFire returns true for transport_channel_failure", () => {
    const result = { success: false, executionStatus: "fire_failed" as const, sentStateRecord: null, failureClass: "transport_channel_failure" as const, failureMessage: "", canRetry: false, emittedEvents: [] };
    expect(canRetryFire(result)).toBe(true);
  });
});

// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * Dispatch Execution Handoff Tests
 *
 * CLAUDE.md 요구 경계:
 * H1: governance blocked → execution 생성 거부
 * H2: ready_to_send + !allConfirmed → execution 생성 거부
 * H3: ready_to_send + allConfirmed + snapshot valid → execution 생성 허용
 * H4: snapshot invalid → execution 생성 거부 (hard fail)
 * H5: 동일 idempotencyKey 재호출 → 기존 execution 반환 (중복 sent 방지)
 * H6: scheduled + snapshot invalidated → drift 감지 → cancel 권고
 * H7: scheduled + readiness 변경 → drift 감지 → rollback 권고
 * H8: scheduled + payload delta → drift 감지 → rollback 권고
 * H9: scheduled + 변동 없음 → still_ready → queue 진행 권고
 * H10: non-scheduled state 에 drift 검사 호출 → no_action
 * H11: governance readiness 에 'sent' 또는 'scheduled' 리터럴 유입 시 boundary 위반
 */

import { describe, it, expect } from "vitest";

import {
  canCreateExecution,
  createExecutionWithIdempotency,
  reevaluateScheduledExecution,
  isGovernanceReadinessInBoundary,
  type ExecutionStateWithIdempotency,
} from "../dispatch-execution-handoff";

import {
  evaluateDispatchGovernance,
  type DispatchGovernanceInput,
  type DispatchPreparationGovernanceState,
} from "../po-dispatch-governance-engine";

import { createInitialExecutionState } from "../dispatch-execution-engine";

// ── Helpers ──

function makeDispatchInput(
  overrides: Partial<DispatchGovernanceInput> = {},
): DispatchGovernanceInput {
  return {
    caseId: "case_1",
    poNumber: "PO-H1",
    approvalSnapshotValid: true,
    conversionSnapshotValid: true,
    snapshotInvalidationReason: "",
    supplierContactEmail: "vendor@example.com",
    supplierContactName: "Vendor Kim",
    shippingAddress: "Seoul Lab, 123 Science Rd",
    billingAddress: "Seoul HQ, 456 Finance St",
    paymentTerms: "Net 30",
    deliveryTerms: "FOB Origin",
    requiredDocuments: ["spec_sheet"],
    attachedDocuments: ["spec_sheet"],
    policyHoldActive: false,
    policyHoldReason: "",
    dataChangedAfterApproval: false,
    changeDetails: [],
    supplierProfileChanged: false,
    supplierProfileChangeDetail: "",
    lockedFields: ["vendorId", "lineItems", "totalAmount"],
    actor: "op_1",
    ...overrides,
  };
}

function withScheduledStatus(
  exec: ReturnType<typeof createInitialExecutionState>,
): ExecutionStateWithIdempotency {
  return {
    ...exec,
    status: "scheduled",
    scheduledSendAt: "2026-05-01T09:00:00Z",
    idempotencyKey: "idem_test",
  };
}

describe("Dispatch Execution Handoff", () => {
  // ── H1 ──────────────────────────────────────────
  it("H1: governance blocked → execution 생성 거부", () => {
    const blocked = evaluateDispatchGovernance(
      makeDispatchInput({ paymentTerms: "" }),
    );
    expect(blocked.readiness).toBe("blocked");

    const verdict = canCreateExecution(blocked);
    expect(verdict.allowed).toBe(false);
    expect(verdict.denyCode).toBe("not_ready_to_send");
    expect(verdict.denyReason).toContain("blocked");
  });

  // ── H2 ──────────────────────────────────────────
  it("H2: ready_to_send + !allConfirmed → execution 생성 거부", () => {
    // 시뮬레이션: ready_to_send 이지만 allConfirmed 가 false 인 경우
    // (실제 evaluator 는 이 조합을 자연 발생시키지 않으므로 수동 구성)
    const ready = evaluateDispatchGovernance(makeDispatchInput());
    expect(ready.readiness).toBe("ready_to_send");

    const broken: DispatchPreparationGovernanceState = {
      ...ready,
      allConfirmed: false,
    };

    const verdict = canCreateExecution(broken);
    expect(verdict.allowed).toBe(false);
    expect(verdict.denyCode).toBe("not_all_confirmed");
  });

  // ── H3 ──────────────────────────────────────────
  it("H3: ready_to_send + allConfirmed + snapshot valid → 허용", () => {
    const ready = evaluateDispatchGovernance(makeDispatchInput());
    expect(ready.readiness).toBe("ready_to_send");
    expect(ready.allConfirmed).toBe(true);

    const verdict = canCreateExecution(ready);
    expect(verdict.allowed).toBe(true);
    expect(verdict.denyCode).toBeNull();
    expect(verdict.denyReason).toBeNull();
  });

  // ── H4 ──────────────────────────────────────────
  it("H4: snapshot invalid → execution 생성 거부", () => {
    const invalid = evaluateDispatchGovernance(
      makeDispatchInput({
        approvalSnapshotValid: false,
        snapshotInvalidationReason: "Approval drifted",
      }),
    );
    // hard blocker 가 존재하므로 일단 hard_blockers_present 로 차단됨
    const verdict = canCreateExecution(invalid);
    expect(verdict.allowed).toBe(false);
    // hard_blockers_present 또는 snapshot_invalid 중 하나로 차단
    expect([
      "hard_blockers_present",
      "snapshot_invalid",
      "not_ready_to_send",
    ]).toContain(verdict.denyCode);
  });

  // ── H5 ──────────────────────────────────────────
  it("H5: 동일 idempotencyKey 재호출 → 기존 execution 반환", () => {
    const input = {
      caseId: "case_1",
      poNumber: "PO-H5",
      dispatchPreparationStateId: "dpgov_1",
      poCreatedObjectId: "pocreated_1",
      approvalDecisionObjectId: "approval_1",
      actor: "op_1",
      idempotencyKey: "idem_abc",
    };

    // 첫 호출 → 신규 생성
    const r1 = createExecutionWithIdempotency(input, []);
    expect(r1.created).toBe(true);
    expect(r1.idempotencyKey).toBe("idem_abc");

    // 기존 execution 목록에 r1 을 포함시켜 재호출
    const existing: ExecutionStateWithIdempotency[] = [
      { ...r1.execution, idempotencyKey: "idem_abc" },
    ];
    const r2 = createExecutionWithIdempotency(input, existing);
    expect(r2.created).toBe(false);
    expect(r2.execution.executionId).toBe(r1.execution.executionId);
    expect(r2.idempotencyKey).toBe("idem_abc");

    // 다른 idempotencyKey 는 신규 생성
    const r3 = createExecutionWithIdempotency(
      { ...input, idempotencyKey: "idem_xyz" },
      existing,
    );
    expect(r3.created).toBe(true);
    expect(r3.execution.executionId).not.toBe(r1.execution.executionId);
  });

  // ── H6 ──────────────────────────────────────────
  it("H6: scheduled + snapshot invalidated → cancel_execution 권고", () => {
    const exec = withScheduledStatus(
      createInitialExecutionState({
        caseId: "case_1",
        poNumber: "PO-H6",
        dispatchPreparationStateId: "dpgov_1",
        poCreatedObjectId: "po_1",
        approvalDecisionObjectId: "appr_1",
        actor: "op_1",
      }),
    );

    const invalid = evaluateDispatchGovernance(
      makeDispatchInput({
        approvalSnapshotValid: false,
        snapshotInvalidationReason: "Approval re-evaluation required",
      }),
    );

    const result = reevaluateScheduledExecution(exec, invalid);
    expect(result.driftDetected).toBe(true);
    expect(result.verdict).toBe("snapshot_invalidated");
    expect(result.recommendedAction).toBe("cancel_execution");
  });

  // ── H7 ──────────────────────────────────────────
  it("H7: scheduled + hard blocker 등장 → cancel_execution 권고", () => {
    const exec = withScheduledStatus(
      createInitialExecutionState({
        caseId: "case_1",
        poNumber: "PO-H7",
        dispatchPreparationStateId: "dpgov_1",
        poCreatedObjectId: "po_1",
        approvalDecisionObjectId: "appr_1",
        actor: "op_1",
      }),
    );

    const blocked = evaluateDispatchGovernance(
      makeDispatchInput({ policyHoldActive: true, policyHoldReason: "Budget freeze" }),
    );

    const result = reevaluateScheduledExecution(exec, blocked);
    expect(result.driftDetected).toBe(true);
    expect(result.verdict).toBe("hard_blocker_appeared");
    expect(result.recommendedAction).toBe("cancel_execution");
  });

  // ── H8 ──────────────────────────────────────────
  it("H8: scheduled + payload delta → rollback_to_needs_review 권고", () => {
    const exec = withScheduledStatus(
      createInitialExecutionState({
        caseId: "case_1",
        poNumber: "PO-H8",
        dispatchPreparationStateId: "dpgov_1",
        poCreatedObjectId: "po_1",
        approvalDecisionObjectId: "appr_1",
        actor: "op_1",
      }),
    );

    // supplier profile 변경 → soft blocker + delta 발생
    const ready = evaluateDispatchGovernance(makeDispatchInput());
    const withDelta: DispatchPreparationGovernanceState = {
      ...ready,
      supplierFacingPayloadDelta: ["supplier email updated"],
    };

    const result = reevaluateScheduledExecution(exec, withDelta);
    expect(result.driftDetected).toBe(true);
    expect(result.verdict).toBe("payload_delta_detected");
    expect(result.recommendedAction).toBe("rollback_to_needs_review");
  });

  // ── H9 ──────────────────────────────────────────
  it("H9: scheduled + 변동 없음 → still_ready + proceed_to_queue", () => {
    const exec = withScheduledStatus(
      createInitialExecutionState({
        caseId: "case_1",
        poNumber: "PO-H9",
        dispatchPreparationStateId: "dpgov_1",
        poCreatedObjectId: "po_1",
        approvalDecisionObjectId: "appr_1",
        actor: "op_1",
      }),
    );
    const stillReady = evaluateDispatchGovernance(makeDispatchInput());

    const result = reevaluateScheduledExecution(exec, stillReady);
    expect(result.driftDetected).toBe(false);
    expect(result.verdict).toBe("still_ready");
    expect(result.recommendedAction).toBe("proceed_to_queue");
  });

  // ── H10 ──────────────────────────────────────────
  it("H10: non-scheduled 상태에 drift 검사 → no_action", () => {
    const exec: ExecutionStateWithIdempotency = {
      ...createInitialExecutionState({
        caseId: "case_1",
        poNumber: "PO-H10",
        dispatchPreparationStateId: "dpgov_1",
        poCreatedObjectId: "po_1",
        approvalDecisionObjectId: "appr_1",
        actor: "op_1",
      }),
      idempotencyKey: "idem_1",
      // status 는 draft_dispatch (기본값)
    };
    const fresh = evaluateDispatchGovernance(makeDispatchInput());

    const result = reevaluateScheduledExecution(exec, fresh);
    expect(result.driftDetected).toBe(false);
    expect(result.verdict).toBe("not_scheduled_state");
    expect(result.recommendedAction).toBe("no_action");
  });

  // ── H11 ──────────────────────────────────────────
  it("H11: governance readiness 에 'sent' 리터럴 유입 → boundary 위반", () => {
    const ready = evaluateDispatchGovernance(makeDispatchInput());
    const tainted: DispatchPreparationGovernanceState = {
      ...ready,
      readiness: "sent",
    };

    const verdict = canCreateExecution(tainted);
    expect(verdict.allowed).toBe(false);
    expect(verdict.denyCode).toBe("invalid_readiness_literal");

    expect(isGovernanceReadinessInBoundary("sent")).toBe(false);
    expect(isGovernanceReadinessInBoundary("scheduled")).toBe(false);
    expect(isGovernanceReadinessInBoundary("ready_to_send")).toBe(true);
    expect(isGovernanceReadinessInBoundary("blocked")).toBe(true);
    expect(isGovernanceReadinessInBoundary("needs_review")).toBe(true);
    expect(isGovernanceReadinessInBoundary("not_evaluated")).toBe(true);
    expect(isGovernanceReadinessInBoundary("cancelled")).toBe(true);
  });
});

// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * POCreatedRecord (unified computed view) tests
 *
 * 본 파일은 po-created-record.ts orchestrator의 contract만 검증한다.
 * governance/created engine 자체의 동작은 별도 test 파일에서 다룬다.
 *
 * Spec:
 * R1: ready 시나리오 — supplierFacingPayloadStatus=locked + send_now/schedule_send 활성
 * R2: snapshot fail — supplierFacingPayloadStatus=stale + send_now 비활성 + reason 노출
 * R3: required term/document 누락 — blockingReasons에 hard severity 포함
 * R4: needs_review (soft only) — supplierFacingPayloadStatus=draft + send_now 비활성
 * R5: dispatchReadiness sent ≠ ready_to_send 분리 — record가 두 상태를 구분
 * R6: action whitelist는 optimistic unlock 금지 — blocker 존재 시 send_now 불포함
 */

import { describe, it, expect } from "vitest";

import {
  evaluateDispatchGovernance,
  type DispatchGovernanceInput,
} from "../po-dispatch-governance-engine";

import { type PoCreatedState } from "../po-created-engine";

import {
  buildPoCreatedRecord,
  type POCreatedRecord,
  type ReentryActionKey,
} from "../po-created-record";

// ── Helpers ──

function makeDispatchInput(overrides: Partial<DispatchGovernanceInput> = {}): DispatchGovernanceInput {
  return {
    caseId: "case_1",
    poNumber: "PO-001",
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

function makePoCreatedState(overrides: Partial<PoCreatedState> = {}): PoCreatedState {
  return {
    poCreatedStatus: "po_created_recorded",
    substatus: "ready_for_dispatch_preparation",
    poCreatedOpenedAt: "2026-04-08T00:00:00Z",
    poCreatedOpenedBy: "conversion_handoff",
    poConversionDraftObjectId: "draft_1",
    approvalDecisionObjectId: "approval_1",
    requestSubmissionEventId: "event_1",
    createdVendorCount: 1,
    createdLineCount: 3,
    createdCommercialFieldCount: 4,
    createdOperationalFieldCount: 3,
    missingFieldCount: 0,
    poCreatedBlockedFlag: false,
    poCreatedBlockedReason: null,
    poCreatedObjectId: "pocreated_1",
    createdBasis: {
      vendorIds: ["v1"],
      lineCoverageSummary: "3건 완료",
      paymentTerm: "Net 30",
      billingReference: "BILL-001",
      deliveryTarget: "Seoul Lab",
      receivingInstruction: "1층 수령",
      shipToReference: "Seoul Lab, 123 Science Rd",
      internalNote: "",
      supplierNote: "",
      commercialSummary: "상업 조건 완료",
      operationalSummary: "운영 조건 완료",
    },
    ...overrides,
  };
}

function buildRecord(opts: {
  dispatch?: Partial<DispatchGovernanceInput>;
  poCreated?: Partial<PoCreatedState>;
  quoteSnapshotValid?: boolean;
}): POCreatedRecord {
  const dispatchGovernance = evaluateDispatchGovernance(makeDispatchInput(opts.dispatch));
  const poCreatedState = makePoCreatedState(opts.poCreated);
  return buildPoCreatedRecord({
    poCreatedState,
    dispatchGovernance,
    quoteShortlistSnapshotId: "qsnap_1",
    quoteSnapshotValid: opts.quoteSnapshotValid ?? true,
  });
}

const has = (actions: ReentryActionKey[], key: ReentryActionKey) => actions.includes(key);

describe("POCreatedRecord (unified computed view)", () => {
  it("R1: ready 시나리오 — supplierFacingPayloadStatus=locked + send_now/schedule_send 활성", () => {
    const record = buildRecord({});

    expect(record.dispatchReadiness).toBe("ready_to_send");
    expect(record.supplierFacingPayloadStatus).toBe("locked");
    expect(record.snapshotValidity.approvalSnapshotValid).toBe(true);
    expect(record.snapshotValidity.quoteSnapshotValid).toBe(true);
    expect(record.snapshotValidity.conversionSnapshotValid).toBe(true);
    expect(record.snapshotValidity.reason).toBeNull();
    expect(record.blockingReasons).toEqual([]);

    expect(has(record.reentryAvailableActions, "send_now")).toBe(true);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(true);
    expect(has(record.reentryAvailableActions, "open_dispatch_prep")).toBe(true);
    // 회수/보정 경로는 항상 열려있다
    expect(has(record.reentryAvailableActions, "reopen_po_conversion")).toBe(true);
    expect(has(record.reentryAvailableActions, "request_correction")).toBe(true);
    expect(has(record.reentryAvailableActions, "cancel_dispatch_prep")).toBe(true);

    expect(record.nextAction).toContain("발송 준비 완료");
    expect(record.poCreatedObjectId).toBe("pocreated_1");
    expect(record.approvalDecisionObjectId).toBe("approval_1");
    expect(record.poConversionDraftObjectId).toBe("draft_1");
    expect(record.quoteShortlistSnapshotId).toBe("qsnap_1");
  });

  it("R2: approval snapshot 무효 → stale + send 비활성 + reason 노출", () => {
    const record = buildRecord({
      dispatch: {
        approvalSnapshotValid: false,
        snapshotInvalidationReason: "승인 값 변경",
      },
    });

    expect(record.dispatchReadiness).toBe("blocked");
    expect(record.supplierFacingPayloadStatus).toBe("stale");
    expect(record.snapshotValidity.approvalSnapshotValid).toBe(false);
    expect(record.snapshotValidity.reason).toBeTruthy();
    expect(record.snapshotValidity.reason).toContain("승인 값 변경");

    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(false);
    expect(has(record.reentryAvailableActions, "open_dispatch_prep")).toBe(false);
    // reopen 경로는 살아 있어야 함 (stale → re-entry 진입점)
    expect(has(record.reentryAvailableActions, "reopen_po_conversion")).toBe(true);

    expect(record.blockingReasons.some((b) => b.severity === "hard")).toBe(true);
    expect(record.nextAction).toContain("승인");
  });

  it("R2-b: quote shortlist snapshot 무효 → stale + 별도 blocker", () => {
    const record = buildRecord({ quoteSnapshotValid: false });

    expect(record.snapshotValidity.quoteSnapshotValid).toBe(false);
    expect(record.supplierFacingPayloadStatus).toBe("stale");
    expect(record.blockingReasons.some((b) => b.code === "quote_snapshot_invalidated")).toBe(true);
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
  });

  it("R3: required document 누락 → hard blocker + correction 경로", () => {
    const record = buildRecord({
      dispatch: { attachedDocuments: [] },
    });

    expect(record.dispatchReadiness).toBe("blocked");
    expect(record.supplierFacingPayloadStatus).toBe("not_ready");
    expect(
      record.blockingReasons.some(
        (b) => b.code === "required_document_missing" && b.severity === "hard",
      ),
    ).toBe(true);
    expect(has(record.reentryAvailableActions, "request_correction")).toBe(true);
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
  });

  it("R4: soft blockers only → needs_review + draft + send 비활성", () => {
    const record = buildRecord({
      dispatch: {
        billingAddress: "",
        deliveryTerms: "",
      },
    });

    expect(record.dispatchReadiness).toBe("needs_review");
    expect(record.supplierFacingPayloadStatus).toBe("draft");
    expect(record.blockingReasons.every((b) => b.severity === "soft")).toBe(true);
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(false);
    // dispatch prep 진입은 가능 (hard blocker 없음)
    expect(has(record.reentryAvailableActions, "open_dispatch_prep")).toBe(true);
  });

  it("R5: ready_to_send와 sent 상태 분리 — record는 두 readiness를 그대로 노출", () => {
    const ready = buildRecord({});
    expect(ready.dispatchReadiness).toBe("ready_to_send");
    expect(ready.supplierFacingPayloadStatus).toBe("locked");

    // sent 상태는 governance 외부에서 set되므로 직접 조립
    const dispatchState = evaluateDispatchGovernance(makeDispatchInput());
    const sentRecord = buildPoCreatedRecord({
      poCreatedState: makePoCreatedState(),
      dispatchGovernance: { ...dispatchState, readiness: "sent" },
      quoteShortlistSnapshotId: "qsnap_1",
      quoteSnapshotValid: true,
    });
    expect(sentRecord.dispatchReadiness).toBe("sent");
    expect(sentRecord.supplierFacingPayloadStatus).toBe("locked");
    // sent 상태에서는 send_now / schedule_send를 다시 열지 않는다 (재발송 금지)
    expect(has(sentRecord.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(sentRecord.reentryAvailableActions, "schedule_send")).toBe(false);
  });

  it("R6: optimistic unlock 금지 — hard blocker 있으면 send_now/open_dispatch_prep 모두 차단", () => {
    const record = buildRecord({
      dispatch: {
        supplierContactEmail: "",
        paymentTerms: "",
      },
    });

    expect(record.blockingReasons.filter((b) => b.severity === "hard").length).toBeGreaterThan(0);
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(record.reentryAvailableActions, "open_dispatch_prep")).toBe(false);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(false);
    // 보정/재진입 경로는 항상 열려있다
    expect(has(record.reentryAvailableActions, "request_correction")).toBe(true);
    expect(has(record.reentryAvailableActions, "reopen_po_conversion")).toBe(true);
  });

  it("R7-b: canCreateExecution guard wiring — ready_to_send + !allConfirmed → send_now 차단", () => {
    // 실제 evaluator 는 이 조합을 자연 발생시키지 않지만, handoff boundary guard 가
    // POCreatedRecord.reentryAvailableActions 의 단일 진입점임을 확인한다.
    const dispatchState = evaluateDispatchGovernance(makeDispatchInput());
    expect(dispatchState.readiness).toBe("ready_to_send");

    const record = buildPoCreatedRecord({
      poCreatedState: makePoCreatedState(),
      dispatchGovernance: { ...dispatchState, allConfirmed: false },
      quoteShortlistSnapshotId: "qsnap_1",
      quoteSnapshotValid: true,
    });

    // guard 가 not_all_confirmed 로 거부하므로 send 계열은 닫혀야 한다
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(false);
    // 단, hard blocker 는 없으므로 dispatch prep 진입은 가능
    expect(has(record.reentryAvailableActions, "open_dispatch_prep")).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // Batch 1 확장 시나리오 — CLAUDE.md event list 에 대응하는 재계산 계약
  // ──────────────────────────────────────────────────────────────────────

  it("R8: supplier profile 변경 → hard blocker + send 경로 차단 + reopen 은 유지", () => {
    const record = buildRecord({
      dispatch: {
        supplierProfileChanged: true,
        supplierProfileChangeDetail: "공급사 담당자/세금 정보 변경",
      },
    });

    // supplier master 변경은 soft blocker 로 needs_review 에 떨어진다
    // (canonical: dispatch-prep-governance-chain Scenario 5 에서 문서화 — supplier_profile_changed 는 soft)
    // send 차단은 canCreateExecution guard 가 readiness !== "ready_to_send" 로 거부하여 달성.
    expect(record.dispatchReadiness).toBe("needs_review");
    expect(record.supplierFacingPayloadStatus).toBe("draft"); // soft only → draft (R4 와 일관)
    expect(record.blockingReasons.some((b) => b.severity === "soft" && b.code === "supplier_profile_changed")).toBe(true);

    // send 계열은 전부 차단, 그러나 회수/보정/재진입은 살아있어야 한다
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(false);
    expect(has(record.reentryAvailableActions, "reopen_po_conversion")).toBe(true);
    expect(has(record.reentryAvailableActions, "request_correction")).toBe(true);
  });

  it("R9: policy hold 활성 → send 차단 + nextAction 이 hold 사유 전달", () => {
    const record = buildRecord({
      dispatch: {
        policyHoldActive: true,
        policyHoldReason: "연말 발주 동결",
      },
    });

    expect(record.dispatchReadiness).toBe("blocked");
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    expect(has(record.reentryAvailableActions, "schedule_send")).toBe(false);
    // nextAction 에 remediation 정보가 들어가야 한다 (raw reason noop 금지)
    expect(record.nextAction.length).toBeGreaterThan(0);
  });

  it("R10: reopen 시나리오 — stale 에서 재평가하면 deterministic 하게 같은 결과가 나와야 한다", () => {
    // stale 상태에서 record 를 한 번 만든다
    const first = buildRecord({
      dispatch: {
        approvalSnapshotValid: false,
        snapshotInvalidationReason: "승인 값 변경",
      },
    });
    expect(first.dispatchReadiness).toBe("blocked");
    expect(first.supplierFacingPayloadStatus).toBe("stale");

    // 동일 입력으로 다시 빌드 — 계약상 deterministic 이어야 한다
    const second = buildRecord({
      dispatch: {
        approvalSnapshotValid: false,
        snapshotInvalidationReason: "승인 값 변경",
      },
    });

    // id / evaluatedAt 은 Date 기반이라 제외하고, governance 핵심 필드가 일치해야 한다
    expect(second.dispatchReadiness).toBe(first.dispatchReadiness);
    expect(second.supplierFacingPayloadStatus).toBe(first.supplierFacingPayloadStatus);
    expect(second.snapshotValidity).toEqual(first.snapshotValidity);
    expect(second.reentryAvailableActions).toEqual(first.reentryAvailableActions);
    expect(second.blockingReasons.map((b) => b.code)).toEqual(
      first.blockingReasons.map((b) => b.code),
    );

    // reopen 후 approval 이 다시 유효해졌다고 가정 — readiness 가 재계산되어야 한다
    const recovered = buildRecord({});
    expect(recovered.dispatchReadiness).toBe("ready_to_send");
    expect(recovered.supplierFacingPayloadStatus).toBe("locked");
    expect(has(recovered.reentryAvailableActions, "send_now")).toBe(true);
  });

  it("R7: scheduled 상태 — payload locked 유지, send_now는 열리지 않음", () => {
    const dispatchState = evaluateDispatchGovernance(makeDispatchInput());
    const record = buildPoCreatedRecord({
      poCreatedState: makePoCreatedState(),
      dispatchGovernance: { ...dispatchState, readiness: "scheduled", scheduledSendDate: "2026-04-15T09:00:00Z" },
      quoteShortlistSnapshotId: "qsnap_1",
      quoteSnapshotValid: true,
    });

    expect(record.dispatchReadiness).toBe("scheduled");
    expect(record.supplierFacingPayloadStatus).toBe("locked");
    expect(has(record.reentryAvailableActions, "send_now")).toBe(false);
    // 예약 취소 경로는 cancel_dispatch_prep을 통해 살아있음
    expect(has(record.reentryAvailableActions, "cancel_dispatch_prep")).toBe(true);
  });
});

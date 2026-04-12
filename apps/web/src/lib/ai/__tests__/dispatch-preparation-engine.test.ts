/**
 * Dispatch Preparation Engine Tests
 *
 * DPE1-DPE16: 상태 초기화 → readiness → 검증 → 객체 생성 → 핸드오프
 */
import { describe, it, expect } from "vitest";
import {
  createInitialDispatchPrepState,
  buildDispatchPrepReadiness,
  validateDispatchPrepBeforeRecord,
  buildDispatchPreparationObject,
  buildSendConfirmationHandoff,
  type DispatchPreparationState,
  type DispatchRecipient,
  type OutboundPackageBasis,
} from "../dispatch-preparation-engine";
import type { DispatchPreparationHandoff } from "../po-created-engine";

// ── Helpers ──

function makeHealthyHandoff(overrides?: Partial<DispatchPreparationHandoff>): DispatchPreparationHandoff {
  return {
    poCreatedObjectId: "poobj_test_001",
    poConversionDraftObjectId: "draft_001",
    approvalDecisionObjectId: "appr_001",
    createdVendorIds: ["vendor_a"],
    createdLineCoverageSummary: "FBS 외 2건",
    commercialSummary: "단가 일치",
    operationalSummary: "납기 3일",
    dispatchReadiness: "ready",
    ...overrides,
  };
}

function makeValidRecipient(overrides?: Partial<DispatchRecipient>): DispatchRecipient {
  return {
    recipientId: "rcpt_vendor_a",
    displayName: "Vendor A",
    email: "a@vendor.com",
    role: "primary",
    channel: "email",
    isValid: true,
    ...overrides,
  };
}

function makeCompleteOutbound(overrides?: Partial<OutboundPackageBasis>): OutboundPackageBasis {
  return {
    supplierFacingNote: "주문 발송합니다",
    poSummary: "FBS 외 2건",
    deliveryReference: "DEL-001",
    paymentReference: "PAY-001",
    responseExpectation: "2일 내 회신",
    ...overrides,
  };
}

function makeHealthyState(overrides?: Partial<DispatchPreparationState>): DispatchPreparationState {
  return {
    dispatchPreparationStatus: "dispatch_preparation_open",
    substatus: "awaiting_recipient_review",
    dispatchPreparationOpenedAt: new Date().toISOString(),
    poCreatedObjectId: "poobj_test_001",
    createdVendorIds: ["vendor_a"],
    recipients: [makeValidRecipient()],
    outboundPackage: makeCompleteOutbound(),
    attachmentBundle: [{ attachmentId: "att_po", name: "PO 문서", type: "po_document", included: true }],
    missingFieldCount: 0,
    dispatchPreparationBlockedFlag: false,
    dispatchPreparationBlockedReason: null,
    dispatchPreparationObjectId: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Section 1: 상태 초기화
// ══════════════════════════════════════════════════════

describe("Dispatch Preparation Engine — Initialization", () => {
  it("DPE1: healthy handoff → open 상태 + recipients 생성", () => {
    const state = createInitialDispatchPrepState(makeHealthyHandoff());
    expect(state.dispatchPreparationStatus).toBe("dispatch_preparation_open");
    expect(state.substatus).toBe("awaiting_recipient_review");
    expect(state.recipients).toHaveLength(1);
    expect(state.recipients[0].role).toBe("primary");
    expect(state.recipients[0].isValid).toBe(false); // 초기값은 invalid
    expect(state.dispatchPreparationBlockedFlag).toBe(false);
  });

  it("DPE2: blocked handoff → blockedFlag=true", () => {
    const state = createInitialDispatchPrepState(
      makeHealthyHandoff({ dispatchReadiness: "blocked" }),
    );
    expect(state.dispatchPreparationBlockedFlag).toBe(true);
    expect(state.dispatchPreparationBlockedReason).toContain("미충족");
  });

  it("DPE3: 다중 vendor → 다중 recipient 생성", () => {
    const state = createInitialDispatchPrepState(
      makeHealthyHandoff({ createdVendorIds: ["v1", "v2", "v3"] }),
    );
    expect(state.recipients).toHaveLength(3);
    expect(state.recipients.map((r) => r.recipientId)).toEqual([
      "rcpt_v1", "rcpt_v2", "rcpt_v3",
    ]);
  });

  it("DPE4: PO 문서 첨부가 기본 포함", () => {
    const state = createInitialDispatchPrepState(makeHealthyHandoff());
    const poDoc = state.attachmentBundle.find((a) => a.type === "po_document");
    expect(poDoc).toBeDefined();
    expect(poDoc!.included).toBe(true);
  });

  it("DPE5: outboundPackage.poSummary에 handoff lineCoverage 전달", () => {
    const state = createInitialDispatchPrepState(
      makeHealthyHandoff({ createdLineCoverageSummary: "테스트 요약" }),
    );
    expect(state.outboundPackage.poSummary).toBe("테스트 요약");
  });
});

// ══════════════════════════════════════════════════════
// Section 2: Readiness 평가
// ══════════════════════════════════════════════════════

describe("Dispatch Preparation Engine — Readiness", () => {
  it("DPE6: 완전한 state → isSendReady=true, 빈 critical", () => {
    const r = buildDispatchPrepReadiness(makeHealthyState());
    expect(r.isSendReady).toBe(true);
    expect(r.sendCriticalMissing).toHaveLength(0);
  });

  it("DPE7: 주 수신자 없음 → critical 포함", () => {
    const r = buildDispatchPrepReadiness(makeHealthyState({ recipients: [] }));
    expect(r.isSendReady).toBe(false);
    expect(r.sendCriticalMissing.some((m) => m.includes("수신자"))).toBe(true);
  });

  it("DPE8: 수신자 isValid=false → critical '유효한 수신자'", () => {
    const r = buildDispatchPrepReadiness(
      makeHealthyState({ recipients: [makeValidRecipient({ isValid: false })] }),
    );
    expect(r.isSendReady).toBe(false);
    expect(r.sendCriticalMissing.some((m) => m.includes("유효한 수신자"))).toBe(true);
  });

  it("DPE9: supplierFacingNote + poSummary 둘 다 비어있으면 → critical '발송 내용'", () => {
    const r = buildDispatchPrepReadiness(
      makeHealthyState({
        outboundPackage: makeCompleteOutbound({ supplierFacingNote: "", poSummary: "" }),
      }),
    );
    expect(r.sendCriticalMissing.some((m) => m.includes("발송 내용"))).toBe(true);
  });

  it("DPE10: PO 문서 excluded → critical 'PO 문서 첨부'", () => {
    const r = buildDispatchPrepReadiness(
      makeHealthyState({
        attachmentBundle: [{ attachmentId: "att_po", name: "PO 문서", type: "po_document", included: false }],
      }),
    );
    expect(r.sendCriticalMissing.some((m) => m.includes("PO 문서"))).toBe(true);
  });

  it("DPE11: deliveryReference 없으면 → nonCritical '납품 참조'", () => {
    const r = buildDispatchPrepReadiness(
      makeHealthyState({
        outboundPackage: makeCompleteOutbound({ deliveryReference: "" }),
      }),
    );
    expect(r.isSendReady).toBe(true); // non-critical이라 send 가능
    expect(r.nonCriticalMissing.some((m) => m.includes("납품 참조"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// Section 3: 검증 (Validation)
// ══════════════════════════════════════════════════════

describe("Dispatch Preparation Engine — Validation", () => {
  it("DPE12: healthy state → canRecord=true, canSendConfirmation=true", () => {
    const v = validateDispatchPrepBeforeRecord(makeHealthyState());
    expect(v.canRecordDispatchPreparation).toBe(true);
    expect(v.canOpenSendConfirmation).toBe(true);
    expect(v.blockingIssues).toHaveLength(0);
  });

  it("DPE13: blockedFlag → canRecord=false", () => {
    const v = validateDispatchPrepBeforeRecord(
      makeHealthyState({
        dispatchPreparationBlockedFlag: true,
        dispatchPreparationBlockedReason: "차단 사유",
      }),
    );
    expect(v.canRecordDispatchPreparation).toBe(false);
    expect(v.blockingIssues).toContain("차단 사유");
  });

  it("DPE13b: canRecord=true이지만 critical missing → canSendConfirmation=false", () => {
    const v = validateDispatchPrepBeforeRecord(
      makeHealthyState({ recipients: [makeValidRecipient({ isValid: false })] }),
    );
    expect(v.canRecordDispatchPreparation).toBe(true);
    expect(v.canOpenSendConfirmation).toBe(false);
    expect(v.warnings.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════
// Section 4: Canonical Object + Handoff
// ══════════════════════════════════════════════════════

describe("Dispatch Preparation Engine — Object & Handoff", () => {
  it("DPE14: buildObject → primaryRecipient + sendChannel 존재", () => {
    const obj = buildDispatchPreparationObject(makeHealthyState());
    expect(obj.id).toBeTruthy();
    expect(obj.primaryRecipient).toBe("Vendor A");
    expect(obj.sendChannel).toBe("email");
    expect(obj.readinessSummary).toContain("완료");
    expect(obj.recordedBy).toBe("operator");
  });

  it("DPE14b: 수신자 없으면 primaryRecipient=미지정", () => {
    const obj = buildDispatchPreparationObject(makeHealthyState({ recipients: [] }));
    expect(obj.primaryRecipient).toBe("미지정");
  });

  it("DPE15: sendReady → handoff readiness=ready", () => {
    const obj = buildDispatchPreparationObject(makeHealthyState());
    const handoff = buildSendConfirmationHandoff(obj);
    expect(handoff.sendConfirmationReadiness).toBe("ready");
    expect(handoff.dispatchPreparationObjectId).toBe(obj.id);
  });

  it("DPE16: sendNotReady → handoff readiness=incomplete", () => {
    const obj = buildDispatchPreparationObject(
      makeHealthyState({ recipients: [makeValidRecipient({ isValid: false })] }),
    );
    const handoff = buildSendConfirmationHandoff(obj);
    expect(handoff.sendConfirmationReadiness).toBe("incomplete");
  });
});

// @ts-nocheck — vitest 미설치 환경에서 타입 체크 bypass
/**
 * Dispatch Send Precondition Guard — 단위 테스트
 *
 * Spec:
 *  P1  ready_to_send + 모든 valid → sendNow / scheduleSend 모두 allow
 *  P2  hardBlocker 존재 → 두 action 모두 차단
 *  P3  policy_hold_active hardBlocker → 두 action 모두 차단
 *  P4  approvalSnapshotValid=false → 두 action 모두 차단 (snapshot validity가 실제 blocker)
 *  P5  conversionSnapshotValid=false → 두 action 모두 차단
 *  P6  needs_review (soft blocker만) → schedule_send 만 허용, send_now 차단
 *  P7  state === null → 두 action 모두 차단 (미평가 = 미허가)
 *  P8  totalBlockerCount 불일치 → derived_state_corrupt 차단
 *  P9  deterministic — 동일 입력 → 동일 결과
 *  P10 isSendActionAllowed shorthand 가 evaluate 결과와 일치
 */

import { describe, it, expect } from "vitest";

import {
  evaluateDispatchSendPrecondition,
  isSendActionAllowed,
} from "../dispatch-send-precondition";
import type {
  DispatchPreparationGovernanceState,
  DispatchBlocker,
} from "@/lib/ai/po-dispatch-governance-engine";

function baseState(
  overrides: Partial<DispatchPreparationGovernanceState> = {},
): DispatchPreparationGovernanceState {
  const hard = overrides.hardBlockers ?? [];
  const soft = overrides.softBlockers ?? [];
  return {
    stateId: "test_state",
    caseId: "case_1",
    poNumber: "PO-1",
    readiness: "ready_to_send",
    hardBlockers: hard,
    softBlockers: soft,
    totalBlockerCount: hard.length + soft.length,
    approvalSnapshotValid: true,
    conversionSnapshotValid: true,
    snapshotInvalidationReason: "",
    supplierFacingPayloadComplete: true,
    supplierFacingPayloadDelta: [],
    lockedFields: [],
    editableFields: [],
    confirmationChecklist: [],
    allConfirmed: true,
    scheduledSendDate: null,
    evaluatedAt: "2026-04-14T00:00:00Z",
    evaluatedBy: "tester",
    ...overrides,
  };
}

const HARD_POLICY_HOLD: DispatchBlocker = {
  type: "policy_hold_active",
  severity: "hard",
  detail: "정책 보류 활성",
  remediationAction: "정책 보류 해제 요청",
};

const HARD_DOCS_MISSING: DispatchBlocker = {
  type: "required_document_missing",
  severity: "hard",
  detail: "필수 첨부서류 누락: COA",
  remediationAction: "서류 첨부",
};

const SOFT_BILLING: DispatchBlocker = {
  type: "billing_contact_incomplete",
  severity: "soft",
  detail: "청구 주소 미입력",
  remediationAction: "청구 주소 입력",
};

describe("evaluateDispatchSendPrecondition", () => {
  it("P1 — ready_to_send + 모든 valid → 두 action 모두 allow", () => {
    const r = evaluateDispatchSendPrecondition(baseState());
    expect(r.allowed).toBe(true);
    expect(r.sendNowAllowed).toBe(true);
    expect(r.scheduleSendAllowed).toBe(true);
    expect(r.blockReasons).toHaveLength(0);
    expect(r.summary).toBe("발송 가능");
  });

  it("P2 — hardBlocker 존재 → 두 action 모두 차단", () => {
    const r = evaluateDispatchSendPrecondition(
      baseState({ readiness: "blocked", hardBlockers: [HARD_DOCS_MISSING] }),
    );
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(false);
    expect(r.blockReasons.some((b) => b.code === "required_document_missing")).toBe(true);
  });

  it("P3 — policy_hold_active → 두 action 모두 차단", () => {
    const r = evaluateDispatchSendPrecondition(
      baseState({ readiness: "blocked", hardBlockers: [HARD_POLICY_HOLD] }),
    );
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(false);
    expect(r.blockReasons.some((b) => b.code === "policy_hold_active")).toBe(true);
  });

  it("P4 — approvalSnapshotValid=false → 두 action 모두 차단", () => {
    const r = evaluateDispatchSendPrecondition(
      baseState({
        readiness: "blocked",
        approvalSnapshotValid: false,
        snapshotInvalidationReason: "승인 변경됨",
      }),
    );
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(false);
    expect(r.blockReasons.some((b) => b.code === "approval_snapshot_invalid")).toBe(true);
  });

  it("P5 — conversionSnapshotValid=false → 두 action 모두 차단", () => {
    const r = evaluateDispatchSendPrecondition(
      baseState({ readiness: "blocked", conversionSnapshotValid: false }),
    );
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(false);
    expect(r.blockReasons.some((b) => b.code === "conversion_snapshot_invalid")).toBe(true);
  });

  it("P6 — needs_review (soft blocker만) → schedule_send 만 허용, send_now 차단", () => {
    const r = evaluateDispatchSendPrecondition(
      baseState({ readiness: "needs_review", softBlockers: [SOFT_BILLING] }),
    );
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(true);
    expect(r.summary).toBe("예약 발송만 가능 (즉시 발송 잠김)");
  });

  it("P7 — state === null → 두 action 모두 차단 (미평가 = 미허가)", () => {
    const r = evaluateDispatchSendPrecondition(null);
    expect(r.allowed).toBe(false);
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(false);
    expect(r.blockReasons[0].code).toBe("readiness_not_send_ready");
  });

  it("P8 — totalBlockerCount 불일치 → derived_state_corrupt", () => {
    const r = evaluateDispatchSendPrecondition(
      baseState({
        hardBlockers: [],
        softBlockers: [],
        totalBlockerCount: 7, // 의도적 부패
      }),
    );
    expect(r.blockReasons.some((b) => b.code === "derived_state_corrupt")).toBe(true);
    expect(r.sendNowAllowed).toBe(false);
    expect(r.scheduleSendAllowed).toBe(false);
  });

  it("P9 — deterministic", () => {
    const s = baseState({ readiness: "blocked", hardBlockers: [HARD_POLICY_HOLD] });
    const a = evaluateDispatchSendPrecondition(s);
    const b = evaluateDispatchSendPrecondition(s);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("P10 — isSendActionAllowed shorthand 일치", () => {
    const ok = baseState();
    expect(isSendActionAllowed(ok, "send_now")).toBe(true);
    expect(isSendActionAllowed(ok, "schedule_send")).toBe(true);

    const blocked = baseState({ readiness: "blocked", hardBlockers: [HARD_POLICY_HOLD] });
    expect(isSendActionAllowed(blocked, "send_now")).toBe(false);
    expect(isSendActionAllowed(blocked, "schedule_send")).toBe(false);
  });
});

/**
 * PO Created Re-entry Engine Tests
 *
 * PCRE1-PCRE14: 상태 초기화 → 검증 → 의사결정 → 객체 생성 → 핸드오프
 */
import { describe, it, expect } from "vitest";
import {
  createInitialPoCreatedReentryState,
  validatePoCreatedReentryBeforeRecord,
  buildPoCreatedReentryDecisionOptions,
  buildPoCreatedReentryObject,
  buildDispatchPreparationReentryHandoff,
  type PoCreatedReentryState,
} from "../po-created-reentry-engine";
import type { PoCreatedReentryHandoff } from "../po-conversion-reentry-engine";

// ── Helpers ──

function makeHealthyHandoff(overrides?: Partial<PoCreatedReentryHandoff>): PoCreatedReentryHandoff {
  return {
    poConversionReentryDraftObjectId: "pcrdo_test_001",
    approvedCandidateIds: ["cand_001", "cand_002"],
    lockedApprovalFieldSummary: "all locked",
    operationalDeltaSummary: "no delta",
    poCreatedReentryReadiness: "ready",
    ...overrides,
  };
}

function makeHealthyState(overrides?: Partial<PoCreatedReentryState>): PoCreatedReentryState {
  return {
    poCreatedReentryStatus: "po_created_reentry_open",
    substatus: "awaiting_regenerated_identity_review",
    poCreatedReentryOpenedAt: new Date().toISOString(),
    poConversionReentryDraftObjectId: "pcrdo_test_001",
    approvedCandidateIds: ["cand_001"],
    regeneratedPoId: "PO-RE-TEST",
    previousCreatedOverlapCount: 0,
    createdHeaderDeltaStatus: "reviewed",
    createdLineDeltaStatus: "reviewed",
    operationalCarryForwardStatus: "reviewed",
    sendCriticalReadinessStatus: "ready",
    missingDecisionCount: 0,
    poCreatedReentryBlockedFlag: false,
    poCreatedReentryBlockedReason: null,
    poCreatedReentryObjectId: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// Section 1: 상태 초기화
// ══════════════════════════════════════════════════════

describe("PO Created Re-entry Engine — Initialization", () => {
  it("PCRE1: healthy handoff → open 상태 + pending deltas", () => {
    const state = createInitialPoCreatedReentryState(makeHealthyHandoff());
    expect(state.poCreatedReentryStatus).toBe("po_created_reentry_open");
    expect(state.substatus).toBe("awaiting_regenerated_identity_review");
    expect(state.createdHeaderDeltaStatus).toBe("pending");
    expect(state.createdLineDeltaStatus).toBe("pending");
    expect(state.operationalCarryForwardStatus).toBe("pending");
    expect(state.missingDecisionCount).toBe(3);
    expect(state.poCreatedReentryBlockedFlag).toBe(false);
  });

  it("PCRE2: blocked handoff → blockedFlag=true", () => {
    const state = createInitialPoCreatedReentryState(
      makeHealthyHandoff({ poCreatedReentryReadiness: "blocked" }),
    );
    expect(state.poCreatedReentryBlockedFlag).toBe(true);
    expect(state.poCreatedReentryBlockedReason).toContain("미충족");
  });

  it("PCRE3: regeneratedPoId는 PO-RE- 접두사를 가짐", () => {
    const state = createInitialPoCreatedReentryState(makeHealthyHandoff());
    expect(state.regeneratedPoId).toMatch(/^PO-RE-/);
  });

  it("PCRE4: approvedCandidateIds가 handoff에서 전달됨", () => {
    const handoff = makeHealthyHandoff({ approvedCandidateIds: ["a", "b", "c"] });
    const state = createInitialPoCreatedReentryState(handoff);
    expect(state.approvedCandidateIds).toEqual(["a", "b", "c"]);
  });
});

// ══════════════════════════════════════════════════════
// Section 2: 검증 (Validation)
// ══════════════════════════════════════════════════════

describe("PO Created Re-entry Engine — Validation", () => {
  it("PCRE5: healthy state → canRecord=true, canDispatch=true", () => {
    const v = validatePoCreatedReentryBeforeRecord(makeHealthyState());
    expect(v.canRecordPoCreatedReentry).toBe(true);
    expect(v.canOpenDispatchPreparationReentry).toBe(true);
    expect(v.blockingIssues).toHaveLength(0);
  });

  it("PCRE6: blockedFlag → canRecord=false, blocking reason 포함", () => {
    const v = validatePoCreatedReentryBeforeRecord(
      makeHealthyState({ poCreatedReentryBlockedFlag: true, poCreatedReentryBlockedReason: "테스트 차단" }),
    );
    expect(v.canRecordPoCreatedReentry).toBe(false);
    expect(v.blockingIssues).toContain("테스트 차단");
  });

  it("PCRE7: 빈 approvedCandidateIds → hard blocker", () => {
    const v = validatePoCreatedReentryBeforeRecord(
      makeHealthyState({ approvedCandidateIds: [] }),
    );
    expect(v.canRecordPoCreatedReentry).toBe(false);
    expect(v.blockingIssues.some((b) => b.includes("후보 없음"))).toBe(true);
  });

  it("PCRE8: header delta blocked → hard blocker", () => {
    const v = validatePoCreatedReentryBeforeRecord(
      makeHealthyState({ createdHeaderDeltaStatus: "blocked" }),
    );
    expect(v.canRecordPoCreatedReentry).toBe(false);
    expect(v.blockingIssues.some((b) => b.includes("Header delta"))).toBe(true);
  });

  it("PCRE9: pending deltas → warnings + missing items (soft, not blocking)", () => {
    const v = validatePoCreatedReentryBeforeRecord(
      makeHealthyState({
        createdHeaderDeltaStatus: "pending",
        createdLineDeltaStatus: "pending",
        operationalCarryForwardStatus: "pending",
      }),
    );
    expect(v.canRecordPoCreatedReentry).toBe(true);
    expect(v.warnings.length).toBeGreaterThanOrEqual(3);
    expect(v.missingItems.length).toBeGreaterThanOrEqual(3);
  });

  it("PCRE10: sendCritical=incomplete → canRecord=true, canDispatch=false", () => {
    const v = validatePoCreatedReentryBeforeRecord(
      makeHealthyState({ sendCriticalReadinessStatus: "incomplete" }),
    );
    expect(v.canRecordPoCreatedReentry).toBe(true);
    expect(v.canOpenDispatchPreparationReentry).toBe(false);
  });

  it("PCRE11: previousCreatedOverlapCount > 0 → warning (soft)", () => {
    const v = validatePoCreatedReentryBeforeRecord(
      makeHealthyState({ previousCreatedOverlapCount: 2 }),
    );
    expect(v.canRecordPoCreatedReentry).toBe(true);
    expect(v.warnings.some((w) => w.includes("overlap"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// Section 3: 의사결정 옵션 (Decision Options)
// ══════════════════════════════════════════════════════

describe("PO Created Re-entry Engine — Decision Options", () => {
  it("PCRE12: healthy → record + dispatch 가능, hold=false, return=true", () => {
    const opts = buildPoCreatedReentryDecisionOptions(makeHealthyState());
    expect(opts.canRecordCreated).toBe(true);
    expect(opts.canOpenDispatchPreparationReentry).toBe(true);
    expect(opts.canHold).toBe(false);
    expect(opts.canReturnPoConversionReentry).toBe(true);
  });

  it("PCRE12b: pending items → canHold=true", () => {
    const opts = buildPoCreatedReentryDecisionOptions(
      makeHealthyState({ createdHeaderDeltaStatus: "pending" }),
    );
    expect(opts.canHold).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// Section 4: Canonical Object + Handoff
// ══════════════════════════════════════════════════════

describe("PO Created Re-entry Engine — Object & Handoff", () => {
  it("PCRE13: buildObject → 필수 필드 존재 + overlap 요약", () => {
    const obj = buildPoCreatedReentryObject(makeHealthyState());
    expect(obj.id).toBeTruthy();
    expect(obj.regeneratedPoIdentitySummary).toBe("PO-RE-TEST");
    expect(obj.previousCreatedOverlapSummary).toBe("충돌 없음");
    expect(obj.recordedBy).toBe("operator");
  });

  it("PCRE13b: overlap > 0 → 충돌 있음 요약", () => {
    const obj = buildPoCreatedReentryObject(
      makeHealthyState({ previousCreatedOverlapCount: 1 }),
    );
    expect(obj.previousCreatedOverlapSummary).toBe("충돌 있음");
  });

  it("PCRE14: handoff → sendCritical ready → dispatchPreparationReentryReadiness=ready", () => {
    const obj = buildPoCreatedReentryObject(makeHealthyState());
    const handoff = buildDispatchPreparationReentryHandoff(obj);
    expect(handoff.poCreatedReentryObjectId).toBe(obj.id);
    expect(handoff.dispatchPreparationReentryReadiness).toBe("ready");
  });

  it("PCRE14b: handoff → sendCritical incomplete → readiness=pending", () => {
    const obj = buildPoCreatedReentryObject(
      makeHealthyState({ sendCriticalReadinessStatus: "incomplete" }),
    );
    const handoff = buildDispatchPreparationReentryHandoff(obj);
    expect(handoff.dispatchPreparationReentryReadiness).toBe("pending");
  });
});

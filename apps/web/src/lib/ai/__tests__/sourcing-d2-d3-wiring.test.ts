// @ts-nocheck — vitest/jest 미설치 환경에서 타입 체크 bypass
/**
 * D-2 / D-3 Wiring Regression Tests
 *
 * Covers:
 * - D-2  adaptComparisonHandoffToRequestSeed (smart-sourcing → request assembly)
 * - D-3  request_submission_executed / request_submission_handed_off_to_workqueue
 *        publish + targeted invalidation rules
 *
 * 규칙:
 * - canonical truth(QuoteComparisonHandoff)는 mutate 되지 않아야 함.
 * - 신규 두 이벤트는 quote_chain domain 안의 sub-event이며, 새 GovernanceDomain
 *   값을 추가하지 않아야 함 (contract drift 방지).
 * - invalidation rule 은 surface_only / state_transition_check 범위로 제한.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  adaptComparisonHandoffToRequestSeed,
  buildQuoteComparisonHandoff,
  selectVendorInHandoff,
  executeHandoffToRequest,
} from "../smart-sourcing-handoff-engine";
import {
  emitRequestSubmissionExecuted,
  emitRequestSubmissionHandedOffToWorkqueue,
  resetSmartSourcingEventBus,
  subscribeSmartSourcingEvents,
} from "../smart-sourcing-invalidation";
import {
  GOVERNANCE_INVALIDATION_RULES,
  resolveInvalidation,
  createGovernanceEvent,
} from "../governance-event-bus";

// ──────────────────────────────────────────────────────────────────────────────
// D-2: adapter unit tests
// ──────────────────────────────────────────────────────────────────────────────
describe("D-2 adaptComparisonHandoffToRequestSeed", () => {
  function buildSelectedHandoff() {
    const built = buildQuoteComparisonHandoff(
      "Anti-CD3 antibody",
      10,
      [
        { vendor: "Sigma", price: 250000, leadTime: "5일", shippingFee: 0 },
        { vendor: "Thermo", price: 240000, leadTime: "1주", shippingFee: 5000 },
        { vendor: "Abcam", price: 280000, leadTime: "3일", shippingFee: 0 },
      ],
      "Sigma 권장 — 가성비 균형",
      "Thermo 가격 인하 협상 가능",
    );
    const selected = selectVendorInHandoff(built, "Sigma", "리드타임/가격 균형");
    return executeHandoffToRequest(selected);
  }

  it("synthesizes a request handoff with one product id matching the synthetic product", () => {
    const handoff = buildSelectedHandoff();
    const seed = adaptComparisonHandoffToRequestSeed(handoff);

    expect(seed.requestHandoff.requestCandidateIds).toHaveLength(1);
    expect(seed.syntheticProducts).toHaveLength(1);
    expect(seed.syntheticProducts[0].id).toBe(seed.requestHandoff.requestCandidateIds[0]);
    expect(seed.syntheticProducts[0].name).toBe("Anti-CD3 antibody");
    expect(seed.syntheticQuoteItems[0].productId).toBe(seed.requestHandoff.requestCandidateIds[0]);
    expect(seed.syntheticQuoteItems[0].quantity).toBe(10);
  });

  it("places the recommended vendor first in the synthetic vendor list", () => {
    const handoff = buildSelectedHandoff();
    const seed = adaptComparisonHandoffToRequestSeed(handoff);

    expect(seed.syntheticProducts[0].vendors[0].vendor.name).toBe("Sigma");
  });

  it("does not mutate the canonical comparison handoff", () => {
    const handoff = buildSelectedHandoff();
    const before = JSON.stringify(handoff);
    adaptComparisonHandoffToRequestSeed(handoff);
    expect(JSON.stringify(handoff)).toBe(before);
  });

  it("excludes vendors with null price from synthetic vendor list", () => {
    const built = buildQuoteComparisonHandoff(
      "Test reagent",
      5,
      [
        { vendor: "A", price: 100, leadTime: "3일", shippingFee: 0 },
        { vendor: "B", price: "문의", leadTime: "5일", shippingFee: 0 },
      ],
      "",
      "",
    );
    const selected = selectVendorInHandoff(built, "A", "");
    const handoff = executeHandoffToRequest(selected);
    const seed = adaptComparisonHandoffToRequestSeed(handoff);
    expect(seed.syntheticProducts[0].vendors).toHaveLength(1);
    expect(seed.syntheticProducts[0].vendors[0].vendor.name).toBe("A");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// D-3: governance event publish + invalidation rules
// ──────────────────────────────────────────────────────────────────────────────
describe("D-3 request_submission lifecycle events", () => {
  beforeEach(() => {
    resetSmartSourcingEventBus();
  });

  it("emitRequestSubmissionExecuted publishes a quote_chain event with payload metadata", () => {
    const received: unknown[] = [];
    const unsub = subscribeSmartSourcingEvents((event) => received.push(event), {
      eventTypes: ["request_submission_executed"],
    });

    const event = emitRequestSubmissionExecuted("qch_test_1", 3, 7, "rsub_abc");

    expect(event.domain).toBe("quote_chain");
    expect(event.eventType).toBe("request_submission_executed");
    expect(event.payload).toMatchObject({
      vendorTargetCount: 3,
      lineCount: 7,
      submissionEventId: "rsub_abc",
    });
    expect(received).toHaveLength(1);
    unsub();
  });

  it("emitRequestSubmissionHandedOffToWorkqueue publishes the handoff event", () => {
    const event = emitRequestSubmissionHandedOffToWorkqueue(
      "qch_test_1",
      "rsub_abc",
      "2026-04-09T00:00:00.000Z",
    );
    expect(event.domain).toBe("quote_chain");
    expect(event.eventType).toBe("request_submission_handed_off_to_workqueue");
  });

  it("invalidation rule for request_submission_executed targets quote_review surface_only", () => {
    const evt = createGovernanceEvent("quote_chain", "request_submission_executed", {
      caseId: "qch_test_1",
      poNumber: "",
      fromStatus: "request_draft_recorded",
      toStatus: "request_submission_executed",
      actor: "test",
      detail: "",
    });
    const result = resolveInvalidation(evt);
    expect(result.hasInvalidation).toBe(true);
    expect(result.invalidatedTargets.some(
      (t) => t.targetDomain === "quote_chain" && t.targetStage === "quote_review" && t.scope === "surface_only",
    )).toBe(true);
  });

  it("invalidation rule for request_submission_handed_off_to_workqueue uses state_transition_check scope", () => {
    const evt = createGovernanceEvent("quote_chain", "request_submission_handed_off_to_workqueue", {
      caseId: "qch_test_1",
      poNumber: "",
      fromStatus: "request_submission_executed",
      toStatus: "handed_off_to_quote_workqueue",
      actor: "test",
      detail: "",
    });
    const result = resolveInvalidation(evt);
    expect(result.hasInvalidation).toBe(true);
    expect(result.invalidatedTargets.some(
      (t) => t.targetDomain === "quote_chain" && t.scope === "state_transition_check",
    )).toBe(true);
  });

  it("does NOT introduce a new GovernanceDomain — both events stay under quote_chain", () => {
    const submissionRule = GOVERNANCE_INVALIDATION_RULES.find(
      (r) => r.sourceEventTypes.includes("request_submission_executed"),
    );
    const handoffRule = GOVERNANCE_INVALIDATION_RULES.find(
      (r) => r.sourceEventTypes.includes("request_submission_handed_off_to_workqueue"),
    );
    expect(submissionRule?.sourceDomain).toBe("quote_chain");
    expect(handoffRule?.sourceDomain).toBe("quote_chain");
  });
});

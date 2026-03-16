/**
 * Tests for compare-queue-semantics — pure function tests
 */
import {
  determineCompareSubstatus,
  isCompareTerminal,
  isCompareSubstatus,
  isSlaBreach,
  isStale,
  determineResolutionPath,
  COMPARE_SUBSTATUS_DEFS,
  COMPARE_CTA_MAP,
  COMPARE_REPORT_LABELS,
  COMPARE_ESCALATION_RULES,
  RESOLUTION_PATH_LABELS,
} from "@/lib/work-queue/compare-queue-semantics";

// ── determineCompareSubstatus ──

describe("determineCompareSubstatus", () => {
  it("returns compare_decision_pending when no inquiry/quotes and not reopened", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [],
      linkedQuoteStatuses: [],
      isReopened: false,
    });
    expect(result).toBe("compare_decision_pending");
  });

  it("returns compare_reopened when isReopened is true", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [],
      linkedQuoteStatuses: [],
      isReopened: true,
    });
    expect(result).toBe("compare_reopened");
  });

  it("returns compare_reopened even when quotes/inquiries exist (reopened takes priority)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [{ status: "GENERATED" }],
      linkedQuoteStatuses: ["PENDING"],
      isReopened: true,
    });
    expect(result).toBe("compare_reopened");
  });

  it("returns compare_quote_in_progress for active quote (PENDING)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [],
      linkedQuoteStatuses: ["PENDING"],
      isReopened: false,
    });
    expect(result).toBe("compare_quote_in_progress");
  });

  it("returns compare_quote_in_progress for active quote (SENT)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [{ status: "GENERATED" }],
      linkedQuoteStatuses: ["SENT"],
      isReopened: false,
    });
    // Quote takes priority over inquiry
    expect(result).toBe("compare_quote_in_progress");
  });

  it("returns compare_inquiry_followup for active inquiry (GENERATED)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [{ status: "GENERATED" }],
      linkedQuoteStatuses: [],
      isReopened: false,
    });
    expect(result).toBe("compare_inquiry_followup");
  });

  it("returns compare_inquiry_followup for active inquiry (COPIED)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [{ status: "COPIED" }],
      linkedQuoteStatuses: [],
      isReopened: false,
    });
    expect(result).toBe("compare_inquiry_followup");
  });

  it("returns compare_decision_pending when inquiry is SENT (no longer active)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [{ status: "SENT" }],
      linkedQuoteStatuses: [],
      isReopened: false,
    });
    expect(result).toBe("compare_decision_pending");
  });

  it("returns compare_decision_pending when quote is COMPLETED (no longer active)", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [],
      linkedQuoteStatuses: ["COMPLETED"],
      isReopened: false,
    });
    expect(result).toBe("compare_decision_pending");
  });

  it("quote priority beats inquiry when both are active", () => {
    const result = determineCompareSubstatus({
      inquiryDrafts: [{ status: "GENERATED" }],
      linkedQuoteStatuses: ["PENDING"],
      isReopened: false,
    });
    expect(result).toBe("compare_quote_in_progress");
  });
});

// ── isCompareTerminal ──

describe("isCompareTerminal", () => {
  it("returns true for compare_decided", () => {
    expect(isCompareTerminal("compare_decided")).toBe(true);
  });

  it("returns false for non-terminal substatuses", () => {
    expect(isCompareTerminal("compare_decision_pending")).toBe(false);
    expect(isCompareTerminal("compare_inquiry_followup")).toBe(false);
    expect(isCompareTerminal("compare_quote_in_progress")).toBe(false);
    expect(isCompareTerminal("compare_reopened")).toBe(false);
  });

  it("returns false for unknown substatus", () => {
    expect(isCompareTerminal("unknown_status")).toBe(false);
  });
});

// ── isCompareSubstatus ──

describe("isCompareSubstatus", () => {
  it("returns true for all defined compare substatuses", () => {
    expect(isCompareSubstatus("compare_decision_pending")).toBe(true);
    expect(isCompareSubstatus("compare_inquiry_followup")).toBe(true);
    expect(isCompareSubstatus("compare_quote_in_progress")).toBe(true);
    expect(isCompareSubstatus("compare_decided")).toBe(true);
    expect(isCompareSubstatus("compare_reopened")).toBe(true);
  });

  it("returns false for non-compare substatuses", () => {
    expect(isCompareSubstatus("quote_draft_generated")).toBe(false);
    expect(isCompareSubstatus("unknown")).toBe(false);
  });
});

// ── COMPARE_SUBSTATUS_DEFS consistency ──

describe("COMPARE_SUBSTATUS_DEFS", () => {
  it("has exactly 5 entries", () => {
    expect(Object.keys(COMPARE_SUBSTATUS_DEFS)).toHaveLength(5);
  });

  it("all entries have required fields including escalation", () => {
    for (const [key, def] of Object.entries(COMPARE_SUBSTATUS_DEFS)) {
      expect(def.substatus).toBe(key);
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.taskStatus).toBeTruthy();
      expect(def.approvalStatus).toBeTruthy();
      expect(typeof def.isTerminal).toBe("boolean");
      expect(def.activityType).toBeTruthy();
      expect(typeof def.escalationMeaning).toBe("string");
      expect(typeof def.scoringBoostOnBreach).toBe("number");
      expect(["always", "on_breach", "never"]).toContain(def.dashboardVisibility);
    }
  });

  it("only compare_decided is terminal", () => {
    const terminals = Object.values(COMPARE_SUBSTATUS_DEFS).filter((d) => d.isTerminal);
    expect(terminals).toHaveLength(1);
    expect(terminals[0].substatus).toBe("compare_decided");
  });
});

// ── COMPARE_CTA_MAP consistency ──

describe("COMPARE_CTA_MAP", () => {
  it("has entries for all non-terminal substatuses", () => {
    const nonTerminal = Object.values(COMPARE_SUBSTATUS_DEFS).filter((d) => !d.isTerminal);
    for (const def of nonTerminal) {
      expect(COMPARE_CTA_MAP[def.substatus]).toBeDefined();
      expect(COMPARE_CTA_MAP[def.substatus].label).toBeTruthy();
    }
  });

  it("does not have entry for terminal substatus", () => {
    expect(COMPARE_CTA_MAP["compare_decided"]).toBeUndefined();
  });
});

// ── isSlaBreach ──

describe("isSlaBreach", () => {
  it("returns true when ageDays >= slaWarningDays for non-terminal", () => {
    expect(isSlaBreach("compare_decision_pending", 7)).toBe(true);
    expect(isSlaBreach("compare_decision_pending", 10)).toBe(true);
    expect(isSlaBreach("compare_inquiry_followup", 5)).toBe(true);
    expect(isSlaBreach("compare_quote_in_progress", 10)).toBe(true);
    expect(isSlaBreach("compare_reopened", 3)).toBe(true);
  });

  it("returns false when ageDays < slaWarningDays", () => {
    expect(isSlaBreach("compare_decision_pending", 6)).toBe(false);
    expect(isSlaBreach("compare_inquiry_followup", 4)).toBe(false);
    expect(isSlaBreach("compare_reopened", 2)).toBe(false);
  });

  it("returns false for terminal substatus", () => {
    expect(isSlaBreach("compare_decided", 100)).toBe(false);
  });

  it("returns false for unknown substatus", () => {
    expect(isSlaBreach("unknown", 100)).toBe(false);
  });
});

// ── isStale ──

describe("isStale", () => {
  it("returns true when ageDays >= staleDays", () => {
    expect(isStale("compare_decision_pending", 30)).toBe(true);
    expect(isStale("compare_decision_pending", 31)).toBe(true);
  });

  it("returns false when ageDays < staleDays", () => {
    expect(isStale("compare_decision_pending", 29)).toBe(false);
  });

  it("returns false for terminal substatus", () => {
    expect(isStale("compare_decided", 100)).toBe(false);
  });
});

// ── determineResolutionPath ──

describe("determineResolutionPath", () => {
  it("returns direct_decision when no quote/inquiry", () => {
    expect(determineResolutionPath({ hasLinkedQuote: false, hasInquiryDraft: false, isReopened: false }))
      .toBe("direct_decision");
  });

  it("returns via_inquiry when has inquiry only", () => {
    expect(determineResolutionPath({ hasLinkedQuote: false, hasInquiryDraft: true, isReopened: false }))
      .toBe("via_inquiry");
  });

  it("returns via_quote when has quote only", () => {
    expect(determineResolutionPath({ hasLinkedQuote: true, hasInquiryDraft: false, isReopened: false }))
      .toBe("via_quote");
  });

  it("returns via_inquiry_and_quote when both exist", () => {
    expect(determineResolutionPath({ hasLinkedQuote: true, hasInquiryDraft: true, isReopened: false }))
      .toBe("via_inquiry_and_quote");
  });

  it("returns reopened_then_decided when isReopened (takes priority)", () => {
    expect(determineResolutionPath({ hasLinkedQuote: true, hasInquiryDraft: true, isReopened: true }))
      .toBe("reopened_then_decided");
  });
});

// ── RESOLUTION_PATH_LABELS ──

describe("RESOLUTION_PATH_LABELS", () => {
  it("has labels for all 5 resolution paths", () => {
    expect(Object.keys(RESOLUTION_PATH_LABELS)).toHaveLength(5);
    for (const label of Object.values(RESOLUTION_PATH_LABELS)) {
      expect(label).toBeTruthy();
    }
  });
});

// ── COMPARE_REPORT_LABELS ──

describe("COMPARE_REPORT_LABELS", () => {
  it("has exactly 5 metric labels", () => {
    expect(Object.keys(COMPARE_REPORT_LABELS)).toHaveLength(5);
  });
});

// ── COMPARE_ESCALATION_RULES ──

describe("COMPARE_ESCALATION_RULES", () => {
  it("has exactly 3 escalation rules", () => {
    expect(Object.keys(COMPARE_ESCALATION_RULES)).toHaveLength(3);
  });

  it("all rules have required fields", () => {
    for (const rule of Object.values(COMPARE_ESCALATION_RULES)) {
      expect(rule.condition).toBeTruthy();
      expect(rule.label).toBeTruthy();
      expect(rule.reportLabel).toBeTruthy();
    }
  });
});

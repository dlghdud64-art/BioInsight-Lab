/**
 * Operational Queue Semantics Tests
 *
 * ops-queue-semantics.ts의 정의·헬퍼·퍼널·핸드오프 규칙 검증.
 */

import {
  OPS_SUBSTATUS_DEFS,
  OPS_HANDOFF_RULES,
  OPS_FUNNEL_STAGES,
  OPS_STALL_LABELS,
  OPS_ACTIVITY_LABELS,
  getOpsStage,
  isOpsTerminal,
  isOpsSubstatus,
  isOpsSlaBreach,
  isOpsStale,
  determineOpsStallPoint,
  type OpsStallPoint,
} from "@/lib/work-queue/ops-queue-semantics";

// ── 1. OPS_SUBSTATUS_DEFS covers all ops substatuses ──

describe("OPS_SUBSTATUS_DEFS", () => {
  const expectedOpsSubstatuses = [
    // Quote
    "quote_draft_generated", "quote_draft_approved", "quote_draft_dismissed",
    "vendor_email_generated", "vendor_email_approved", "email_sent",
    "vendor_reply_received", "quote_completed",
    // Order
    "followup_draft_generated", "followup_approved", "followup_sent",
    "status_change_proposed", "status_change_approved", "vendor_response_parsed",
    "purchase_request_created",
    // Receiving
    "restock_suggested", "restock_approved", "restock_ordered",
    // Inventory
    "restock_completed", "expiry_alert_created", "expiry_acknowledged",
  ];

  test("covers all non-compare/non-common substatuses from state-mapper", () => {
    for (const substatus of expectedOpsSubstatuses) {
      expect(OPS_SUBSTATUS_DEFS[substatus]).toBeDefined();
    }
    expect(Object.keys(OPS_SUBSTATUS_DEFS).length).toBe(expectedOpsSubstatuses.length);
  });

  test("all entries have non-empty label, description, cta (non-terminal), stage", () => {
    for (const [key, def] of Object.entries(OPS_SUBSTATUS_DEFS)) {
      expect(def.substatus).toBe(key);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(["quote", "order", "receiving", "inventory"]).toContain(def.stage);
      if (!def.isTerminal) {
        expect(def.cta.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── 2. getOpsStage ──

describe("getOpsStage", () => {
  test("returns correct stage for each substatus", () => {
    expect(getOpsStage("quote_draft_generated")).toBe("quote");
    expect(getOpsStage("email_sent")).toBe("quote");
    expect(getOpsStage("followup_draft_generated")).toBe("order");
    expect(getOpsStage("status_change_proposed")).toBe("order");
    expect(getOpsStage("restock_suggested")).toBe("receiving");
    expect(getOpsStage("restock_ordered")).toBe("receiving");
    expect(getOpsStage("expiry_alert_created")).toBe("inventory");
    expect(getOpsStage("restock_completed")).toBe("inventory");
    // Non-ops substatus
    expect(getOpsStage("compare_decision_pending")).toBeNull();
    expect(getOpsStage("unknown")).toBeNull();
  });
});

// ── 3. isOpsTerminal ──

describe("isOpsTerminal", () => {
  test("identifies terminal substatuses correctly", () => {
    expect(isOpsTerminal("quote_completed")).toBe(true);
    expect(isOpsTerminal("quote_draft_dismissed")).toBe(true);
    expect(isOpsTerminal("status_change_approved")).toBe(true);
    expect(isOpsTerminal("restock_completed")).toBe(true);
    expect(isOpsTerminal("expiry_acknowledged")).toBe(true);
    // Non-terminal
    expect(isOpsTerminal("quote_draft_generated")).toBe(false);
    expect(isOpsTerminal("restock_suggested")).toBe(false);
    expect(isOpsTerminal("expiry_alert_created")).toBe(false);
  });
});

// ── 4. isOpsSubstatus ──

describe("isOpsSubstatus", () => {
  test("true for ops, false for compare/common/unknown", () => {
    expect(isOpsSubstatus("quote_draft_generated")).toBe(true);
    expect(isOpsSubstatus("restock_ordered")).toBe(true);
    expect(isOpsSubstatus("expiry_alert_created")).toBe(true);
    // Compare substatus
    expect(isOpsSubstatus("compare_decision_pending")).toBe(false);
    expect(isOpsSubstatus("compare_decided")).toBe(false);
    // Common substatus
    expect(isOpsSubstatus("execution_failed")).toBe(false);
    // Unknown
    expect(isOpsSubstatus("nonexistent")).toBe(false);
  });
});

// ── 5. isOpsSlaBreach ──

describe("isOpsSlaBreach", () => {
  test("detects breach when age >= slaWarningDays", () => {
    // quote_draft_generated: SLA 3d
    expect(isOpsSlaBreach("quote_draft_generated", 3)).toBe(true);
    expect(isOpsSlaBreach("quote_draft_generated", 5)).toBe(true);
    expect(isOpsSlaBreach("quote_draft_generated", 2)).toBe(false);
    // restock_ordered: SLA 10d
    expect(isOpsSlaBreach("restock_ordered", 10)).toBe(true);
    expect(isOpsSlaBreach("restock_ordered", 9)).toBe(false);
    // Terminal substatus — never breached
    expect(isOpsSlaBreach("quote_completed", 100)).toBe(false);
    // Non-ops substatus
    expect(isOpsSlaBreach("compare_decision_pending", 100)).toBe(false);
  });
});

// ── 6. isOpsStale ──

describe("isOpsStale", () => {
  test("detects stale when age >= staleDays", () => {
    // quote_draft_generated: stale 14d
    expect(isOpsStale("quote_draft_generated", 14)).toBe(true);
    expect(isOpsStale("quote_draft_generated", 13)).toBe(false);
    // email_sent: stale 30d
    expect(isOpsStale("email_sent", 30)).toBe(true);
    expect(isOpsStale("email_sent", 29)).toBe(false);
    // Terminal — never stale
    expect(isOpsStale("restock_completed", 100)).toBe(false);
  });
});

// ── 7. OPS_HANDOFF_RULES ──

describe("OPS_HANDOFF_RULES", () => {
  test("has 3 rules with unique IDs and valid stage transitions", () => {
    expect(OPS_HANDOFF_RULES).toHaveLength(3);
    const ids = OPS_HANDOFF_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
    for (const rule of OPS_HANDOFF_RULES) {
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.trigger.length).toBeGreaterThan(0);
      expect(["quote", "order", "receiving", "inventory"]).toContain(rule.fromStage);
      expect(["quote", "order", "receiving", "inventory"]).toContain(rule.toStage);
    }
  });
});

// ── 8. determineOpsStallPoint ──

describe("determineOpsStallPoint", () => {
  test("returns none when totalQuotes is 0", () => {
    expect(determineOpsStallPoint({ totalQuotes: 0, purchasedQuotes: 0, confirmedOrders: 0, completedReceiving: 0 })).toBe("none");
  });

  test("identifies quote stall (largest drop at quote→order)", () => {
    expect(determineOpsStallPoint({ totalQuotes: 10, purchasedQuotes: 2, confirmedOrders: 2, completedReceiving: 2 })).toBe("quote");
  });

  test("identifies order stall (largest drop at order→receiving)", () => {
    expect(determineOpsStallPoint({ totalQuotes: 10, purchasedQuotes: 10, confirmedOrders: 3, completedReceiving: 3 })).toBe("order");
  });

  test("identifies receiving stall (largest drop at receiving→inventory)", () => {
    expect(determineOpsStallPoint({ totalQuotes: 10, purchasedQuotes: 10, confirmedOrders: 10, completedReceiving: 2 })).toBe("receiving");
  });

  test("returns none when no drop", () => {
    expect(determineOpsStallPoint({ totalQuotes: 5, purchasedQuotes: 5, confirmedOrders: 5, completedReceiving: 5 })).toBe("none");
  });
});

// ── 9. OPS_STALL_LABELS ──

describe("OPS_STALL_LABELS", () => {
  test("has all 4 keys with non-empty Korean strings", () => {
    const expectedKeys: OpsStallPoint[] = ["quote", "order", "receiving", "none"];
    for (const key of expectedKeys) {
      expect(OPS_STALL_LABELS[key]).toBeDefined();
      expect(OPS_STALL_LABELS[key].length).toBeGreaterThan(0);
    }
    expect(Object.keys(OPS_STALL_LABELS)).toHaveLength(4);
  });
});

// ── 10. OPS_ACTIVITY_LABELS ──

describe("OPS_ACTIVITY_LABELS", () => {
  test("covers all ops substatuses and common substatuses with non-empty labels", () => {
    for (const key of Object.keys(OPS_SUBSTATUS_DEFS)) {
      expect(OPS_ACTIVITY_LABELS[key]).toBeDefined();
      expect(OPS_ACTIVITY_LABELS[key].length).toBeGreaterThan(0);
    }
    // Common substatuses
    expect(OPS_ACTIVITY_LABELS["execution_failed"]).toBeDefined();
    expect(OPS_ACTIVITY_LABELS["budget_insufficient"]).toBeDefined();
    expect(OPS_ACTIVITY_LABELS["permission_denied"]).toBeDefined();
  });
});

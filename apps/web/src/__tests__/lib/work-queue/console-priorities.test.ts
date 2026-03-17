/**
 * Console Priorities & Grouping Tests
 *
 * 우선순위 티어 할당, SLA 프로모션, 콘솔 그룹 분류, 소유자/CTA 해석 검증.
 */

import {
  assignPriorityTier,
  applyPromotionRules,
  computeFinalTier,
  PRIORITY_TIER_DEFS,
  type PriorityTier,
} from "@/lib/work-queue/console-priorities";

import {
  groupForConsole,
  resolveOwnerRole,
  resolveConsoleCta,
  computeConsoleSummary,
  OWNER_ROLE_LABELS,
  type ConsoleGroup,
} from "@/lib/work-queue/console-grouping";

import type { WorkQueueItem } from "@/lib/work-queue/work-queue-service";

// ── Test Helpers ──

function makeItem(overrides: Partial<WorkQueueItem> = {}): WorkQueueItem {
  return {
    id: "test-" + Math.random().toString(36).slice(2, 8),
    type: "QUOTE_DRAFT",
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
    substatus: null,
    priority: "MEDIUM",
    title: "Test Item",
    summary: null,
    relatedEntityType: null,
    relatedEntityId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    impactScore: 50,
    urgencyScore: 10,
    totalScore: 60,
    urgencyReason: null,
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ── 1. Tier Assignment (5 tests) ──

describe("assignPriorityTier", () => {
  test("BLOCKED → urgent_blocker", () => {
    expect(assignPriorityTier(makeItem({ taskStatus: "BLOCKED" }))).toBe("urgent_blocker");
  });

  test("FAILED → urgent_blocker", () => {
    expect(assignPriorityTier(makeItem({ taskStatus: "FAILED" }))).toBe("urgent_blocker");
  });

  test("approvalStatus PENDING → approval_needed", () => {
    expect(
      assignPriorityTier(makeItem({ taskStatus: "REVIEW_NEEDED", approvalStatus: "PENDING" }))
    ).toBe("approval_needed");
  });

  test("ACTION_NEEDED → action_needed", () => {
    expect(
      assignPriorityTier(makeItem({ taskStatus: "ACTION_NEEDED", approvalStatus: "NOT_REQUIRED" }))
    ).toBe("action_needed");
  });

  test("COMPLETED → informational", () => {
    expect(assignPriorityTier(makeItem({ taskStatus: "COMPLETED" }))).toBe("informational");
  });
});

// ── 2. SLA Promotion (3 tests) ──

describe("applyPromotionRules", () => {
  test("monitoring + SLA 1x breach → action_needed", () => {
    // email_sent has slaWarningDays=7
    const item = makeItem({
      taskStatus: "WAITING_RESPONSE",
      substatus: "email_sent",
      createdAt: daysAgo(8),
    });
    const result = applyPromotionRules(item, "monitoring");
    expect(result).toBe("action_needed");
  });

  test("action_needed + stale (staleDays breach) → urgent_blocker", () => {
    // email_sent has staleDays=30
    const item = makeItem({
      taskStatus: "ACTION_NEEDED",
      substatus: "email_sent",
      createdAt: daysAgo(31),
    });
    const result = applyPromotionRules(item, "action_needed");
    expect(result).toBe("urgent_blocker");
  });

  test("no promotion when under SLA threshold", () => {
    const item = makeItem({
      taskStatus: "WAITING_RESPONSE",
      substatus: "email_sent",
      createdAt: daysAgo(3), // under 7-day SLA
    });
    const result = applyPromotionRules(item, "monitoring");
    expect(result).toBe("monitoring");
  });
});

// ── 3. Grouping (4 tests) ──

describe("groupForConsole", () => {
  test("urgent items go to urgent_blockers group", () => {
    const items = [
      makeItem({ id: "a", taskStatus: "BLOCKED", substatus: "budget_insufficient" }),
      makeItem({ id: "b", taskStatus: "ACTION_NEEDED", substatus: "vendor_reply_received" }),
    ];
    const groups = groupForConsole(items);
    const urgentGroup = groups.find((g) => g.id === "urgent_blockers");
    expect(urgentGroup).toBeDefined();
    expect(urgentGroup!.items.some((i) => i.id === "a")).toBe(true);
  });

  test("PENDING approval items go to approvals_needed group", () => {
    const items = [
      makeItem({ id: "a", taskStatus: "REVIEW_NEEDED", approvalStatus: "PENDING", substatus: "quote_draft_generated" }),
    ];
    const groups = groupForConsole(items);
    const approvalGroup = groups.find((g) => g.id === "approvals_needed");
    expect(approvalGroup).toBeDefined();
    expect(approvalGroup!.items[0].id).toBe("a");
  });

  test("receiving/inventory substatus items go to receiving_restock group", () => {
    const items = [
      makeItem({ id: "a", taskStatus: "WAITING_RESPONSE", substatus: "restock_ordered" }),
      makeItem({ id: "b", taskStatus: "ACTION_NEEDED", substatus: "expiry_alert_created" }),
    ];
    const groups = groupForConsole(items);
    const receivingGroup = groups.find((g) => g.id === "receiving_restock");
    expect(receivingGroup).toBeDefined();
    expect(receivingGroup!.items.length).toBe(2);
  });

  test("compare substatus items go to compare_followup group", () => {
    const items = [
      makeItem({ id: "a", taskStatus: "REVIEW_NEEDED", approvalStatus: "PENDING", substatus: "compare_decision_pending" }),
    ];
    // compare_decision_pending with PENDING approval → could be approval_needed or compare_followup
    // Since approval_needed is checked before compare_followup, this goes to approvals_needed
    const groups = groupForConsole(items);
    const approvalGroup = groups.find((g) => g.id === "approvals_needed");
    expect(approvalGroup).toBeDefined();
    // Let's test with a non-approval compare item
    const items2 = [
      makeItem({ id: "b", taskStatus: "ACTION_NEEDED", approvalStatus: "NOT_REQUIRED", substatus: "compare_inquiry_followup" }),
    ];
    const groups2 = groupForConsole(items2);
    const compareGroup = groups2.find((g) => g.id === "compare_followup");
    expect(compareGroup).toBeDefined();
    expect(compareGroup!.items[0].id).toBe("b");
  });
});

// ── 4. Owner/Action Resolution (3 tests) ──

describe("resolveOwnerRole", () => {
  test("purchase_request_created → APPROVER", () => {
    const item = makeItem({ substatus: "purchase_request_created" });
    expect(resolveOwnerRole(item)).toBe("APPROVER");
  });

  test("restock_ordered → OPERATOR (ops_receiving_pending)", () => {
    const item = makeItem({ substatus: "restock_ordered" });
    expect(resolveOwnerRole(item)).toBe("OPERATOR");
  });

  test("compare_decision_pending → REQUESTER", () => {
    const item = makeItem({ substatus: "compare_decision_pending" });
    expect(resolveOwnerRole(item)).toBe("REQUESTER");
  });
});

describe("resolveConsoleCta", () => {
  test("ops substatus returns CTA label from OPS_QUEUE_CTA_MAP", () => {
    const item = makeItem({ substatus: "restock_suggested" });
    const cta = resolveConsoleCta(item);
    expect(cta.label).toBe("재발주 검토");
  });

  test("compare substatus returns CTA label from COMPARE_CTA_MAP", () => {
    const item = makeItem({ substatus: "compare_decision_pending" });
    const cta = resolveConsoleCta(item);
    expect(cta.label).toBe("판정하기");
  });

  test("unknown substatus returns fallback label", () => {
    const item = makeItem({ substatus: "nonexistent_status" });
    const cta = resolveConsoleCta(item);
    expect(cta.label).toBe("확인");
  });
});

// ── 5. Console Summary (1 test) ──

describe("computeConsoleSummary", () => {
  test("computes correct counts from groups", () => {
    const groups: ConsoleGroup[] = [
      { id: "urgent_blockers", label: "", description: "", items: [makeItem({ id: "u1" }) as any, makeItem({ id: "u2" }) as any], collapsible: false },
      { id: "approvals_needed", label: "", description: "", items: [makeItem({ id: "a1" }) as any], collapsible: false },
      { id: "recently_resolved", label: "", description: "", items: [makeItem({ id: "r1", taskStatus: "COMPLETED" }) as any], collapsible: true },
    ];
    const summary = computeConsoleSummary(groups);
    expect(summary.urgentCount).toBe(2);
    expect(summary.approvalCount).toBe(1);
    expect(summary.totalResolved).toBe(1);
    expect(summary.totalActive).toBeGreaterThanOrEqual(2); // u1, u2, a1 are active
  });
});

// ── 6. Tier Definitions Integrity (1 test) ──

describe("PRIORITY_TIER_DEFS", () => {
  test("all tiers have unique sortOrders and valid fields", () => {
    const allDefs = Object.values(PRIORITY_TIER_DEFS);
    const sortOrders = allDefs.map((d) => d.sortOrder);
    expect(new Set(sortOrders).size).toBe(allDefs.length);

    for (const def of allDefs) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(["red", "orange", "yellow", "blue", "gray"]).toContain(def.visualIndicator);
    }
  });
});

// ── 7. Non-crowding: urgent items don't leak into other groups (1 test) ──

describe("non-crowding", () => {
  test("items appear in exactly one group", () => {
    const items = [
      makeItem({ id: "a", taskStatus: "BLOCKED", substatus: "budget_insufficient" }),
      makeItem({ id: "b", taskStatus: "REVIEW_NEEDED", approvalStatus: "PENDING", substatus: "quote_draft_generated" }),
      makeItem({ id: "c", taskStatus: "WAITING_RESPONSE", substatus: "restock_ordered" }),
      makeItem({ id: "d", taskStatus: "ACTION_NEEDED", approvalStatus: "NOT_REQUIRED", substatus: "compare_inquiry_followup" }),
      makeItem({ id: "e", taskStatus: "COMPLETED", substatus: "quote_completed" }),
    ];
    const groups = groupForConsole(items);

    // Collect all grouped item IDs
    const allGroupedIds = groups.flatMap((g) => g.items.map((i) => i.id));
    const uniqueIds = new Set(allGroupedIds);

    // Every item appears exactly once
    expect(allGroupedIds.length).toBe(uniqueIds.size);
    // All input items are accounted for
    expect(uniqueIds.size).toBe(items.length);
  });
});

// ── 8. computeFinalTier integration (1 test) ──

describe("computeFinalTier", () => {
  test("stale SLA item gets promoted to urgent_blocker", () => {
    // email_sent: slaWarningDays=7, staleDays=30 → 31 days → urgent via staleBreach in assignPriorityTier
    const item = makeItem({
      taskStatus: "WAITING_RESPONSE",
      substatus: "email_sent",
      createdAt: daysAgo(31),
    });
    expect(computeFinalTier(item)).toBe("urgent_blocker");
  });
});

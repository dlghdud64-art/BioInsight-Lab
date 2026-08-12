/**
 * Console Accountability Tests
 *
 * 책임성 메트릭, 에스컬레이션, 개인 워크로드 뷰, 소유자 리포트, 감사 추적 검증.
 */

import {
  computeAccountabilityMetrics,
  evaluateEscalations,
  getEscalationBoost,
  filterForPersonalView,
  computeOwnerReport,
  buildAssignmentAuditTrail,
  ACCOUNTABILITY_METRIC_DEFS,
  ESCALATION_RULE_DEFS,
  PERSONAL_WORKLOAD_VIEW_DEFS,
  PERSONAL_WORKLOAD_VIEW_LABELS,
} from "@/lib/work-queue/console-accountability";
import type {
  ActivityLogEntry,
  EscalationResult,
} from "@/lib/work-queue/console-accountability";
import type { WorkQueueItem } from "@/lib/work-queue/work-queue-service";

// ── Test Helpers ──

const NOW = new Date("2026-03-17T12:00:00Z");

function makeItem(overrides: Partial<WorkQueueItem> = {}): WorkQueueItem {
  return {
    id: "item-" + Math.random().toString(36).slice(2, 8),
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
    createdAt: new Date("2026-03-16T12:00:00Z"),
    updatedAt: new Date("2026-03-16T12:00:00Z"),
    impactScore: 50,
    urgencyScore: 10,
    totalScore: 60,
    urgencyReason: null,
    assigneeId: null,
    ...overrides,
  };
}

function makeLog(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: "log-" + Math.random().toString(36).slice(2, 8),
    activityType: "ITEM_CLAIMED",
    entityId: null,
    userId: null,
    metadata: {},
    createdAt: new Date("2026-03-16T12:00:00Z"),
    ...overrides,
  };
}

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

// ── 1. Metric Computation (6 tests) ──

describe("computeAccountabilityMetrics", () => {
  test("counts unassigned active items", () => {
    const items = [
      makeItem({ id: "a", assigneeId: null }),
      makeItem({ id: "b", assigneeId: "user-1" }),
      makeItem({ id: "c", assigneeId: null }),
      makeItem({ id: "d", assigneeId: null, taskStatus: "COMPLETED" }), // terminal, excluded
    ];
    const metrics = computeAccountabilityMetrics(items, [], NOW);
    expect(metrics.unassignedCount).toBe(2);
  });

  test("counts assigned-untouched items (no first action)", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: { assignmentState: "assigned" },
      }),
      makeItem({
        id: "b",
        assigneeId: "user-2",
        metadata: { assignmentState: "assigned" },
      }),
    ];
    const logs = [
      makeLog({ activityType: "ITEM_CLAIMED", entityId: "a", userId: "user-1" }),
      // "b" has claim but no first action either
      makeLog({ activityType: "ITEM_CLAIMED", entityId: "b", userId: "user-2" }),
      // "a" has a first action
      makeLog({ activityType: "ITEM_STARTED", entityId: "a", userId: "user-1" }),
    ];
    const metrics = computeAccountabilityMetrics(items, logs, NOW);
    expect(metrics.assignedUntouchedCount).toBe(1); // only "b"
  });

  test("counts blocked-aging items (48h+)", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: { assignmentState: "blocked" },
      }),
      makeItem({
        id: "b",
        assigneeId: "user-2",
        metadata: { assignmentState: "blocked" },
      }),
    ];
    const logs = [
      makeLog({ activityType: "ITEM_BLOCKED", entityId: "a", createdAt: hoursAgo(50) }),
      makeLog({ activityType: "ITEM_BLOCKED", entityId: "b", createdAt: hoursAgo(10) }),
    ];
    const metrics = computeAccountabilityMetrics(items, logs, NOW);
    expect(metrics.blockedAgingCount).toBe(1); // only "a"
  });

  test("counts handoff-not-accepted items (12h+)", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: "user-1", toUserId: "user-2", at: hoursAgo(15).toISOString(), nextAction: "review" },
        },
      }),
      makeItem({
        id: "b",
        assigneeId: "user-3",
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: "user-3", toUserId: "user-4", at: hoursAgo(5).toISOString(), nextAction: "review" },
        },
      }),
    ];
    const metrics = computeAccountabilityMetrics(items, [], NOW);
    expect(metrics.handoffNotAcceptedCount).toBe(1); // only "a"
  });

  test("computes average first-action latency", () => {
    const logs = [
      // Entity A: claim → started, 4h gap
      makeLog({ activityType: "ITEM_CLAIMED", entityId: "a", createdAt: hoursAgo(10) }),
      makeLog({ activityType: "ITEM_STARTED", entityId: "a", createdAt: hoursAgo(6) }),
      // Entity B: claim → started, 2h gap
      makeLog({ activityType: "ITEM_ASSIGNED", entityId: "b", createdAt: hoursAgo(8) }),
      makeLog({ activityType: "ITEM_STARTED", entityId: "b", createdAt: hoursAgo(6) }),
    ];
    const metrics = computeAccountabilityMetrics([], logs, NOW);
    // avg = (4 + 2) / 2 = 3.0
    expect(metrics.avgFirstActionLatencyHours).toBe(3);
  });

  test("counts reassignments from logs", () => {
    const logs = [
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "b" }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
      makeLog({ activityType: "ITEM_CLAIMED", entityId: "a" }), // not a reassignment
    ];
    const metrics = computeAccountabilityMetrics([], logs, NOW);
    expect(metrics.reassignmentCount).toBe(3);
  });
});

// ── 2. Escalation Evaluation (5 tests) ──

describe("evaluateEscalations", () => {
  test("assigned_no_first_action fires after 24h", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: { assignmentState: "assigned" },
        updatedAt: hoursAgo(30),
      }),
    ];
    const logs = [
      makeLog({ activityType: "ITEM_CLAIMED", entityId: "a", createdAt: hoursAgo(30) }),
    ];
    const results = evaluateEscalations(items, logs, NOW);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "assigned_no_first_action", itemId: "a", severity: "warning" }),
      ])
    );
  });

  test("handoff_not_picked_up fires after 12h", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: "user-1", toUserId: "user-2", at: hoursAgo(14).toISOString(), nextAction: "review" },
        },
      }),
    ];
    const results = evaluateEscalations(items, [], NOW);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "handoff_not_picked_up", itemId: "a", priorityBoost: 8 }),
      ])
    );
  });

  test("blocked_too_long fires after 48h", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: { assignmentState: "blocked" },
      }),
    ];
    const logs = [
      makeLog({ activityType: "ITEM_BLOCKED", entityId: "a", createdAt: hoursAgo(50) }),
    ];
    const results = evaluateEscalations(items, logs, NOW);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "blocked_too_long", severity: "critical", priorityBoost: 10 }),
      ])
    );
  });

  test("repeatedly_reassigned fires at 3+ reassignments", () => {
    const items = [makeItem({ id: "a", assigneeId: "user-1" })];
    const logs = [
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
    ];
    const results = evaluateEscalations(items, logs, NOW);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "repeatedly_reassigned", itemId: "a" }),
      ])
    );
  });

  test("overdue_urgent_same_owner fires for urgent_blocker held 24h+", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        taskStatus: "BLOCKED", // BLOCKED → urgent_blocker tier
        updatedAt: hoursAgo(30),
      }),
    ];
    const results = evaluateEscalations(items, [], NOW);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "overdue_urgent_same_owner", severity: "critical", priorityBoost: 15 }),
      ])
    );
  });
});

// ── 3. Escalation Boost (1 test, part of escalation section) ──

describe("getEscalationBoost", () => {
  test("returns max boost for item from multiple escalations", () => {
    const item = makeItem({ id: "a" });
    const escalations: EscalationResult[] = [
      { ruleId: "assigned_no_first_action", severity: "warning", priorityBoost: 5, itemId: "a", message: "" },
      { ruleId: "blocked_too_long", severity: "critical", priorityBoost: 10, itemId: "a", message: "" },
      { ruleId: "handoff_not_picked_up", severity: "warning", priorityBoost: 8, itemId: "b", message: "" }, // different item
    ];
    expect(getEscalationBoost(item, escalations)).toBe(10);
  });
});

// ── 4. Personal Workload Views (5 tests) ──

describe("filterForPersonalView", () => {
  const userId = "user-me";

  test("my_urgent: returns my urgent + escalated items", () => {
    const items = [
      makeItem({ id: "a", assigneeId: userId, taskStatus: "BLOCKED" }), // urgent_blocker
      makeItem({ id: "b", assigneeId: userId, taskStatus: "ACTION_NEEDED" }), // not urgent, but escalated
      makeItem({ id: "c", assigneeId: userId, taskStatus: "ACTION_NEEDED" }), // not urgent, not escalated
      makeItem({ id: "d", assigneeId: "other", taskStatus: "BLOCKED" }), // urgent but not mine
    ];
    const escalations: EscalationResult[] = [
      { ruleId: "assigned_no_first_action", severity: "warning", priorityBoost: 5, itemId: "b", message: "" },
    ];
    const result = filterForPersonalView(items, "my_urgent", userId, escalations);
    const ids = result.map((i) => i.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
  });

  test("assigned_to_me: returns my non-urgent, non-escalated items", () => {
    const items = [
      makeItem({ id: "a", assigneeId: userId, taskStatus: "ACTION_NEEDED" }),
      makeItem({ id: "b", assigneeId: userId, taskStatus: "BLOCKED" }), // urgent → goes to my_urgent
      makeItem({ id: "c", assigneeId: "other" }), // not mine
    ];
    const result = filterForPersonalView(items, "assigned_to_me", userId, []);
    const ids = result.map((i) => i.id);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
    expect(ids).not.toContain("c");
  });

  test("waiting_on_others: returns items I handed off", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: userId,
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: userId, toUserId: "other", at: NOW.toISOString(), nextAction: "review" },
        },
      }),
      makeItem({
        id: "b",
        assigneeId: "other",
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: "other", toUserId: userId, at: NOW.toISOString(), nextAction: "review" },
        },
      }),
    ];
    const result = filterForPersonalView(items, "waiting_on_others", userId);
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  test("handed_off_to_me: returns items handed off to me", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "other",
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: "other", toUserId: userId, at: NOW.toISOString(), nextAction: "review" },
        },
      }),
      makeItem({
        id: "b",
        assigneeId: userId,
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: userId, toUserId: "other", at: NOW.toISOString(), nextAction: "review" },
        },
      }),
    ];
    const result = filterForPersonalView(items, "handed_off_to_me", userId);
    expect(result.map((i) => i.id)).toEqual(["a"]);
  });

  test("team_overflow: returns unassigned urgent/action_needed items", () => {
    const items = [
      makeItem({ id: "a", assigneeId: null, taskStatus: "BLOCKED" }), // urgent_blocker, no owner
      makeItem({ id: "b", assigneeId: null, taskStatus: "ACTION_NEEDED" }), // action_needed, no owner
      makeItem({ id: "c", assigneeId: null, taskStatus: "COMPLETED" }), // terminal
      makeItem({ id: "d", assigneeId: "user-1", taskStatus: "BLOCKED" }), // urgent but has owner
      makeItem({ id: "e", assigneeId: null, taskStatus: "MONITORING", priority: "LOW", impactScore: 10, urgencyScore: 5, totalScore: 15 }), // low priority, informational tier
    ];
    const result = filterForPersonalView(items, "team_overflow", userId);
    const ids = result.map((i) => i.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("d");
  });
});

// ── 5. Owner Report (2 tests) ──

describe("computeOwnerReport", () => {
  test("computes correct counters for owner", () => {
    const ownerId = "user-1";
    const items = [
      makeItem({ id: "a", assigneeId: ownerId, taskStatus: "BLOCKED", metadata: { assignmentState: "blocked" } }), // urgent + blocked
      makeItem({ id: "b", assigneeId: ownerId, taskStatus: "ACTION_NEEDED" }), // non-urgent active
      makeItem({
        id: "c",
        assigneeId: "other",
        metadata: {
          assignmentState: "handed_off",
          handoff: { note: "n", fromUserId: "other", toUserId: ownerId, at: NOW.toISOString(), nextAction: "review" },
        },
      }),
    ];
    const logs = [
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a", metadata: { assigneeId_before: ownerId, assigneeId_after: "user-2" } }),
    ];
    const report = computeOwnerReport(items, logs, ownerId, NOW);
    expect(report.ownerId).toBe(ownerId);
    expect(report.ownedUrgentCount).toBe(1);
    expect(report.blockedOwnedCount).toBe(1);
    expect(report.pendingHandoffCount).toBe(1);
    expect(report.reassignmentHotspotCount).toBe(1);
  });

  test("returns null latency when no log data", () => {
    const report = computeOwnerReport([], [], "user-1", NOW);
    expect(report.avgFirstActionLatencyHours).toBeNull();
    expect(report.ownedUrgentCount).toBe(0);
    expect(report.overdueOwnedCount).toBe(0);
  });
});

// ── 6. Audit Trail (2 tests) ──

describe("buildAssignmentAuditTrail", () => {
  test("builds full trail from log sequence", () => {
    const itemId = "item-1";
    const logs: ActivityLogEntry[] = [
      makeLog({ activityType: "ITEM_CLAIMED", entityId: itemId, userId: "user-1", createdAt: hoursAgo(48) }),
      makeLog({ activityType: "ITEM_STARTED", entityId: itemId, userId: "user-1", createdAt: hoursAgo(44) }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: itemId, userId: "user-2", createdAt: hoursAgo(40) }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: itemId, userId: "user-3", createdAt: hoursAgo(36) }),
      makeLog({ activityType: "ITEM_BLOCKED", entityId: itemId, userId: "user-3", createdAt: hoursAgo(30), metadata: { note: "waiting on vendor" } }),
      makeLog({ activityType: "ITEM_HANDED_OFF", entityId: itemId, userId: "user-3", createdAt: hoursAgo(20) }),
      makeLog({ activityType: "AI_TASK_COMPLETED", entityId: itemId, userId: "user-4", createdAt: hoursAgo(10) }),
    ];

    const trail = buildAssignmentAuditTrail(itemId, logs);
    expect(trail.claimedBy).toBe("user-1");
    expect(trail.claimedAt).toBeTruthy();
    expect(trail.firstActionBy).toBe("user-1");
    expect(trail.firstActionAt).toBeTruthy();
    expect(trail.untouchedHours).toBeCloseTo(4, 0);
    expect(trail.reassignmentCount).toBe(2);
    expect(trail.reassignedBy).toBe("user-3"); // last reassigner
    expect(trail.handedOffBy).toBe("user-3");
    expect(trail.blockedReason).toBe("waiting on vendor");
    expect(trail.resolvedBy).toBe("user-4");
    expect(trail.resolvedAt).toBeTruthy();
  });

  test("returns empty trail for no logs", () => {
    const trail = buildAssignmentAuditTrail("item-1", []);
    expect(trail.claimedBy).toBeNull();
    expect(trail.claimedAt).toBeNull();
    expect(trail.firstActionBy).toBeNull();
    expect(trail.reassignmentCount).toBe(0);
    expect(trail.resolvedBy).toBeNull();
    expect(trail.untouchedHours).toBeNull();
  });
});

// ── 7. No Duplicate Ownership (1 test) ──

describe("no duplicate ownership in reports", () => {
  test("item counted in only one owner report", () => {
    const items = [
      makeItem({ id: "a", assigneeId: "user-1", taskStatus: "BLOCKED" }),
    ];
    const report1 = computeOwnerReport(items, [], "user-1", NOW);
    const report2 = computeOwnerReport(items, [], "user-2", NOW);
    expect(report1.ownedUrgentCount).toBe(1);
    expect(report2.ownedUrgentCount).toBe(0);
  });
});

// ── 8. Definition Integrity (1 test) ──

describe("definition integrity", () => {
  test("all definitions have Korean labels and valid fields", () => {
    // Metric defs
    for (const def of Object.values(ACCOUNTABILITY_METRIC_DEFS)) {
      expect(def.id).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(typeof def.label).toBe("string");
      expect(def.description).toBeTruthy();
      expect(def.whereShown).toBeTruthy();
    }

    // Escalation rule defs
    for (const def of Object.values(ESCALATION_RULE_DEFS)) {
      expect(def.id).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.thresholdHours).toBeGreaterThan(0);
      expect(["warning", "critical"]).toContain(def.severity);
      expect(def.priorityBoost).toBeGreaterThan(0);
    }

    // Personal workload view defs
    for (const def of Object.values(PERSONAL_WORKLOAD_VIEW_DEFS)) {
      expect(def.id).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(typeof def.sortOrder).toBe("number");
      // Ensure matching label exists
      expect(PERSONAL_WORKLOAD_VIEW_LABELS[def.id]).toBe(def.label);
    }
  });
});

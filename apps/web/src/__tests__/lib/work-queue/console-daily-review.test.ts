/**
 * Console Daily Review Tests
 *
 * 일일 검토 항목 선택, 에스컬레이션 액션, 검토 결과, 이월, 가시성, 정의 무결성 검증.
 */

import {
  selectDailyReviewItems,
  getAvailableEscalationActions,
  getAvailableReviewOutcomes,
  buildReviewRecord,
  applyReviewOutcome,
  applyEscalationAction,
  computeCarryOver,
  splitByVisibility,
  DAILY_REVIEW_CATEGORY_DEFS,
  DAILY_REVIEW_CATEGORY_LABELS,
  ESCALATION_ACTION_DEFS,
  ESCALATION_ACTION_LABELS,
  REVIEW_OUTCOME_DEFS,
  REVIEW_OUTCOME_LABELS,
  CARRY_OVER_DEFS,
} from "@/lib/work-queue/console-daily-review";
import { ESCALATION_RULE_DEFS } from "@/lib/work-queue/console-accountability";
import type {
  ActivityLogEntry,
  EscalationResult,
} from "@/lib/work-queue/console-accountability";
import type { DailyReviewItem, ReviewRecord } from "@/lib/work-queue/console-daily-review";
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

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

// ── 1. Daily Review Item Selection (5 tests) ──

describe("selectDailyReviewItems", () => {
  test("categorizes urgent_blocker + assigned item as urgent_now", () => {
    // BLOCKED → urgent_blocker tier
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        taskStatus: "BLOCKED",
        updatedAt: hoursAgo(2), // recent, so no overdue escalation
      }),
    ];
    const surface = selectDailyReviewItems(items, [], "user-1", NOW);
    expect(surface.categories.urgent_now.length).toBe(1);
    expect(surface.categories.urgent_now[0].item.id).toBe("a");
    expect(surface.categories.urgent_now[0].category).toBe("urgent_now");
  });

  test("categorizes overdue_urgent_same_owner escalation as overdue_owned", () => {
    // BLOCKED + held 30h → overdue_urgent_same_owner fires
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        taskStatus: "BLOCKED",
        updatedAt: hoursAgo(30),
      }),
    ];
    const surface = selectDailyReviewItems(items, [], "user-1", NOW);
    expect(surface.categories.overdue_owned.length).toBe(1);
    expect(surface.categories.overdue_owned[0].item.id).toBe("a");
  });

  test("categorizes blocked_too_long escalation as blocked_too_long", () => {
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
    const surface = selectDailyReviewItems(items, logs, "user-1", NOW);
    expect(surface.categories.blocked_too_long.length).toBe(1);
    expect(surface.categories.blocked_too_long[0].item.id).toBe("a");
  });

  test("categorizes handoff_not_picked_up escalation as handoff_not_accepted", () => {
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
    const surface = selectDailyReviewItems(items, [], "user-1", NOW);
    expect(surface.categories.handoff_not_accepted.length).toBe(1);
    expect(surface.categories.handoff_not_accepted[0].item.id).toBe("a");
  });

  test("categorizes urgent_blocker + no assignee as urgent_unassigned", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: null,
        taskStatus: "BLOCKED",
        updatedAt: hoursAgo(2),
      }),
    ];
    const surface = selectDailyReviewItems(items, [], "user-1", NOW);
    expect(surface.categories.urgent_unassigned.length).toBe(1);
    expect(surface.categories.urgent_unassigned[0].item.id).toBe("a");
  });
});

// ── 2. Escalation Action Triggers (5 tests) ──

describe("getAvailableEscalationActions", () => {
  test("escalate_untouched available for assigned_no_first_action + assigned state", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "assigned" },
    });
    const escalations: EscalationResult[] = [
      { ruleId: "assigned_no_first_action", severity: "warning", priorityBoost: 5, itemId: "a", message: "" },
    ];
    const actions = getAvailableEscalationActions(item, escalations, false);
    expect(actions).toContain("escalate_untouched");
  });

  test("escalate_handoff available for handoff_not_picked_up + handed_off state", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: {
        assignmentState: "handed_off",
        handoff: { note: "n", fromUserId: "user-1", toUserId: "user-2", at: NOW.toISOString(), nextAction: "review" },
      },
    });
    const escalations: EscalationResult[] = [
      { ruleId: "handoff_not_picked_up", severity: "warning", priorityBoost: 8, itemId: "a", message: "" },
    ];
    const actions = getAvailableEscalationActions(item, escalations, false);
    expect(actions).toContain("escalate_handoff");
  });

  test("escalate_blocked available for blocked_too_long + blocked state", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "blocked" },
    });
    const escalations: EscalationResult[] = [
      { ruleId: "blocked_too_long", severity: "critical", priorityBoost: 10, itemId: "a", message: "" },
    ];
    const actions = getAvailableEscalationActions(item, escalations, false);
    expect(actions).toContain("escalate_blocked");
  });

  test("escalate_reassignment requires lead permission", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "assigned" },
    });
    const escalations: EscalationResult[] = [
      { ruleId: "repeatedly_reassigned", severity: "warning", priorityBoost: 5, itemId: "a", message: "" },
    ];
    // Non-lead should NOT get this action
    const actionsNonLead = getAvailableEscalationActions(item, escalations, false);
    expect(actionsNonLead).not.toContain("escalate_reassignment");
    // Lead should get it
    const actionsLead = getAvailableEscalationActions(item, escalations, true);
    expect(actionsLead).toContain("escalate_reassignment");
  });

  test("escalate_overdue_urgent requires lead permission", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "assigned" },
    });
    const escalations: EscalationResult[] = [
      { ruleId: "overdue_urgent_same_owner", severity: "critical", priorityBoost: 15, itemId: "a", message: "" },
    ];
    const actionsNonLead = getAvailableEscalationActions(item, escalations, false);
    expect(actionsNonLead).not.toContain("escalate_overdue_urgent");
    const actionsLead = getAvailableEscalationActions(item, escalations, true);
    expect(actionsLead).toContain("escalate_overdue_urgent");
  });
});

// ── 3. Review Outcome Application (4 tests) ──

describe("applyReviewOutcome", () => {
  test("keep_with_owner preserves assignee and clears carry-over", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { carryOver: { fromDate: "2026-03-15", reason: "unresolved_urgent", dayCount: 2, severityPromoted: true, originalCategory: "urgent_now" } },
    });
    const result = applyReviewOutcome(item, "keep_with_owner", {
      actorUserId: "reviewer-1",
      note: "확인 완료",
      now: NOW,
    });
    expect(result.newAssigneeId).toBe("user-1");
    expect(result.newPayload.carryOver).toBeNull();
    expect(result.logEvent).toBe("ITEM_REVIEW_COMPLETED");
    expect(result.logMetadata.reviewOutcome).toBe("keep_with_owner");
    // Review history appended
    const history = result.newPayload.reviewHistory as ReviewRecord[];
    expect(history.length).toBe(1);
    expect(history[0].reviewOutcome).toBe("keep_with_owner");
  });

  test("reassign changes assignee and sets assigned state", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: {},
    });
    const result = applyReviewOutcome(item, "reassign", {
      actorUserId: "reviewer-1",
      targetUserId: "user-2",
      note: "담당 변경",
      now: NOW,
    });
    expect(result.newAssigneeId).toBe("user-2");
    expect(result.newPayload.assignmentState).toBe("assigned");
    expect(result.logMetadata.assigneeId_before).toBe("user-1");
    expect(result.logMetadata.assigneeId_after).toBe("user-2");
  });

  test("escalate_to_lead changes assignee to target lead", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: {},
    });
    const result = applyReviewOutcome(item, "escalate_to_lead", {
      actorUserId: "reviewer-1",
      targetUserId: "lead-1",
      note: "리드 판단 필요",
      now: NOW,
    });
    expect(result.newAssigneeId).toBe("lead-1");
    expect(result.newPayload.assignmentState).toBe("assigned");
  });

  test("resolved_during_review sets resolved state and clears carry-over", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { carryOver: { fromDate: "2026-03-15", reason: "overdue_owned", dayCount: 1, severityPromoted: false, originalCategory: "overdue_owned" } },
    });
    const result = applyReviewOutcome(item, "resolved_during_review", {
      actorUserId: "reviewer-1",
      note: "검토 중 해결",
      now: NOW,
    });
    expect(result.newPayload.assignmentState).toBe("resolved");
    expect(result.newPayload.carryOver).toBeNull();
    expect(result.newAssigneeId).toBe("user-1"); // no owner change
  });
});

// ── 4. Carry-Over Semantics (4 tests) ──

describe("computeCarryOver", () => {
  test("returns carry-over entry for carry_to_next review outcome", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      taskStatus: "ACTION_NEEDED",
      metadata: {
        reviewHistory: [
          {
            reviewedBy: "reviewer-1",
            reviewedAt: daysAgo(1).toISOString(),
            reviewOutcome: "carry_to_next",
            reviewNote: "내일 확인",
            resultingOwnerId: null,
            resultingState: null,
          },
        ],
      },
    });
    const carryOver = computeCarryOver(item, NOW);
    expect(carryOver).not.toBeNull();
    expect(carryOver!.dayCount).toBeGreaterThanOrEqual(1);
    expect(carryOver!.reason).toBeTruthy();
  });

  test("severity promotes after threshold days", () => {
    // overdue_owned: severityPromotesAfterDays = 1
    const reviewDate = daysAgo(2);
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      taskStatus: "ACTION_NEEDED",
      metadata: {
        carryOver: {
          fromDate: daysAgo(2).toISOString().slice(0, 10),
          reason: "overdue_owned",
          dayCount: 1,
          severityPromoted: false,
          originalCategory: "overdue_owned",
        },
        reviewHistory: [
          {
            reviewedBy: "reviewer-1",
            reviewedAt: reviewDate.toISOString(),
            reviewOutcome: "carry_to_next",
            reviewNote: "이월",
            resultingOwnerId: null,
            resultingState: null,
          },
        ],
      },
    });
    const carryOver = computeCarryOver(item, NOW);
    expect(carryOver).not.toBeNull();
    expect(carryOver!.severityPromoted).toBe(true);
    expect(carryOver!.dayCount).toBeGreaterThanOrEqual(2);
  });

  test("exits carry-over when resolved_during_review today", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: {
        carryOver: { fromDate: "2026-03-15", reason: "unresolved_urgent", dayCount: 2, severityPromoted: true, originalCategory: "urgent_now" },
        reviewHistory: [
          {
            reviewedBy: "reviewer-1",
            reviewedAt: NOW.toISOString(), // today
            reviewOutcome: "resolved_during_review",
            reviewNote: "해결",
            resultingOwnerId: null,
            resultingState: "resolved",
          },
        ],
      },
    });
    const carryOver = computeCarryOver(item, NOW);
    expect(carryOver).toBeNull();
  });

  test("exits carry-over when keep_with_owner today", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: {
        carryOver: { fromDate: "2026-03-15", reason: "overdue_owned", dayCount: 1, severityPromoted: false, originalCategory: "overdue_owned" },
        reviewHistory: [
          {
            reviewedBy: "reviewer-1",
            reviewedAt: NOW.toISOString(), // today
            reviewOutcome: "keep_with_owner",
            reviewNote: "확인",
            resultingOwnerId: null,
            resultingState: null,
          },
        ],
      },
    });
    const carryOver = computeCarryOver(item, NOW);
    expect(carryOver).toBeNull();
  });
});

// ── 5. Escalation Action Application (2 tests) ──

describe("applyEscalationAction", () => {
  test("escalate_untouched reassigns to lead and records lastEscalation", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "assigned" },
    });
    const result = applyEscalationAction(item, "escalate_untouched", {
      actorUserId: "operator-1",
      targetUserId: "lead-1",
      now: NOW,
    });
    expect(result.newAssigneeId).toBe("lead-1");
    expect(result.newPayload.assignmentState).toBe("assigned");
    expect((result.newPayload.lastEscalation as Record<string, unknown>).actionId).toBe("escalate_untouched");
    expect(result.logEvent).toBe("ITEM_ESCALATED");
    expect(result.logMetadata.escalationActionId).toBe("escalate_untouched");
    expect(result.logMetadata.assigneeId_before).toBe("user-1");
    expect(result.logMetadata.assigneeId_after).toBe("lead-1");
  });

  test("escalate_blocked keeps owner and requires note", () => {
    const item = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "blocked" },
    });
    const result = applyEscalationAction(item, "escalate_blocked", {
      actorUserId: "operator-1",
      note: "벤더 응답 대기 중",
      now: NOW,
    });
    // keep_owner: assignee unchanged
    expect(result.newAssigneeId).toBe("user-1");
    expect(result.newPayload.assignmentState).toBe("blocked");
    expect((result.newPayload.lastEscalation as Record<string, unknown>).note).toBe("벤더 응답 대기 중");
  });
});

// ── 6. Lead/Operator Visibility (2 tests) ──

describe("splitByVisibility", () => {
  test("operator view excludes lead-only categories", () => {
    const items: DailyReviewItem[] = [
      {
        item: makeItem({ id: "a" }),
        category: "urgent_now", // visibleTo: both
        escalations: [],
        carryOver: null,
        availableEscalationActions: [],
        availableReviewOutcomes: [],
      },
      {
        item: makeItem({ id: "b" }),
        category: "recently_resolved", // visibleTo: operator
        escalations: [],
        carryOver: null,
        availableEscalationActions: [],
        availableReviewOutcomes: [],
      },
      {
        item: makeItem({ id: "c" }),
        category: "needs_lead_intervention", // visibleTo: lead
        escalations: [],
        carryOver: null,
        availableEscalationActions: [],
        availableReviewOutcomes: [],
      },
    ];
    const { operatorItems, leadItems } = splitByVisibility(items);
    // operator gets "both" + "operator" categories
    expect(operatorItems.map((i) => i.item.id)).toEqual(expect.arrayContaining(["a", "b"]));
    expect(operatorItems.map((i) => i.item.id)).not.toContain("c");
    // lead gets "both" + "lead" categories
    expect(leadItems.map((i) => i.item.id)).toEqual(expect.arrayContaining(["a", "c"]));
    expect(leadItems.map((i) => i.item.id)).not.toContain("b");
  });

  test("lead view includes items with critical escalations from operator-only categories", () => {
    const items: DailyReviewItem[] = [
      {
        item: makeItem({ id: "a" }),
        category: "recently_resolved", // visibleTo: operator only
        escalations: [
          { ruleId: "blocked_too_long", severity: "critical", priorityBoost: 10, itemId: "a", message: "" },
        ],
        carryOver: null,
        availableEscalationActions: [],
        availableReviewOutcomes: [],
      },
    ];
    const { leadItems } = splitByVisibility(items);
    expect(leadItems.map((i) => i.item.id)).toContain("a");
  });
});

// ── 7. Definition Integrity (2 tests) ──

describe("definition integrity", () => {
  test("all definitions have Korean labels", () => {
    // Category defs
    for (const [id, def] of Object.entries(DAILY_REVIEW_CATEGORY_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(typeof def.sortOrder).toBe("number");
      expect(["operator", "lead", "both"]).toContain(def.visibleTo);
      // Matching label exists
      expect(DAILY_REVIEW_CATEGORY_LABELS[id as keyof typeof DAILY_REVIEW_CATEGORY_LABELS]).toBe(def.label);
    }

    // Escalation action defs
    for (const [id, def] of Object.entries(ESCALATION_ACTION_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(def.activityLogEvent).toBe("ITEM_ESCALATED");
      expect(["reassign_to_lead", "keep_owner", "unassign"]).toContain(def.ownerChange);
      expect(["lead_only", "operator_or_lead"]).toContain(def.permissionRule);
      expect(ESCALATION_ACTION_LABELS[id as keyof typeof ESCALATION_ACTION_LABELS]).toBe(def.label);
    }

    // Review outcome defs
    for (const [id, def] of Object.entries(REVIEW_OUTCOME_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.activityLogEvent).toBe("ITEM_REVIEW_COMPLETED");
      expect(REVIEW_OUTCOME_LABELS[id as keyof typeof REVIEW_OUTCOME_LABELS]).toBe(def.label);
    }

    // Carry-over defs
    for (const def of Object.values(CARRY_OVER_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(typeof def.severityPromotesAfterDays).toBe("number");
      expect(def.exitCondition).toBeTruthy();
    }
  });

  test("all escalation actions reference valid escalation rules", () => {
    for (const def of Object.values(ESCALATION_ACTION_DEFS)) {
      expect(ESCALATION_RULE_DEFS[def.triggerRuleId]).toBeDefined();
    }
  });
});

// ── 8. Build Review Record (1 test) ──

describe("buildReviewRecord", () => {
  test("constructs complete review record", () => {
    const record = buildReviewRecord({
      reviewedBy: "reviewer-1",
      reviewOutcome: "reassign",
      reviewNote: "담당 변경",
      resultingOwnerId: "user-2",
      resultingState: "assigned",
      now: NOW,
    });
    expect(record.reviewedBy).toBe("reviewer-1");
    expect(record.reviewOutcome).toBe("reassign");
    expect(record.reviewNote).toBe("담당 변경");
    expect(record.resultingOwnerId).toBe("user-2");
    expect(record.resultingState).toBe("assigned");
    expect(record.reviewedAt).toBe(NOW.toISOString());
  });
});

// ── 9. Review Outcomes Per Category (1 test) ──

describe("getAvailableReviewOutcomes", () => {
  test("active blocked item includes blocked_followup, excludes escalate_to_lead for needs_lead_intervention", () => {
    const blockedItem = makeItem({
      id: "a",
      assigneeId: "user-1",
      metadata: { assignmentState: "blocked" },
    });
    // For blocked_too_long category
    const outcomes1 = getAvailableReviewOutcomes(blockedItem, "blocked_too_long");
    expect(outcomes1).toContain("blocked_followup");
    expect(outcomes1).toContain("keep_with_owner");
    expect(outcomes1).toContain("escalate_to_lead");

    // For needs_lead_intervention category, escalate_to_lead excluded
    const outcomes2 = getAvailableReviewOutcomes(blockedItem, "needs_lead_intervention");
    expect(outcomes2).toContain("blocked_followup");
    expect(outcomes2).not.toContain("escalate_to_lead");
  });
});

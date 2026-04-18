/**
 * Console Cadence & SLA Governance Tests
 *
 * §1 케이던스 상태, §2 SLA 준수, §3 리드 개입 트리거,
 * §4 검토 결과 거버넌스, §5 거버넌스 신호, 정의 무결성 검증.
 */

import {
  evaluateCadenceStatuses,
  evaluateSLAStatuses,
  evaluateLeadInterventionTriggers,
  computeGovernanceSignals,
  generateGovernanceReport,
  getReviewOutcomeGovernance,
  getCarryOverReasonForOutcome,
  CADENCE_STEP_DEFS,
  CADENCE_STEP_LABELS,
  SLA_CATEGORY_DEFS,
  SLA_CATEGORY_LABELS,
  LEAD_INTERVENTION_CASE_DEFS,
  LEAD_INTERVENTION_LABELS,
  GOVERNANCE_SIGNAL_DEFS,
  GOVERNANCE_SIGNAL_LABELS,
  REVIEW_OUTCOME_GOVERNANCE,
} from "@/lib/work-queue/console-cadence-governance";
import type {
  CadenceStepId,
  SLACategoryId,
  LeadInterventionCaseId,
  GovernanceSignalId,
} from "@/lib/work-queue/console-cadence-governance";
import type { ActivityLogEntry } from "@/lib/work-queue/console-accountability";
import type { WorkQueueItem } from "@/lib/work-queue/work-queue-service";

// ── Test Helpers ──

const NOW = new Date("2026-03-17T12:00:00Z"); // Tuesday

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

// ── §1: Cadence Status Tests (4 tests) ──

describe("evaluateCadenceStatuses", () => {
  test("returns 4 cadence steps", () => {
    const statuses = evaluateCadenceStatuses([], [], "user-1", NOW);
    expect(statuses).toHaveLength(4);
    const ids = statuses.map((s: { stepId: string }) => s.stepId);
    expect(ids).toContain("start_of_day_review");
    expect(ids).toContain("midday_escalation_check");
    expect(ids).toContain("end_of_day_carryover");
    expect(ids).toContain("weekly_bottleneck_review");
  });

  test("start_of_day counts urgent and overdue items", () => {
    const items = [
      // urgent_blocker + assigned → urgent_now
      makeItem({
        id: "a",
        assigneeId: "user-1",
        taskStatus: "BLOCKED",
        updatedAt: hoursAgo(2),
      }),
    ];
    const statuses = evaluateCadenceStatuses(items, [], "user-1", NOW);
    const sod = statuses.find((s: { stepId: string }) => s.stepId === "start_of_day_review")!;
    expect(sod.pendingItemCount).toBeGreaterThanOrEqual(1);
    expect(sod.isRelevant).toBe(true);
  });

  test("marks weekly review as not relevant on non-Monday", () => {
    // NOW is Tuesday (2026-03-17)
    const statuses = evaluateCadenceStatuses([], [], "user-1", NOW);
    const weekly = statuses.find((s: { stepId: string }) => s.stepId === "weekly_bottleneck_review")!;
    expect(weekly.isRelevant).toBe(false);
  });

  test("marks cadence step as completed when log exists", () => {
    const logs = [
      makeLog({
        activityType: "CADENCE_START_OF_DAY",
        createdAt: NOW, // today
      }),
    ];
    const statuses = evaluateCadenceStatuses([], logs, "user-1", NOW);
    const sod = statuses.find((s: { stepId: string }) => s.stepId === "start_of_day_review")!;
    expect(sod.isRelevant).toBe(false); // completed
    expect(sod.description).toContain("완료");
  });
});

// ── §2: SLA Status Tests (6 tests) ──

describe("evaluateSLAStatuses", () => {
  test("returns 6 SLA categories", () => {
    const statuses = evaluateSLAStatuses([], [], NOW);
    expect(statuses).toHaveLength(6);
    const ids = statuses.map((s: { categoryId: string }) => s.categoryId);
    expect(ids).toContain("first_action_latency");
    expect(ids).toContain("urgent_resolution");
    expect(ids).toContain("handoff_acceptance");
    expect(ids).toContain("blocked_resolution");
    expect(ids).toContain("reassignment_stability");
    expect(ids).toContain("review_completion");
  });

  test("first_action_latency: within target when recent", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        createdAt: hoursAgo(2), // 2h ago
        updatedAt: hoursAgo(2),
      }),
    ];
    const logs = [
      makeLog({
        activityType: "STATUS_UPDATE",
        entityId: "a",
        createdAt: hoursAgo(1), // first action 1h after creation
      }),
    ];
    const statuses = evaluateSLAStatuses(items, logs, NOW);
    const fal = statuses.find((s: { categoryId: string }) => s.categoryId === "first_action_latency")!;
    expect(fal.withinTarget).toBe(1);
    expect(fal.breached).toBe(0);
  });

  test("first_action_latency: breached when no action for 10h", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        createdAt: hoursAgo(10),
        updatedAt: hoursAgo(10),
      }),
    ];
    const statuses = evaluateSLAStatuses(items, [], NOW);
    const fal = statuses.find((s: { categoryId: string }) => s.categoryId === "first_action_latency")!;
    expect(fal.breached).toBe(1);
    expect(fal.complianceRate).toBe(0);
  });

  test("urgent_resolution: tracks urgent items against 24h breach", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        taskStatus: "BLOCKED", // urgent_blocker tier
        createdAt: hoursAgo(30),
        updatedAt: hoursAgo(30),
      }),
    ];
    const statuses = evaluateSLAStatuses(items, [], NOW);
    const ur = statuses.find((s: { categoryId: string }) => s.categoryId === "urgent_resolution")!;
    expect(ur.breached).toBe(1);
  });

  test("handoff_acceptance: detects pending handoffs", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: {
          assignmentState: "handed_off",
          handoff: { handedOffAt: hoursAgo(14).toISOString() },
        },
      }),
    ];
    const statuses = evaluateSLAStatuses(items, [], NOW);
    const ha = statuses.find((s: { categoryId: string }) => s.categoryId === "handoff_acceptance")!;
    expect(ha.totalItems).toBe(1);
    expect(ha.breached).toBe(1); // 14h > 12h breach
  });

  test("review_completion: tracks reviewed vs unreviewed", () => {
    const items = [
      makeItem({
        id: "a",
        metadata: {
          reviewHistory: [{
            reviewedBy: "user-1",
            reviewedAt: NOW.toISOString(),
            reviewOutcome: "keep_with_owner",
            reviewNote: "",
            resultingOwnerId: null,
            resultingState: null,
          }],
        },
      }),
      makeItem({ id: "b" }), // not reviewed today
    ];
    const statuses = evaluateSLAStatuses(items, [], NOW);
    const rc = statuses.find((s: { categoryId: string }) => s.categoryId === "review_completion")!;
    expect(rc.withinTarget).toBe(1);
    expect(rc.breached).toBe(1);
    expect(rc.complianceRate).toBe(0.5);
  });
});

// ── §3: Lead Intervention Trigger Tests (5 tests) ──

describe("evaluateLeadInterventionTriggers", () => {
  test("returns 5 intervention cases", () => {
    const triggers = evaluateLeadInterventionTriggers([], [], NOW);
    expect(triggers).toHaveLength(5);
    const ids = triggers.map((t: { caseId: string }) => t.caseId);
    expect(ids).toContain("repeated_reassignment");
    expect(ids).toContain("carry_over_escalation");
    expect(ids).toContain("sla_breach_cluster");
    expect(ids).toContain("blocked_without_action");
    expect(ids).toContain("operator_overload");
  });

  test("repeated_reassignment triggers on 3+ reassignments", () => {
    const items = [makeItem({ id: "a", assigneeId: "user-1" })];
    const logs = [
      makeLog({ activityType: "ITEM_ASSIGNED", entityId: "a" }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
    ];
    const triggers = evaluateLeadInterventionTriggers(items, logs, NOW);
    const rr = triggers.find((t: { caseId: string }) => t.caseId === "repeated_reassignment")!;
    expect(rr.triggered).toBe(true);
    expect(rr.affectedItemIds).toContain("a");
  });

  test("carry_over_escalation triggers on 2+ day carry-over", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: {
          reviewHistory: [{
            reviewedBy: "user-2",
            reviewedAt: daysAgo(3).toISOString(),
            reviewOutcome: "carry_to_next",
            reviewNote: "",
            resultingOwnerId: null,
            resultingState: null,
          }],
          carryOver: {
            fromDate: "2026-03-14",
            reason: "overdue_owned",
            dayCount: 3,
            severityPromoted: true,
            originalCategory: "overdue_owned",
          },
        },
      }),
    ];
    const triggers = evaluateLeadInterventionTriggers(items, [], NOW);
    const co = triggers.find((t: { caseId: string }) => t.caseId === "carry_over_escalation")!;
    expect(co.triggered).toBe(true);
  });

  test("blocked_without_action triggers on 48h+ blocked with no recent log", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: {
          assignmentState: "blocked",
          blockedAt: hoursAgo(50).toISOString(),
        },
        updatedAt: hoursAgo(50),
      }),
    ];
    // No logs in last 24h
    const logs = [
      makeLog({ entityId: "a", createdAt: hoursAgo(49) }),
    ];
    const triggers = evaluateLeadInterventionTriggers(items, logs, NOW);
    const bwa = triggers.find((t: { caseId: string }) => t.caseId === "blocked_without_action")!;
    expect(bwa.triggered).toBe(true);
    expect(bwa.affectedItemIds).toContain("a");
  });

  test("operator_overload triggers on 5+ urgent items for one user", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({
        id: `item-${i}`,
        assigneeId: "user-1",
        taskStatus: "BLOCKED", // urgent_blocker tier
      }),
    );
    const triggers = evaluateLeadInterventionTriggers(items, [], NOW);
    const ol = triggers.find((t: { caseId: string }) => t.caseId === "operator_overload")!;
    expect(ol.triggered).toBe(true);
    expect(ol.affectedUserIds).toContain("user-1");
    expect(ol.affectedItemIds).toHaveLength(5);
  });
});

// ── §4: Review Outcome Governance Tests (3 tests) ──

describe("Review Outcome Governance", () => {
  test("keep_with_owner has no carry-over reason and preserves history", () => {
    const gov = getReviewOutcomeGovernance("keep_with_owner");
    expect(gov.carryOverReasonCode).toBeNull();
    expect(gov.preservesHistory).toBe(true);
  });

  test("carry_to_next maps to overdue_owned carry-over reason", () => {
    const reason = getCarryOverReasonForOutcome("carry_to_next");
    expect(reason).toBe("overdue_owned");
  });

  test("blocked_followup maps to blocked_unresolved carry-over reason", () => {
    const reason = getCarryOverReasonForOutcome("blocked_followup");
    expect(reason).toBe("blocked_unresolved");
  });
});

// ── §5: Governance Signals Tests (3 tests) ──

describe("computeGovernanceSignals", () => {
  test("returns 6 governance signals", () => {
    const signals = computeGovernanceSignals([], [], "user-1", NOW);
    expect(signals).toHaveLength(6);
    const ids = signals.map((s: { signalId: string }) => s.signalId);
    expect(ids).toContain("daily_unresolved_urgent");
    expect(ids).toContain("carry_over_by_reason");
    expect(ids).toContain("blocked_aging");
    expect(ids).toContain("reassignment_hotspots");
    expect(ids).toContain("avg_first_action_latency");
    expect(ids).toContain("lead_intervention_count");
  });

  test("daily_unresolved_urgent counts urgent_now + overdue_owned", () => {
    const items = [
      // urgent_now: BLOCKED + assigned + recent
      makeItem({
        id: "a",
        assigneeId: "user-1",
        taskStatus: "BLOCKED",
        updatedAt: hoursAgo(2),
      }),
    ];
    const signals = computeGovernanceSignals(items, [], "user-1", NOW);
    const dur = signals.find((s: { signalId: string }) => s.signalId === "daily_unresolved_urgent")!;
    expect(dur.value).toBeGreaterThanOrEqual(1);
  });

  test("lead_intervention_count tracks ITEM_ESCALATED logs", () => {
    const logs = [
      makeLog({ activityType: "ITEM_ESCALATED", entityId: "a" }),
      makeLog({ activityType: "ITEM_ESCALATED", entityId: "b" }),
    ];
    const signals = computeGovernanceSignals([], logs, "user-1", NOW);
    const lic = signals.find((s: { signalId: string }) => s.signalId === "lead_intervention_count")!;
    expect(lic.value).toBe(2);
    expect(lic.breakdown.escalated).toBe(2);
  });
});

// ── Composite: Governance Report Test (1 test) ──

describe("generateGovernanceReport", () => {
  test("returns complete report with all sections", () => {
    const report = generateGovernanceReport([], [], "user-1", NOW);
    expect(report.date).toBe("2026-03-17");
    expect(report.cadenceStatuses).toHaveLength(4);
    expect(report.slaStatuses).toHaveLength(6);
    expect(report.interventionTriggers).toHaveLength(5);
    expect(report.signals).toHaveLength(6);
  });
});

// ── Definition Integrity Tests (4 tests) ──

describe("Definition Integrity", () => {
  test("all cadence step defs have Korean labels", () => {
    for (const [id, def] of Object.entries(CADENCE_STEP_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(CADENCE_STEP_LABELS[id as CadenceStepId]).toBe(def.label);
    }
  });

  test("all SLA category defs have Korean labels", () => {
    for (const [id, def] of Object.entries(SLA_CATEGORY_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(SLA_CATEGORY_LABELS[id as SLACategoryId]).toBe(def.label);
    }
  });

  test("all lead intervention defs have Korean labels", () => {
    for (const [id, def] of Object.entries(LEAD_INTERVENTION_CASE_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(LEAD_INTERVENTION_LABELS[id as LeadInterventionCaseId]).toBe(def.label);
    }
  });

  test("all governance signal defs have Korean labels", () => {
    for (const [id, def] of Object.entries(GOVERNANCE_SIGNAL_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(GOVERNANCE_SIGNAL_LABELS[id as GovernanceSignalId]).toBe(def.label);
    }
  });
});

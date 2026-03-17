/**
 * Console Bottleneck Remediation Tests
 *
 * §1 병목 탐지, §2 개선 항목 상태 전이, §3 주간 검토,
 * §4 거버넌스→개선 연결, §5 콘솔 가시화, §6 보고 신호, 정의 무결성.
 */

import {
  detectBottlenecks,
  canTransitionRemediation,
  applyRemediationTransition,
  buildRemediationItem,
  buildWeeklyReviewOutcome,
  buildRemediationConsoleView,
  computeRemediationReportSignals,
  BOTTLENECK_CLASS_DEFS,
  BOTTLENECK_CLASS_LABELS,
  REMEDIATION_STATUS_DEFS,
  REMEDIATION_STATUS_LABELS,
  GOVERNANCE_REMEDIATION_LINKS,
} from "@/lib/work-queue/console-bottleneck-remediation";
import type {
  BottleneckClassId,
  RemediationItem,
  RemediationStatus,
  DetectedBottleneck,
} from "@/lib/work-queue/console-bottleneck-remediation";
import type { ActivityLogEntry } from "@/lib/work-queue/console-accountability";
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

function makeRemediation(overrides: Partial<RemediationItem> = {}): RemediationItem {
  return {
    remediationId: "rem-" + Math.random().toString(36).slice(2, 8),
    bottleneckType: "repeated_sla_breach",
    sourceMetric: "sla_breach_count",
    sourceRule: "test rule",
    severity: "high",
    summary: "Test remediation",
    owner: "user-1",
    createdAt: daysAgo(3).toISOString(),
    dueAt: new Date(NOW.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    status: "open",
    linkedQueueFamily: null,
    linkedEntityType: null,
    reviewContext: "test context",
    resolutionNote: null,
    affectedItemIds: [],
    affectedUserIds: [],
    ...overrides,
  };
}

function makeBottleneck(overrides: Partial<DetectedBottleneck> = {}): DetectedBottleneck {
  return {
    bottleneckType: "repeated_sla_breach",
    severity: "high",
    affectedItemIds: [],
    affectedUserIds: [],
    detail: "test",
    metric: "test_metric",
    metricValue: 5,
    remediationRequired: true,
    existingRemediationId: null,
    ...overrides,
  };
}

// ── §1: Bottleneck Detection Tests (5 tests) ──

describe("detectBottlenecks", () => {
  test("returns 7 bottleneck classes", () => {
    const results = detectBottlenecks([], [], [], "user-1", NOW);
    expect(results).toHaveLength(7);
    const types = results.map((r: DetectedBottleneck) => r.bottleneckType);
    expect(types).toContain("repeated_sla_breach");
    expect(types).toContain("repeated_carry_over");
    expect(types).toContain("repeated_reassignment_hotspot");
    expect(types).toContain("blocked_work_hotspot");
    expect(types).toContain("handoff_failure_hotspot");
    expect(types).toContain("owner_role_latency_hotspot");
    expect(types).toContain("queue_type_throughput_hotspot");
  });

  test("detects repeated carry-over on items with 3+ day carryOver", () => {
    const items = [
      makeItem({
        id: "a",
        assigneeId: "user-1",
        metadata: {
          reviewHistory: [{
            reviewedBy: "user-2",
            reviewedAt: daysAgo(4).toISOString(),
            reviewOutcome: "carry_to_next",
            reviewNote: "",
            resultingOwnerId: null,
            resultingState: null,
          }],
          carryOver: {
            fromDate: "2026-03-13",
            reason: "overdue_owned",
            dayCount: 4,
            severityPromoted: true,
            originalCategory: "overdue_owned",
          },
        },
      }),
    ];
    const results = detectBottlenecks(items, [], [], "user-1", NOW);
    const co = results.find((r: DetectedBottleneck) => r.bottleneckType === "repeated_carry_over")!;
    expect(co.remediationRequired).toBe(true);
    expect(co.affectedItemIds).toContain("a");
    expect(co.metricValue).toBe(1);
  });

  test("detects repeated reassignment hotspot on 5+ reassignments", () => {
    const items = [makeItem({ id: "a", assigneeId: "user-1" })];
    const logs = Array.from({ length: 5 }, () =>
      makeLog({ activityType: "ITEM_REASSIGNED", entityId: "a" }),
    );
    const results = detectBottlenecks(items, logs, [], "user-1", NOW);
    const ra = results.find((r: DetectedBottleneck) => r.bottleneckType === "repeated_reassignment_hotspot")!;
    expect(ra.remediationRequired).toBe(true);
    expect(ra.affectedItemIds).toContain("a");
  });

  test("detects blocked work hotspot with 3+ items blocked 48h+", () => {
    const items = Array.from({ length: 3 }, (_, i) =>
      makeItem({
        id: `blocked-${i}`,
        assigneeId: "user-1",
        metadata: {
          assignmentState: "blocked",
          blockedAt: hoursAgo(50).toISOString(),
        },
        updatedAt: hoursAgo(50),
      }),
    );
    const results = detectBottlenecks(items, [], [], "user-1", NOW);
    const bw = results.find((r: DetectedBottleneck) => r.bottleneckType === "blocked_work_hotspot")!;
    expect(bw.remediationRequired).toBe(true);
    expect(bw.metricValue).toBe(3);
  });

  test("links existing remediation when active remediation exists", () => {
    const rem = makeRemediation({
      remediationId: "rem-existing",
      bottleneckType: "repeated_carry_over",
    });
    const results = detectBottlenecks([], [], [rem], "user-1", NOW);
    const co = results.find((r: DetectedBottleneck) => r.bottleneckType === "repeated_carry_over")!;
    expect(co.existingRemediationId).toBe("rem-existing");
  });
});

// ── §2: Remediation Status Transitions (4 tests) ──

describe("Remediation Status Transitions", () => {
  test("open can transition to in_progress, deferred, resolved", () => {
    expect(canTransitionRemediation("open", "in_progress")).toBe(true);
    expect(canTransitionRemediation("open", "deferred")).toBe(true);
    expect(canTransitionRemediation("open", "resolved")).toBe(true);
    expect(canTransitionRemediation("open", "blocked")).toBe(false);
  });

  test("resolved is terminal — no transitions allowed", () => {
    expect(canTransitionRemediation("resolved", "open")).toBe(false);
    expect(canTransitionRemediation("resolved", "in_progress")).toBe(false);
    expect(canTransitionRemediation("resolved", "deferred")).toBe(false);
  });

  test("applyRemediationTransition updates status and produces log event", () => {
    const rem = makeRemediation({ status: "open" });
    const result = applyRemediationTransition(rem, "in_progress", {
      actorUserId: "user-1",
      note: "작업 시작",
      now: NOW,
    });
    expect(result.updatedRemediation.status).toBe("in_progress");
    expect(result.logEvent).toBe("REMEDIATION_STATUS_CHANGED");
    expect(result.logMetadata.fromStatus).toBe("open");
    expect(result.logMetadata.toStatus).toBe("in_progress");
  });

  test("applyRemediationTransition throws on invalid transition", () => {
    const rem = makeRemediation({ status: "resolved" });
    expect(() =>
      applyRemediationTransition(rem, "open", { actorUserId: "user-1" }),
    ).toThrow("Invalid transition");
  });
});

// ── §2: Build Remediation Item (2 tests) ──

describe("buildRemediationItem", () => {
  test("creates remediation with correct fields from bottleneck", () => {
    const bottleneck = makeBottleneck({
      bottleneckType: "blocked_work_hotspot",
      severity: "medium",
      affectedItemIds: ["a", "b"],
    });
    const rem = buildRemediationItem({
      remediationId: "rem-1",
      bottleneck,
      owner: "user-1",
      summary: "차단 해소 조치",
      reviewContext: "주간 검토 #5",
      now: NOW,
    });
    expect(rem.remediationId).toBe("rem-1");
    expect(rem.bottleneckType).toBe("blocked_work_hotspot");
    expect(rem.severity).toBe("medium");
    expect(rem.status).toBe("open");
    expect(rem.owner).toBe("user-1");
    expect(rem.affectedItemIds).toEqual(["a", "b"]);
  });

  test("sets due date 7 days from now by default", () => {
    const bottleneck = makeBottleneck();
    const rem = buildRemediationItem({
      remediationId: "rem-2",
      bottleneck,
      owner: "user-1",
      summary: "test",
      reviewContext: "test",
      now: NOW,
    });
    const dueDate = new Date(rem.dueAt);
    const expectedDue = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(dueDate.toISOString().slice(0, 10)).toBe(expectedDue.toISOString().slice(0, 10));
  });
});

// ── §3: Weekly Review Outcome (2 tests) ──

describe("buildWeeklyReviewOutcome", () => {
  test("builds review with detected bottlenecks and summary", () => {
    const bottlenecks = [
      makeBottleneck({ severity: "high", metricValue: 5 }),
      makeBottleneck({ severity: "low", metricValue: 1 }),
    ];
    const outcome = buildWeeklyReviewOutcome({
      bottlenecks,
      remediations: [],
      createdRemediationIds: ["rem-1"],
      resolvedRemediationIds: ["rem-old"],
      deferredRemediationIds: [],
      reviewedBy: "lead-1",
      now: NOW,
    });
    expect(outcome.reviewDate).toBe("2026-03-17");
    expect(outcome.bottlenecksDetected).toHaveLength(1); // only high, not low
    expect(outcome.remediationsCreated).toContain("rem-1");
    expect(outcome.remediationsResolved).toContain("rem-old");
    expect(outcome.summary).toContain("병목 1건");
  });

  test("identifies recurring hotspots without remediation", () => {
    const bottlenecks = [
      makeBottleneck({
        bottleneckType: "repeated_carry_over",
        severity: "high",
        metricValue: 3,
        remediationRequired: true,
        existingRemediationId: null,
      }),
    ];
    const outcome = buildWeeklyReviewOutcome({
      bottlenecks,
      remediations: [],
      createdRemediationIds: [],
      resolvedRemediationIds: [],
      deferredRemediationIds: [],
      reviewedBy: "lead-1",
      now: NOW,
    });
    expect(outcome.recurringWithoutRemediation).toHaveLength(1);
    expect(outcome.recurringWithoutRemediation[0].bottleneckType).toBe("repeated_carry_over");
  });
});

// ── §5: Remediation Console View (3 tests) ──

describe("buildRemediationConsoleView", () => {
  test("counts open, high-severity, due-soon, overdue correctly", () => {
    const remediations = [
      makeRemediation({ status: "open", severity: "high", dueAt: new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() }),
      makeRemediation({ status: "in_progress", severity: "critical", dueAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() }),
      makeRemediation({ status: "resolved" }),
    ];
    const view = buildRemediationConsoleView(remediations, [], NOW);
    expect(view.openCount).toBe(2); // open + in_progress
    expect(view.highSeverityCount).toBe(2); // high + critical
    expect(view.dueSoonCount).toBe(1); // due within 3 days
    expect(view.overdueCount).toBe(1); // past due
  });

  test("links remediations to active bottlenecks", () => {
    const remediations = [
      makeRemediation({ bottleneckType: "blocked_work_hotspot", status: "open" }),
    ];
    const bottlenecks = [
      makeBottleneck({ bottleneckType: "blocked_work_hotspot", severity: "medium", metricValue: 5 }),
    ];
    const view = buildRemediationConsoleView(remediations, bottlenecks, NOW);
    expect(view.linkedToCurrentHotspots).toHaveLength(1);
  });

  test("includes recently resolved remediations", () => {
    const remediations = [
      makeRemediation({ status: "resolved", createdAt: daysAgo(2).toISOString() }),
      makeRemediation({ status: "resolved", createdAt: daysAgo(10).toISOString() }),
    ];
    const view = buildRemediationConsoleView(remediations, [], NOW);
    expect(view.recentlyResolved).toHaveLength(1); // only within 7 days
  });
});

// ── §6: Close-the-Loop Reporting (3 tests) ──

describe("computeRemediationReportSignals", () => {
  test("counts recurring hotspots and remediation stats", () => {
    const bottlenecks = [
      makeBottleneck({ severity: "high", metricValue: 5 }),
      makeBottleneck({ severity: "low", metricValue: 1 }),
    ];
    const remediations = [
      makeRemediation({ status: "open" }),
      makeRemediation({ status: "resolved" }),
    ];
    const signals = computeRemediationReportSignals(bottlenecks, remediations, NOW);
    expect(signals.recurringHotspotCount).toBe(1); // only high, not low
    expect(signals.remediationOpenedCount).toBe(1); // open only
    expect(signals.remediationResolvedCount).toBe(1);
  });

  test("detects hotspot without any remediation", () => {
    const bottlenecks = [
      makeBottleneck({
        bottleneckType: "repeated_carry_over",
        severity: "high",
        metricValue: 3,
        remediationRequired: true,
        existingRemediationId: null,
      }),
    ];
    const signals = computeRemediationReportSignals(bottlenecks, [], NOW);
    expect(signals.hotspotWithoutRemediationCount).toBe(1);
  });

  test("detects hotspot recurrence after remediation", () => {
    const bottlenecks = [
      makeBottleneck({
        bottleneckType: "repeated_sla_breach",
        severity: "high",
        metricValue: 5,
      }),
    ];
    const remediations = [
      makeRemediation({
        bottleneckType: "repeated_sla_breach",
        status: "resolved",
      }),
    ];
    const signals = computeRemediationReportSignals(bottlenecks, remediations, NOW);
    expect(signals.hotspotRecurrenceAfterRemediationCount).toBe(1);
  });
});

// ── Definition Integrity Tests (3 tests) ──

describe("Definition Integrity", () => {
  test("all bottleneck class defs have Korean labels", () => {
    for (const [id, def] of Object.entries(BOTTLENECK_CLASS_DEFS) as [BottleneckClassId, { label: string }][]) {
      expect(def.label).toBeTruthy();
      expect(BOTTLENECK_CLASS_LABELS[id]).toBe(def.label);
    }
  });

  test("all remediation statuses have labels and terminal flag", () => {
    for (const [id, def] of Object.entries(REMEDIATION_STATUS_DEFS) as [RemediationStatus, { label: string; isTerminal: boolean }][]) {
      expect(def.label).toBeTruthy();
      expect(REMEDIATION_STATUS_LABELS[id]).toBe(def.label);
      expect(typeof def.isTerminal).toBe("boolean");
    }
  });

  test("all governance remediation links match bottleneck class IDs", () => {
    for (const [id, link] of Object.entries(GOVERNANCE_REMEDIATION_LINKS) as [BottleneckClassId, { bottleneckType: string; whoCanCreate: string[] }][]) {
      expect(BOTTLENECK_CLASS_DEFS[id]).toBeDefined();
      expect(link.bottleneckType).toBe(id);
      expect(link.whoCanCreate.length).toBeGreaterThan(0);
    }
  });
});

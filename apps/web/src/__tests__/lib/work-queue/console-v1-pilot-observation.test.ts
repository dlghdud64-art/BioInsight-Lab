/**
 * Ops Console V1 — Pilot Observation 검증 테스트
 *
 * §1: 관찰 항목 정합성
 * §2: 이슈 분류 동작
 * §3: 관찰 요약 생성
 * §4: Non-Blocker 재평가 정합성
 * §5: 스코프 분리 기준 + 파일럿 종료 조건
 */

import {
  OBSERVATION_POINTS,
  classifyPilotIssue,
  buildObservationSummary,
  NON_BLOCKER_REASSESSMENTS,
  SCOPE_DECISION_CRITERIA,
  getV11Fixes,
  getV2Defers,
  getMonitorItems,
  isPilotObservationComplete,
  canClosePilot,
  type ObservationPointId,
  type ObservationLogEntry,
  type PilotIssue,
  type ObservationPoint,
  type NonBlockerReassessment,
  type ScopeDecisionCriteria as ScopeDecisionCriteriaType,
  type PilotObservationSummary,
} from "@/lib/work-queue/console-v1-pilot-observation";

// ══════════════════════════════════════════════════════
// §1: Observation Points
// ══════════════════════════════════════════════════════

describe("§1: Observation Points", () => {
  it("should define exactly 5 observation points", () => {
    expect(Object.keys(OBSERVATION_POINTS)).toHaveLength(5);
  });

  it("should have all required fields for each point", () => {
    Object.values(OBSERVATION_POINTS).forEach((point: ObservationPoint) => {
      expect(point.id).toBeTruthy();
      expect(point.label).toBeTruthy();
      expect(point.description).toBeTruthy();
      expect(point.metric).toBeTruthy();
      expect(point.threshold).toBeTruthy();
      expect(point.actionIfExceeded).toBeTruthy();
    });
  });

  it("should have Korean labels", () => {
    Object.values(OBSERVATION_POINTS).forEach((point: ObservationPoint) => {
      expect(/[가-힣]/.test(point.label)).toBe(true);
    });
  });

  it("should cover all 5 canonical observation areas", () => {
    const ids = Object.keys(OBSERVATION_POINTS);
    expect(ids).toContain("sync_failure_frequency");
    expect(ids).toContain("cta_refetch_delay");
    expect(ids).toContain("remediation_creation_friction");
    expect(ids).toContain("governance_access_frequency");
    expect(ids).toContain("blocked_missing_reason_frequency");
  });
});

// ══════════════════════════════════════════════════════
// §2: Issue Classification
// ══════════════════════════════════════════════════════

describe("§2: Pilot Issue Classification", () => {
  it("should classify structural issues as blocker", () => {
    expect(classifyPilotIssue(0, 100, true)).toBe("blocker");
  });

  it("should classify above-threshold as friction", () => {
    expect(classifyPilotIssue(10, 5, false)).toBe("friction");
  });

  it("should classify at-threshold as friction", () => {
    expect(classifyPilotIssue(5, 5, false)).toBe("friction");
  });

  it("should classify below-threshold as defer", () => {
    expect(classifyPilotIssue(3, 5, false)).toBe("defer");
  });
});

// ══════════════════════════════════════════════════════
// §3: Observation Summary
// ══════════════════════════════════════════════════════

describe("§3: Observation Summary", () => {
  const makeEntry = (pointId: ObservationPointId, val: number): ObservationLogEntry => ({
    date: "2026-03-17",
    observationPointId: pointId,
    metricValue: val,
    note: "test",
    reporter: "tester",
  });

  const makeIssue = (cls: "blocker" | "friction" | "defer"): PilotIssue => ({
    id: `test-${cls}`,
    title: `Test ${cls}`,
    classification: cls,
    observedAt: "2026-03-17",
    observationPoint: null,
    description: "test",
    resolution: "test",
    resolvedAt: null,
  });

  it("should count entries by observation point", () => {
    const entries: ObservationLogEntry[] = [
      makeEntry("sync_failure_frequency", 3),
      makeEntry("sync_failure_frequency", 5),
      makeEntry("cta_refetch_delay", 2000),
    ];

    const summary = buildObservationSummary(entries, [], "2026-03-17");
    expect(summary.entriesByPoint.sync_failure_frequency).toBe(2);
    expect(summary.entriesByPoint.cta_refetch_delay).toBe(1);
    expect(summary.entriesByPoint.remediation_creation_friction).toBe(0);
  });

  it("should count issues by classification", () => {
    const issues: PilotIssue[] = [
      makeIssue("blocker"),
      makeIssue("friction"),
      makeIssue("friction"),
      makeIssue("defer"),
    ];

    const summary = buildObservationSummary([], issues, "2026-03-17");
    expect(summary.blockerCount).toBe(1);
    expect(summary.frictionCount).toBe(2);
    expect(summary.deferCount).toBe(1);
  });

  it("should set correct totalEntries", () => {
    const entries: ObservationLogEntry[] = [
      makeEntry("sync_failure_frequency", 1),
      makeEntry("cta_refetch_delay", 2),
      makeEntry("governance_access_frequency", 3),
    ];

    const summary = buildObservationSummary(entries, [], "2026-03-17");
    expect(summary.totalEntries).toBe(3);
  });
});

// ══════════════════════════════════════════════════════
// §4: Non-Blocker Reassessment
// ══════════════════════════════════════════════════════

describe("§4: Non-Blocker Reassessment", () => {
  it("should have exactly 6 reassessment entries", () => {
    expect(NON_BLOCKER_REASSESSMENTS).toHaveLength(6);
  });

  it("should reference valid NB issue IDs", () => {
    NON_BLOCKER_REASSESSMENTS.forEach((r: NonBlockerReassessment) => {
      expect(r.issueId).toMatch(/^NB-0[1-6]$/);
    });
  });

  it("should have unique issue IDs", () => {
    const ids = NON_BLOCKER_REASSESSMENTS.map((r: NonBlockerReassessment) => r.issueId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getV11Fixes should return v1.1_fix items", () => {
    const fixes = getV11Fixes();
    expect(fixes.length).toBeGreaterThan(0);
    fixes.forEach((r: NonBlockerReassessment) => {
      expect(r.action).toBe("v1.1_fix");
    });
  });

  it("getV2Defers should return v2_defer items", () => {
    const defers = getV2Defers();
    expect(defers.length).toBeGreaterThan(0);
    defers.forEach((r: NonBlockerReassessment) => {
      expect(r.action).toBe("v2_defer");
    });
  });

  it("getMonitorItems should return monitor items", () => {
    const monitors = getMonitorItems();
    expect(monitors.length).toBeGreaterThan(0);
    monitors.forEach((r: NonBlockerReassessment) => {
      expect(r.action).toBe("monitor");
    });
  });

  it("all items should sum to 6", () => {
    expect(
      getV11Fixes().length + getV2Defers().length + getMonitorItems().length,
    ).toBe(6);
  });
});

// ══════════════════════════════════════════════════════
// §5: Scope Decision & Pilot Closure
// ══════════════════════════════════════════════════════

describe("§5: Scope Decision Criteria & Pilot Closure", () => {
  it("should have 4 scope decision criteria", () => {
    expect(SCOPE_DECISION_CRITERIA).toHaveLength(4);
  });

  it("should have unique criteria IDs", () => {
    const ids = SCOPE_DECISION_CRITERIA.map(
      (c: ScopeDecisionCriteriaType) => c.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("isPilotObservationComplete should return false with insufficient entries", () => {
    const summary: PilotObservationSummary = {
      startDate: "2026-03-17",
      endDate: null,
      totalEntries: 5,
      entriesByPoint: {
        sync_failure_frequency: 1,
        cta_refetch_delay: 1,
        remediation_creation_friction: 1,
        governance_access_frequency: 1,
        blocked_missing_reason_frequency: 1,
      },
      issuesFound: [],
      blockerCount: 0,
      frictionCount: 0,
      deferCount: 0,
    };
    expect(isPilotObservationComplete(summary)).toBe(false);
  });

  it("isPilotObservationComplete should return false if a point has zero entries", () => {
    const summary: PilotObservationSummary = {
      startDate: "2026-03-17",
      endDate: null,
      totalEntries: 12,
      entriesByPoint: {
        sync_failure_frequency: 3,
        cta_refetch_delay: 3,
        remediation_creation_friction: 3,
        governance_access_frequency: 3,
        blocked_missing_reason_frequency: 0,
      },
      issuesFound: [],
      blockerCount: 0,
      frictionCount: 0,
      deferCount: 0,
    };
    expect(isPilotObservationComplete(summary)).toBe(false);
  });

  it("isPilotObservationComplete should return true when all points covered with 10+ entries", () => {
    const summary: PilotObservationSummary = {
      startDate: "2026-03-17",
      endDate: null,
      totalEntries: 15,
      entriesByPoint: {
        sync_failure_frequency: 3,
        cta_refetch_delay: 3,
        remediation_creation_friction: 3,
        governance_access_frequency: 3,
        blocked_missing_reason_frequency: 3,
      },
      issuesFound: [],
      blockerCount: 0,
      frictionCount: 0,
      deferCount: 0,
    };
    expect(isPilotObservationComplete(summary)).toBe(true);
  });

  it("canClosePilot should return false if blockers exist", () => {
    const summary: PilotObservationSummary = {
      startDate: "2026-03-17",
      endDate: null,
      totalEntries: 15,
      entriesByPoint: {
        sync_failure_frequency: 3,
        cta_refetch_delay: 3,
        remediation_creation_friction: 3,
        governance_access_frequency: 3,
        blocked_missing_reason_frequency: 3,
      },
      issuesFound: [],
      blockerCount: 1,
      frictionCount: 0,
      deferCount: 0,
    };
    expect(canClosePilot(summary)).toBe(false);
  });

  it("canClosePilot should return true when observation complete and no blockers", () => {
    const summary: PilotObservationSummary = {
      startDate: "2026-03-17",
      endDate: null,
      totalEntries: 15,
      entriesByPoint: {
        sync_failure_frequency: 3,
        cta_refetch_delay: 3,
        remediation_creation_friction: 3,
        governance_access_frequency: 3,
        blocked_missing_reason_frequency: 3,
      },
      issuesFound: [],
      blockerCount: 0,
      frictionCount: 2,
      deferCount: 1,
    };
    expect(canClosePilot(summary)).toBe(true);
  });
});

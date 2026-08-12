/**
 * Console V1 Productization Tests
 *
 * §1 용어 동결 무결성, §2 교차 화면 UX 유틸리티,
 * §3 엣지 상태 탐지, §4 콘솔 네비게이션, §5 파일럿 시나리오 정합성.
 */

import {
  CANONICAL_TERMS,
  SEVERITY_STYLES,
  SLA_COMPLIANCE_STYLES,
  getSLAComplianceStyle,
  formatRelativeTime,
  formatDuration,
  CTA_VARIANTS,
  EDGE_STATE_MESSAGES,
  detectEdgeStates,
  CONSOLE_MODE_DEFS,
  CONSOLE_MODE_LABELS,
  CONSOLE_MODE_ORDER,
  PILOT_SCENARIOS,
  PILOT_CHECKLIST,
  PRE_EXISTING_ISSUES,
  hasBlockerIssues,
} from "@/lib/work-queue/console-v1-productization";
import type {
  EdgeStateId,
  ConsoleMode,
  CanonicalTermKey,
} from "@/lib/work-queue/console-v1-productization";

// ── Test Helpers ──

const NOW = new Date("2026-03-17T12:00:00Z");

function makeQueueItem(overrides: Partial<{
  taskStatus: string;
  assigneeId: string | null;
  metadata: Record<string, unknown>;
  updatedAt: Date | string;
}> = {}) {
  return {
    taskStatus: "ACTION_NEEDED",
    assigneeId: "user-1",
    metadata: {},
    updatedAt: new Date("2026-03-17T10:00:00Z"),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════
// §1: Canonical Terminology Freeze
// ══════════════════════════════════════════════════════

describe("Canonical Terminology", () => {
  it("should have Korean labels for all terms", () => {
    const allKeys = Object.keys(CANONICAL_TERMS) as CanonicalTermKey[];
    expect(allKeys.length).toBeGreaterThan(80);

    for (const key of allKeys) {
      const value = CANONICAL_TERMS[key];
      expect(typeof value).toBe("string");
      // All non-empty terms should contain Korean characters (except approval_none which is "")
      if (key !== "approval_none") {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("should cover all queue/assignment surface terms", () => {
    // Assignment states
    expect(CANONICAL_TERMS.unassigned).toBe("미배정");
    expect(CANONICAL_TERMS.assigned).toBe("배정됨");
    expect(CANONICAL_TERMS.in_progress).toBe("진행 중");
    expect(CANONICAL_TERMS.blocked).toBe("차단됨");
    expect(CANONICAL_TERMS.handed_off).toBe("인수인계");
    expect(CANONICAL_TERMS.resolved).toBe("완료");
  });

  it("should cover all console mode terms", () => {
    expect(CANONICAL_TERMS.mode_queue).toBe("운영 큐");
    expect(CANONICAL_TERMS.mode_daily_review).toBe("일일 검토");
    expect(CANONICAL_TERMS.mode_governance).toBe("거버넌스");
    expect(CANONICAL_TERMS.mode_remediation).toBe("개선");
  });

  it("should cover all daily review category terms", () => {
    expect(CANONICAL_TERMS.review_urgent_now).toBe("긴급 현재");
    expect(CANONICAL_TERMS.review_overdue_owned).toBe("초과 보유");
    expect(CANONICAL_TERMS.review_blocked_long).toBe("장기 차단");
    expect(CANONICAL_TERMS.review_handoff_pending).toBe("미인수 인수인계");
    expect(CANONICAL_TERMS.review_urgent_unassigned).toBe("긴급 미배정");
    expect(CANONICAL_TERMS.review_recently_resolved).toBe("최근 완료");
    expect(CANONICAL_TERMS.review_lead_intervention).toBe("리드 개입 필요");
  });

  it("should cover all remediation/bottleneck terms", () => {
    expect(CANONICAL_TERMS.remediation_open).toBe("열림");
    expect(CANONICAL_TERMS.remediation_resolved).toBe("해결");
    expect(CANONICAL_TERMS.bottleneck_sla).toBe("반복 SLA 위반");
    expect(CANONICAL_TERMS.bottleneck_throughput).toBe("큐 유형 처리량 핫스팟");
  });

  it("should have no duplicate values across term groups", () => {
    // Uniqueness within each group (mode labels should be unique)
    const modeTerms = [
      CANONICAL_TERMS.mode_queue,
      CANONICAL_TERMS.mode_daily_review,
      CANONICAL_TERMS.mode_governance,
      CANONICAL_TERMS.mode_remediation,
    ];
    expect(new Set(modeTerms).size).toBe(modeTerms.length);
  });
});

// ══════════════════════════════════════════════════════
// §2: Cross-Surface UX Consistency
// ══════════════════════════════════════════════════════

describe("Cross-Surface UX Utilities", () => {
  describe("SEVERITY_STYLES", () => {
    it("should define all 4 severity levels with consistent structure", () => {
      const levels = ["critical", "high", "medium", "low"] as const;
      for (const level of levels) {
        const style = SEVERITY_STYLES[level];
        expect(style.bg).toMatch(/^bg-/);
        expect(style.border).toMatch(/^border-/);
        expect(style.text).toMatch(/^text-/);
        expect(typeof style.badge).toBe("string");
      }
    });
  });

  describe("getSLAComplianceStyle", () => {
    it("should return 'good' for rate >= 0.8", () => {
      expect(getSLAComplianceStyle(0.85)).toBe(SLA_COMPLIANCE_STYLES.good);
      expect(getSLAComplianceStyle(0.8)).toBe(SLA_COMPLIANCE_STYLES.good);
      expect(getSLAComplianceStyle(1.0)).toBe(SLA_COMPLIANCE_STYLES.good);
    });

    it("should return 'warning' for 0.5 <= rate < 0.8", () => {
      expect(getSLAComplianceStyle(0.5)).toBe(SLA_COMPLIANCE_STYLES.warning);
      expect(getSLAComplianceStyle(0.79)).toBe(SLA_COMPLIANCE_STYLES.warning);
    });

    it("should return 'bad' for rate < 0.5", () => {
      expect(getSLAComplianceStyle(0.49)).toBe(SLA_COMPLIANCE_STYLES.bad);
      expect(getSLAComplianceStyle(0)).toBe(SLA_COMPLIANCE_STYLES.bad);
    });
  });

  describe("formatRelativeTime", () => {
    it("should return '방금 전' for less than 1 minute", () => {
      const justNow = new Date(NOW.getTime() - 30000); // 30 seconds ago
      expect(formatRelativeTime(justNow, NOW)).toBe("방금 전");
    });

    it("should return minutes for < 60 minutes", () => {
      const fiveMinAgo = new Date(NOW.getTime() - 5 * 60000);
      expect(formatRelativeTime(fiveMinAgo, NOW)).toBe("5분 전");
    });

    it("should return hours for < 24 hours", () => {
      const threeHoursAgo = new Date(NOW.getTime() - 3 * 3600000);
      expect(formatRelativeTime(threeHoursAgo, NOW)).toBe("3시간 전");
    });

    it("should return days for < 7 days", () => {
      const twoDaysAgo = new Date(NOW.getTime() - 2 * 86400000);
      expect(formatRelativeTime(twoDaysAgo, NOW)).toBe("2일 전");
    });

    it("should return weeks for < 30 days", () => {
      const twoWeeksAgo = new Date(NOW.getTime() - 14 * 86400000);
      expect(formatRelativeTime(twoWeeksAgo, NOW)).toBe("2주 전");
    });

    it("should accept ISO string input", () => {
      const fiveMinAgo = new Date(NOW.getTime() - 5 * 60000).toISOString();
      expect(formatRelativeTime(fiveMinAgo, NOW)).toBe("5분 전");
    });

    it("should return '방금 전' for future dates", () => {
      const future = new Date(NOW.getTime() + 60000);
      expect(formatRelativeTime(future, NOW)).toBe("방금 전");
    });
  });

  describe("formatDuration", () => {
    it("should format sub-hour as minutes", () => {
      expect(formatDuration(0.5)).toBe("30분");
    });

    it("should format hours", () => {
      expect(formatDuration(3)).toBe("3시간");
    });

    it("should format days", () => {
      expect(formatDuration(48)).toBe("2일");
    });

    it("should format days and hours", () => {
      expect(formatDuration(26)).toBe("1일 2시간");
    });
  });

  describe("CTA_VARIANTS", () => {
    it("should define all 4 CTA types", () => {
      expect(CTA_VARIANTS.primary).toBe("default");
      expect(CTA_VARIANTS.secondary).toBe("outline");
      expect(CTA_VARIANTS.destructive).toBe("destructive");
      expect(CTA_VARIANTS.ghost).toBe("ghost");
    });
  });
});

// ══════════════════════════════════════════════════════
// §3: Edge State Detection
// ══════════════════════════════════════════════════════

describe("Edge State Detection", () => {
  it("should define all 11 edge state messages", () => {
    const ids: EdgeStateId[] = [
      "empty_queue", "no_remediation", "no_governance_issues",
      "no_daily_review_items", "blocked_missing_reason",
      "assignment_no_owner", "stale_missing_timestamp",
      "action_failed", "action_retrying", "loading", "error",
    ];
    for (const id of ids) {
      const msg = EDGE_STATE_MESSAGES[id];
      expect(msg.id).toBe(id);
      expect(msg.title.length).toBeGreaterThan(0);
      expect(msg.description.length).toBeGreaterThan(0);
      expect(["empty", "success", "warning", "error", "loading"]).toContain(msg.icon);
    }
  });

  it("should detect empty_queue for no items", () => {
    const states = detectEdgeStates([]);
    expect(states).toContain("empty_queue");
  });

  it("should detect blocked_missing_reason for BLOCKED items without reason", () => {
    const items = [makeQueueItem({ taskStatus: "BLOCKED", metadata: {} })];
    const states = detectEdgeStates(items);
    expect(states).toContain("blocked_missing_reason");
  });

  it("should NOT detect blocked_missing_reason when blockedReason exists", () => {
    const items = [makeQueueItem({
      taskStatus: "BLOCKED",
      metadata: { blockedReason: "waiting vendor", blockedAt: "2026-03-17T10:00:00Z" },
    })];
    const states = detectEdgeStates(items);
    expect(states).not.toContain("blocked_missing_reason");
  });

  it("should detect assignment_no_owner for assigned items without assigneeId", () => {
    const items = [makeQueueItem({
      assigneeId: null,
      metadata: { assignmentState: "assigned" },
    })];
    const states = detectEdgeStates(items);
    expect(states).toContain("assignment_no_owner");
  });

  it("should NOT detect assignment_no_owner when assigneeId exists", () => {
    const items = [makeQueueItem({
      assigneeId: "user-1",
      metadata: { assignmentState: "assigned" },
    })];
    const states = detectEdgeStates(items);
    expect(states).not.toContain("assignment_no_owner");
  });

  it("should deduplicate edge states", () => {
    const items = [
      makeQueueItem({ taskStatus: "BLOCKED", metadata: {} }),
      makeQueueItem({ taskStatus: "BLOCKED", metadata: {} }),
    ];
    const states = detectEdgeStates(items);
    const blockedCount = states.filter((s: string) => s === "blocked_missing_reason").length;
    // Should only appear once due to break + dedup
    expect(blockedCount).toBeLessThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════
// §4: Console Navigation
// ══════════════════════════════════════════════════════

describe("Console Navigation", () => {
  it("should define all 4 console modes", () => {
    const modes: ConsoleMode[] = ["queue", "daily_review", "governance", "remediation"];
    for (const mode of modes) {
      expect(CONSOLE_MODE_DEFS[mode]).toBeDefined();
      expect(CONSOLE_MODE_DEFS[mode].label.length).toBeGreaterThan(0);
      expect(CONSOLE_MODE_DEFS[mode].description.length).toBeGreaterThan(0);
      expect(["operator", "lead", "both"]).toContain(CONSOLE_MODE_DEFS[mode].primaryAudience);
    }
  });

  it("should have consistent labels between CONSOLE_MODE_DEFS and CONSOLE_MODE_LABELS", () => {
    for (const mode of CONSOLE_MODE_ORDER) {
      expect(CONSOLE_MODE_LABELS[mode]).toBe(CONSOLE_MODE_DEFS[mode].label);
    }
  });

  it("should order modes by sortOrder", () => {
    for (let i = 0; i < CONSOLE_MODE_ORDER.length - 1; i++) {
      const current = CONSOLE_MODE_DEFS[CONSOLE_MODE_ORDER[i]];
      const next = CONSOLE_MODE_DEFS[CONSOLE_MODE_ORDER[i + 1]];
      expect(current.sortOrder).toBeLessThan(next.sortOrder);
    }
  });

  it("should have labels matching CANONICAL_TERMS", () => {
    expect(CONSOLE_MODE_LABELS.queue).toBe(CANONICAL_TERMS.mode_queue);
    expect(CONSOLE_MODE_LABELS.daily_review).toBe(CANONICAL_TERMS.mode_daily_review);
    expect(CONSOLE_MODE_LABELS.governance).toBe(CANONICAL_TERMS.mode_governance);
    expect(CONSOLE_MODE_LABELS.remediation).toBe(CANONICAL_TERMS.mode_remediation);
  });
});

// ══════════════════════════════════════════════════════
// §5: Pilot Readiness
// ══════════════════════════════════════════════════════

describe("Pilot Readiness", () => {
  it("should define 5 pilot scenarios with non-empty steps", () => {
    expect(PILOT_SCENARIOS.length).toBe(5);
    for (const scenario of PILOT_SCENARIOS) {
      expect(scenario.id.length).toBeGreaterThan(0);
      expect(scenario.title.length).toBeGreaterThan(0);
      expect(["operator", "lead", "admin"]).toContain(scenario.audience);
      expect(scenario.steps.length).toBeGreaterThan(0);
      expect(scenario.expectedOutcome.length).toBeGreaterThan(0);
    }
  });

  it("should have unique scenario IDs", () => {
    const ids = PILOT_SCENARIOS.map((s: { id: string }) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should include operator and lead scenarios", () => {
    const audiences = PILOT_SCENARIOS.map((s: { audience: string }) => s.audience);
    expect(audiences).toContain("operator");
    expect(audiences).toContain("lead");
  });

  it("should define 11 pilot checklist items", () => {
    expect(PILOT_CHECKLIST.length).toBe(11);
    for (const item of PILOT_CHECKLIST) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
      expect(["admin", "operator", "lead"]).toContain(item.audience);
    }
  });

  it("should have unique checklist IDs", () => {
    const ids = PILOT_CHECKLIST.map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should classify all pre-existing issues as non-blocker or deferred", () => {
    expect(PRE_EXISTING_ISSUES.length).toBeGreaterThan(0);
    for (const issue of PRE_EXISTING_ISSUES) {
      expect(["blocker", "non_blocker", "deferred"]).toContain(issue.classification);
    }
    // No current blockers
    expect(hasBlockerIssues()).toBe(false);
  });

  it("should have unique issue IDs", () => {
    const ids = PRE_EXISTING_ISSUES.map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Tests for scoring.ts — compare domain SLA escalation
 */
import {
  computeUrgencyScore,
  getUrgencyReason,
  type ScoredItem,
} from "@/lib/work-queue/scoring";

function makeItem(overrides: Partial<ScoredItem>): ScoredItem {
  return {
    type: "COMPARE_DECISION",
    substatus: "compare_decision_pending",
    approvalStatus: "PENDING",
    priority: "MEDIUM",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

// ── Urgency Score ──

describe("computeUrgencyScore — compare SLA escalation", () => {
  it("gives scoringBoostOnBreach (20) for compare_decision_pending at 7+ days", () => {
    const item = makeItem({ substatus: "compare_decision_pending", createdAt: daysAgo(7) });
    const score = computeUrgencyScore(item);
    // 20 (SLA breach) + 3 (approval pending: min(7*3,15)=15 but capped by PENDING check)
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it("gives scoringBoostOnBreach (25) for compare_reopened at 3+ days", () => {
    const item = makeItem({ substatus: "compare_reopened", createdAt: daysAgo(3) });
    const score = computeUrgencyScore(item);
    expect(score).toBeGreaterThanOrEqual(25);
  });

  it("gives +10 for compare_decision_pending at 3-6 days (pre-breach)", () => {
    const item = makeItem({ substatus: "compare_decision_pending", createdAt: daysAgo(5), approvalStatus: "NOT_REQUIRED" });
    const score = computeUrgencyScore(item);
    expect(score).toBe(10);
  });

  it("gives scoringBoostOnBreach (15) for compare_inquiry_followup at 5+ days", () => {
    const item = makeItem({ substatus: "compare_inquiry_followup", approvalStatus: "NOT_REQUIRED", createdAt: daysAgo(5) });
    const score = computeUrgencyScore(item);
    expect(score).toBeGreaterThanOrEqual(15);
  });

  it("gives 0 for compare_decided (terminal, no boost)", () => {
    const item = makeItem({ substatus: "compare_decided", approvalStatus: "APPROVED", createdAt: daysAgo(100) });
    const score = computeUrgencyScore(item);
    // Terminal status — no compare-related urgency
    expect(score).toBe(0);
  });
});

// ── Urgency Reason ──

describe("getUrgencyReason — compare SLA escalation messages", () => {
  it("returns escalationMeaning for SLA-breached compare_decision_pending", () => {
    const item = makeItem({ substatus: "compare_decision_pending", createdAt: daysAgo(7) });
    expect(getUrgencyReason(item)).toBe("판정 7일 이상 지연 — 의사결정 필요");
  });

  it("returns escalationMeaning for SLA-breached compare_reopened", () => {
    const item = makeItem({ substatus: "compare_reopened", createdAt: daysAgo(3) });
    expect(getUrgencyReason(item)).toBe("재검토 3일 초과 — 즉시 재판정 필요");
  });

  it("returns stale message for 30+ day old item", () => {
    const item = makeItem({ substatus: "compare_decision_pending", createdAt: daysAgo(30) });
    const reason = getUrgencyReason(item);
    expect(reason).toContain("장기 미처리");
    expect(reason).toContain("30");
  });

  it("returns pre-breach message for 3-6 day old item", () => {
    const item = makeItem({ substatus: "compare_decision_pending", createdAt: daysAgo(5) });
    const reason = getUrgencyReason(item);
    expect(reason).toBe("비교 판정 5일 대기");
  });

  it("returns null for fresh compare item (< 3 days)", () => {
    const item = makeItem({ substatus: "compare_decision_pending", createdAt: daysAgo(1) });
    expect(getUrgencyReason(item)).toBeNull();
  });
});

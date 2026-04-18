/**
 * Organization Overview Hub Mapper Tests
 *
 * 8개 시나리오로 mapper 계산/tone/severity/count를 검증한다.
 * fixture inline 정의 — 회귀 방지용.
 */

import {
  countReviewByStatus,
  countCompareByStatus,
  countQuoteDraftByStatus,
  countApprovalByState,
  countBudgetWarnings,
  countInventoryWarnings,
  countRecentActivity,
  resolveKpiTone,
  resolveStatusLabel,
  resolveAlertSeverity,
  mapToOverviewPageViewModel,
  type OpsHubRawInput,
} from "@/lib/review-queue/ops-hub-mappers";
import type { ReviewQueueItem, CompareQueueItem, QuoteDraftItem } from "@/lib/review-queue/types";
import type { ApprovalRequest } from "@/lib/review-queue/permissions";
import type { ActivityEvent } from "@/lib/review-queue/activity-log";

// ═══════════════════════════════════════════════════
// Fixture Builders
// ═══════════════════════════════════════════════════

function makeReviewItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id: `rq-${Math.random().toString(36).slice(2, 6)}`,
    sourceType: "search",
    rawInput: "test",
    parsedItemName: "Test Item",
    manufacturer: null,
    catalogNumber: null,
    spec: null,
    quantity: null,
    unit: null,
    confidence: "medium",
    status: "confirmed",
    matchCandidates: [],
    selectedProduct: null,
    needsReview: false,
    reviewReason: null,
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCompareItem(overrides: Partial<CompareQueueItem> = {}): CompareQueueItem {
  return {
    compareItemId: `ci-${Math.random().toString(36).slice(2, 6)}`,
    sourceQueueItemId: "rq-1",
    sourceType: "search",
    parsedItemName: "Test",
    normalizedNeed: "Test need",
    candidateProducts: [],
    selectedProductId: null,
    manufacturer: null,
    catalogNumber: null,
    spec: null,
    quantity: 1,
    unit: "ea",
    comparisonReason: null,
    reviewReason: null,
    confidence: "medium",
    sourceContext: "",
    evidenceSummary: null,
    status: "pending_comparison",
    ...overrides,
  };
}

function makeQuoteDraft(overrides: Partial<QuoteDraftItem> = {}): QuoteDraftItem {
  return {
    quoteDraftItemId: `qd-${Math.random().toString(36).slice(2, 6)}`,
    sourceQueueItemId: "rq-1",
    sourceType: "search",
    selectedProductId: "p1",
    parsedItemName: "Test",
    manufacturer: "Mfg",
    catalogNumber: "CAT-1",
    spec: "500mL",
    quantity: 1,
    unit: "ea",
    notes: null,
    sourceContext: "",
    evidenceSummary: null,
    budgetHint: null,
    inventoryHint: null,
    status: "draft_ready",
    ...overrides,
  };
}

function makeApprovalRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    approvalRequestId: `ar-${Math.random().toString(36).slice(2, 6)}`,
    entityType: "review_queue_item",
    entityId: "rq-1",
    requestedAction: "review.approve",
    requestedByUserId: "user-1",
    requestedByRole: "member",
    requiredApproverRole: "admin",
    assignedApproverUserId: null,
    approvalState: "pending_approval",
    requestReason: "test",
    supportingContext: "",
    priority: "medium",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolutionNote: null,
    ...overrides,
  };
}

function makeActivityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    eventId: `evt-${Math.random().toString(36).slice(2, 6)}`,
    eventType: "review_item_created",
    entityType: "review_queue_item",
    entityId: "rq-1",
    parentEntityType: null,
    parentEntityId: null,
    actorType: "user",
    actorId: "user-1",
    actorLabel: "사용자",
    timestamp: new Date().toISOString(),
    sourceType: null,
    previousState: null,
    nextState: null,
    reasonCodes: [],
    message: "테스트 이벤트",
    metadata: {},
    ...overrides,
  };
}

const BASE_ORG = { id: "org-1", name: "테스트 조직", plan: "business" as const, memberCount: 10, createdAt: "2025-01-01T00:00:00Z" };

// ═══════════════════════════════════════════════════
// Scenario 1: Normal — 운영 중 상태
// ═══════════════════════════════════════════════════

describe("Scenario: Normal", () => {
  const input: OpsHubRawInput = {
    organization: BASE_ORG,
    reviewItems: [
      makeReviewItem({ status: "confirmed" }),
      makeReviewItem({ status: "confirmed" }),
      makeReviewItem({ status: "needs_review", reviewReason: "manufacturer_missing" }),
      makeReviewItem({ status: "needs_review", reviewReason: "spec_unclear" }),
      makeReviewItem({ status: "match_failed" }),
      makeReviewItem({ status: "approved" }),
    ],
    compareItems: [
      makeCompareItem({ status: "pending_comparison" }),
      makeCompareItem({ status: "selection_needed" }),
      makeCompareItem({ status: "selection_confirmed" }),
    ],
    quoteDrafts: [
      makeQuoteDraft({ status: "draft_ready" }),
      makeQuoteDraft({ status: "draft_ready" }),
      makeQuoteDraft({ status: "missing_required_fields" }),
      makeQuoteDraft({ status: "awaiting_review", budgetHint: "budgetCheckRequired" }),
    ],
    approvalRequests: [makeApprovalRequest()],
    activityEvents: [makeActivityEvent(), makeActivityEvent()],
    memberCount: 10,
    activeMemberCount: 7,
  };

  test("review count", () => {
    const c = countReviewByStatus(input.reviewItems);
    expect(c.total).toBe(6);
    expect(c.needsReview).toBe(2);
    expect(c.matchFailed).toBe(1);
    expect(c.approved).toBe(1);
  });

  test("compare count", () => {
    const c = countCompareByStatus(input.compareItems);
    expect(c.total).toBe(3);
    expect(c.pending).toBe(2);
    expect(c.confirmed).toBe(1);
  });

  test("quote draft count", () => {
    const c = countQuoteDraftByStatus(input.quoteDrafts);
    expect(c.total).toBe(4);
    expect(c.ready).toBe(2);
    expect(c.missing).toBe(1);
    expect(c.review).toBe(1);
  });

  test("budget warnings", () => {
    expect(countBudgetWarnings(input.quoteDrafts)).toBe(1);
  });

  test("page VM structure", () => {
    const vm = mapToOverviewPageViewModel(input);
    expect(vm.kpis).toHaveLength(8);
    expect(vm.stepFunnel.stages).toHaveLength(3);
    expect(vm.alerts.isEmpty).toBe(false);
    expect(vm.workQueue.isEmpty).toBe(false);
    expect(vm.quickLinks).toHaveLength(6);
  });

  test("KPI tones", () => {
    const vm = mapToOverviewPageViewModel(input);
    const reviewKpi = vm.kpis.find((k) => k.key === "reviewNeeded");
    expect(reviewKpi?.tone).toBe("amber");
    expect(reviewKpi?.statusLabel).toBe("확인 필요");

    const quoteKpi = vm.kpis.find((k) => k.key === "quoteDraftReady");
    expect(quoteKpi?.tone).toBe("green");
    expect(quoteKpi?.statusLabel).toBe("즉시 처리 가능");
  });
});

// ═══════════════════════════════════════════════════
// Scenario 2: Empty — 신규 조직
// ═══════════════════════════════════════════════════

describe("Scenario: Empty", () => {
  const input: OpsHubRawInput = {
    organization: { ...BASE_ORG, name: "신규 조직", plan: "starter" },
    reviewItems: [],
    compareItems: [],
    quoteDrafts: [],
    approvalRequests: [],
    activityEvents: [],
    memberCount: 1,
    activeMemberCount: 1,
  };

  test("all counts zero", () => {
    expect(countReviewByStatus(input.reviewItems).total).toBe(0);
    expect(countCompareByStatus(input.compareItems).total).toBe(0);
    expect(countQuoteDraftByStatus(input.quoteDrafts).total).toBe(0);
  });

  test("VM has empty blocks", () => {
    const vm = mapToOverviewPageViewModel(input);
    expect(vm.alerts.isEmpty).toBe(true);
    expect(vm.workQueue.isEmpty).toBe(true);
    expect(vm.approvalInbox.isEmpty).toBe(true);
    expect(vm.activityFeed.isEmpty).toBe(true);
  });

  test("KPI all green/slate", () => {
    const vm = mapToOverviewPageViewModel(input);
    vm.kpis.forEach((k) => {
      expect(["green", "slate"]).toContain(k.tone);
    });
  });
});

// ═══════════════════════════════════════════════════
// Scenario 3: Review Backlog
// ═══════════════════════════════════════════════════

describe("Scenario: Review Backlog", () => {
  const input: OpsHubRawInput = {
    organization: BASE_ORG,
    reviewItems: Array.from({ length: 12 }, () => makeReviewItem({ status: "needs_review" })),
    compareItems: [],
    quoteDrafts: [],
    approvalRequests: [],
    activityEvents: [],
    memberCount: 5,
    activeMemberCount: 3,
  };

  test("review needed > 5 → red tone", () => {
    const vm = mapToOverviewPageViewModel(input);
    const kpi = vm.kpis.find((k) => k.key === "reviewNeeded");
    expect(kpi?.value).toBe(12);
    expect(kpi?.tone).toBe("red");
    expect(kpi?.statusLabel).toBe("우선 처리");
  });
});

// ═══════════════════════════════════════════════════
// Scenario 4: Approval Stale
// ═══════════════════════════════════════════════════

describe("Scenario: Approval Stale", () => {
  const staleDate = new Date(Date.now() - 10 * 86400000).toISOString();
  const input: OpsHubRawInput = {
    organization: BASE_ORG,
    reviewItems: [],
    compareItems: [],
    quoteDrafts: [],
    approvalRequests: [
      makeApprovalRequest({ createdAt: staleDate }),
      makeApprovalRequest({ createdAt: staleDate }),
    ],
    activityEvents: [],
    memberCount: 5,
    activeMemberCount: 3,
  };

  test("stale approval generates urgent alert", () => {
    const vm = mapToOverviewPageViewModel(input);
    const staleAlert = vm.alerts.items.find((a) => a.id === "stale-approvals");
    expect(staleAlert).toBeDefined();
    expect(staleAlert?.severity).toBe("urgent");
    expect(staleAlert?.count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════
// Scenario 5: Quote Blocked
// ═══════════════════════════════════════════════════

describe("Scenario: Quote Blocked", () => {
  const input: OpsHubRawInput = {
    organization: BASE_ORG,
    reviewItems: [],
    compareItems: [],
    quoteDrafts: [
      makeQuoteDraft({ status: "missing_required_fields" }),
      makeQuoteDraft({ status: "missing_required_fields" }),
      makeQuoteDraft({ status: "draft_ready", budgetHint: "budgetCheckRequired" }),
      makeQuoteDraft({ status: "draft_ready", inventoryHint: "possibleDuplicatePurchase" }),
    ],
    approvalRequests: [],
    activityEvents: [],
    memberCount: 5,
    activeMemberCount: 3,
  };

  test("blocked + budget + inventory alerts", () => {
    const vm = mapToOverviewPageViewModel(input);
    expect(vm.alerts.items.length).toBeGreaterThanOrEqual(2);
    expect(vm.alerts.items.some((a) => a.id === "blocked")).toBe(true);
    expect(vm.alerts.items.some((a) => a.id === "budget-check")).toBe(true);
  });

  test("budget and inventory warning counts", () => {
    expect(countBudgetWarnings(input.quoteDrafts)).toBe(1);
    expect(countInventoryWarnings(input.quoteDrafts)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// Scenario 6: Mixed Sources
// ═══════════════════════════════════════════════════

describe("Scenario: Mixed Sources", () => {
  const input: OpsHubRawInput = {
    organization: BASE_ORG,
    reviewItems: [
      makeReviewItem({ sourceType: "search", status: "confirmed" }),
      makeReviewItem({ sourceType: "excel", status: "needs_review" }),
      makeReviewItem({ sourceType: "protocol", status: "match_failed" }),
    ],
    compareItems: [],
    quoteDrafts: [],
    approvalRequests: [],
    activityEvents: [],
    memberCount: 5,
    activeMemberCount: 3,
  };

  test("mixed sources count correctly", () => {
    const c = countReviewByStatus(input.reviewItems);
    expect(c.total).toBe(3);
    expect(c.confirmed).toBe(1);
    expect(c.needsReview).toBe(1);
    expect(c.matchFailed).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// Scenario 7: Partial Error
// ═══════════════════════════════════════════════════

describe("Scenario: Partial Error", () => {
  const input: OpsHubRawInput = {
    organization: BASE_ORG,
    reviewItems: [makeReviewItem()],
    compareItems: [],
    quoteDrafts: [],
    approvalRequests: [],
    activityEvents: [],
    memberCount: 5,
    activeMemberCount: 3,
    errorBlocks: ["alerts", "activityFeed"],
  };

  test("pageState reflects partial error", () => {
    const vm = mapToOverviewPageViewModel(input);
    expect(vm.pageState.hasPartialError).toBe(true);
    expect(vm.pageState.errorBlocks).toContain("alerts");
    expect(vm.pageState.errorBlocks).toContain("activityFeed");
  });
});

// ═══════════════════════════════════════════════════
// Tone / Severity Unit Tests
// ═══════════════════════════════════════════════════

describe("resolveKpiTone", () => {
  test("reviewNeeded thresholds", () => {
    expect(resolveKpiTone("reviewNeeded", 0)).toBe("green");
    expect(resolveKpiTone("reviewNeeded", 3)).toBe("amber");
    expect(resolveKpiTone("reviewNeeded", 10)).toBe("red");
  });

  test("approvalPending thresholds", () => {
    expect(resolveKpiTone("approvalPending", 0)).toBe("green");
    expect(resolveKpiTone("approvalPending", 1)).toBe("amber");
    expect(resolveKpiTone("approvalPending", 5)).toBe("red");
  });

  test("quoteDraftReady", () => {
    expect(resolveKpiTone("quoteDraftReady", 0)).toBe("slate");
    expect(resolveKpiTone("quoteDraftReady", 3)).toBe("green");
  });
});

describe("resolveAlertSeverity", () => {
  test("stale approval → urgent", () => {
    expect(resolveAlertSeverity("staleApproval", 1, 8)).toBe("urgent");
  });

  test("budget check → warning/urgent", () => {
    expect(resolveAlertSeverity("budgetCheck", 1)).toBe("warning");
    expect(resolveAlertSeverity("budgetCheck", 5)).toBe("urgent");
  });

  test("compare backlog → info", () => {
    expect(resolveAlertSeverity("compareBacklog", 10)).toBe("info");
  });
});

describe("resolveStatusLabel", () => {
  test("reviewNeeded labels", () => {
    expect(resolveStatusLabel("reviewNeeded", 0)).toBe("정상");
    expect(resolveStatusLabel("reviewNeeded", 3)).toBe("확인 필요");
    expect(resolveStatusLabel("reviewNeeded", 8)).toBe("우선 처리");
  });
});

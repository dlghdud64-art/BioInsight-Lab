/**
 * Organization Overview Hub — 8 Scenario Tests
 *
 * 시나리오별 fixture → mapper → expected 검증.
 * block-level assertion + tone/severity/count 명시 검증.
 */

import {
  countReviewByStatus,
  countCompareByStatus,
  countQuoteDraftByStatus,
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
import type { OverviewOrganizationHeader } from "@/lib/review-queue/ops-hub-view-models";

// ═══════════════════════════════════════════════════
// Fixture Builders (compact)
// ═══════════════════════════════════════════════════

let _id = 0;
const uid = () => `${++_id}`;

const ORG: OverviewOrganizationHeader = { id: "org-1", name: "바이오사이언스 연구소", plan: "business", memberCount: 12, createdAt: "2025-06-15T00:00:00Z" };

function ri(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return { id: `rq-${uid()}`, sourceType: "search", rawInput: "test", parsedItemName: "Item", manufacturer: null, catalogNumber: null, spec: null, quantity: null, unit: null, confidence: "medium", status: "confirmed", matchCandidates: [], selectedProduct: null, needsReview: false, reviewReason: null, addedAt: new Date().toISOString(), ...overrides };
}

function ci(overrides: Partial<CompareQueueItem> = {}): CompareQueueItem {
  return { compareItemId: `ci-${uid()}`, sourceQueueItemId: "rq-1", sourceType: "search", parsedItemName: "Item", normalizedNeed: "need", candidateProducts: [], selectedProductId: null, manufacturer: null, catalogNumber: null, spec: null, quantity: 1, unit: "ea", comparisonReason: null, reviewReason: null, confidence: "medium", sourceContext: "", evidenceSummary: null, status: "pending_comparison", ...overrides };
}

function qd(overrides: Partial<QuoteDraftItem> = {}): QuoteDraftItem {
  return { quoteDraftItemId: `qd-${uid()}`, sourceQueueItemId: "rq-1", sourceType: "search", selectedProductId: "p1", parsedItemName: "Item", manufacturer: "Mfg", catalogNumber: "CAT", spec: "500mL", quantity: 1, unit: "ea", notes: null, sourceContext: "", evidenceSummary: null, budgetHint: null, inventoryHint: null, status: "draft_ready", ...overrides };
}

function ar(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return { approvalRequestId: `ar-${uid()}`, entityType: "review_queue_item", entityId: "rq-1", requestedAction: "review.approve", requestedByUserId: "user-1", requestedByRole: "member", requiredApproverRole: "admin", assignedApproverUserId: null, approvalState: "pending_approval", requestReason: "test", supportingContext: "", priority: "medium", createdAt: new Date().toISOString(), resolvedAt: null, resolutionNote: null, ...overrides };
}

function ae(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return { eventId: `evt-${uid()}`, eventType: "review_item_created", entityType: "review_queue_item", entityId: "rq-1", parentEntityType: null, parentEntityId: null, actorType: "user", actorId: "user-1", actorLabel: "사용자", timestamp: new Date().toISOString(), sourceType: null, previousState: null, nextState: null, reasonCodes: [], message: "테스트", metadata: {}, ...overrides };
}

const staleDate = new Date(Date.now() - 10 * 86400000).toISOString();

// ═══════════════════════════════════════════════════
// 1. scenario-normal
// ═══════════════════════════════════════════════════

describe("scenario-normal", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri({ status: "confirmed" }), ri({ status: "confirmed" }), ri({ status: "needs_review", reviewReason: "manufacturer_missing" }), ri({ status: "needs_review", reviewReason: "spec_unclear" }), ri({ status: "match_failed" }), ri({ status: "approved" })],
    compareItems: [ci({ status: "pending_comparison" }), ci({ status: "selection_needed" }), ci({ status: "selection_confirmed" })],
    quoteDrafts: [qd(), qd(), qd({ status: "missing_required_fields" }), qd({ status: "awaiting_review", budgetHint: "budgetCheckRequired" })],
    approvalRequests: [ar(), ar({ approvalState: "approved", resolvedAt: new Date().toISOString() })],
    activityEvents: [ae(), ae(), ae(), ae(), ae()],
    memberCount: 12, activeMemberCount: 8,
  };
  const vm = mapToOverviewPageViewModel(input);

  test("KPI values", () => {
    expect(vm.kpis.find((k) => k.key === "reviewNeeded")?.value).toBe(2);
    expect(vm.kpis.find((k) => k.key === "compareWaiting")?.value).toBe(2);
    expect(vm.kpis.find((k) => k.key === "quoteDraftReady")?.value).toBe(2);
    expect(vm.kpis.find((k) => k.key === "approvalPending")?.value).toBe(1);
    expect(vm.kpis.find((k) => k.key === "budgetWarnings")?.value).toBe(1);
  });

  test("KPI tones are not red for normal state", () => {
    expect(vm.kpis.find((k) => k.key === "reviewNeeded")?.tone).toBe("amber");
    expect(vm.kpis.find((k) => k.key === "quoteDraftReady")?.tone).toBe("green");
    expect(vm.kpis.find((k) => k.key === "approvalPending")?.tone).toBe("amber");
  });

  test("KPI statusLabels", () => {
    expect(vm.kpis.find((k) => k.key === "reviewNeeded")?.statusLabel).toBe("확인 필요");
    expect(vm.kpis.find((k) => k.key === "quoteDraftReady")?.statusLabel).toBe("즉시 처리 가능");
  });

  test("Step funnel counts", () => {
    expect(vm.stepFunnel.stages[0].count).toBe(6); // total review
    expect(vm.stepFunnel.stages[1].count).toBe(3);
    expect(vm.stepFunnel.stages[2].count).toBe(4);
  });

  test("Step funnel subStatus includes numbers", () => {
    expect(vm.stepFunnel.stages[0].subStatus).toContain("2"); // needs_review
    expect(vm.stepFunnel.stages[0].subStatus).toContain("1"); // match_failed
  });

  test("Alerts has budget check", () => {
    expect(vm.alerts.isEmpty).toBe(false);
    expect(vm.alerts.items.some((a) => a.id === "budget-check")).toBe(true);
  });

  test("Work queue is not empty", () => {
    expect(vm.workQueue.isEmpty).toBe(false);
    expect(vm.workQueue.sections.length).toBeGreaterThan(0);
  });

  test("Quick links exist", () => {
    expect(vm.quickLinks.length).toBe(6);
    expect(vm.quickLinks[0].label).toContain("검토 큐");
  });

  test("All KPIs have description and linkHref type", () => {
    vm.kpis.forEach((k) => {
      expect(k.description).toBeTruthy();
      expect(typeof k.linkHref === "string" || k.linkHref === null).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════
// 2. scenario-empty
// ═══════════════════════════════════════════════════

describe("scenario-empty", () => {
  const input: OpsHubRawInput = {
    organization: { ...ORG, name: "신규 조직", plan: "starter" },
    reviewItems: [], compareItems: [], quoteDrafts: [], approvalRequests: [], activityEvents: [],
    memberCount: 1, activeMemberCount: 1,
  };
  const vm = mapToOverviewPageViewModel(input);

  test("KPI values all zero except members", () => {
    expect(vm.kpis.find((k) => k.key === "reviewNeeded")?.value).toBe(0);
    expect(vm.kpis.find((k) => k.key === "compareWaiting")?.value).toBe(0);
    expect(vm.kpis.find((k) => k.key === "quoteDraftReady")?.value).toBe(0);
    expect(vm.kpis.find((k) => k.key === "approvalPending")?.value).toBe(0);
  });

  test("KPI tones are green or slate, never red", () => {
    vm.kpis.forEach((k) => {
      expect(["green", "slate"]).toContain(k.tone);
    });
  });

  test("All blocks empty", () => {
    expect(vm.alerts.isEmpty).toBe(true);
    expect(vm.alerts.emptyMessage).toBeTruthy();
    expect(vm.workQueue.isEmpty).toBe(true);
    expect(vm.workQueue.emptyMessage).toBeTruthy();
    expect(vm.approvalInbox.isEmpty).toBe(true);
    expect(vm.activityFeed.isEmpty).toBe(true);
  });

  test("Step funnel all zero", () => {
    vm.stepFunnel.stages.forEach((s) => expect(s.count).toBe(0));
  });

  test("Empty state is not partial-error", () => {
    expect(vm.pageState.hasPartialError).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 3. scenario-partial-error-alerts
// ═══════════════════════════════════════════════════

describe("scenario-partial-error-alerts", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri()], compareItems: [], quoteDrafts: [], approvalRequests: [],
    activityEvents: [ae()],
    memberCount: 5, activeMemberCount: 3,
    errorBlocks: ["alerts"],
  };
  const vm = mapToOverviewPageViewModel(input);

  test("pageState reflects alerts error", () => {
    expect(vm.pageState.hasPartialError).toBe(true);
    expect(vm.pageState.errorBlocks).toContain("alerts");
    expect(vm.pageState.errorBlocks).not.toContain("workQueue");
  });

  test("other blocks still render", () => {
    expect(vm.stepFunnel.stages.length).toBe(3);
    expect(vm.activityFeed.isEmpty).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 4. scenario-review-backlog
// ═══════════════════════════════════════════════════

describe("scenario-review-backlog", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [
      ...Array.from({ length: 8 }, () => ri({ status: "needs_review", reviewReason: "manufacturer_missing" })),
      ...Array.from({ length: 4 }, () => ri({ status: "match_failed" })),
    ],
    compareItems: [ci()],
    quoteDrafts: [],
    approvalRequests: [],
    activityEvents: [ae()],
    memberCount: 8, activeMemberCount: 5,
  };
  const vm = mapToOverviewPageViewModel(input);

  test("reviewNeeded is red tone (>5)", () => {
    const kpi = vm.kpis.find((k) => k.key === "reviewNeeded");
    expect(kpi?.value).toBe(8);
    expect(kpi?.tone).toBe("red");
    expect(kpi?.statusLabel).toBe("우선 처리");
  });

  test("match_failed alert generated when >= 3", () => {
    expect(vm.alerts.items.some((a) => a.id === "match-fail")).toBe(true);
  });

  test("work queue has manual-review section", () => {
    expect(vm.workQueue.sections.some((s) => s.id === "manual-review")).toBe(true);
  });

  test("step1 funnel count matches", () => {
    expect(vm.stepFunnel.stages[0].count).toBe(12);
  });
});

// ═══════════════════════════════════════════════════
// 5. scenario-approval-stale
// ═══════════════════════════════════════════════════

describe("scenario-approval-stale", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri()],
    compareItems: [],
    quoteDrafts: [],
    approvalRequests: [
      ar({ createdAt: staleDate, requestedByUserId: "user-1", assignedApproverUserId: "user-2" }),
      ar({ createdAt: staleDate, requestedByUserId: "user-3", assignedApproverUserId: "user-2" }),
      ar({ createdAt: new Date().toISOString() }),
    ],
    activityEvents: [ae()],
    memberCount: 6, activeMemberCount: 4,
  };
  const vm = mapToOverviewPageViewModel(input, "user-2");

  test("approvalPending KPI is red (3 pending)", () => {
    const kpi = vm.kpis.find((k) => k.key === "approvalPending");
    expect(kpi?.value).toBe(3);
    expect(kpi?.tone).toBe("red");
    expect(kpi?.statusLabel).toBe("우선 확인");
  });

  test("stale approval alert is urgent", () => {
    const alert = vm.alerts.items.find((a) => a.id === "stale-approvals");
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("urgent");
    expect(alert?.count).toBe(2);
  });

  test("approval inbox has pending items", () => {
    expect(vm.approvalInbox.pendingCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════
// 6. scenario-quote-blocked
// ═══════════════════════════════════════════════════

describe("scenario-quote-blocked", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri({ status: "approved" })],
    compareItems: [],
    quoteDrafts: [
      qd({ status: "missing_required_fields" }),
      qd({ status: "missing_required_fields" }),
      qd({ status: "missing_required_fields" }),
      qd({ status: "draft_ready", budgetHint: "budgetCheckRequired" }),
      qd({ status: "draft_ready", inventoryHint: "possibleDuplicatePurchase" }),
    ],
    approvalRequests: [],
    activityEvents: [],
    memberCount: 5, activeMemberCount: 3,
  };
  const vm = mapToOverviewPageViewModel(input);

  test("blocked alert exists", () => {
    expect(vm.alerts.items.some((a) => a.id === "blocked")).toBe(true);
  });

  test("budget check alert exists", () => {
    expect(vm.alerts.items.some((a) => a.id === "budget-check")).toBe(true);
  });

  test("inventory dupe alert exists", () => {
    expect(vm.alerts.items.some((a) => a.id === "inv-dupe")).toBe(true);
  });

  test("budget and inventory KPI values", () => {
    expect(vm.kpis.find((k) => k.key === "budgetWarnings")?.value).toBe(1);
    expect(vm.kpis.find((k) => k.key === "budgetWarnings")?.tone).toBe("amber");
    expect(vm.kpis.find((k) => k.key === "inventoryWarnings")?.value).toBe(1);
  });

  test("work queue has submit-ready section", () => {
    expect(vm.workQueue.sections.some((s) => s.id === "submit-ready")).toBe(true);
  });

  test("quoteDraftReady KPI counts only draft_ready", () => {
    expect(vm.kpis.find((k) => k.key === "quoteDraftReady")?.value).toBe(2);
  });
});

// ═══════════════════════════════════════════════════
// 7. scenario-mixed-sources
// ═══════════════════════════════════════════════════

describe("scenario-mixed-sources", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [
      ri({ sourceType: "search", status: "confirmed" }),
      ri({ sourceType: "search", status: "needs_review" }),
      ri({ sourceType: "excel", status: "confirmed" }),
      ri({ sourceType: "excel", status: "needs_review", reviewReason: "quantity_missing" }),
      ri({ sourceType: "protocol", status: "match_failed" }),
      ri({ sourceType: "protocol", status: "needs_review", reviewReason: "catalog_missing" }),
    ],
    compareItems: [ci({ sourceType: "excel" }), ci({ sourceType: "protocol" })],
    quoteDrafts: [qd({ sourceType: "search" }), qd({ sourceType: "excel" })],
    approvalRequests: [],
    activityEvents: [
      ae({ message: "직접 검색 항목 추가" }),
      ae({ message: "엑셀 업로드 12행 추가" }),
      ae({ message: "프로토콜에서 5개 추출" }),
    ],
    memberCount: 8, activeMemberCount: 6,
  };
  const vm = mapToOverviewPageViewModel(input);

  test("review count is source-agnostic", () => {
    const c = countReviewByStatus(input.reviewItems);
    expect(c.total).toBe(6);
    expect(c.needsReview).toBe(3);
    expect(c.matchFailed).toBe(1);
  });

  test("step funnel counts all sources", () => {
    expect(vm.stepFunnel.stages[0].count).toBe(6);
    expect(vm.stepFunnel.stages[1].count).toBe(2);
    expect(vm.stepFunnel.stages[2].count).toBe(2);
  });

  test("activity feed has mixed source messages", () => {
    expect(vm.activityFeed.items.length).toBe(3);
    const msgs = vm.activityFeed.items.map((f) => f.action);
    expect(msgs.some((m) => m.includes("검색"))).toBe(true);
    expect(msgs.some((m) => m.includes("엑셀"))).toBe(true);
    expect(msgs.some((m) => m.includes("프로토콜"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// 8. scenario-high-activity
// ═══════════════════════════════════════════════════

describe("scenario-high-activity", () => {
  const recentEvents = Array.from({ length: 30 }, (_, i) =>
    ae({ message: `활동 ${i + 1}`, timestamp: new Date(Date.now() - i * 3600000).toISOString() })
  );
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri({ status: "confirmed" }), ri({ status: "approved" })],
    compareItems: [ci({ status: "selection_confirmed" })],
    quoteDrafts: [qd()],
    approvalRequests: [],
    activityEvents: recentEvents,
    memberCount: 15, activeMemberCount: 12,
  };
  const vm = mapToOverviewPageViewModel(input);

  test("recent activity KPI is high but tone is slate (not danger)", () => {
    const kpi = vm.kpis.find((k) => k.key === "recentActivity");
    expect(kpi?.value).toBe(30);
    expect(kpi?.tone).toBe("slate");
  });

  test("activity feed shows up to 10 items", () => {
    expect(vm.activityFeed.items.length).toBe(10);
  });

  test("high activity does not create alerts", () => {
    expect(vm.alerts.items.every((a) => !a.title.includes("활동"))).toBe(true);
  });

  test("KPIs are calm despite high activity", () => {
    expect(vm.kpis.find((k) => k.key === "reviewNeeded")?.tone).toBe("green");
    expect(vm.kpis.find((k) => k.key === "approvalPending")?.tone).toBe("green");
  });
});

// ═══════════════════════════════════════════════════
// Additional partial-error scenarios
// ═══════════════════════════════════════════════════

describe("partial-error: activityFeed only", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri()], compareItems: [], quoteDrafts: [], approvalRequests: [], activityEvents: [],
    memberCount: 3, activeMemberCount: 2,
    errorBlocks: ["activityFeed"],
  };
  const vm = mapToOverviewPageViewModel(input);

  test("only activityFeed in errorBlocks", () => {
    expect(vm.pageState.errorBlocks).toEqual(["activityFeed"]);
    expect(vm.pageState.hasPartialError).toBe(true);
  });

  test("other blocks unaffected", () => {
    expect(vm.stepFunnel.stages.length).toBe(3);
    expect(vm.kpis.length).toBe(8);
  });
});

describe("partial-error: approvalInbox only", () => {
  const input: OpsHubRawInput = {
    organization: ORG,
    reviewItems: [ri()], compareItems: [], quoteDrafts: [], approvalRequests: [], activityEvents: [ae()],
    memberCount: 3, activeMemberCount: 2,
    errorBlocks: ["approvalInbox"],
  };
  const vm = mapToOverviewPageViewModel(input);

  test("only approvalInbox in errorBlocks", () => {
    expect(vm.pageState.errorBlocks).toEqual(["approvalInbox"]);
  });

  test("activity feed still works", () => {
    expect(vm.activityFeed.isEmpty).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// Regression guards
// ═══════════════════════════════════════════════════

describe("regression guards", () => {
  test("stale approval → high severity", () => {
    expect(resolveAlertSeverity("staleApproval", 1, 8)).toBe("urgent");
  });

  test("quoteDraftReady → green tone", () => {
    expect(resolveKpiTone("quoteDraftReady", 3)).toBe("green");
  });

  test("review backlog is warning not danger at 5", () => {
    expect(resolveKpiTone("reviewNeeded", 5)).toBe("amber");
  });

  test("review backlog becomes red only at 6+", () => {
    expect(resolveKpiTone("reviewNeeded", 6)).toBe("red");
  });

  test("empty reviewNeeded → green", () => {
    expect(resolveKpiTone("reviewNeeded", 0)).toBe("green");
    expect(resolveStatusLabel("reviewNeeded", 0)).toBe("정상");
  });

  test("CTA labels are purpose-driven", () => {
    const vm = mapToOverviewPageViewModel({
      organization: ORG, reviewItems: [ri()], compareItems: [], quoteDrafts: [], approvalRequests: [], activityEvents: [],
      memberCount: 1, activeMemberCount: 1,
    });
    vm.stepFunnel.stages.forEach((s) => {
      expect(s.ctaLabel).toBeTruthy();
      expect(s.ctaLabel).not.toBe("보기");
      expect(s.ctaLabel).not.toBe("이동");
    });
    vm.quickLinks.forEach((l) => {
      expect(l.label).toBeTruthy();
      expect(l.label.length).toBeGreaterThan(3);
    });
  });
});

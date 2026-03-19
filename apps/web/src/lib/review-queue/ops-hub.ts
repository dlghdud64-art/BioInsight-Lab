/**
 * Organization Operations Hub — 운영 허브 데이터 집계
 *
 * Step 1~3 queue + approval + activity를 조직 허브용으로 요약.
 * 개별 store의 상태를 읽어 운영 KPI / Alerts / Work Queue / Funnel을 생성.
 */

import type { ReviewQueueItem, CompareQueueItem, QuoteDraftItem } from "./types";
import type { ApprovalRequest } from "./permissions";
import type { ActivityEvent } from "./activity-log";

// ═══════════════════════════════════════════════════
// Operations KPI
// ═══════════════════════════════════════════════════

export interface OpsKPI {
  totalMembers: number;
  activeMembers: number;
  approvalPending: number;
  reviewNeeded: number;
  compareWaiting: number;
  quoteDraftReady: number;
  budgetWarnings: number;
  inventoryWarnings: number;
}

export function computeOpsKPI(params: {
  memberCount: number;
  activeMemberCount: number;
  reviewItems: ReviewQueueItem[];
  compareItems: CompareQueueItem[];
  quoteDrafts: QuoteDraftItem[];
  approvalRequests: ApprovalRequest[];
}): OpsKPI {
  return {
    totalMembers: params.memberCount,
    activeMembers: params.activeMemberCount,
    approvalPending: params.approvalRequests.filter((r) => r.approvalState === "pending_approval").length,
    reviewNeeded: params.reviewItems.filter((i) => i.status === "needs_review" || i.status === "match_failed").length,
    compareWaiting: params.compareItems.filter((i) => i.status === "pending_comparison" || i.status === "selection_needed").length,
    quoteDraftReady: params.quoteDrafts.filter((i) => i.status === "draft_ready").length,
    budgetWarnings: params.quoteDrafts.filter((i) => i.budgetHint === "budgetCheckRequired").length,
    inventoryWarnings: params.quoteDrafts.filter((i) => i.inventoryHint === "possibleDuplicatePurchase").length,
  };
}

export const KPI_CONFIG: {
  key: keyof OpsKPI;
  label: string;
  icon: string;
  emptyText: string;
  linkHref: string;
}[] = [
  { key: "totalMembers", label: "총 멤버", icon: "Users", emptyText: "멤버를 초대하세요", linkHref: "" },
  { key: "approvalPending", label: "승인 대기", icon: "ClipboardCheck", emptyText: "승인 대기 없음", linkHref: "" },
  { key: "reviewNeeded", label: "검토 필요", icon: "AlertTriangle", emptyText: "검토 필요 항목 없음", linkHref: "/test/search" },
  { key: "compareWaiting", label: "비교 대기", icon: "GitCompare", emptyText: "비교 대기 없음", linkHref: "/test/compare" },
  { key: "quoteDraftReady", label: "견적 제출 가능", icon: "FileText", emptyText: "제출 가능 초안 없음", linkHref: "/test/quote" },
  { key: "budgetWarnings", label: "예산 경고", icon: "CreditCard", emptyText: "예산 경고 없음", linkHref: "" },
  { key: "inventoryWarnings", label: "재고 중복 경고", icon: "Package", emptyText: "재고 경고 없음", linkHref: "/dashboard/inventory" },
];

// ═══════════════════════════════════════════════════
// Step Funnel Summary
// ═══════════════════════════════════════════════════

export interface StepFunnelSummary {
  step1Total: number;
  step1Confirmed: number;
  step1NeedsReview: number;
  step1MatchFailed: number;
  step1Approved: number;
  step2Total: number;
  step2Pending: number;
  step2Confirmed: number;
  step3Total: number;
  step3Ready: number;
  step3Missing: number;
  step3Review: number;
}

export function computeStepFunnel(params: {
  reviewItems: ReviewQueueItem[];
  compareItems: CompareQueueItem[];
  quoteDrafts: QuoteDraftItem[];
}): StepFunnelSummary {
  const r = params.reviewItems;
  const c = params.compareItems;
  const q = params.quoteDrafts;
  return {
    step1Total: r.length,
    step1Confirmed: r.filter((i) => i.status === "confirmed").length,
    step1NeedsReview: r.filter((i) => i.status === "needs_review").length,
    step1MatchFailed: r.filter((i) => i.status === "match_failed").length,
    step1Approved: r.filter((i) => i.status === "approved").length,
    step2Total: c.length,
    step2Pending: c.filter((i) => i.status === "pending_comparison" || i.status === "selection_needed").length,
    step2Confirmed: c.filter((i) => i.status === "selection_confirmed").length,
    step3Total: q.length,
    step3Ready: q.filter((i) => i.status === "draft_ready").length,
    step3Missing: q.filter((i) => i.status === "missing_required_fields").length,
    step3Review: q.filter((i) => i.status === "awaiting_review").length,
  };
}

// ═══════════════════════════════════════════════════
// Alerts
// ═══════════════════════════════════════════════════

export type AlertPriority = "high" | "medium" | "low";

export interface OpsAlert {
  id: string;
  priority: AlertPriority;
  title: string;
  description: string;
  count: number;
  linkHref: string;
  linkLabel: string;
}

export function generateAlerts(params: {
  reviewItems: ReviewQueueItem[];
  compareItems: CompareQueueItem[];
  quoteDrafts: QuoteDraftItem[];
  approvalRequests: ApprovalRequest[];
}): OpsAlert[] {
  const alerts: OpsAlert[] = [];

  // 예산 확인 필요
  const budgetItems = params.quoteDrafts.filter((i) => i.budgetHint === "budgetCheckRequired");
  if (budgetItems.length > 0) {
    alerts.push({
      id: "budget-check",
      priority: "high",
      title: "예산 확인 필요",
      description: `예산 확인이 필요한 견적 초안 ${budgetItems.length}건`,
      count: budgetItems.length,
      linkHref: "/test/quote",
      linkLabel: "견적 초안 확인",
    });
  }

  // 재고 중복
  const dupeItems = params.quoteDrafts.filter((i) => i.inventoryHint === "possibleDuplicatePurchase");
  if (dupeItems.length > 0) {
    alerts.push({
      id: "inventory-dupe",
      priority: "high",
      title: "재고 중복 가능",
      description: `동일 또는 유사 재고가 존재할 수 있는 항목 ${dupeItems.length}건`,
      count: dupeItems.length,
      linkHref: "/dashboard/inventory",
      linkLabel: "재고 확인",
    });
  }

  // 장기 승인 대기 (7일+)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const oldApprovals = params.approvalRequests.filter(
    (r) => r.approvalState === "pending_approval" && r.createdAt < sevenDaysAgo
  );
  if (oldApprovals.length > 0) {
    alerts.push({
      id: "stale-approvals",
      priority: "high",
      title: "장기 승인 대기",
      description: `7일 이상 처리되지 않은 승인 요청 ${oldApprovals.length}건`,
      count: oldApprovals.length,
      linkHref: "",
      linkLabel: "승인 요청 보기",
    });
  }

  // 매칭 실패 다수
  const matchFailed = params.reviewItems.filter((i) => i.status === "match_failed");
  if (matchFailed.length >= 3) {
    alerts.push({
      id: "match-failures",
      priority: "medium",
      title: "매칭 실패 항목",
      description: `후보를 찾지 못한 항목 ${matchFailed.length}건`,
      count: matchFailed.length,
      linkHref: "/test/search",
      linkLabel: "검토 큐 확인",
    });
  }

  // 제출 차단
  const blocked = params.quoteDrafts.filter((i) => i.status === "missing_required_fields");
  if (blocked.length > 0) {
    alerts.push({
      id: "submission-blocked",
      priority: "medium",
      title: "견적 제출 차단",
      description: `필수 정보가 누락된 견적 초안 ${blocked.length}건`,
      count: blocked.length,
      linkHref: "/test/quote",
      linkLabel: "초안 수정",
    });
  }

  // 장기 비교 대기
  const longCompare = params.compareItems.filter(
    (i) => i.status === "pending_comparison" || i.status === "selection_needed"
  );
  if (longCompare.length >= 5) {
    alerts.push({
      id: "compare-backlog",
      priority: "low",
      title: "비교 작업 적체",
      description: `후보 선택 대기 중인 항목 ${longCompare.length}건`,
      count: longCompare.length,
      linkHref: "/test/compare",
      linkLabel: "비교 큐 확인",
    });
  }

  return alerts.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });
}

// ═══════════════════════════════════════════════════
// Work Queue Summary
// ═══════════════════════════════════════════════════

export interface WorkQueueSection {
  id: string;
  title: string;
  count: number;
  description: string;
  linkHref: string;
  linkLabel: string;
  items: { label: string; count: number }[];
}

export function generateWorkQueue(params: {
  reviewItems: ReviewQueueItem[];
  compareItems: CompareQueueItem[];
  quoteDrafts: QuoteDraftItem[];
}): WorkQueueSection[] {
  const sections: WorkQueueSection[] = [];

  // 검토 필요
  const reviewNeeded = params.reviewItems.filter((i) => i.status === "needs_review");
  if (reviewNeeded.length > 0) {
    const mfgMissing = reviewNeeded.filter((i) => i.reviewReason?.includes("manufacturer_missing")).length;
    const specUnclear = reviewNeeded.filter((i) => i.reviewReason?.includes("spec_unclear")).length;
    const qtyMissing = reviewNeeded.filter((i) => i.reviewReason?.includes("quantity_missing")).length;
    sections.push({
      id: "review-needed",
      title: "검토 필요",
      count: reviewNeeded.length,
      description: "Step 1에서 확인이 필요한 항목",
      linkHref: "/test/search",
      linkLabel: "검토 큐 열기",
      items: [
        ...(mfgMissing > 0 ? [{ label: "제조사 확인 필요", count: mfgMissing }] : []),
        ...(specUnclear > 0 ? [{ label: "규격 확인 필요", count: specUnclear }] : []),
        ...(qtyMissing > 0 ? [{ label: "수량 누락", count: qtyMissing }] : []),
      ],
    });
  }

  // 후보 선택 필요
  const compareNeeded = params.compareItems.filter(
    (i) => i.status === "pending_comparison" || i.status === "selection_needed"
  );
  if (compareNeeded.length > 0) {
    sections.push({
      id: "compare-needed",
      title: "후보 선택 필요",
      count: compareNeeded.length,
      description: "Step 2에서 비교 확정 대기 중",
      linkHref: "/test/compare",
      linkLabel: "비교 큐 열기",
      items: [],
    });
  }

  // 견적 제출 가능
  const draftReady = params.quoteDrafts.filter((i) => i.status === "draft_ready");
  if (draftReady.length > 0) {
    sections.push({
      id: "quote-ready",
      title: "견적 제출 가능",
      count: draftReady.length,
      description: "Step 3에서 바로 제출 가능",
      linkHref: "/test/quote",
      linkLabel: "견적 초안 열기",
      items: [],
    });
  }

  // 수동 확인 필요
  const matchFailed = params.reviewItems.filter((i) => i.status === "match_failed");
  if (matchFailed.length > 0) {
    sections.push({
      id: "match-failed",
      title: "수동 확인 필요",
      count: matchFailed.length,
      description: "후보를 찾지 못한 항목",
      linkHref: "/test/search",
      linkLabel: "검토 큐 열기",
      items: [],
    });
  }

  return sections;
}

// ═══════════════════════════════════════════════════
// Activity Feed Summary
// ═══════════════════════════════════════════════════

export interface ActivityFeedItem {
  id: string;
  actor: string;
  action: string;
  entity: string;
  time: string;
  linkHref?: string;
}

export function summarizeRecentActivity(
  events: ActivityEvent[],
  limit: number = 10
): ActivityFeedItem[] {
  return events
    .slice(-limit)
    .reverse()
    .map((e) => ({
      id: e.eventId,
      actor: e.actorLabel,
      action: e.message,
      entity: e.entityId,
      time: e.timestamp,
    }));
}

// ═══════════════════════════════════════════════════
// Approval Inbox Summary
// ═══════════════════════════════════════════════════

export interface ApprovalInboxSummary {
  pendingCount: number;
  myRequestsCount: number;
  recentDecisions: { id: string; action: string; state: string; time: string }[];
}

export function computeApprovalInboxSummary(
  requests: ApprovalRequest[],
  currentUserId: string
): ApprovalInboxSummary {
  const pending = requests.filter((r) => r.approvalState === "pending_approval");
  const myRequests = requests.filter((r) => r.requestedByUserId === currentUserId);
  const recent = requests
    .filter((r) => r.approvalState === "approved" || r.approvalState === "rejected")
    .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""))
    .slice(0, 5)
    .map((r) => ({
      id: r.approvalRequestId,
      action: r.requestedAction,
      state: r.approvalState,
      time: r.resolvedAt ?? r.createdAt,
    }));

  return {
    pendingCount: pending.length,
    myRequestsCount: myRequests.length,
    recentDecisions: recent,
  };
}

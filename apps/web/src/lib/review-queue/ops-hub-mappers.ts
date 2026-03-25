/**
 * Organization Overview Hub — Mappers
 *
 * Raw domain objects → Page-level view model 변환.
 * count 계산, severity/tone 해석, helperText/statusLabel 생성을 여기서 잠근다.
 * UI 컴포넌트는 계산하지 않고 이 mapper의 출력만 렌더한다.
 */

import type { ReviewQueueItem, CompareQueueItem, QuoteDraftItem } from "./types";
import type { ApprovalRequest } from "./permissions";
import type { ActivityEvent } from "./activity-log";
import type {
  OrganizationOverviewPageViewModel,
  OverviewOrganizationHeader,
  OverviewKpiCardViewModel,
  KpiTone,
  StepFunnelViewModel,
  AlertsBlockViewModel,
  AlertItemViewModel,
  AlertSeverity,
  WorkQueueBlockViewModel,
  WorkQueueSectionViewModel,
  ApprovalInboxBlockViewModel,
  ActivityFeedBlockViewModel,
  ActivityFeedItemViewModel,
  QuickLinkItemViewModel,
  ErrorBlockKey,
} from "./ops-hub-view-models";

// ═══════════════════════════════════════════════════
// Raw Domain Input
// ═══════════════════════════════════════════════════

export interface OpsHubRawInput {
  organization: OverviewOrganizationHeader;
  reviewItems: ReviewQueueItem[];
  compareItems: CompareQueueItem[];
  quoteDrafts: QuoteDraftItem[];
  approvalRequests: ApprovalRequest[];
  activityEvents: ActivityEvent[];
  memberCount: number;
  activeMemberCount: number;
  errorBlocks?: ErrorBlockKey[];
}

// ═══════════════════════════════════════════════════
// 1. Count Calculators
// ═══════════════════════════════════════════════════

export function countReviewByStatus(items: ReviewQueueItem[]) {
  const active = items.filter((i) => i.status !== "excluded");
  return {
    total: active.length,
    confirmed: active.filter((i) => i.status === "confirmed").length,
    needsReview: active.filter((i) => i.status === "needs_review").length,
    matchFailed: active.filter((i) => i.status === "match_failed").length,
    compareNeeded: active.filter((i) => i.status === "compare_needed").length,
    approved: active.filter((i) => i.status === "approved").length,
  };
}

export function countCompareByStatus(items: CompareQueueItem[]) {
  const active = items.filter((i) => i.status !== "removed");
  return {
    total: active.length,
    pending: active.filter((i) => i.status === "pending_comparison" || i.status === "selection_needed").length,
    confirmed: active.filter((i) => i.status === "selection_confirmed").length,
  };
}

export function countQuoteDraftByStatus(items: QuoteDraftItem[]) {
  const active = items.filter((i) => i.status !== "removed");
  return {
    total: active.length,
    ready: active.filter((i) => i.status === "draft_ready").length,
    missing: active.filter((i) => i.status === "missing_required_fields").length,
    review: active.filter((i) => i.status === "awaiting_review").length,
  };
}

export function countApprovalByState(requests: ApprovalRequest[]) {
  return {
    total: requests.length,
    pending: requests.filter((r) => r.approvalState === "pending_approval").length,
    approved: requests.filter((r) => r.approvalState === "approved").length,
    rejected: requests.filter((r) => r.approvalState === "rejected").length,
  };
}

export function countBudgetWarnings(drafts: QuoteDraftItem[]): number {
  return drafts.filter((d) => d.budgetHint === "budgetCheckRequired" && d.status !== "removed").length;
}

export function countInventoryWarnings(drafts: QuoteDraftItem[]): number {
  return drafts.filter((d) => d.inventoryHint === "possibleDuplicatePurchase" && d.status !== "removed").length;
}

export function countRecentActivity(events: ActivityEvent[], days: number = 7): number {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return events.filter((e) => e.timestamp >= cutoff).length;
}

// ═══════════════════════════════════════════════════
// 2. Tone / Severity / Label Resolvers
// ═══════════════════════════════════════════════════

export function resolveKpiTone(key: string, value: number): KpiTone {
  switch (key) {
    case "reviewNeeded": return value === 0 ? "green" : value <= 5 ? "amber" : "red";
    case "compareWaiting": return value === 0 ? "green" : value <= 3 ? "blue" : "amber";
    case "quoteDraftReady": return value === 0 ? "slate" : "green";
    case "approvalPending": return value === 0 ? "green" : value <= 2 ? "amber" : "red";
    case "budgetWarnings": return value === 0 ? "green" : "amber";
    case "inventoryWarnings": return value === 0 ? "green" : "amber";
    default: return "slate";
  }
}

export function resolveStatusLabel(key: string, value: number): string {
  switch (key) {
    case "reviewNeeded": return value === 0 ? "정상" : value <= 5 ? "확인 필요" : "우선 처리";
    case "compareWaiting": return value === 0 ? "정상" : value <= 3 ? "처리 가능" : "대기 증가";
    case "quoteDraftReady": return value === 0 ? "없음" : "즉시 처리 가능";
    case "approvalPending": return value === 0 ? "정상" : value <= 2 ? "대기 중" : "우선 확인";
    case "budgetWarnings": return value === 0 ? "정상" : "검토 필요";
    case "inventoryWarnings": return value === 0 ? "정상" : "대조 필요";
    case "activeMembers": return "운영 중";
    case "recentActivity": return "활동 추적 중";
    default: return "";
  }
}

export function resolveAlertSeverity(type: string, count: number, ageDays?: number): AlertSeverity {
  if (type === "staleApproval" && ageDays && ageDays >= 7) return "urgent";
  if (type === "submissionBlocked" && count >= 3) return "urgent";
  if (type === "budgetCheck" || type === "inventoryDupe") return count >= 3 ? "urgent" : "warning";
  if (type === "matchFailed") return count >= 5 ? "warning" : "info";
  if (type === "compareBacklog") return "info";
  return "info";
}

export function buildHelperText(key: string, count: number): string {
  const KPI_DESCRIPTIONS: Record<string, string> = {
    reviewNeeded: "Step 1에서 확인이 필요한 항목입니다",
    compareWaiting: "후보 선택이 필요한 항목입니다",
    quoteDraftReady: "Step 3에서 바로 제출할 수 있습니다",
    approvalPending: "검토 또는 제출 승인이 필요한 요청입니다",
    budgetWarnings: "제출 전 예산 검토가 필요한 항목입니다",
    inventoryWarnings: "기존 재고와 중복 구매 가능성이 있습니다",
    activeMembers: "최근 작업이 있는 조직 멤버 수입니다",
    recentActivity: "검토, 비교, 제출, 승인 이벤트 기준입니다",
  };
  return KPI_DESCRIPTIONS[key] ?? "";
}

// ═══════════════════════════════════════════════════
// 3. Block-Level Mappers
// ═══════════════════════════════════════════════════

function mapKpis(input: OpsHubRawInput): OverviewKpiCardViewModel[] {
  const review = countReviewByStatus(input.reviewItems);
  const compare = countCompareByStatus(input.compareItems);
  const quote = countQuoteDraftByStatus(input.quoteDrafts);
  const approval = countApprovalByState(input.approvalRequests);
  const budget = countBudgetWarnings(input.quoteDrafts);
  const inventory = countInventoryWarnings(input.quoteDrafts);
  const recent = countRecentActivity(input.activityEvents, 7);

  const entries: { key: string; title: string; value: number; linkHref: string | null }[] = [
    { key: "reviewNeeded", title: "검토 필요", value: review.needsReview, linkHref: "/search" },
    { key: "compareWaiting", title: "비교 확정 대기", value: compare.pending, linkHref: "/search" },
    { key: "quoteDraftReady", title: "견적 초안 제출 가능", value: quote.ready, linkHref: "/search" },
    { key: "approvalPending", title: "승인 대기", value: approval.pending, linkHref: null },
    { key: "budgetWarnings", title: "예산 확인 필요", value: budget, linkHref: null },
    { key: "inventoryWarnings", title: "재고 중복 가능", value: inventory, linkHref: "/dashboard/inventory" },
    { key: "activeMembers", title: "활성 멤버", value: input.activeMemberCount, linkHref: null },
    { key: "recentActivity", title: "최근 7일 활동", value: recent, linkHref: null },
  ];

  return entries.map((e) => ({
    key: e.key,
    title: e.title,
    value: e.value,
    description: buildHelperText(e.key, e.value),
    statusLabel: resolveStatusLabel(e.key, e.value),
    tone: resolveKpiTone(e.key, e.value),
    linkHref: e.linkHref,
  }));
}

function mapStepFunnel(input: OpsHubRawInput): StepFunnelViewModel {
  const r = countReviewByStatus(input.reviewItems);
  const c = countCompareByStatus(input.compareItems);
  const q = countQuoteDraftByStatus(input.quoteDrafts);

  return {
    stages: [
      { key: "step1", title: "검토 큐", count: r.total, description: "입력 해석과 항목 검토가 진행 중입니다", subStatus: `검토 필요 ${r.needsReview} · 실패 ${r.matchFailed}`, linkHref: "/search", ctaLabel: "검토 큐 열기" },
      { key: "step2", title: "비교 큐", count: c.total, description: "후보 선택과 비교 확정이 필요한 항목입니다", subStatus: `선택 필요 ${c.pending} · 확정 ${c.confirmed}`, linkHref: "/search", ctaLabel: "비교 큐 열기" },
      { key: "step3", title: "견적 초안", count: q.total, description: "제출 전 수량·단위·예산을 확인할 수 있습니다", subStatus: `제출 가능 ${q.ready} · 보류 ${q.missing + q.review}`, linkHref: "/search", ctaLabel: "견적 초안 열기" },
    ],
  };
}

function mapAlerts(input: OpsHubRawInput): AlertsBlockViewModel {
  const items: AlertItemViewModel[] = [];

  // 장기 승인 대기
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const stale = input.approvalRequests.filter((r) => r.approvalState === "pending_approval" && r.createdAt < sevenDaysAgo);
  if (stale.length > 0) {
    items.push({ id: "stale-approvals", severity: "urgent", severityLabel: "긴급", title: "승인 지연", description: `7일 이상 대기 중인 승인 요청 ${stale.length}건`, count: stale.length, linkHref: "#approvals", ctaLabel: "승인 요청 보기" });
  }

  // 예산
  const budgetCount = countBudgetWarnings(input.quoteDrafts);
  if (budgetCount > 0) {
    const sev = resolveAlertSeverity("budgetCheck", budgetCount);
    items.push({ id: "budget-check", severity: sev, severityLabel: sev === "urgent" ? "긴급" : "주의", title: "예산 확인 필요", description: `제출 전 검토가 필요한 견적 초안 ${budgetCount}건`, count: budgetCount, linkHref: "/search", ctaLabel: "예산 확인 항목 보기" });
  }

  // 재고 중복
  const invCount = countInventoryWarnings(input.quoteDrafts);
  if (invCount > 0) {
    const sev = resolveAlertSeverity("inventoryDupe", invCount);
    items.push({ id: "inv-dupe", severity: sev, severityLabel: sev === "urgent" ? "긴급" : "주의", title: "재고 중복 가능", description: `기존 보유 재고와 대조가 필요한 항목 ${invCount}건`, count: invCount, linkHref: "/dashboard/inventory", ctaLabel: "재고 대조 항목 보기" });
  }

  // 매칭 실패
  const matchFailed = input.reviewItems.filter((i) => i.status === "match_failed").length;
  if (matchFailed >= 3) {
    items.push({ id: "match-fail", severity: "info", severityLabel: "안내", title: "매칭 실패 항목", description: `후보를 찾지 못한 항목 ${matchFailed}건`, count: matchFailed, linkHref: "/search", ctaLabel: "검토 큐 확인" });
  }

  // 제출 차단
  const blocked = input.quoteDrafts.filter((i) => i.status === "missing_required_fields").length;
  if (blocked > 0) {
    items.push({ id: "blocked", severity: "warning", severityLabel: "주의", title: "견적 제출 차단", description: `필수 정보가 누락된 견적 초안 ${blocked}건`, count: blocked, linkHref: "/search", ctaLabel: "초안 수정" });
  }

  // 정렬: urgent > warning > info
  const order: Record<AlertSeverity, number> = { urgent: 0, warning: 1, info: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return { items, isEmpty: items.length === 0, emptyMessage: "현재 우선 확인이 필요한 운영 경고가 없습니다" };
}

function mapWorkQueue(input: OpsHubRawInput): WorkQueueBlockViewModel {
  const sections: WorkQueueSectionViewModel[] = [];
  const reviewNeeded = input.reviewItems.filter((i) => i.status === "needs_review");
  const confirmed = input.reviewItems.filter((i) => i.status === "confirmed");

  if (confirmed.length > 0) {
    sections.push({ id: "approve-ready", title: "즉시 승인 가능", count: confirmed.length, description: "검토가 끝나 바로 다음 단계로 보낼 수 있습니다", linkHref: "/search", ctaLabel: "승인 가능한 항목 보기", details: [] });
  }

  const comparePending = input.compareItems.filter((i) => i.status === "pending_comparison" || i.status === "selection_needed");
  if (comparePending.length > 0) {
    sections.push({ id: "compare-needed", title: "후보 선택 필요", count: comparePending.length, description: "비교 후 선택 확정이 필요한 항목입니다", linkHref: "/search", ctaLabel: "비교 확정하러 가기", details: [] });
  }

  const draftReady = input.quoteDrafts.filter((i) => i.status === "draft_ready");
  if (draftReady.length > 0) {
    sections.push({ id: "submit-ready", title: "제출 직전 확인", count: draftReady.length, description: "견적 요청 전에 수량·단위·예산을 확인하세요", linkHref: "/search", ctaLabel: "견적 초안 확인하기", details: [] });
  }

  if (reviewNeeded.length > 0) {
    const mfg = reviewNeeded.filter((i) => i.reviewReason?.includes("manufacturer_missing")).length;
    const spec = reviewNeeded.filter((i) => i.reviewReason?.includes("spec_unclear")).length;
    const qty = reviewNeeded.filter((i) => i.reviewReason?.includes("quantity_missing")).length;
    sections.push({
      id: "manual-review", title: "수동 확인 필요", count: reviewNeeded.length, description: "자동 해석만으로는 확정할 수 없는 항목입니다", linkHref: "/search", ctaLabel: "수동 검토 항목 보기",
      details: [
        ...(mfg > 0 ? [{ label: "제조사 확인 필요", count: mfg }] : []),
        ...(spec > 0 ? [{ label: "규격 확인 필요", count: spec }] : []),
        ...(qty > 0 ? [{ label: "수량 누락", count: qty }] : []),
      ],
    });
  }

  return { sections, isEmpty: sections.length === 0, emptyMessage: "지금 바로 처리할 작업이 없습니다" };
}

function mapApprovalInbox(input: OpsHubRawInput, currentUserId: string): ApprovalInboxBlockViewModel {
  const pending = input.approvalRequests.filter((r) => r.approvalState === "pending_approval");
  const myRequests = input.approvalRequests.filter((r) => r.requestedByUserId === currentUserId);
  const recent = input.approvalRequests
    .filter((r) => r.approvalState === "approved" || r.approvalState === "rejected")
    .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""))
    .slice(0, 5)
    .map((r) => ({
      id: r.approvalRequestId,
      action: r.requestReason,
      state: r.approvalState as "approved" | "rejected",
      stateLabel: r.approvalState === "approved" ? "승인" : "반려",
      time: r.resolvedAt ?? r.createdAt,
    }));

  const isEmpty = pending.length === 0 && myRequests.length === 0 && recent.length === 0;
  return {
    pendingCount: pending.length,
    pendingDescription: "구매 또는 운영 승인 후 진행할 수 있습니다",
    myRequestsCount: myRequests.length,
    myRequestsDescription: "현재 승인 대기 중입니다",
    recentDecisions: recent,
    isEmpty,
    emptyMessage: "현재 승인 대기 요청이 없습니다",
  };
}

function mapActivityFeed(events: ActivityEvent[], limit: number = 10): ActivityFeedBlockViewModel {
  const items: ActivityFeedItemViewModel[] = events
    .slice(-limit)
    .reverse()
    .map((e) => ({
      id: e.eventId,
      actor: e.actorLabel,
      action: e.message,
      time: e.timestamp,
      timeFormatted: new Date(e.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    }));

  return { items, isEmpty: items.length === 0, emptyMessage: "아직 기록된 운영 활동이 없습니다" };
}

// ═══════════════════════════════════════════════════
// 4. Page-Level Mapper
// ═══════════════════════════════════════════════════

const DEFAULT_QUICK_LINKS: QuickLinkItemViewModel[] = [
  { href: "/search", label: "Step 1 검토 큐 열기" },
  { href: "/search", label: "Step 2 비교 큐 열기" },
  { href: "/search", label: "Step 3 견적 초안 열기" },
  { href: "#approvals", label: "승인 요청 보기" },
  { href: "#members", label: "멤버 및 접근 관리 보기" },
  { href: "#settings", label: "정책 및 설정 보기" },
];

export function mapToOverviewPageViewModel(
  input: OpsHubRawInput,
  currentUserId: string = "current_user"
): OrganizationOverviewPageViewModel {
  return {
    organization: input.organization,
    kpis: mapKpis(input),
    stepFunnel: mapStepFunnel(input),
    alerts: mapAlerts(input),
    workQueue: mapWorkQueue(input),
    approvalInbox: mapApprovalInbox(input, currentUserId),
    activityFeed: mapActivityFeed(input.activityEvents),
    quickLinks: DEFAULT_QUICK_LINKS,
    pageState: {
      isLoading: false,
      hasPartialError: (input.errorBlocks?.length ?? 0) > 0,
      errorBlocks: input.errorBlocks ?? [],
    },
  };
}

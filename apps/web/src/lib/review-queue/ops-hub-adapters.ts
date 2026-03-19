/**
 * Organization Overview Hub — Domain Selector / Query Adapter Layer
 *
 * raw query → normalized source contract → overview mapper input.
 * UI/container는 raw API shape을 직접 알지 않는다.
 */

import type { ReviewQueueItem, CompareQueueItem, QuoteDraftItem } from "./types";
import type { ApprovalRequest, Role } from "./permissions";
import type { ActivityEvent } from "./activity-log";
import type { OpsHubRawInput } from "./ops-hub-mappers";
import type { OverviewOrganizationHeader } from "./ops-hub-view-models";

// ═══════════════════════════════════════════════════
// 1. Unified Source Contract
// ═══════════════════════════════════════════════════

export interface OverviewSourceState<T> {
  data: T;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  error?: unknown;
  lastUpdatedAt?: string | null;
}

/** empty data 기본값으로 source 생성 */
export function loadedSource<T>(data: T, isEmpty: boolean = false): OverviewSourceState<T> {
  return { data, isLoading: false, isError: false, isEmpty, lastUpdatedAt: new Date().toISOString() };
}

export function loadingSource<T>(fallback: T): OverviewSourceState<T> {
  return { data: fallback, isLoading: true, isError: false, isEmpty: true, lastUpdatedAt: null };
}

export function errorSource<T>(fallback: T, error?: unknown): OverviewSourceState<T> {
  return { data: fallback, isLoading: false, isError: true, isEmpty: true, error, lastUpdatedAt: null };
}

// ═══════════════════════════════════════════════════
// 2. Current User Source
// ═══════════════════════════════════════════════════

export interface CurrentUserContext {
  userId: string;
  role: Role;
  organizationId: string | null;
  name: string;
  email: string;
}

export function adaptCurrentUser(session: {
  user?: { id?: string; name?: string | null; email?: string | null };
} | null, roleFromMembership?: Role): OverviewSourceState<CurrentUserContext> {
  if (!session?.user?.id) {
    return errorSource({ userId: "", role: "viewer", organizationId: null, name: "", email: "" }, "no_session");
  }
  return loadedSource({
    userId: session.user.id,
    role: roleFromMembership ?? "member",
    organizationId: null,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  });
}

// ═══════════════════════════════════════════════════
// 3. Organization Members Source
// ═══════════════════════════════════════════════════

export interface OrganizationMemberSummary {
  totalCount: number;
  activeCount: number;
  invitePendingCount: number;
}

export function adaptOrganizationMembers(raw: {
  members?: Array<{ id: string; role: string; lastActiveAt?: string | null }>;
  invites?: Array<{ status: string }>;
} | null | undefined): OverviewSourceState<OrganizationMemberSummary> {
  if (!raw) return loadingSource({ totalCount: 0, activeCount: 0, invitePendingCount: 0 });

  const members = raw.members ?? [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const active = members.filter((m) => m.lastActiveAt && m.lastActiveAt >= sevenDaysAgo);
  const invitePending = (raw.invites ?? []).filter((i) => i.status === "PENDING").length;

  return loadedSource({
    totalCount: members.length,
    activeCount: active.length,
    invitePendingCount: invitePending,
  }, members.length === 0);
}

// ═══════════════════════════════════════════════════
// 4. Review Queue Source
// ═══════════════════════════════════════════════════

export function adaptReviewQueue(items: ReviewQueueItem[]): OverviewSourceState<ReviewQueueItem[]> {
  return loadedSource(items, items.length === 0);
}

// ═══════════════════════════════════════════════════
// 5. Compare Queue Source
// ═══════════════════════════════════════════════════

export function adaptCompareQueue(items: CompareQueueItem[]): OverviewSourceState<CompareQueueItem[]> {
  return loadedSource(items, items.length === 0);
}

// ═══════════════════════════════════════════════════
// 6. Quote Draft Source
// ═══════════════════════════════════════════════════

export function adaptQuoteDrafts(items: QuoteDraftItem[]): OverviewSourceState<QuoteDraftItem[]> {
  return loadedSource(items, items.length === 0);
}

// ═══════════════════════════════════════════════════
// 7. Approval Requests Source
// ═══════════════════════════════════════════════════

export function adaptApprovalRequests(requests: ApprovalRequest[]): OverviewSourceState<ApprovalRequest[]> {
  return loadedSource(requests, requests.length === 0);
}

// ═══════════════════════════════════════════════════
// 8. Activity Events Source
// ═══════════════════════════════════════════════════

export function adaptActivityEvents(events: ActivityEvent[]): OverviewSourceState<ActivityEvent[]> {
  return loadedSource(events, events.length === 0);
}

// ═══════════════════════════════════════════════════
// 9. Budget Summaries Source
// ═══════════════════════════════════════════════════

export interface BudgetSummary {
  budgetId: string;
  name: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  status: "active" | "draft" | "closed";
}

export function adaptBudgetSummaries(raw: BudgetSummary[] | null | undefined): OverviewSourceState<BudgetSummary[]> {
  const items = raw ?? [];
  return loadedSource(items, items.length === 0);
}

// ═══════════════════════════════════════════════════
// 10. Inventory Signals Source
// ═══════════════════════════════════════════════════

export interface InventorySignal {
  productId: string;
  catalogNumber: string | null;
  currentQuantity: number;
  safetyStock: number | null;
  expiryDate: string | null;
  isLow: boolean;
  isExpiring: boolean;
}

export function adaptInventorySignals(raw: InventorySignal[] | null | undefined): OverviewSourceState<InventorySignal[]> {
  const items = raw ?? [];
  return loadedSource(items, items.length === 0);
}

// ═══════════════════════════════════════════════════
// 11. Time Context Source
// ═══════════════════════════════════════════════════

export interface TimeContext {
  now: string;
  todayStart: string;
  sevenDaysAgo: string;
  thirtyDaysAgo: string;
}

export function createTimeContext(): TimeContext {
  const now = new Date();
  return {
    now: now.toISOString(),
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    sevenDaysAgo: new Date(now.getTime() - 7 * 86400000).toISOString(),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 86400000).toISOString(),
  };
}

// ═══════════════════════════════════════════════════
// 12. All Sources Combined
// ═══════════════════════════════════════════════════

export interface OverviewSourceBundle {
  currentUser: OverviewSourceState<CurrentUserContext>;
  members: OverviewSourceState<OrganizationMemberSummary>;
  reviewQueue: OverviewSourceState<ReviewQueueItem[]>;
  compareQueue: OverviewSourceState<CompareQueueItem[]>;
  quoteDrafts: OverviewSourceState<QuoteDraftItem[]>;
  approvalRequests: OverviewSourceState<ApprovalRequest[]>;
  activityEvents: OverviewSourceState<ActivityEvent[]>;
  budgetSummaries: OverviewSourceState<BudgetSummary[]>;
  inventorySignals: OverviewSourceState<InventorySignal[]>;
  timeContext: TimeContext;
}

// ═══════════════════════════════════════════════════
// 13. Source Bundle → Mapper Input Adapter
// ═══════════════════════════════════════════════════

/**
 * OverviewSourceBundle → OpsHubRawInput 변환.
 * mapper는 OverviewSourceState를 몰라도 된다.
 * 이 함수가 loading/error를 흡수하고 fallback data + errorBlocks를 만든다.
 */
export function bundleToMapperInput(
  bundle: OverviewSourceBundle,
  organization: OverviewOrganizationHeader
): OpsHubRawInput {
  const errorBlocks: Array<"alerts" | "workQueue" | "approvalInbox" | "activityFeed"> = [];

  // 각 source의 error 여부를 block error로 매핑
  if (bundle.approvalRequests.isError) errorBlocks.push("approvalInbox");
  if (bundle.activityEvents.isError) errorBlocks.push("activityFeed");
  // alerts는 여러 source에 의존 — approval + quoteDrafts + reviewQueue 중 하나라도 error면
  if (bundle.approvalRequests.isError || bundle.quoteDrafts.isError || bundle.reviewQueue.isError) {
    if (!errorBlocks.includes("alerts" as never)) errorBlocks.push("alerts");
  }
  // workQueue도 여러 source에 의존
  if (bundle.reviewQueue.isError || bundle.compareQueue.isError || bundle.quoteDrafts.isError) {
    errorBlocks.push("workQueue");
  }

  return {
    organization,
    reviewItems: bundle.reviewQueue.data,
    compareItems: bundle.compareQueue.data,
    quoteDrafts: bundle.quoteDrafts.data,
    approvalRequests: bundle.approvalRequests.data,
    activityEvents: bundle.activityEvents.data,
    memberCount: bundle.members.data.totalCount,
    activeMemberCount: bundle.members.data.activeCount,
    errorBlocks: [...new Set(errorBlocks)],
  };
}

// ═══════════════════════════════════════════════════
// 14. Source Health Summary
// ═══════════════════════════════════════════════════

export interface SourceHealthSummary {
  totalSources: number;
  loadingSources: number;
  errorSources: number;
  healthySources: number;
  isFullyLoaded: boolean;
  isPartiallyDegraded: boolean;
}

export function getSourceHealth(bundle: OverviewSourceBundle): SourceHealthSummary {
  const sources = [
    bundle.currentUser,
    bundle.members,
    bundle.reviewQueue,
    bundle.compareQueue,
    bundle.quoteDrafts,
    bundle.approvalRequests,
    bundle.activityEvents,
    bundle.budgetSummaries,
    bundle.inventorySignals,
  ];

  const loading = sources.filter((s) => s.isLoading).length;
  const errors = sources.filter((s) => s.isError).length;

  return {
    totalSources: sources.length,
    loadingSources: loading,
    errorSources: errors,
    healthySources: sources.length - loading - errors,
    isFullyLoaded: loading === 0,
    isPartiallyDegraded: errors > 0 && errors < sources.length,
  };
}

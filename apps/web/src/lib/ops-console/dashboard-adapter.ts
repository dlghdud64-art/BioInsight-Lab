/**
 * ops-console/dashboard-adapter.ts
 *
 * Today Operating Hub 대시보드 어댑터.
 * OpsStore의 EntityGraph/UnifiedInboxItem 데이터를 대시보드 뷰 모델로 변환.
 * inbox-adapter, reentry-context 의 기존 로직을 최대한 재사용한다.
 *
 * @module ops-console/dashboard-adapter
 */

import type {
  UnifiedInboxItem,
  InboxPriority,
  InboxSourceModule,
} from './inbox-adapter';
import {
  calculateInboxPriority,
  sortInboxItems,
} from './inbox-adapter';
import type { EntityGraph } from './scenario-transition-runner';
import {
  buildStockRiskReentryContext,
  buildExpiryReentryContext,
  buildReceivingExceptionReentryContext,
  buildReentryCommand,
  SOURCE_TYPE_LABELS,
  URGENCY_LABELS,
  ENTRY_PATH_LABELS,
} from './reentry-context';

// ---------------------------------------------------------------------------
// 1. Dashboard Item Types & Groups
// ---------------------------------------------------------------------------

export type DashboardItemType =
  | 'po_ready_to_issue'
  | 'po_ack_pending'
  | 'po_approval_pending'
  | 'quote_review_required'
  | 'quote_response_pending'
  | 'receiving_blocked'
  | 'receiving_postable'
  | 'quarantine_active'
  | 'reorder_due'
  | 'reorder_blocked'
  | 'expiry_action_due'
  | 'recovery_entry';

export type DashboardGroupKey =
  | 'top_priority'
  | 'blocked'
  | 'review_required'
  | 'waiting_external'
  | 'ready_to_execute'
  | 'recovery';

// ---------------------------------------------------------------------------
// 2. DashboardItem
// ---------------------------------------------------------------------------

export interface DashboardItem {
  itemType: DashboardItemType;
  sourceModule: InboxSourceModule;
  entityId: string;
  title: string;
  summary: string;
  priority: InboxPriority;
  currentOwnerName?: string;
  assignmentState: string;
  dueState: { label: string; isOverdue: boolean; tone: 'normal' | 'due_soon' | 'overdue' };
  blockerSummary?: string;
  readySummary?: string;
  waitingExternalLabel?: string;
  nextAction: string;
  nextRoute: string;
  nextOwnerName?: string;
  groupKey: DashboardGroupKey;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 3. Today Header Stats
// ---------------------------------------------------------------------------

export interface TodayHeaderStats {
  totalActionable: number;
  blockedCount: number;
  overdueCount: number;
  waitingExternalCount: number;
  readyToExecuteCount: number;
  myWorkCount: number;
  teamWorkCount: number;
}

// ---------------------------------------------------------------------------
// 4. Owner Workload
// ---------------------------------------------------------------------------

export interface OwnerWorkload {
  ownerName: string;
  openCount: number;
  blockedCount: number;
  overdueCount: number;
  nextCriticalItem?: { title: string; entityRoute: string; priority: string };
}

// ---------------------------------------------------------------------------
// 5. Ready Action
// ---------------------------------------------------------------------------

export interface ReadyAction {
  entityId: string;
  title: string;
  whyReady: string;
  ownerName?: string;
  nextAction: string;
  handoffTarget: string;
  nextRoute: string;
  sourceModule: string;
}

// ---------------------------------------------------------------------------
// 6. Recovery Entry
// ---------------------------------------------------------------------------

export interface RecoveryEntry {
  entityId: string;
  sourceContext: string;
  whyReentry: string;
  recommendedEntryPath: string;
  nextOwner?: string;
  returnRoute: string;
  entryHref: string;
  sourceModule: string;
}

// ---------------------------------------------------------------------------
// 7. Blocker Section
// ---------------------------------------------------------------------------

export interface BlockerSection {
  resolveFirst: DashboardItem[];
  reviewRequired: DashboardItem[];
  waitingExternal: DashboardItem[];
  escalationNeeded: DashboardItem[];
}

// ---------------------------------------------------------------------------
// 8. Internal: WorkType → DashboardItemType mapping
// ---------------------------------------------------------------------------

function resolveDashboardItemType(item: UnifiedInboxItem): DashboardItemType {
  switch (item.workType) {
    case 'po_ready_to_issue':
      return 'po_ready_to_issue';
    case 'po_ack_pending':
      return 'po_ack_pending';
    case 'po_approval_pending':
      return 'po_approval_pending';
    case 'quote_review_required':
      return 'quote_review_required';
    case 'quote_response_pending':
      return 'quote_response_pending';
    case 'receiving_issue':
      return 'receiving_blocked';
    case 'posting_blocked':
      return 'receiving_blocked';
    case 'quarantine_constrained':
      return 'quarantine_active';
    case 'reorder_due':
      return item.blockedReason ? 'reorder_blocked' : 'reorder_due';
    case 'expiry_action_due':
      return 'expiry_action_due';
    default:
      return 'reorder_due';
  }
}

// ---------------------------------------------------------------------------
// 9. Internal: Triage → DashboardGroupKey mapping
// ---------------------------------------------------------------------------

function resolveGroupKey(item: UnifiedInboxItem): DashboardGroupKey {
  if (item.blockedReason) return 'blocked';
  switch (item.triageGroup) {
    case 'now':
      return 'ready_to_execute';
    case 'needs_review':
      return 'review_required';
    case 'blocked':
      return 'blocked';
    case 'waiting_external':
      return 'waiting_external';
    case 'due_soon':
      return 'review_required';
    default:
      return 'review_required';
  }
}

// ---------------------------------------------------------------------------
// 10. Internal: Assignment state label
// ---------------------------------------------------------------------------

function resolveAssignmentState(item: UnifiedInboxItem): string {
  if (!item.owner) return '미배정';
  return '담당 배정';
}

// ---------------------------------------------------------------------------
// 11. Internal: Waiting external label
// ---------------------------------------------------------------------------

function resolveWaitingExternalLabel(item: UnifiedInboxItem): string | undefined {
  if (item.workType === 'quote_response_pending') return '공급사 응답 대기';
  if (item.workType === 'po_ack_pending') return '공급사 확인 대기';
  return undefined;
}

// ---------------------------------------------------------------------------
// 12. buildDashboardItems
// ---------------------------------------------------------------------------

export function buildDashboardItems(items: UnifiedInboxItem[]): DashboardItem[] {
  return items.map((item): DashboardItem => ({
    itemType: resolveDashboardItemType(item),
    sourceModule: item.sourceModule,
    entityId: item.entityId,
    title: item.title,
    summary: item.summary,
    priority: item.priority,
    currentOwnerName: item.owner,
    assignmentState: resolveAssignmentState(item),
    dueState: item.dueState,
    blockerSummary: item.blockedReason,
    readySummary: !item.blockedReason && item.triageGroup === 'now'
      ? '즉시 실행 가능'
      : undefined,
    waitingExternalLabel: resolveWaitingExternalLabel(item),
    nextAction: item.nextAction,
    nextRoute: item.entityRoute,
    nextOwnerName: item.owner,
    groupKey: resolveGroupKey(item),
    updatedAt: item.updatedAt,
  }));
}

// ---------------------------------------------------------------------------
// 13. buildTodayHeaderStats
// ---------------------------------------------------------------------------

export function buildTodayHeaderStats(items: UnifiedInboxItem[]): TodayHeaderStats {
  const totalActionable = items.length;
  const blockedCount = items.filter((i) => i.blockedReason != null).length;
  const overdueCount = items.filter((i) => i.dueState.isOverdue).length;
  const waitingExternalCount = items.filter(
    (i) => i.triageGroup === 'waiting_external',
  ).length;
  const readyToExecuteCount = items.filter(
    (i) => i.triageGroup === 'now',
  ).length;
  const myWorkCount = items.filter((i) => i.owner != null).length;
  const teamWorkCount = items.filter((i) => i.owner == null).length;

  return {
    totalActionable,
    blockedCount,
    overdueCount,
    waitingExternalCount,
    readyToExecuteCount,
    myWorkCount,
    teamWorkCount,
  };
}

// ---------------------------------------------------------------------------
// 14. buildTopPriorityQueue
// ---------------------------------------------------------------------------

/**
 * 운영 영향도 기준 상위 항목 추출.
 *
 * 우선순위 순서:
 *  1. P0: 승인 발행 지연 PO, 입고 격리/문서 차단, 긴급 부족+차단 재주문, 만료 기한 초과
 *  2. P1: 견적 검토 필요(대체품/문서), 확인 대기+납기 압박, 부분 반영 차단
 *  3. 하위: 외부 대기만, 모니터 만료
 *
 * inbox-adapter의 priority/triage를 재사용.
 */
export function buildTopPriorityQueue(
  items: UnifiedInboxItem[],
  limit: number = 8,
): DashboardItem[] {
  // Operational impact scoring (higher = more urgent)
  const scored = items.map((item) => {
    let score = 0;

    // P0 tier: highest operational impact
    if (item.priority === 'p0') score += 1000;
    if (item.priority === 'p1') score += 500;
    if (item.priority === 'p2') score += 200;

    // Overdue escalation
    if (item.dueState.isOverdue) score += 300;
    if (item.dueState.tone === 'due_soon') score += 100;

    // Blocker escalation
    if (item.blockedReason) score += 150;

    // Quarantine is always highest within its tier
    if (item.workType === 'quarantine_constrained') score += 200;

    // PO ready to issue overdue = money sitting idle
    if (item.workType === 'po_ready_to_issue' && item.dueState.isOverdue) score += 250;

    // Receiving doc missing blocks inventory
    if (item.workType === 'receiving_issue') score += 100;

    // Critical shortage reorder blocked
    if (
      item.workType === 'reorder_due' &&
      item.blockedReason &&
      item.riskBadges.some((b) => b.includes('긴급'))
    ) {
      score += 200;
    }

    return { item, score };
  });

  scored.sort((a, b) => {
    const sd = b.score - a.score;
    if (sd !== 0) return sd;
    // Tie-break: overdue first, then priority, then updatedAt
    if (a.item.dueState.isOverdue && !b.item.dueState.isOverdue) return -1;
    if (!a.item.dueState.isOverdue && b.item.dueState.isOverdue) return 1;
    return new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime();
  });

  return buildDashboardItems(scored.slice(0, limit).map((s) => s.item));
}

// ---------------------------------------------------------------------------
// 15. buildOwnerWorkloads
// ---------------------------------------------------------------------------

export function buildOwnerWorkloads(items: UnifiedInboxItem[]): OwnerWorkload[] {
  const ownerMap = new Map<string, UnifiedInboxItem[]>();

  for (const item of items) {
    const owner = item.owner ?? '미배정';
    const existing = ownerMap.get(owner) ?? [];
    existing.push(item);
    ownerMap.set(owner, existing);
  }

  const workloads: OwnerWorkload[] = [];

  for (const [ownerName, ownerItems] of Array.from(ownerMap.entries())) {
    const blocked = ownerItems.filter((i) => i.blockedReason != null);
    const overdue = ownerItems.filter((i) => i.dueState.isOverdue);

    // Find most critical item (highest priority, overdue first)
    const sorted = sortInboxItems(ownerItems);
    const critical = sorted[0];

    workloads.push({
      ownerName,
      openCount: ownerItems.length,
      blockedCount: blocked.length,
      overdueCount: overdue.length,
      nextCriticalItem: critical
        ? {
            title: critical.title,
            entityRoute: critical.entityRoute,
            priority: critical.priority,
          }
        : undefined,
    });
  }

  // Sort: most overdue first, then most blocked, then most open
  workloads.sort((a, b) => {
    const od = b.overdueCount - a.overdueCount;
    if (od !== 0) return od;
    const bd = b.blockedCount - a.blockedCount;
    if (bd !== 0) return bd;
    return b.openCount - a.openCount;
  });

  return workloads;
}

// ---------------------------------------------------------------------------
// 16. buildBlockerSection
// ---------------------------------------------------------------------------

export function buildBlockerSection(items: UnifiedInboxItem[]): BlockerSection {
  const allDashboard = buildDashboardItems(items);

  const resolveFirst: DashboardItem[] = [];
  const reviewRequired: DashboardItem[] = [];
  const waitingExternal: DashboardItem[] = [];
  const escalationNeeded: DashboardItem[] = [];

  for (const di of allDashboard) {
    // Escalation: P0 + overdue + blocked
    if (di.priority === 'p0' && di.dueState.isOverdue && di.blockerSummary) {
      escalationNeeded.push(di);
      continue;
    }

    // Blocked items
    if (di.blockerSummary) {
      resolveFirst.push(di);
      continue;
    }

    // Waiting external
    if (di.waitingExternalLabel) {
      waitingExternal.push(di);
      continue;
    }

    // Review required
    if (di.groupKey === 'review_required') {
      reviewRequired.push(di);
      continue;
    }
  }

  return { resolveFirst, reviewRequired, waitingExternal, escalationNeeded };
}

// ---------------------------------------------------------------------------
// 17. buildReadyActions
// ---------------------------------------------------------------------------

export function buildReadyActions(items: UnifiedInboxItem[]): ReadyAction[] {
  // Only truly ready items: triageGroup === 'now', no blocker
  const readyItems = items.filter(
    (i) => i.triageGroup === 'now' && !i.blockedReason,
  );

  return readyItems.map((item): ReadyAction => {
    let whyReady: string;
    let handoffTarget: string;

    switch (item.workType) {
      case 'po_ready_to_issue':
        whyReady = '승인 완료, 공급사 발행 가능';
        handoffTarget = '공급사';
        break;
      case 'quarantine_constrained':
        whyReady = '격리 검사 실행 대기';
        handoffTarget = 'QC 담당';
        break;
      case 'receiving_issue':
        whyReady = '문서 재요청 또는 검수 진행 가능';
        handoffTarget = '공급사 / 검수 담당';
        break;
      case 'reorder_due':
        whyReady = '재주문 발주 또는 견적 요청 가능';
        handoffTarget = '구매 담당';
        break;
      case 'expiry_action_due':
        whyReady = '만료 조치 실행 가능';
        handoffTarget = '재고 담당';
        break;
      default:
        whyReady = '즉시 처리 가능';
        handoffTarget = '담당자';
    }

    return {
      entityId: item.entityId,
      title: item.title,
      whyReady,
      ownerName: item.owner,
      nextAction: item.nextAction,
      handoffTarget,
      nextRoute: item.entityRoute,
      sourceModule: item.sourceModule,
    };
  });
}

// ---------------------------------------------------------------------------
// 18. buildRecoveryEntries
// ---------------------------------------------------------------------------

export function buildRecoveryEntries(graph: EntityGraph): RecoveryEntry[] {
  const entries: RecoveryEntry[] = [];

  // Stock risk reorder recovery
  for (const rr of graph.reorderRecommendations) {
    if (rr.status === 'blocked' || rr.urgency === 'urgent' || (rr.urgency as string) === 'critical') {
      const sp = graph.stockPositions.find((p) => p.id === rr.supportingStockPositionId);
      const ctx = buildStockRiskReentryContext(rr, sp);
      const cmd = buildReentryCommand(ctx);
      const urgencyLabel = URGENCY_LABELS[ctx.urgency];

      entries.push({
        entityId: rr.id,
        sourceContext: `${SOURCE_TYPE_LABELS[ctx.sourceType]} (${urgencyLabel})`,
        whyReentry: ctx.sourceSummary,
        recommendedEntryPath: ENTRY_PATH_LABELS[cmd.entryPath],
        nextOwner: ctx.urgency === 'critical' ? '구매 담당자' : undefined,
        returnRoute: ctx.returnRoute ?? '/dashboard/stock-risk',
        entryHref: cmd.href,
        sourceModule: 'stock_risk',
      });
    }
  }

  // Expiry replacement recovery
  for (const ea of graph.expiryActions) {
    if (ea.status === 'completed' || ea.status === 'dismissed') continue;
    if (ea.actionType === 'replace_order' || ea.actionType === 'dispose') {
      const sp = graph.stockPositions.find((p) => p.inventoryItemId === ea.inventoryItemId);
      const ctx = buildExpiryReentryContext(ea, sp);
      const cmd = buildReentryCommand(ctx);
      const urgencyLabel = URGENCY_LABELS[ctx.urgency];

      entries.push({
        entityId: ea.id,
        sourceContext: `${SOURCE_TYPE_LABELS[ctx.sourceType]} (${urgencyLabel})`,
        whyReentry: ctx.sourceSummary,
        recommendedEntryPath: ENTRY_PATH_LABELS[cmd.entryPath],
        nextOwner: ctx.urgency === 'critical' ? '구매 담당자' : undefined,
        returnRoute: ctx.returnRoute ?? '/dashboard/stock-risk',
        entryHref: cmd.href,
        sourceModule: 'stock_risk',
      });
    }
  }

  // Receiving exception recovery
  for (const rb of graph.receivingBatches) {
    if (rb.status === 'posted' || rb.status === 'closed' || rb.status === 'cancelled') continue;

    const hasIssue = rb.lineReceipts.some(
      (l) =>
        l.conditionStatus !== 'ok' ||
        l.documentStatus !== 'complete' ||
        l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
    );

    if (hasIssue) {
      const ctx = buildReceivingExceptionReentryContext(rb);
      const cmd = buildReentryCommand(ctx);
      const urgencyLabel = URGENCY_LABELS[ctx.urgency];

      entries.push({
        entityId: rb.id,
        sourceContext: `${SOURCE_TYPE_LABELS[ctx.sourceType]} (${urgencyLabel})`,
        whyReentry: ctx.sourceSummary,
        recommendedEntryPath: ENTRY_PATH_LABELS[cmd.entryPath],
        returnRoute: ctx.returnRoute ?? `/dashboard/receiving/${rb.id}`,
        entryHref: cmd.href,
        sourceModule: 'receiving',
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 19. Dashboard Group Metadata
// ---------------------------------------------------------------------------

export const DASHBOARD_GROUP_META: Record<
  DashboardGroupKey,
  { label: string; order: number }
> = {
  top_priority: { label: '최우선 처리', order: 0 },
  blocked: { label: '차단 해소 필요', order: 1 },
  review_required: { label: '검토 필요', order: 2 },
  waiting_external: { label: '외부 대기', order: 3 },
  ready_to_execute: { label: '즉시 실행', order: 4 },
  recovery: { label: '재진입 필요', order: 5 },
};

export const DASHBOARD_ITEM_TYPE_LABELS: Record<DashboardItemType, string> = {
  po_ready_to_issue: '발주 발행 대기',
  po_ack_pending: '공급사 확인 대기',
  po_approval_pending: '승인 대기',
  quote_review_required: '견적 비교 검토',
  quote_response_pending: '공급사 응답 대기',
  receiving_blocked: '입고 차단',
  receiving_postable: '재고 반영 가능',
  quarantine_active: '격리 진행 중',
  reorder_due: '재주문 필요',
  reorder_blocked: '재주문 차단',
  expiry_action_due: '만료 조치 필요',
  recovery_entry: '재진입 필요',
};

// ---------------------------------------------------------------------------
// 20. Header Stats Labels (drill-down routes)
// ---------------------------------------------------------------------------

export const HEADER_STAT_META: Record<
  keyof TodayHeaderStats,
  { label: string; route: string }
> = {
  totalActionable: { label: '전체 작업', route: '/dashboard/inbox' },
  blockedCount: { label: '차단', route: '/dashboard/inbox?filter_state=blocked' },
  overdueCount: { label: '기한 초과', route: '/dashboard/inbox?filter_state=overdue' },
  waitingExternalCount: { label: '외부 대기', route: '/dashboard/inbox?filter_state=waiting_external' },
  readyToExecuteCount: { label: '실행 가능', route: '/dashboard/inbox?filter_state=now' },
  myWorkCount: { label: '내 작업', route: '/dashboard/inbox?filter_owner=my_work' },
  teamWorkCount: { label: '팀 작업', route: '/dashboard/inbox?filter_owner=team_work' },
};

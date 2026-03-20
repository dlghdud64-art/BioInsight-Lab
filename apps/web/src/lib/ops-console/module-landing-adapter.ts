/**
 * ops-console/module-landing-adapter.ts
 *
 * 모듈 랜딩 뷰 모델 어댑터.
 * Quotes, PO, Receiving, Stock Risk 모듈 랜딩 페이지에서 공유하는
 * 통합 뷰 모델, 버킷 분류, 헤더 통계, 다운스트림 핸드오프를 제공합니다.
 *
 * inbox-adapter의 UnifiedInboxItem을 소스로 사용하며,
 * dashboard-adapter의 스코어링 패턴을 모듈 범위로 축소 적용합니다.
 *
 * @module ops-console/module-landing-adapter
 */

import type {
  UnifiedInboxItem,
  InboxSourceModule,
  InboxWorkType,
} from './inbox-adapter';
import {
  sortInboxItems,
} from './inbox-adapter';

// ---------------------------------------------------------------------------
// 1. Module Landing Item
// ---------------------------------------------------------------------------

export type ModuleBucketKey =
  | 'ready'
  | 'blocked'
  | 'needs_review'
  | 'waiting_external'
  | 'handoff';

export interface ModuleLandingItem {
  moduleType: 'quote' | 'po' | 'receiving' | 'stock_risk';
  entityId: string;
  title: string;
  summary: string;
  bucketKey: ModuleBucketKey;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  currentOwnerName?: string;
  assignmentState: string;
  dueState: {
    label: string;
    isOverdue: boolean;
    tone: 'normal' | 'due_soon' | 'overdue';
  };
  blockerSummary?: string;
  reviewSummary?: string;
  waitingExternalLabel?: string;
  readySummary?: string;
  nextAction: string;
  targetRoute: string;
  nextHandoffLabel?: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 2. Module Header Stats
// ---------------------------------------------------------------------------

export interface ModuleHeaderStats {
  openActionable: number;
  blocked: number;
  overdue: number;
  waitingExternal: number;
  readyToExecute: number;
  nextActionSummary: string;
}

// ---------------------------------------------------------------------------
// 3. Module Downstream
// ---------------------------------------------------------------------------

export interface ModuleDownstream {
  label: string;
  count: number;
  targetRoute: string;
  description: string;
}

// ---------------------------------------------------------------------------
// 4. Module Orientation
// ---------------------------------------------------------------------------

export const MODULE_ORIENTATION: Record<
  InboxSourceModule,
  {
    role: string;
    stages: string;
    upstream?: string;
    downstream?: string;
  }
> = {
  quote: {
    role: '견적 / 응답 / 비교 / 선정',
    stages: '응답 수집 → 비교 검토 → 공급사 선택 → PO 전환',
    downstream: '발주 관리',
  },
  po: {
    role: '승인 / 발행 / 확인 / 입고 인계',
    stages: '승인 진행 → 발행 → 공급사 확인 → 입고 연결',
    upstream: '견적',
    downstream: '입고 관리',
  },
  receiving: {
    role: '도착 / 검수 / 문서 / 재고 반영',
    stages: '도착 확인 → 검수 → lot/문서 확인 → 반영',
    upstream: '발주',
    downstream: '재고 위험',
  },
  stock_risk: {
    role: '부족 / 만료 / 재주문 / 복구',
    stages: '부족 감지 → 재주문 → 만료 조치 → sourcing 복구',
    upstream: '입고',
  },
};

// ---------------------------------------------------------------------------
// 5. Bucket Key Labels
// ---------------------------------------------------------------------------

export const BUCKET_KEY_META: Record<
  ModuleBucketKey,
  { label: string; order: number }
> = {
  ready: { label: '실행 가능', order: 0 },
  blocked: { label: '차단됨', order: 1 },
  needs_review: { label: '검토 필요', order: 2 },
  waiting_external: { label: '외부 대기', order: 3 },
  handoff: { label: '인계 준비', order: 4 },
};

// ---------------------------------------------------------------------------
// 6. Internal: Bucket resolution
// ---------------------------------------------------------------------------

/** WorkType이 다운스트림 핸드오프 준비 상태를 의미하는지 판별 */
const HANDOFF_WORK_TYPES: Set<InboxWorkType> = new Set([
  'po_ready_to_issue',
  'posting_blocked', // posting ready 가 차단 해소 시 반영 가능
]);

function resolveBucketKey(item: UnifiedInboxItem): ModuleBucketKey {
  // blocked: has blockedReason
  if (item.blockedReason) return 'blocked';

  // handoff: workType suggests downstream readiness
  if (HANDOFF_WORK_TYPES.has(item.workType) && !item.blockedReason && item.triageGroup === 'now') {
    return 'handoff';
  }

  // ready: triageGroup='now' AND no blockedReason
  if (item.triageGroup === 'now') return 'ready';

  // needs_review: triageGroup='needs_review'
  if (item.triageGroup === 'needs_review') return 'needs_review';

  // waiting_external: triageGroup='waiting_external'
  if (item.triageGroup === 'waiting_external') return 'waiting_external';

  // due_soon → needs_review bucket (review-like urgency)
  if (item.triageGroup === 'due_soon') return 'needs_review';

  return 'needs_review';
}

// ---------------------------------------------------------------------------
// 7. Internal: Assignment state label
// ---------------------------------------------------------------------------

function resolveAssignmentState(item: UnifiedInboxItem): string {
  if (!item.owner) return '미배정';
  return '담당 배정';
}

// ---------------------------------------------------------------------------
// 8. Internal: Waiting external label
// ---------------------------------------------------------------------------

function resolveWaitingExternalLabel(
  item: UnifiedInboxItem,
): string | undefined {
  if (item.workType === 'quote_response_pending') return '공급사 응답 대기';
  if (item.workType === 'po_ack_pending') return '공급사 확인 대기';
  return undefined;
}

// ---------------------------------------------------------------------------
// 9. Internal: Review summary
// ---------------------------------------------------------------------------

function resolveReviewSummary(item: UnifiedInboxItem): string | undefined {
  if (item.workType === 'quote_review_required') return '비교표 검토 후 공급사 선정 필요';
  if (item.workType === 'po_approval_pending') return '승인 단계 진행 확인 필요';
  if (item.workType === 'expiry_action_due') return '만료 조치 방안 검토 필요';
  if (item.workType === 'reorder_due' && !item.blockedReason) return '재주문 수량/공급사 검토 필요';
  return undefined;
}

// ---------------------------------------------------------------------------
// 10. Internal: Ready summary
// ---------------------------------------------------------------------------

function resolveReadySummary(item: UnifiedInboxItem): string | undefined {
  if (item.blockedReason) return undefined;
  if (item.triageGroup !== 'now') return undefined;

  switch (item.workType) {
    case 'po_ready_to_issue':
      return '승인 완료, 발행 실행 가능';
    case 'quarantine_constrained':
      return '격리 검사 실행 대기';
    case 'receiving_issue':
      return '문서 재요청 또는 검수 진행 가능';
    case 'reorder_due':
      return '재주문 발주 또는 견적 요청 가능';
    case 'expiry_action_due':
      return '만료 조치 실행 가능';
    default:
      return '즉시 처리 가능';
  }
}

// ---------------------------------------------------------------------------
// 11. Internal: Handoff label
// ---------------------------------------------------------------------------

function resolveHandoffLabel(
  moduleType: InboxSourceModule,
  item: UnifiedInboxItem,
): string | undefined {
  switch (moduleType) {
    case 'quote':
      if (item.workType === 'quote_review_required') return 'PO 전환 가능';
      return undefined;
    case 'po':
      if (item.workType === 'po_ready_to_issue') return '입고 대기 전환';
      return undefined;
    case 'receiving':
      if (item.workType === 'posting_blocked' && !item.blockedReason) return '재고 반영 가능';
      return undefined;
    case 'stock_risk':
      return undefined;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// 12. Internal: Module-specific moduleType mapping
// ---------------------------------------------------------------------------

function resolveModuleType(
  module: InboxSourceModule,
): 'quote' | 'po' | 'receiving' | 'stock_risk' {
  return module;
}

// ---------------------------------------------------------------------------
// 13. buildModuleLandingItems
// ---------------------------------------------------------------------------

/**
 * UnifiedInboxItem을 모듈 필터로 걸러서 ModuleLandingItem으로 변환.
 */
export function buildModuleLandingItems(
  items: UnifiedInboxItem[],
  moduleFilter: InboxSourceModule,
): ModuleLandingItem[] {
  const filtered = items.filter((i) => i.sourceModule === moduleFilter);
  const sorted = sortInboxItems(filtered);

  return sorted.map((item): ModuleLandingItem => ({
    moduleType: resolveModuleType(moduleFilter),
    entityId: item.entityId,
    title: item.title,
    summary: item.summary,
    bucketKey: resolveBucketKey(item),
    priority: item.priority,
    currentOwnerName: item.owner,
    assignmentState: resolveAssignmentState(item),
    dueState: item.dueState,
    blockerSummary: item.blockedReason,
    reviewSummary: resolveReviewSummary(item),
    waitingExternalLabel: resolveWaitingExternalLabel(item),
    readySummary: resolveReadySummary(item),
    nextAction: item.nextAction,
    targetRoute: item.entityRoute,
    nextHandoffLabel: resolveHandoffLabel(moduleFilter, item),
    updatedAt: item.updatedAt,
  }));
}

// ---------------------------------------------------------------------------
// 14. buildModuleHeaderStats
// ---------------------------------------------------------------------------

/**
 * 모듈 스코프 헤더 통계 및 contextual nextActionSummary 생성.
 */
export function buildModuleHeaderStats(
  items: UnifiedInboxItem[],
  moduleFilter: InboxSourceModule,
): ModuleHeaderStats {
  const filtered = items.filter((i) => i.sourceModule === moduleFilter);

  const openActionable = filtered.length;
  const blocked = filtered.filter((i) => i.blockedReason != null).length;
  const overdue = filtered.filter((i) => i.dueState.isOverdue).length;
  const waitingExternal = filtered.filter(
    (i) => i.triageGroup === 'waiting_external',
  ).length;
  const readyToExecute = filtered.filter(
    (i) => i.triageGroup === 'now' && !i.blockedReason,
  ).length;
  const nextActionSummary = buildNextActionSummary(filtered, moduleFilter);

  return {
    openActionable,
    blocked,
    overdue,
    waitingExternal,
    readyToExecute,
    nextActionSummary,
  };
}

// ---------------------------------------------------------------------------
// 15. Module-specific nextActionSummary builders
// ---------------------------------------------------------------------------

function buildNextActionSummary(
  items: UnifiedInboxItem[],
  moduleFilter: InboxSourceModule,
): string {
  switch (moduleFilter) {
    case 'quote':
      return buildQuoteNextActionSummary(items);
    case 'po':
      return buildPONextActionSummary(items);
    case 'receiving':
      return buildReceivingNextActionSummary(items);
    case 'stock_risk':
      return buildStockRiskNextActionSummary(items);
    default:
      return `작업 ${items.length}건`;
  }
}

function buildQuoteNextActionSummary(items: UnifiedInboxItem[]): string {
  const responsePending = items.filter(
    (i) => i.workType === 'quote_response_pending',
  ).length;
  const reviewRequired = items.filter(
    (i) => i.workType === 'quote_review_required',
  ).length;
  // Handoff-ready: review done items in 'now' triage with no blocker
  const handoffReady = items.filter(
    (i) =>
      i.workType === 'quote_review_required' &&
      i.triageGroup === 'now' &&
      !i.blockedReason,
  ).length;

  if (responsePending > 0) return `공급사 응답 ${responsePending}건 검토`;
  if (reviewRequired > 0) return `비교 ${reviewRequired}건 선택 대기`;
  if (handoffReady > 0) return `PO 전환 ${handoffReady}건 가능`;
  return '처리 대기 항목 없음';
}

function buildPONextActionSummary(items: UnifiedInboxItem[]): string {
  const readyToIssue = items.filter(
    (i) => i.workType === 'po_ready_to_issue',
  ).length;
  const approvalPending = items.filter(
    (i) => i.workType === 'po_approval_pending',
  ).length;
  const ackPending = items.filter(
    (i) => i.workType === 'po_ack_pending',
  ).length;

  if (readyToIssue > 0) return `발행 가능 ${readyToIssue}건`;
  if (approvalPending > 0) return `승인 대기 ${approvalPending}건`;
  if (ackPending > 0) return `확인 대기 ${ackPending}건`;
  return '처리 대기 항목 없음';
}

function buildReceivingNextActionSummary(items: UnifiedInboxItem[]): string {
  const postable = items.filter(
    (i) =>
      i.workType === 'posting_blocked' &&
      i.triageGroup === 'now' &&
      !i.blockedReason,
  ).length;
  const inspectionPending = items.filter(
    (i) => i.workType === 'quarantine_constrained',
  ).length;
  const docIssue = items.filter(
    (i) => i.workType === 'receiving_issue',
  ).length;

  if (postable > 0) return `반영 가능 ${postable}건`;
  if (inspectionPending > 0) return `검수 대기 ${inspectionPending}건`;
  if (docIssue > 0) return `문서 확인 ${docIssue}건`;
  return '처리 대기 항목 없음';
}

function buildStockRiskNextActionSummary(items: UnifiedInboxItem[]): string {
  const reorderDue = items.filter(
    (i) => i.workType === 'reorder_due' && !i.blockedReason,
  ).length;
  const expiryDue = items.filter(
    (i) => i.workType === 'expiry_action_due',
  ).length;
  const blockedReorder = items.filter(
    (i) => i.workType === 'reorder_due' && i.blockedReason != null,
  ).length;

  if (reorderDue > 0) return `재주문 ${reorderDue}건 필요`;
  if (expiryDue > 0) return `만료 조치 ${expiryDue}건`;
  if (blockedReorder > 0) return `차단 ${blockedReorder}건 해소`;
  return '처리 대기 항목 없음';
}

// ---------------------------------------------------------------------------
// 16. buildModulePriorityQueue
// ---------------------------------------------------------------------------

/**
 * 운영 영향도 기준 모듈 내 상위 항목 추출.
 * dashboard-adapter의 buildTopPriorityQueue과 동일 스코어링을 모듈 범위로 적용.
 */
export function buildModulePriorityQueue(
  items: UnifiedInboxItem[],
  moduleFilter: InboxSourceModule,
  limit: number = 8,
): ModuleLandingItem[] {
  const filtered = items.filter((i) => i.sourceModule === moduleFilter);

  const scored = filtered.map((item) => {
    let score = 0;

    // Priority tier
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
    if (item.workType === 'po_ready_to_issue' && item.dueState.isOverdue)
      score += 250;

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
    if (a.item.dueState.isOverdue && !b.item.dueState.isOverdue) return -1;
    if (!a.item.dueState.isOverdue && b.item.dueState.isOverdue) return 1;
    return (
      new Date(b.item.updatedAt).getTime() -
      new Date(a.item.updatedAt).getTime()
    );
  });

  const topItems = scored.slice(0, limit).map((s) => s.item);
  return topItems.map((item): ModuleLandingItem => ({
    moduleType: resolveModuleType(moduleFilter),
    entityId: item.entityId,
    title: item.title,
    summary: item.summary,
    bucketKey: resolveBucketKey(item),
    priority: item.priority,
    currentOwnerName: item.owner,
    assignmentState: resolveAssignmentState(item),
    dueState: item.dueState,
    blockerSummary: item.blockedReason,
    reviewSummary: resolveReviewSummary(item),
    waitingExternalLabel: resolveWaitingExternalLabel(item),
    readySummary: resolveReadySummary(item),
    nextAction: item.nextAction,
    targetRoute: item.entityRoute,
    nextHandoffLabel: resolveHandoffLabel(moduleFilter, item),
    updatedAt: item.updatedAt,
  }));
}

// ---------------------------------------------------------------------------
// 17. buildModuleBuckets
// ---------------------------------------------------------------------------

/**
 * ModuleLandingItem 목록을 버킷별로 분류.
 */
export function buildModuleBuckets(
  items: ModuleLandingItem[],
): Record<ModuleBucketKey, ModuleLandingItem[]> {
  const buckets: Record<ModuleBucketKey, ModuleLandingItem[]> = {
    ready: [],
    blocked: [],
    needs_review: [],
    waiting_external: [],
    handoff: [],
  };

  for (const item of items) {
    buckets[item.bucketKey].push(item);
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// 18. buildModuleDownstream
// ---------------------------------------------------------------------------

/**
 * 모듈별 다운스트림 핸드오프 항목 생성.
 *
 * - quotes → "발주 생성 가능" (vendor selected quotes)
 * - po → "입고 대기" (issued/acknowledged POs)
 * - receiving → "재고 반영" (postable batches)
 * - stock_risk → "재진입 필요" (recovery entries)
 */
export function buildModuleDownstream(
  moduleFilter: InboxSourceModule,
  items: UnifiedInboxItem[],
): ModuleDownstream[] {
  const filtered = items.filter((i) => i.sourceModule === moduleFilter);

  switch (moduleFilter) {
    case 'quote':
      return buildQuoteDownstream(filtered);
    case 'po':
      return buildPODownstream(filtered);
    case 'receiving':
      return buildReceivingDownstream(filtered);
    case 'stock_risk':
      return buildStockRiskDownstream(filtered);
    default:
      return [];
  }
}

function buildQuoteDownstream(items: UnifiedInboxItem[]): ModuleDownstream[] {
  // Vendor selected quotes ready for PO conversion
  const poReadyCount = items.filter(
    (i) =>
      i.workType === 'quote_review_required' &&
      i.triageGroup === 'now' &&
      !i.blockedReason,
  ).length;

  if (poReadyCount === 0) return [];

  return [
    {
      label: '발주 생성 가능',
      count: poReadyCount,
      targetRoute: '/dashboard/purchase-orders',
      description: '공급사 선정 완료, PO 전환 대기 중인 견적',
    },
  ];
}

function buildPODownstream(items: UnifiedInboxItem[]): ModuleDownstream[] {
  // Issued or acknowledged POs waiting for receiving
  const receivingReadyCount = items.filter(
    (i) => i.workType === 'po_ack_pending',
  ).length;

  // Also include ready-to-issue as pre-downstream
  const issueReadyCount = items.filter(
    (i) => i.workType === 'po_ready_to_issue',
  ).length;

  const downstream: ModuleDownstream[] = [];

  if (receivingReadyCount > 0) {
    downstream.push({
      label: '입고 대기',
      count: receivingReadyCount,
      targetRoute: '/dashboard/receiving',
      description: '발행 완료, 공급사 확인 후 입고 연결 대기',
    });
  }

  if (issueReadyCount > 0) {
    downstream.push({
      label: '발행 대기',
      count: issueReadyCount,
      targetRoute: '/dashboard/purchase-orders',
      description: '승인 완료, 공급사 발행 실행 필요',
    });
  }

  return downstream;
}

function buildReceivingDownstream(
  items: UnifiedInboxItem[],
): ModuleDownstream[] {
  // Postable batches ready for inventory posting
  const postableCount = items.filter(
    (i) =>
      (i.workType === 'posting_blocked' || i.workType === 'receiving_issue') &&
      i.triageGroup === 'now' &&
      !i.blockedReason,
  ).length;

  if (postableCount === 0) return [];

  return [
    {
      label: '재고 반영',
      count: postableCount,
      targetRoute: '/dashboard/inventory',
      description: '검수 완료, 재고 반영 실행 가능한 입고 건',
    },
  ];
}

function buildStockRiskDownstream(
  items: UnifiedInboxItem[],
): ModuleDownstream[] {
  // Recovery entries — items that need re-entry to sourcing
  const recoveryCount = items.filter(
    (i) =>
      (i.workType === 'reorder_due' && i.blockedReason != null) ||
      (i.workType === 'quarantine_constrained'),
  ).length;

  if (recoveryCount === 0) return [];

  return [
    {
      label: '재진입 필요',
      count: recoveryCount,
      targetRoute: '/dashboard/stock-risk',
      description: '차단 해소 또는 대체 소싱 재진입이 필요한 재고 위험 항목',
    },
  ];
}

// ---------------------------------------------------------------------------
// 19. Module Landing Bucket Colors
// ---------------------------------------------------------------------------

export const BUCKET_COLORS: Record<ModuleBucketKey, string> = {
  ready: 'bg-emerald-500/10 text-emerald-400',
  blocked: 'bg-red-500/10 text-red-400',
  needs_review: 'bg-amber-500/10 text-amber-400',
  waiting_external: 'bg-blue-500/10 text-blue-400',
  handoff: 'bg-teal-500/10 text-teal-400',
};

// ---------------------------------------------------------------------------
// 20. Module Label Helpers
// ---------------------------------------------------------------------------

export const MODULE_TYPE_LABELS: Record<InboxSourceModule, string> = {
  quote: '견적',
  po: '발주',
  receiving: '입고',
  stock_risk: '재고 위험',
};

export const MODULE_HEADER_STAT_META: Record<
  keyof Omit<ModuleHeaderStats, 'nextActionSummary'>,
  { label: string }
> = {
  openActionable: { label: '전체 작업' },
  blocked: { label: '차단' },
  overdue: { label: '기한 초과' },
  waitingExternal: { label: '외부 대기' },
  readyToExecute: { label: '실행 가능' },
};

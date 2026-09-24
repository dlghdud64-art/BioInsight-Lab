/**
 * ops-console/inbox-adapter.ts
 *
 * Unified Inbox Orchestration Layer.
 * 견적, 발주, 입고, 재고 위험 엔티티를 통합 작업함 항목으로 변환하고
 * 우선순위/트리아지 그룹/정렬/필터 로직을 제공합니다.
 *
 * @module ops-console/inbox-adapter
 */

/* §po-seed-cutoff 2차 (2026-09-24 · 호영님 판정) — 시드 전용 빌더 제거.
 * buildInboxFromPOs · buildInboxFromReceiving · buildInboxFromStockRisk · buildFullInbox 는
 * ops-console 시드 그래프(seed-data + ops-store + scenario-transition-runner)에서만 입력을 받았고,
 * 그 셋이 이번에 삭제되며 호출자가 0 이 됐다(문서 문자열 3건만 남아 있었다).
 * 남기면 다음 사람이 "실데이터만 꽂으면 된다" 고 읽는다 — 구현 복원은 git 이력에서.
 * 살아 있는 것: buildInboxFromQuotes(실 endpoint real-quote-inbox 가 쓴다) · 정렬·필터·우선순위 파생. */
import { stockItemLabel } from './stock-item-label';
import type {
  QuoteRequestContract,
  QuoteResponseContract,
  QuoteComparisonContract,
} from '../review-queue/quote-rfq-contract';
// #post-approval-purchase-order-flow B+H step 1 — vendor name lookup
// (mock seed). 호영님 host DB swap 시 graph.vendors 로 변경.
// step 2 — vendor email 보조 map (button disabled 분기에 사용).

import type {
  PurchaseOrderContract,
  ApprovalExecutionContract,
  PurchaseOrderAcknowledgementContract,
} from '../review-queue/po-approval-contract';

import type { ReceivingBatchContract } from '../review-queue/receiving-inbound-contract';

import type {
  InventoryStockPositionContract,
  ReorderRecommendationContract,
  ExpiryActionContract,
} from '../review-queue/reorder-expiry-stock-risk-contract';

// ---------------------------------------------------------------------------
// 1. UnifiedInboxItem
// ---------------------------------------------------------------------------

export type InboxWorkType =
  | 'quote_response_pending'
  | 'quote_review_required'
  | 'po_approval_pending'
  | 'po_ready_to_issue'
  | 'po_ack_pending'
  | 'receiving_issue'
  | 'posting_blocked'
  | 'reorder_due'
  | 'expiry_action_due'
  | 'quarantine_constrained';

export type InboxPriority = 'p0' | 'p1' | 'p2' | 'p3';

export type InboxTriageGroup =
  | 'now'
  | 'needs_review'
  | 'blocked'
  | 'waiting_external'
  | 'due_soon';

export type InboxSourceModule = 'quote' | 'po' | 'receiving' | 'stock_risk';

export interface UnifiedInboxItem {
  id: string;
  workType: InboxWorkType;
  entityId: string;
  entityRoute: string;
  title: string;
  /** Korean - WHY this is a task NOW */
  summary: string;
  priority: InboxPriority;
  owner?: string;
  dueState: {
    label: string;
    isOverdue: boolean;
    tone: 'normal' | 'due_soon' | 'overdue';
    /** §brief-redesign — 마감까지 남은 일수(임박마감 계산용). 음수=초과, null=기한없음. resolveDueState 가 항상 채움; optional 로 타 생산처 안전. */
    daysUntil?: number | null;
  };
  blockedReason?: string;
  /** Korean - what to do next */
  nextAction: string;
  sourceModule: InboxSourceModule;
  riskBadges: string[];
  updatedAt: string;
  /** Computed for grouping */
  triageGroup: InboxTriageGroup;
  /**
   * #post-approval-purchase-order-flow B+H step 1 — vendor display.
   * PO inbox 의 row 표시 + 차후 PDF/email quick-action wiring 에 사용.
   * 다른 module type (quote / receiving / stock_risk) 은 undefined.
   */
  vendorId?: string;
  vendorName?: string;
  /**
   * step 2 — vendor email (button disabled 분기). VENDOR_CONTACT_MAP 또는
   * actual graph.vendors 에서 propagate. null = 미설정 → email button disabled.
   */
  vendorEmail?: string | null;
}

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

const NOW_MS = () => Date.now();

function hoursSince(iso: string): number {
  return Math.max(0, (NOW_MS() - new Date(iso).getTime()) / (1000 * 60 * 60));
}


export function resolveDueState(
  dueAt: string | undefined,
): UnifiedInboxItem['dueState'] {
  if (!dueAt) return { label: '기한 없음', isOverdue: false, tone: 'normal', daysUntil: null };
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return {
      label: `${Math.abs(Math.floor(diffDays))}일 초과`,
      isOverdue: true,
      tone: 'overdue',
      daysUntil: Math.ceil(diffDays),
    };
  }
  if (diffDays <= 3) {
    const remaining = Math.ceil(diffDays);
    return {
      label: remaining === 0 ? '오늘 마감' : `${remaining}일 남음`,
      isOverdue: false,
      tone: 'due_soon',
      daysUntil: remaining,
    };
  }
  return {
    label: `${Math.ceil(diffDays)}일 남음`,
    isOverdue: false,
    tone: 'normal',
    daysUntil: Math.ceil(diffDays),
  };
}

// ---------------------------------------------------------------------------
// 3. Priority calculation
// ---------------------------------------------------------------------------

export function calculateInboxPriority(item: UnifiedInboxItem): InboxPriority {
  const { workType, dueState, blockedReason, riskBadges } = item;

  // P0: receiving_issue + quarantine + doc missing
  if (
    workType === 'receiving_issue' &&
    (riskBadges.includes('보류') || riskBadges.includes('문서 누락'))
  ) {
    return 'p0';
  }
  // P0: quarantine_constrained
  if (workType === 'quarantine_constrained') return 'p0';
  // P0: PO approved + overdue + not issued
  if (workType === 'po_ready_to_issue' && dueState.isOverdue) return 'p0';
  // P0: critical shortage + blocked reorder
  if (
    workType === 'reorder_due' &&
    blockedReason &&
    riskBadges.some((b) => b.includes('긴급') || b.includes('부족'))
  ) {
    return 'p0';
  }
  // P0: expiry action overdue
  if (workType === 'expiry_action_due' && dueState.isOverdue) return 'p0';

  // P1: quote comparison ready + review required
  if (workType === 'quote_review_required') return 'p1';
  // P1: ack pending + no promised delivery
  if (workType === 'po_ack_pending') return 'p1';
  // P1: posting blocked + inventory demand
  if (workType === 'posting_blocked') return 'p1';
  // P1: po_ready_to_issue (non-overdue)
  if (workType === 'po_ready_to_issue') return 'p1';

  // P2: partially responded quote
  if (workType === 'quote_response_pending') return 'p2';
  // P2: due soon approval
  if (workType === 'po_approval_pending' && dueState.tone === 'due_soon')
    return 'p2';
  // P2: open reorder recommendation
  if (workType === 'reorder_due' && !blockedReason) return 'p2';
  // P2: expiry action not overdue
  if (workType === 'expiry_action_due' && !dueState.isOverdue) return 'p2';

  // P3: waiting external only; monitor-only expiry
  return 'p3';
}

// ---------------------------------------------------------------------------
// 4. Triage group calculation
// ---------------------------------------------------------------------------

export function calculateTriageGroup(
  item: UnifiedInboxItem,
): InboxTriageGroup {
  const { priority, workType, blockedReason, dueState } = item;

  // blocked: has blockedReason, posting_blocked, budget blocker
  // Check blocked BEFORE p0 so budget-blocked reorders go to 'blocked' group
  if (blockedReason && workType !== 'receiving_issue' && workType !== 'quarantine_constrained') return 'blocked';
  if (workType === 'posting_blocked') return 'blocked';

  // now: p0 items, ready_to_issue, ready_to_post
  if (priority === 'p0') return 'now';
  if (workType === 'po_ready_to_issue') return 'now';

  // needs_review: review_required, comparison ready, substitute exists
  if (workType === 'quote_review_required') return 'needs_review';

  // waiting_external: ack_pending, quote_response_pending (partial)
  if (workType === 'po_ack_pending') return 'waiting_external';
  if (workType === 'quote_response_pending') return 'waiting_external';

  // due_soon: dueState.tone === 'due_soon' and not in above groups
  if (dueState.tone === 'due_soon') return 'due_soon';

  // fallback: needs_review for review-like items, due_soon otherwise
  if (workType === 'expiry_action_due') return 'needs_review';
  if (workType === 'reorder_due') return 'needs_review';
  if (workType === 'po_approval_pending') return 'needs_review';

  return 'due_soon';
}

// ---------------------------------------------------------------------------
// 5. Builder functions
// ---------------------------------------------------------------------------

export function buildInboxFromQuotes(
  quotes: QuoteRequestContract[],
  responses: QuoteResponseContract[],
  comparisons: QuoteComparisonContract[],
): UnifiedInboxItem[] {
  const items: UnifiedInboxItem[] = [];

  for (const qr of quotes) {
    // Skip terminal states
    if (
      qr.status === 'converted_to_po' ||
      qr.status === 'cancelled' ||
      qr.status === 'expired' ||
      qr.status === 'vendor_selected'
    )
      continue;

    const qrResponses = responses.filter(
      (r) => r.quoteRequestId === qr.id,
    );
    const respondedCount = qrResponses.filter(
      (r) =>
        r.responseStatus === 'responded' ||
        r.responseStatus === 'incomplete',
    ).length;
    const comparison = comparisons.find((c) => c.quoteRequestId === qr.id);
    const dueState = resolveDueState(qr.dueAt);

    // Check if comparison ready and review required
    if (
      (qr.status === 'comparison_ready' || qr.status === 'responded') ||
      (comparison &&
        comparison.comparisonStatus !== 'converted' &&
        comparison.comparableItemRows.some((r) => r.requiresReview))
    ) {
      const hasSubstitute = qrResponses.some((r) =>
        r.responseItems.some((ri) => ri.substituteOffered),
      );
      const reviewReasons: string[] = [];
      if (comparison?.comparableItemRows.some((r) => r.requiresReview))
        reviewReasons.push('검토 필요 항목');
      if (hasSubstitute) reviewReasons.push('대체품 검토');
      if (comparison?.missingResponses && comparison.missingResponses.length > 0)
        reviewReasons.push(`미응답 ${comparison.missingResponses.length}곳`);

      if (reviewReasons.length > 0 && comparison) {
        const reviewItem: UnifiedInboxItem = {
          id: `inbox-qr-review-${qr.id}`,
          workType: 'quote_review_required',
          entityId: qr.id,
          entityRoute: `/dashboard/quotes/${qr.id}`,
          title: `${qr.requestNumber} 비교 검토 필요`,
          summary: `${respondedCount}/${qr.vendorIds.length} 응답 수신, ${reviewReasons.join(' / ')}`,
          priority: 'p1', // placeholder, recalculated
          owner: undefined,
          dueState,
          nextAction: '비교표 검토 후 공급사 선정',
          sourceModule: 'quote',
          riskBadges: reviewReasons,
          updatedAt: qr.createdAt,
          triageGroup: 'needs_review', // placeholder
        };
        reviewItem.priority = calculateInboxPriority(reviewItem);
        reviewItem.triageGroup = calculateTriageGroup(reviewItem);
        items.push(reviewItem);
      }
    }

    // Partially responded or sent — waiting for external
    if (qr.status === 'partially_responded' || qr.status === 'sent') {
      const pendingVendors = qr.vendorIds.length - respondedCount;
      const pendingItem: UnifiedInboxItem = {
        id: `inbox-qr-pending-${qr.id}`,
        workType: 'quote_response_pending',
        entityId: qr.id,
        entityRoute: `/dashboard/quotes/${qr.id}`,
        title: `${qr.requestNumber} 공급사 응답 대기`,
        summary: `${respondedCount}/${qr.vendorIds.length} 응답, ${pendingVendors}곳 미응답`,
        priority: 'p2', // placeholder
        owner: undefined,
        dueState,
        nextAction: pendingVendors > 0 ? '미응답 공급사 독촉 또는 마감 결정' : '비교 검토 진행',
        sourceModule: 'quote',
        riskBadges: dueState.tone === 'due_soon' ? ['마감 임박'] : [],
        updatedAt: qr.createdAt,
        triageGroup: 'waiting_external', // placeholder
      };
      pendingItem.priority = calculateInboxPriority(pendingItem);
      pendingItem.triageGroup = calculateTriageGroup(pendingItem);
      items.push(pendingItem);
    }
  }

  return items;
}

/** 정렬 우선순위 — 잘라낸 시드 빌더 블록에 섞여 있던 상수. 정렬은 살아 있는 경로다(실 endbox 정렬). */
const PRIORITY_ORDER: Record<InboxPriority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
};
export function sortInboxItems(items: UnifiedInboxItem[]): UnifiedInboxItem[] {
  return [...items].sort((a, b) => {
    // Priority first (p0 first)
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;

    // Overdue first
    if (a.dueState.isOverdue && !b.dueState.isOverdue) return -1;
    if (!a.dueState.isOverdue && b.dueState.isOverdue) return 1;

    // updatedAt descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

// ---------------------------------------------------------------------------
// 8. Filter helpers
// ---------------------------------------------------------------------------

export function filterByModule(
  items: UnifiedInboxItem[],
  module: string | null,
): UnifiedInboxItem[] {
  if (!module || module === 'all') return items;
  return items.filter((i) => i.sourceModule === module);
}

export function filterByState(
  items: UnifiedInboxItem[],
  state: string | null,
): UnifiedInboxItem[] {
  if (!state || state === 'all') return items;
  return items.filter((i) => i.triageGroup === state);
}

export function filterByOwner(
  items: UnifiedInboxItem[],
  owner: string | null,
): UnifiedInboxItem[] {
  if (!owner) return items;
  return items.filter((i) => i.owner === owner);
}

export function filterByDue(
  items: UnifiedInboxItem[],
  due: string | null,
): UnifiedInboxItem[] {
  if (!due || due === 'all') return items;
  if (due === 'overdue') return items.filter((i) => i.dueState.isOverdue);
  if (due === 'due_soon')
    return items.filter((i) => i.dueState.tone === 'due_soon');
  return items;
}

// ---------------------------------------------------------------------------
// 9. Summary stats
// ---------------------------------------------------------------------------

export interface InboxSummaryStats {
  totalOpen: number;
  blockerCount: number;
  overdueCount: number;
  reviewRequiredCount: number;
  readyToExecuteCount: number;
}

export function calculateSummaryStats(
  items: UnifiedInboxItem[],
): InboxSummaryStats {
  return {
    totalOpen: items.length,
    blockerCount: items.filter((i) => i.blockedReason != null).length,
    overdueCount: items.filter((i) => i.dueState.isOverdue).length,
    reviewRequiredCount: items.filter(
      (i) => i.triageGroup === 'needs_review',
    ).length,
    readyToExecuteCount: items.filter((i) => i.triageGroup === 'now').length,
  };
}

// ---------------------------------------------------------------------------
// 10. Triage group metadata
// ---------------------------------------------------------------------------

export const TRIAGE_GROUP_META: Record<
  InboxTriageGroup,
  { label: string; order: number }
> = {
  now: { label: '지금 처리', order: 0 },
  needs_review: { label: '검토 필요', order: 1 },
  blocked: { label: '차단됨', order: 2 },
  waiting_external: { label: '외부 대기', order: 3 },
  due_soon: { label: '기한 임박', order: 4 },
};

export const MODULE_FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'quote', label: '견적' },
  { key: 'po', label: '발주' },
  { key: 'receiving', label: '입고' },
  { key: 'stock_risk', label: '재고위험' },
] as const;

export const STATE_FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'now', label: '실행가능' },
  { key: 'blocked', label: '차단' },
  { key: 'waiting_external', label: '대기' },
  { key: 'needs_review', label: '검토필요' },
] as const;

export const WORK_TYPE_LABELS: Record<InboxWorkType, string> = {
  quote_response_pending: '견적 대기',
  quote_review_required: '견적 검토',
  po_approval_pending: '승인 대기',
  po_ready_to_issue: '발행 준비',
  po_ack_pending: '확인 대기',
  receiving_issue: '입고 이슈',
  posting_blocked: '반영 차단',
  reorder_due: '재주문',
  expiry_action_due: '만료 조치',
  quarantine_constrained: '보류',
};

export const SOURCE_MODULE_COLORS: Record<InboxSourceModule, string> = {
  quote: 'bg-blue-500/10 text-blue-400',
  po: 'bg-teal-500/10 text-teal-400',
  receiving: 'bg-yellow-500/10 text-yellow-400',
  stock_risk: 'bg-purple-500/10 text-purple-400',
};

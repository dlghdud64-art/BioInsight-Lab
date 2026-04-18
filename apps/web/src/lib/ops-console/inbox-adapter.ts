/**
 * ops-console/inbox-adapter.ts
 *
 * Unified Inbox Orchestration Layer.
 * 견적, 발주, 입고, 재고 위험 엔티티를 통합 작업함 항목으로 변환하고
 * 우선순위/트리아지 그룹/정렬/필터 로직을 제공합니다.
 *
 * @module ops-console/inbox-adapter
 */

import type {
  QuoteRequestContract,
  QuoteResponseContract,
  QuoteComparisonContract,
} from '../review-queue/quote-rfq-contract';

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
  };
  blockedReason?: string;
  /** Korean - what to do next */
  nextAction: string;
  sourceModule: InboxSourceModule;
  riskBadges: string[];
  updatedAt: string;
  /** Computed for grouping */
  triageGroup: InboxTriageGroup;
}

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

const NOW_MS = () => Date.now();

function hoursSince(iso: string): number {
  return Math.max(0, (NOW_MS() - new Date(iso).getTime()) / (1000 * 60 * 60));
}

function resolveDueState(
  dueAt: string | undefined,
): UnifiedInboxItem['dueState'] {
  if (!dueAt) return { label: '기한 없음', isOverdue: false, tone: 'normal' };
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return {
      label: `${Math.abs(Math.floor(diffDays))}일 초과`,
      isOverdue: true,
      tone: 'overdue',
    };
  }
  if (diffDays <= 3) {
    const remaining = Math.ceil(diffDays);
    return {
      label: remaining === 0 ? '오늘 마감' : `${remaining}일 남음`,
      isOverdue: false,
      tone: 'due_soon',
    };
  }
  return {
    label: `${Math.ceil(diffDays)}일 남음`,
    isOverdue: false,
    tone: 'normal',
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
    (riskBadges.includes('격리') || riskBadges.includes('문서 누락'))
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

export function buildInboxFromPOs(
  pos: PurchaseOrderContract[],
  approvals: ApprovalExecutionContract[],
  acks: PurchaseOrderAcknowledgementContract[],
): UnifiedInboxItem[] {
  const items: UnifiedInboxItem[] = [];

  for (const po of pos) {
    // PO approved or ready_to_issue → need to issue
    if (po.status === 'approved' || po.status === 'ready_to_issue') {
      const elapsed = hoursSince(po.createdAt);
      const dueState = resolveDueState(po.requiredByAt);
      const issueItem: UnifiedInboxItem = {
        id: `inbox-po-issue-${po.id}`,
        workType: 'po_ready_to_issue',
        entityId: po.id,
        entityRoute: `/dashboard/purchase-orders/${po.id}`,
        title: `${po.poNumber} 발행 대기`,
        summary: `승인 완료 ${Math.round(elapsed)}시간 경과, 공급사 발행 필요`,
        priority: 'p1', // placeholder
        owner: po.ownerId,
        dueState,
        nextAction: '발주서 발행 실행',
        sourceModule: 'po',
        riskBadges: dueState.isOverdue ? ['발행 지연'] : [],
        updatedAt: po.createdAt,
        triageGroup: 'now', // placeholder
      };
      issueItem.priority = calculateInboxPriority(issueItem);
      issueItem.triageGroup = calculateTriageGroup(issueItem);
      items.push(issueItem);
    }

    // PO issued, ack pending
    if (po.status === 'issued') {
      const ack = acks.find((a) => a.poId === po.id);
      if (!ack || ack.status === 'sent' || ack.status === 'not_sent') {
        const elapsed = hoursSince(po.issuedAt ?? po.createdAt);
        const dueState = resolveDueState(po.requiredByAt);
        const hasPromisedDelivery = ack?.promisedDeliveryAt != null;
        const ackItem: UnifiedInboxItem = {
          id: `inbox-po-ack-${po.id}`,
          workType: 'po_ack_pending',
          entityId: po.id,
          entityRoute: `/dashboard/purchase-orders/${po.id}`,
          title: `${po.poNumber} 공급사 확인 대기`,
          summary: `발행 ${Math.round(elapsed)}시간 경과, 공급사 확인 미응답`,
          priority: 'p1', // placeholder
          owner: po.ownerId,
          dueState,
          nextAction: hasPromisedDelivery
            ? '납기 일정 확인'
            : '공급사 확인 독촉',
          sourceModule: 'po',
          riskBadges: !hasPromisedDelivery ? ['납기 미확정'] : [],
          updatedAt: po.issuedAt ?? po.createdAt,
          triageGroup: 'waiting_external', // placeholder
        };
        ackItem.priority = calculateInboxPriority(ackItem);
        ackItem.triageGroup = calculateTriageGroup(ackItem);
        items.push(ackItem);
      }
    }

    // PO pending_approval or approval_in_progress
    if (
      po.status === 'pending_approval' ||
      po.status === 'approval_in_progress'
    ) {
      const approval = approvals.find(
        (a) => a.entityId === po.id && a.entityType === 'purchase_order',
      );
      const dueState = resolveDueState(po.requiredByAt);
      const currentStep = approval?.steps.find((s) => s.status === 'active');
      const approvalItem: UnifiedInboxItem = {
        id: `inbox-po-approval-${po.id}`,
        workType: 'po_approval_pending',
        entityId: po.id,
        entityRoute: `/dashboard/purchase-orders/${po.id}`,
        title: `${po.poNumber} 승인 대기`,
        summary: currentStep
          ? `${currentStep.stepType} 단계 검토 중`
          : '승인 대기 중',
        priority: 'p2', // placeholder
        owner: po.ownerId,
        dueState,
        nextAction: '승인 진행 확인',
        sourceModule: 'po',
        riskBadges: dueState.isOverdue ? ['승인 지연'] : [],
        updatedAt: po.createdAt,
        triageGroup: 'needs_review', // placeholder
      };
      approvalItem.priority = calculateInboxPriority(approvalItem);
      approvalItem.triageGroup = calculateTriageGroup(approvalItem);
      items.push(approvalItem);
    }
  }

  return items;
}

export function buildInboxFromReceiving(
  batches: ReceivingBatchContract[],
): UnifiedInboxItem[] {
  const items: UnifiedInboxItem[] = [];

  for (const rb of batches) {
    // Skip terminal states
    if (rb.status === 'posted' || rb.status === 'closed' || rb.status === 'cancelled') continue;

    const hasDocMissing = rb.lineReceipts.some(
      (l) => l.documentStatus === 'partial' || l.documentStatus === 'missing',
    );
    const hasQuarantine = rb.lineReceipts.some((l) =>
      l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
    );
    const hasInspectionPending = rb.lineReceipts.some(
      (l) =>
        l.inspectionRequired &&
        (l.inspectionStatus === 'pending' ||
          l.inspectionStatus === 'in_progress'),
    );
    const hasTempExcursion = rb.lineReceipts.some(
      (l) => l.conditionStatus === 'temperature_excursion',
    );

    // Quarantine issue
    if (hasQuarantine) {
      const quarantineLines = rb.lineReceipts.filter((l) =>
        l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
      );
      const riskBadges: string[] = ['격리'];
      if (hasTempExcursion) riskBadges.push('온도 이탈');

      const quarItem: UnifiedInboxItem = {
        id: `inbox-rb-quar-${rb.id}`,
        workType: 'quarantine_constrained',
        entityId: rb.id,
        entityRoute: `/dashboard/receiving/${rb.id}`,
        title: `${rb.receivingNumber} 격리 품목`,
        summary: `${quarantineLines.length}개 라인 격리 보관 중, 검사 완료 필요`,
        priority: 'p0', // placeholder
        owner: rb.receivedBy,
        dueState: { label: '즉시 처리', isOverdue: true, tone: 'overdue' },
        nextAction: '격리 검사 실행 후 판정',
        sourceModule: 'receiving',
        riskBadges,
        updatedAt: rb.receivedAt,
        triageGroup: 'now', // placeholder
      };
      quarItem.priority = calculateInboxPriority(quarItem);
      quarItem.triageGroup = calculateTriageGroup(quarItem);
      items.push(quarItem);
    }

    // Doc missing issue
    if (hasDocMissing) {
      const missingLines = rb.lineReceipts.filter(
        (l) =>
          l.documentStatus === 'partial' || l.documentStatus === 'missing',
      );
      const riskBadges: string[] = ['문서 누락'];

      const docItem: UnifiedInboxItem = {
        id: `inbox-rb-doc-${rb.id}`,
        workType: 'receiving_issue',
        entityId: rb.id,
        entityRoute: `/dashboard/receiving/${rb.id}`,
        title: `${rb.receivingNumber} 문서 누락`,
        summary: `${missingLines.length}개 라인 필수 문서 미첨부, 검수 차단`,
        priority: 'p0', // placeholder
        owner: rb.receivedBy,
        dueState: {
          label: hoursSince(rb.receivedAt) > 24 ? '24시간 초과' : '24시간 이내',
          isOverdue: hoursSince(rb.receivedAt) > 24,
          tone: hoursSince(rb.receivedAt) > 24 ? 'overdue' : 'due_soon',
        },
        blockedReason: '필수 문서 없이 검수 진행 불가',
        nextAction: '공급사에 문서 재요청',
        sourceModule: 'receiving',
        riskBadges,
        updatedAt: rb.receivedAt,
        triageGroup: 'now', // placeholder
      };
      docItem.priority = calculateInboxPriority(docItem);
      docItem.triageGroup = calculateTriageGroup(docItem);
      items.push(docItem);
    }

    // Posting blocked
    if (
      (hasDocMissing || hasQuarantine || hasInspectionPending) &&
      (rb.status as any) !== 'posted'
    ) {
      const blockers: string[] = [];
      if (hasDocMissing) blockers.push('문서 누락');
      if (hasQuarantine) blockers.push('격리 미해결');
      if (hasInspectionPending) blockers.push('검수 미완료');

      const postItem: UnifiedInboxItem = {
        id: `inbox-rb-post-${rb.id}`,
        workType: 'posting_blocked',
        entityId: rb.id,
        entityRoute: `/dashboard/receiving/${rb.id}`,
        title: `${rb.receivingNumber} 재고 반영 차단`,
        summary: `${blockers.join(' + ')}으로 전체 반영 불가`,
        priority: 'p1', // placeholder
        owner: rb.receivedBy,
        dueState: {
          label: hoursSince(rb.receivedAt) > 8 ? 'SLA 초과' : '8시간 이내',
          isOverdue: hoursSince(rb.receivedAt) > 8,
          tone: hoursSince(rb.receivedAt) > 8 ? 'overdue' : 'due_soon',
        },
        blockedReason: blockers.join(' + '),
        nextAction: '차단 요인 해소 후 재고 반영',
        sourceModule: 'receiving',
        riskBadges: blockers,
        updatedAt: rb.receivedAt,
        triageGroup: 'blocked', // placeholder
      };
      postItem.priority = calculateInboxPriority(postItem);
      postItem.triageGroup = calculateTriageGroup(postItem);
      items.push(postItem);
    }
  }

  return items;
}

export function buildInboxFromStockRisk(
  positions: InventoryStockPositionContract[],
  recommendations: ReorderRecommendationContract[],
  expiryActions: ExpiryActionContract[],
): UnifiedInboxItem[] {
  const items: UnifiedInboxItem[] = [];

  // Reorder recommendations
  for (const rr of recommendations) {
    // Skip terminal states
    if (
      rr.status === 'converted_to_quote' ||
      rr.status === 'converted_to_po' ||
      rr.status === 'dismissed'
    )
      continue;

    const sp = positions.find((p) => p.id === rr.supportingStockPositionId);
    const isCritical =
      sp?.riskStatus === 'critical_shortage' || rr.urgency === 'urgent';
    const isBlocked = rr.status === 'blocked';
    const riskBadges: string[] = [];
    if (isCritical) riskBadges.push('긴급 부족');
    if (isBlocked) riskBadges.push('차단');
    if (rr.budgetImpactEstimate?.budgetRemainingPercent !== undefined &&
        rr.budgetImpactEstimate.budgetRemainingPercent < 15)
      riskBadges.push('예산 위험');

    const reorderItem: UnifiedInboxItem = {
      id: `inbox-rr-${rr.id}`,
      workType: 'reorder_due',
      entityId: rr.id,
      entityRoute: `/dashboard/stock-risk`,
      title: `${rr.inventoryItemId} 재주문 ${isBlocked ? '차단' : '필요'}`,
      summary: isBlocked
        ? rr.blockedReasons.join(' / ')
        : `가용 ${rr.currentAvailableQuantity}${rr.recommendedUnit}, ${rr.recommendedOrderQuantity}${rr.recommendedUnit} 발주 권장`,
      priority: 'p2', // placeholder
      owner: undefined,
      dueState: isCritical
        ? { label: '즉시 처리', isOverdue: true, tone: 'overdue' }
        : { label: '검토 필요', isOverdue: false, tone: 'due_soon' },
      blockedReason: isBlocked ? rr.blockedReasons.join(' + ') : undefined,
      nextAction: isBlocked
        ? '차단 사유 해소 후 재주문'
        : '견적 요청 또는 직접 발주',
      sourceModule: 'stock_risk',
      riskBadges,
      updatedAt: rr.generatedAt,
      triageGroup: 'needs_review', // placeholder
    };
    reorderItem.priority = calculateInboxPriority(reorderItem);
    reorderItem.triageGroup = calculateTriageGroup(reorderItem);
    items.push(reorderItem);
  }

  // Expiry actions
  for (const ea of expiryActions) {
    if (ea.status === 'completed' || ea.status === 'dismissed') continue;

    const dueState = resolveDueState(ea.dueAt);
    const isMonitorOnly = ea.actionType === 'monitor';
    const riskBadges: string[] = [];
    if (ea.daysToExpiry !== undefined && ea.daysToExpiry <= 30)
      riskBadges.push('만료 임박');
    if (ea.status === 'overdue' || dueState.isOverdue)
      riskBadges.push('기한 초과');

    const expiryItem: UnifiedInboxItem = {
      id: `inbox-ea-${ea.id}`,
      workType: 'expiry_action_due',
      entityId: ea.id,
      entityRoute: `/dashboard/stock-risk`,
      title: `${ea.inventoryItemId} 유효기간 조치 필요`,
      summary: ea.daysToExpiry !== undefined
        ? `만료까지 ${ea.daysToExpiry}일, ${ea.affectedQuantity}${ea.unit} 영향`
        : `${ea.affectedQuantity}${ea.unit} 조치 필요`,
      priority: isMonitorOnly ? 'p3' : 'p2', // placeholder
      owner: ea.ownerId,
      dueState,
      nextAction: ea.actionType === 'replace_order'
        ? '교체 발주 실행'
        : ea.actionType === 'consume_first'
          ? '우선 사용 지정'
          : ea.actionType === 'dispose'
            ? '폐기 절차 진행'
            : '상태 확인 후 조치 결정',
      sourceModule: 'stock_risk',
      riskBadges,
      updatedAt: ea.triggeredAt,
      triageGroup: 'needs_review', // placeholder
    };
    expiryItem.priority = calculateInboxPriority(expiryItem);
    expiryItem.triageGroup = calculateTriageGroup(expiryItem);
    items.push(expiryItem);
  }

  // Quarantine constrained stock positions (not already captured by receiving)
  for (const sp of positions) {
    if (sp.riskStatus === 'quarantine_constrained') {
      const riskBadges = [...sp.riskFlags];
      const qcItem: UnifiedInboxItem = {
        id: `inbox-sp-qc-${sp.id}`,
        workType: 'quarantine_constrained',
        entityId: sp.id,
        entityRoute: `/dashboard/stock-risk`,
        title: `${sp.inventoryItemId} 격리 제약`,
        summary: `격리 ${sp.quarantinedQuantity}${sp.unit}, 가용 ${sp.availableQuantity}${sp.unit}`,
        priority: 'p0',
        owner: undefined,
        dueState: { label: '즉시 처리', isOverdue: true, tone: 'overdue' },
        nextAction: '격리 해제 검사 또는 폐기 결정',
        sourceModule: 'stock_risk',
        riskBadges,
        updatedAt: sp.snapshotAt,
        triageGroup: 'now',
      };
      items.push(qcItem);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// 6. Full inbox builder
// ---------------------------------------------------------------------------

export function buildFullInbox(
  quoteRequests: QuoteRequestContract[],
  quoteResponses: QuoteResponseContract[],
  quoteComparisons: QuoteComparisonContract[],
  purchaseOrders: PurchaseOrderContract[],
  approvalExecutions: ApprovalExecutionContract[],
  acknowledgements: PurchaseOrderAcknowledgementContract[],
  receivingBatches: ReceivingBatchContract[],
  stockPositions: InventoryStockPositionContract[],
  reorderRecommendations: ReorderRecommendationContract[],
  expiryActions: ExpiryActionContract[],
): UnifiedInboxItem[] {
  const all = [
    ...buildInboxFromQuotes(quoteRequests, quoteResponses, quoteComparisons),
    ...buildInboxFromPOs(purchaseOrders, approvalExecutions, acknowledgements),
    ...buildInboxFromReceiving(receivingBatches),
    ...buildInboxFromStockRisk(
      stockPositions,
      reorderRecommendations,
      expiryActions,
    ),
  ];

  return sortInboxItems(all);
}

// ---------------------------------------------------------------------------
// 7. Sort
// ---------------------------------------------------------------------------

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
  quarantine_constrained: '격리',
};

export const SOURCE_MODULE_COLORS: Record<InboxSourceModule, string> = {
  quote: 'bg-blue-500/10 text-blue-400',
  po: 'bg-teal-500/10 text-teal-400',
  receiving: 'bg-orange-500/10 text-orange-400',
  stock_risk: 'bg-purple-500/10 text-purple-400',
};

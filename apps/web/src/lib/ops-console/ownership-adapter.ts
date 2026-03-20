/**
 * ops-console/ownership-adapter.ts
 *
 * 공통 ownership summary model 및 도메인별 owner 해석 어댑터.
 * contract 레이어를 오염시키지 않고 UI adapter 레이어에서
 * current owner / next owner / waiting external / reviewer / escalation을
 * 일관되게 계산합니다.
 *
 * @module ops-console/ownership-adapter
 */

import type { QuoteRequestContract, QuoteResponseContract } from '../review-queue/quote-rfq-contract';
import type {
  PurchaseOrderContract,
  ApprovalExecutionContract,
  PurchaseOrderAcknowledgementContract,
} from '../review-queue/po-approval-contract';
import type { ReceivingBatchContract } from '../review-queue/receiving-inbound-contract';
import type {
  InventoryStockPositionContract,
  ReorderRecommendationContract,
} from '../review-queue/reorder-expiry-stock-risk-contract';

// ---------------------------------------------------------------------------
// 1. Assignment State Taxonomy
// ---------------------------------------------------------------------------

export type AssignmentState =
  | 'owned_by_me'
  | 'owned_by_team'
  | 'unassigned'
  | 'awaiting_internal_review'
  | 'awaiting_approval'
  | 'waiting_external'
  | 'handoff_pending'
  | 'escalated'
  | 'blocked_by_role'
  | 'resolved';

// ---------------------------------------------------------------------------
// 2. SLA State
// ---------------------------------------------------------------------------

export type SlaState =
  | 'on_track'
  | 'due_soon'
  | 'overdue_internal'
  | 'overdue_external'
  | 'escalation_required';

// ---------------------------------------------------------------------------
// 3. Common Ownership Summary Model
// ---------------------------------------------------------------------------

/**
 * 공통 ownership summary — inbox / detail / action surface에서 재사용.
 * 같은 엔티티가 어디에서든 동일한 owner 해석을 가짐.
 */
export interface OwnershipSummary {
  /** 현재 처리 책임자 */
  currentOwnerName?: string;
  /** 현재 owner의 역할 */
  currentOwnerRole?: string;
  /** assignment state */
  assignmentState: AssignmentState;
  /** 검토자 이름 목록 */
  reviewerNames?: string[];
  /** 승인자 이름 목록 */
  approverNames?: string[];
  /** 외부 대기 대상 라벨 */
  waitingExternalLabel?: string;
  /** 다음 담당자 */
  nextOwnerName?: string;
  /** 다음 담당자 역할 */
  nextOwnerRole?: string;
  /** 에스컬레이션 대상자 */
  escalationOwnerName?: string;
  /** SLA 상태 */
  slaState: SlaState;
  /** owner 관련 blocked reason */
  ownerBlockedReason?: string;
}

// ---------------------------------------------------------------------------
// 4. SLA 계산 helper
// ---------------------------------------------------------------------------

function computeSlaState(
  dueAt: string | undefined,
  isWaitingExternal: boolean,
  isBlocked: boolean,
): SlaState {
  if (!dueAt) return 'on_track';
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diffHours = (due - now) / (1000 * 60 * 60);

  if (diffHours < 0) {
    if (isBlocked) return 'escalation_required';
    return isWaitingExternal ? 'overdue_external' : 'overdue_internal';
  }
  if (diffHours <= 24) return 'due_soon';
  return 'on_track';
}

// ---------------------------------------------------------------------------
// 5. Quote Ownership
// ---------------------------------------------------------------------------

export function buildQuoteOwnership(
  qr: QuoteRequestContract,
  responses: QuoteResponseContract[],
): OwnershipSummary {
  const isVendorSelected = qr.status === 'vendor_selected' || qr.status === 'converted_to_po';
  const isConverted = qr.status === 'converted_to_po';
  const respondedCount = responses.filter(
    (r) => r.responseStatus === 'responded' || r.responseStatus === 'incomplete',
  ).length;
  const totalVendors = qr.vendorIds.length;
  const isWaitingExternal = respondedCount < totalVendors && !isVendorSelected;
  const hasSubstitute = responses.some((r) => r.responseItems.some((ri) => ri.substituteOffered));

  let assignmentState: AssignmentState;
  if (isConverted) {
    assignmentState = 'resolved';
  } else if (isWaitingExternal && respondedCount === 0) {
    assignmentState = 'waiting_external';
  } else if (isVendorSelected) {
    assignmentState = 'handoff_pending';
  } else if (hasSubstitute || respondedCount > 0) {
    assignmentState = 'awaiting_internal_review';
  } else {
    assignmentState = 'owned_by_me';
  }

  return {
    currentOwnerName: qr.requesterTeam ?? undefined,
    currentOwnerRole: '구매 담당자',
    assignmentState,
    reviewerNames: hasSubstitute ? ['스펙 검토자'] : undefined,
    waitingExternalLabel: isWaitingExternal
      ? `미응답 공급사 ${totalVendors - respondedCount}곳`
      : undefined,
    nextOwnerName: isVendorSelected ? 'PO 발행 담당자' : undefined,
    nextOwnerRole: isVendorSelected ? '구매 실행' : undefined,
    escalationOwnerName: 'procurement_manager',
    slaState: computeSlaState(qr.dueAt, isWaitingExternal, false),
  };
}

// ---------------------------------------------------------------------------
// 6. PO Ownership
// ---------------------------------------------------------------------------

export function buildPOOwnership(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): OwnershipSummary {
  const isApproved = po.status === 'approved' || po.status === 'ready_to_issue';
  const isIssued = po.status === 'issued' || po.status === 'acknowledged';
  const isAcknowledged = po.status === 'acknowledged';
  const ackPending =
    po.status === 'issued' && (!ack || ack.status === 'sent' || ack.status === 'not_sent');

  // Approval step owners
  const activeStep = approval?.steps.find((s) => s.status === 'active');
  const approverNames = activeStep?.assigneeIds ?? [];

  let assignmentState: AssignmentState;
  let waitingExternalLabel: string | undefined;
  let nextOwnerName: string | undefined;
  let nextOwnerRole: string | undefined;

  if (isAcknowledged) {
    assignmentState = 'handoff_pending';
    nextOwnerName = '입고 담당자';
    nextOwnerRole = '입고/검수';
  } else if (ackPending) {
    assignmentState = 'waiting_external';
    waitingExternalLabel = '공급사 발주 확인 대기';
    nextOwnerName = '공급사 확인 후 입고 담당자';
    nextOwnerRole = '입고/검수';
  } else if (isApproved) {
    assignmentState = 'owned_by_me';
    nextOwnerName = '공급사';
    nextOwnerRole = '발주 확인';
  } else if (approval && approval.status !== 'approved') {
    assignmentState = 'awaiting_approval';
    nextOwnerName = '발행 담당자';
    nextOwnerRole = '구매 실행';
  } else {
    assignmentState = 'owned_by_team';
  }

  return {
    currentOwnerName: po.ownerId ?? undefined,
    currentOwnerRole: '구매 실행 담당자',
    assignmentState,
    approverNames: approverNames.length > 0 ? approverNames : undefined,
    waitingExternalLabel,
    nextOwnerName,
    nextOwnerRole,
    escalationOwnerName: 'procurement_manager',
    slaState: computeSlaState(po.requiredByAt, ackPending, !isApproved && !isIssued),
  };
}

// ---------------------------------------------------------------------------
// 7. Receiving Ownership
// ---------------------------------------------------------------------------

export function buildReceivingOwnership(
  rb: ReceivingBatchContract,
): OwnershipSummary {
  const hasDocMissing = rb.lineReceipts.some(
    (l) => l.documentStatus === 'partial' || l.documentStatus === 'missing',
  );
  const hasQuarantine = rb.lineReceipts.some((l) =>
    l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
  );
  const hasInspectionPending = rb.lineReceipts.some(
    (l) => l.inspectionRequired && (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
  );
  const isPosted = rb.status === 'posted' || rb.status === 'closed';
  const canPost = !hasDocMissing && !hasQuarantine && !hasInspectionPending && !isPosted;

  let assignmentState: AssignmentState;
  let waitingExternalLabel: string | undefined;
  let ownerBlockedReason: string | undefined;

  if (isPosted) {
    assignmentState = 'resolved';
  } else if (hasDocMissing) {
    assignmentState = 'waiting_external';
    waitingExternalLabel = '공급사 문서 재요청 대기';
    ownerBlockedReason = '필수 문서 미첨부 — 공급사 제공 필요';
  } else if (hasQuarantine) {
    assignmentState = 'awaiting_internal_review';
    ownerBlockedReason = '격리 품목 검사 판정 필요';
  } else if (hasInspectionPending) {
    assignmentState = 'awaiting_internal_review';
  } else if (canPost) {
    assignmentState = 'owned_by_me';
  } else {
    assignmentState = 'blocked_by_role';
  }

  return {
    currentOwnerName: rb.receivedBy ?? undefined,
    currentOwnerRole: '입고 검수 담당자',
    assignmentState,
    reviewerNames: hasQuarantine ? ['품질/준법 검토자'] : undefined,
    waitingExternalLabel,
    nextOwnerName: canPost || isPosted ? '재고 관리자' : undefined,
    nextOwnerRole: canPost || isPosted ? '재고 위험 관리' : undefined,
    escalationOwnerName: 'lab_ops_lead',
    slaState: computeSlaState(undefined, hasDocMissing, hasQuarantine || hasInspectionPending),
    ownerBlockedReason,
  };
}

// ---------------------------------------------------------------------------
// 8. Stock Risk Ownership
// ---------------------------------------------------------------------------

export function buildStockRiskOwnership(
  stockPositions: InventoryStockPositionContract[],
  reorderRecommendations: ReorderRecommendationContract[],
): OwnershipSummary {
  const hasCritical = stockPositions.some((s) => s.riskStatus === 'critical_shortage');
  const hasBlocked = reorderRecommendations.some((r) => r.status === 'blocked');
  const hasOpenReorder = reorderRecommendations.some(
    (r) => r.status === 'open' || r.status === 'under_review',
  );

  let assignmentState: AssignmentState;
  let ownerBlockedReason: string | undefined;

  if (hasBlocked) {
    assignmentState = 'blocked_by_role';
    const blockedReasons = reorderRecommendations
      .filter((r) => r.status === 'blocked')
      .flatMap((r) => r.blockedReasons);
    ownerBlockedReason = blockedReasons[0];
  } else if (hasCritical) {
    assignmentState = 'owned_by_me';
  } else if (hasOpenReorder) {
    assignmentState = 'owned_by_team';
  } else {
    assignmentState = 'resolved';
  }

  return {
    currentOwnerRole: '재고 관리 / 구매 담당자',
    assignmentState,
    nextOwnerName: hasOpenReorder ? '견적 요청 담당자' : undefined,
    nextOwnerRole: hasOpenReorder ? '구매 실행' : undefined,
    escalationOwnerName: hasCritical ? 'procurement_manager' : 'finance_lead',
    slaState: hasCritical ? 'escalation_required' : hasBlocked ? 'overdue_internal' : 'on_track',
    ownerBlockedReason,
  };
}

// ---------------------------------------------------------------------------
// 9. Inbox Ownership (per item)
// ---------------------------------------------------------------------------

export function buildInboxItemOwnership(item: {
  workType: string;
  owner?: string;
  blockedReason?: string;
  dueState: { tone: string };
}): OwnershipSummary {
  const isExternal =
    item.workType === 'po_ack_pending' ||
    item.workType === 'quote_response_pending';
  const isBlocked = !!item.blockedReason;
  const isOverdue = item.dueState.tone === 'overdue';

  let assignmentState: AssignmentState;
  if (isExternal) {
    assignmentState = 'waiting_external';
  } else if (isBlocked) {
    assignmentState = 'blocked_by_role';
  } else if (item.owner) {
    assignmentState = 'owned_by_me';
  } else {
    assignmentState = 'unassigned';
  }

  return {
    currentOwnerName: item.owner,
    assignmentState,
    waitingExternalLabel: isExternal ? '외부 응답 대기' : undefined,
    escalationOwnerName: isOverdue ? 'team_lead' : undefined,
    slaState: isOverdue
      ? isExternal
        ? 'overdue_external'
        : 'escalation_required'
      : item.dueState.tone === 'due_soon'
        ? 'due_soon'
        : 'on_track',
    ownerBlockedReason: item.blockedReason,
  };
}

// ---------------------------------------------------------------------------
// 10. Assignment State Labels
// ---------------------------------------------------------------------------

export const ASSIGNMENT_STATE_LABELS: Record<AssignmentState, string> = {
  owned_by_me: '내 작업',
  owned_by_team: '팀 작업',
  unassigned: '미할당',
  awaiting_internal_review: '내부 검토 대기',
  awaiting_approval: '승인 대기',
  waiting_external: '외부 대기',
  handoff_pending: '인수인계 대기',
  escalated: '에스컬레이션',
  blocked_by_role: '역할 차단',
  resolved: '처리 완료',
};

export const ASSIGNMENT_STATE_TONES: Record<AssignmentState, string> = {
  owned_by_me: 'text-blue-400',
  owned_by_team: 'text-slate-300',
  unassigned: 'text-amber-400',
  awaiting_internal_review: 'text-amber-400',
  awaiting_approval: 'text-amber-400',
  waiting_external: 'text-purple-400',
  handoff_pending: 'text-teal-400',
  escalated: 'text-red-400',
  blocked_by_role: 'text-red-400',
  resolved: 'text-emerald-400',
};

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  on_track: '정상',
  due_soon: '마감 임박',
  overdue_internal: '내부 지연',
  overdue_external: '외부 지연',
  escalation_required: '에스컬레이션 필요',
};

export const SLA_STATE_TONES: Record<SlaState, string> = {
  on_track: 'text-emerald-400',
  due_soon: 'text-amber-400',
  overdue_internal: 'text-red-400',
  overdue_external: 'text-purple-400',
  escalation_required: 'text-red-400',
};

// ---------------------------------------------------------------------------
// 11. Inbox Owner Filter Options
// ---------------------------------------------------------------------------

export const OWNER_FILTER_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'my_work', label: '내 작업' },
  { key: 'team_work', label: '팀 작업' },
  { key: 'unassigned', label: '미할당' },
  { key: 'waiting_external', label: '외부 대기' },
  { key: 'escalated', label: '에스컬레이션' },
  { key: 'approval_owned', label: '승인 대기' },
] as const;

export type OwnerFilterKey = (typeof OWNER_FILTER_OPTIONS)[number]['key'];

export function filterByOwnerState(
  items: Array<{ assignmentState?: AssignmentState }>,
  filter: OwnerFilterKey,
): typeof items {
  if (filter === 'all') return items;
  const stateMap: Record<string, AssignmentState[]> = {
    my_work: ['owned_by_me'],
    team_work: ['owned_by_team'],
    unassigned: ['unassigned'],
    waiting_external: ['waiting_external'],
    escalated: ['escalated', 'blocked_by_role'],
    approval_owned: ['awaiting_approval', 'awaiting_internal_review'],
  };
  const states = stateMap[filter];
  if (!states) return items;
  return items.filter((item) => item.assignmentState && states.includes(item.assignmentState));
}

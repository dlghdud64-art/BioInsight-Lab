/**
 * ops-console/ops-adapters.ts
 *
 * View-model 어댑터 — 계약 데이터를 UI ViewModel로 변환하는 순수 함수 모음.
 * 모든 함수는 side-effect 없음.
 *
 * @module ops-console/ops-adapters
 */

import type {
  QuoteRequestContract,
  QuoteResponseContract,
  QuoteComparisonContract,
  QuoteComparisonRowContract,
  QuoteResponseItemContract,
} from '../review-queue/quote-rfq-contract';

import type {
  PurchaseOrderContract,
  PurchaseOrderLineContract,
  ApprovalExecutionContract,
  PurchaseOrderAcknowledgementContract,
} from '../review-queue/po-approval-contract';

import type {
  ReceivingBatchContract,
  ReceivingLineReceiptContract,
} from '../review-queue/receiving-inbound-contract';

import type {
  InventoryStockPositionContract,
  ReorderRecommendationContract,
  ExpiryActionContract,
} from '../review-queue/reorder-expiry-stock-risk-contract';

import type { OperatorInboxItem, OperatorPriority } from '../review-queue/operator-console-contract';

// View-model types
import type { OperatorInboxItemViewModel } from '../review-queue/operator-console-view-models';
import type {
  QuoteRequestListItemVM,
  QuoteVendorResponseVM,
  QuoteComparisonRowVM,
  QuoteDecisionSummaryVM,
  QuoteComparisonVendorColumn,
} from '../review-queue/quote-rfq-view-models';
import type {
  PurchaseOrderListItemVM,
  ApprovalExecutionVM,
  PurchaseOrderLineVM,
  ApprovalStepTimelineVM,
} from '../review-queue/po-approval-view-models';
import type {
  ReceivingBatchListItemVM,
  ReceivingLineReceiptVM,
} from '../review-queue/receiving-inbound-view-models';
import type {
  InventoryStockHealthVM,
  ReorderRecommendationVM,
  ExpiryActionVM,
} from '../review-queue/reorder-expiry-stock-risk-view-models';

// ---------------------------------------------------------------------------
// Shared types & helpers
// ---------------------------------------------------------------------------

export type VendorMap = Record<string, string>;

// ---- Korean formatters ----

function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function formatRelativeDate(iso: string): string {
  const now = new Date();
  const target = new Date(iso);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays > 0) return `${diffDays}일 후`;
  return `${Math.abs(diffDays)}일 전`;
}

function formatElapsedHours(hours: number): string {
  if (hours < 1) return '1시간 미만';
  const days = Math.floor(hours / 24);
  const remaining = Math.floor(hours % 24);
  if (days === 0) return `${Math.floor(hours)}시간 경과`;
  if (remaining === 0) return `${days}일 경과`;
  return `${days}일 ${remaining}시간 경과`;
}

// ---- Status label maps ----

const QUOTE_REQUEST_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  draft: { label: '초안', tone: 'neutral' },
  ready_to_send: { label: '발송 준비', tone: 'info' },
  sent: { label: '발송됨', tone: 'info' },
  partially_responded: { label: '부분 응답', tone: 'warning' },
  responded: { label: '응답 완료', tone: 'success' },
  comparison_ready: { label: '비교 준비', tone: 'info' },
  vendor_selected: { label: '공급사 선정', tone: 'success' },
  converted_to_po: { label: '발주 전환', tone: 'success' },
  expired: { label: '만료', tone: 'danger' },
  cancelled: { label: '취소', tone: 'neutral' },
};

const QUOTE_RESPONSE_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  not_sent: { label: '미전달', tone: 'neutral' },
  sent: { label: '전달됨', tone: 'info' },
  viewed: { label: '열람됨', tone: 'info' },
  responded: { label: '회신 완료', tone: 'success' },
  declined: { label: '거절', tone: 'danger' },
  expired: { label: '기한 초과', tone: 'danger' },
  incomplete: { label: '부분 응답', tone: 'warning' },
};

const PO_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  draft: { label: '초안', tone: 'neutral' },
  pending_approval: { label: '승인 대기', tone: 'info' },
  approval_in_progress: { label: '승인 진행', tone: 'info' },
  approved: { label: '승인 완료', tone: 'success' },
  rejected: { label: '반려', tone: 'danger' },
  ready_to_issue: { label: '발행 준비', tone: 'info' },
  issued: { label: '발행됨', tone: 'info' },
  acknowledged: { label: '공급사 확인', tone: 'success' },
  partially_received: { label: '부분 입고', tone: 'warning' },
  received: { label: '입고 완료', tone: 'success' },
  closed: { label: '마감', tone: 'neutral' },
  cancelled: { label: '취소', tone: 'neutral' },
  on_hold: { label: '보류', tone: 'warning' },
};

const APPROVAL_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  not_started: { label: '미시작', tone: 'neutral' },
  in_progress: { label: '진행 중', tone: 'info' },
  approved: { label: '승인 완료', tone: 'success' },
  rejected: { label: '반려', tone: 'danger' },
  returned: { label: '반송', tone: 'warning' },
  cancelled: { label: '취소', tone: 'neutral' },
  expired: { label: '기한 초과', tone: 'danger' },
};

const APPROVAL_STEP_TYPE_LABELS: Record<string, string> = {
  budget: '예산 검토',
  manager: '관리자 승인',
  procurement: '구매 검토',
  finance: '재무 승인',
  compliance: '규정 검토',
  admin: '관리자 최종 승인',
};

const APPROVAL_STEP_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  waiting: { label: '대기', tone: 'neutral' },
  active: { label: '검토 중', tone: 'info' },
  approved: { label: '승인', tone: 'success' },
  rejected: { label: '반려', tone: 'danger' },
  returned: { label: '반송', tone: 'warning' },
  skipped: { label: '건너뜀', tone: 'neutral' },
  expired: { label: '기한 초과', tone: 'danger' },
};

const RECEIVING_BATCH_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  expected: { label: '입고 예정', tone: 'neutral' },
  arrived: { label: '도착', tone: 'info' },
  partially_received: { label: '부분 수령', tone: 'warning' },
  received: { label: '수령 완료', tone: 'success' },
  inspection_in_progress: { label: '검수 중', tone: 'info' },
  ready_to_post: { label: '반영 준비', tone: 'info' },
  posted: { label: '반영 완료', tone: 'success' },
  issue_flagged: { label: '이슈 발생', tone: 'danger' },
  closed: { label: '마감', tone: 'neutral' },
  cancelled: { label: '취소', tone: 'neutral' },
};

const PRIORITY_LABELS: Record<OperatorPriority, string> = {
  p0: '긴급',
  p1: '오늘 처리',
  p2: '일반',
  p3: '참고',
};

const PRIORITY_TONES: Record<OperatorPriority, string> = {
  p0: 'danger',
  p1: 'warning',
  p2: 'info',
  p3: 'neutral',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  request: '요청',
  approval: '승인',
  budget_risk: '예산 위험',
  document_issue: '서류 이슈',
  inventory_action: '재고 조치',
  integration_exception: '연동 예외',
  manual_review: '수동 검토',
  escalation_followup: '에스컬레이션',
};

const OWNERSHIP_STATE_LABELS: Record<string, string> = {
  assigned_to_me: '내 작업',
  assigned_to_team: '팀 배정',
  unassigned: '미할당',
  blocked: '차단됨',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  search: '검색 기반',
  compare: '비교 기반',
  manual: '수동 생성',
  reorder: '재발주',
  protocol: '프로토콜 기반',
};

const PO_SOURCE_LABELS: Record<string, string> = {
  quote: '견적 기반',
  manual: '수동 생성',
  reorder: '재발주',
  contract: '계약 기반',
};

const MATCH_LABELS: Record<string, { label: string; tone: string }> = {
  exact: { label: '정확 일치', tone: 'success' },
  compatible: { label: '호환', tone: 'info' },
  partial: { label: '부분 일치', tone: 'warning' },
  unclear: { label: '확인 필요', tone: 'danger' },
};

const FULFILLMENT_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  open: { label: '미처리', tone: 'neutral' },
  confirmed: { label: '확인', tone: 'info' },
  partially_received: { label: '부분 입고', tone: 'warning' },
  received: { label: '입고 완료', tone: 'success' },
  backordered: { label: '재입고 대기', tone: 'warning' },
  cancelled: { label: '취소', tone: 'neutral' },
  issue_flagged: { label: '이슈', tone: 'danger' },
};

const STOCK_RISK_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  healthy: { label: '정상', tone: 'healthy' },
  watch: { label: '관찰', tone: 'watch' },
  reorder_due: { label: '재주문 필요', tone: 'warning' },
  critical_shortage: { label: '긴급 부족', tone: 'danger' },
  expiry_risk: { label: '유효기간 위험', tone: 'warning' },
  quarantine_constrained: { label: '격리 제약', tone: 'danger' },
  blocked: { label: '차단', tone: 'blocked' },
};

const REORDER_TYPE_LABELS: Record<string, string> = {
  below_reorder_point: '재주문 기준 도달',
  coverage_risk: '커버리지 부족',
  incoming_gap: '입고 공백',
  expiry_replacement: '만료 대체',
  project_demand: '프로젝트 수요',
  manual_review: '수동 검토',
};

const REORDER_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  open: { label: '검토 대기', tone: 'open' },
  under_review: { label: '검토 중', tone: 'in_progress' },
  approved_for_quote: { label: '견적 승인', tone: 'in_progress' },
  converted_to_quote: { label: '견적 전환', tone: 'converted' },
  converted_to_po: { label: '발주 전환', tone: 'converted' },
  deferred: { label: '보류', tone: 'open' },
  dismissed: { label: '기각', tone: 'open' },
  blocked: { label: '차단', tone: 'blocked' },
};

const URGENCY_LABELS: Record<string, { label: string; tone: string }> = {
  low: { label: '낮음', tone: 'low' },
  normal: { label: '보통', tone: 'normal' },
  high: { label: '높음', tone: 'high' },
  urgent: { label: '긴급', tone: 'urgent' },
};

const EXPIRY_ACTION_TYPE_LABELS: Record<string, string> = {
  monitor: '모니터링',
  consume_first: '우선 사용',
  transfer: '이관',
  quarantine: '격리',
  dispose: '폐기',
  replace_order: '교체 발주',
  review: '검토',
};

const EXPIRY_ACTION_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  open: { label: '대기', tone: 'warning' },
  in_progress: { label: '진행 중', tone: 'info' },
  completed: { label: '완료', tone: 'success' },
  dismissed: { label: '기각', tone: 'neutral' },
  blocked: { label: '차단', tone: 'danger' },
  overdue: { label: '기한 초과', tone: 'danger' },
};

// ---- Due state helper ----

function resolveDueState(
  dueAt: string | undefined,
): { label: string; isOverdue: boolean; tone: 'normal' | 'due_soon' | 'overdue' } {
  if (!dueAt) return { label: '기한 없음', isOverdue: false, tone: 'normal' };
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    return { label: `${Math.abs(Math.floor(diffDays))}일 초과`, isOverdue: true, tone: 'overdue' };
  }
  if (diffDays <= 3) {
    const remaining = Math.ceil(diffDays);
    return { label: remaining === 0 ? '오늘 마감' : `${remaining}일 남음`, isOverdue: false, tone: 'due_soon' };
  }
  return { label: `${Math.ceil(diffDays)}일 남음`, isOverdue: false, tone: 'normal' };
}

function resolveExpiryTone(daysToExpiry: number | undefined): 'normal' | 'warning' | 'danger' | 'expired' {
  if (daysToExpiry === undefined || daysToExpiry > 90) return 'normal';
  if (daysToExpiry <= 0) return 'expired';
  if (daysToExpiry <= 30) return 'danger';
  return 'warning';
}

// ===========================================================================
// 1. Inbox adapters
// ===========================================================================

export function toOperatorInboxItemVM(
  item: OperatorInboxItem,
  vendors: VendorMap,
): OperatorInboxItemViewModel {
  return {
    id: item.id,
    itemType: item.itemType,
    itemTypeLabel: ITEM_TYPE_LABELS[item.itemType] ?? item.itemType,
    title: item.title,
    stateLabel: item.status,
    priority: item.priority,
    priorityLabel: PRIORITY_LABELS[item.priority],
    priorityTone: PRIORITY_TONES[item.priority],
    ownerLabel: item.owner?.name,
    ownershipStateLabel: OWNERSHIP_STATE_LABELS[item.ownershipState] ?? item.ownershipState,
    sourceContextLabel: item.sourceContext?.label,
    sourceContextHref: item.sourceContext?.href,
    impactLabel: item.impactLabel,
    elapsedTimeLabel: formatElapsedHours(item.elapsedHours),
    dueLabel: item.dueAt ? formatRelativeDate(item.dueAt) : undefined,
    slaLabel: item.slaHours ? `SLA ${item.slaHours}시간` : undefined,
    isOverdue: item.isOverdue,
    isBlocked: item.isBlocked,
    blockedReasonLabel: item.blockedReason,
    primaryActionLabel: item.isBlocked ? '차단 해제' : '상세 보기',
    linkedContextLabels: item.linkedContexts,
    href: item.sourceContext?.href ?? `/dashboard/operator/${item.id}`,
  };
}

// ===========================================================================
// 2. Quote adapters
// ===========================================================================

export function toQuoteRequestListItemVM(
  req: QuoteRequestContract,
  responses: QuoteResponseContract[],
  vendors: VendorMap,
): QuoteRequestListItemVM {
  const statusInfo = QUOTE_REQUEST_STATUS_LABELS[req.status] ?? { label: req.status, tone: 'neutral' };
  const dueState = resolveDueState(req.dueAt);
  const respondedCount = responses.filter(
    (r) => r.quoteRequestId === req.id && (r.responseStatus === 'responded' || r.responseStatus === 'incomplete'),
  ).length;

  return {
    id: req.id,
    requestNumber: req.requestNumber,
    title: req.title,
    currentStatusLabel: statusInfo.label,
    statusTone: statusInfo.tone as QuoteRequestListItemVM['statusTone'],
    vendorCount: req.vendorIds.length,
    itemCount: req.items.length,
    dueState,
    responseProgressText: `${respondedCount}/${req.vendorIds.length} 공급사 응답`,
    selectedVendorName: req.summary.selectedVendorId ? vendors[req.summary.selectedVendorId] : undefined,
    urgencyBadge: req.priority === 'urgent' ? '긴급' : req.priority === 'high' ? '높음' : undefined,
    sourceTypeLabel: SOURCE_TYPE_LABELS[req.sourceType] ?? req.sourceType,
    href: `/dashboard/quotes/${req.id}`,
  };
}

export function toQuoteVendorResponseVM(
  resp: QuoteResponseContract,
  vendorName: string,
): QuoteVendorResponseVM {
  const statusInfo = QUOTE_RESPONSE_STATUS_LABELS[resp.responseStatus] ?? { label: resp.responseStatus, tone: 'neutral' };
  const prices = resp.responseItems.map((i) => i.unitPrice).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const leads = resp.responseItems.map((i) => i.leadTimeDays).filter((d): d is number => d !== undefined);
  const minLead = leads.length > 0 ? Math.min(...leads) : 0;
  const maxLead = leads.length > 0 ? Math.max(...leads) : 0;
  const missingDocs = resp.responseItems.filter(
    (i) => !i.complianceDocs.includes('msds') || !i.complianceDocs.includes('coa'),
  ).length;
  const substitutes = resp.responseItems.filter((i) => i.substituteOffered).length;
  const riskBadges: string[] = [];
  if (missingDocs > 0) riskBadges.push(`문서 누락 ${missingDocs}건`);
  if (substitutes > 0) riskBadges.push(`대체품 ${substitutes}건`);

  return {
    vendorId: resp.vendorId,
    vendorName,
    responseStatusLabel: statusInfo.label,
    statusTone: statusInfo.tone,
    responseCoverage: {
      responded: resp.responseItems.length,
      total: resp.responseItems.length,
      label: `${resp.responseItems.length}개 항목 응답`,
    },
    priceRangeText: prices.length > 0 ? `${formatKRW(minPrice)} ~ ${formatKRW(maxPrice)}` : undefined,
    leadTimeRangeText: leads.length > 0 ? (minLead === maxLead ? `${minLead}일` : `${minLead}~${maxLead}일`) : undefined,
    missingDocsCount: missingDocs,
    substituteCount: substitutes,
    riskBadges,
    canCompare: resp.responseStatus === 'responded' || resp.responseStatus === 'incomplete',
    canSelect: resp.responseStatus === 'responded',
  };
}

export function toQuoteComparisonRowVM(
  row: QuoteComparisonRowContract,
  vendors: VendorMap,
): QuoteComparisonRowVM {
  const vendorColumns: QuoteComparisonVendorColumn[] = row.vendorOptions.map((opt) => {
    const matchInfo = opt.isExactMatch
      ? MATCH_LABELS['exact']!
      : opt.isSubstitute
        ? MATCH_LABELS['compatible']!
        : MATCH_LABELS['partial']!;
    return {
      vendorId: opt.vendorId,
      vendorName: vendors[opt.vendorId] ?? opt.vendorId,
      priceLabel: opt.normalizedUnitPrice !== undefined ? formatKRW(opt.normalizedUnitPrice) : undefined,
      leadTimeLabel: opt.leadTimeDays !== undefined ? `${opt.leadTimeDays}일` : undefined,
      matchLabel: matchInfo.label,
      matchTone: matchInfo.tone,
      hasRequiredDocs: opt.hasRequiredDocs,
      warningBadges: opt.warningBadges,
      score: opt.score,
    };
  });

  return {
    requestItemId: row.requestItemId,
    itemLabel: row.itemLabel,
    requestedSpecSummary: '',
    vendorColumns,
    bestPriceMarker: row.bestPriceVendorId ? vendors[row.bestPriceVendorId] : undefined,
    fastestLeadMarker: row.fastestLeadVendorId ? vendors[row.fastestLeadVendorId] : undefined,
    exactMatchMarker: row.exactMatchVendorId ? vendors[row.exactMatchVendorId] : undefined,
    reviewRequired: row.requiresReview,
    issueSummary: row.hasCoverageGap
      ? '일부 공급사 미응답'
      : row.hasSpecMismatch
        ? '사양 불일치 확인 필요'
        : undefined,
  };
}

export function toQuoteDecisionSummaryVM(
  comparison: QuoteComparisonContract,
  responses: QuoteResponseContract[],
  vendors: VendorMap,
): QuoteDecisionSummaryVM {
  const scenarioLabels: Record<string, string> = {
    lowest_cost: '최저 비용 기준',
    fastest_delivery: '최단 납기 기준',
    best_match: '사양 일치도 기준',
    balanced: '가격·납기·문서 균형 기준',
  };

  const uncoveredCount = comparison.comparableItemRows.filter((r) => r.hasCoverageGap).length;
  const substituteCount = responses
    .filter((r) => comparison.vendorsInScope.includes(r.vendorId))
    .reduce((sum, r) => sum + r.responseItems.filter((i) => i.substituteOffered).length, 0);

  const blockers: string[] = [];
  if (comparison.missingResponses.length > 0) {
    blockers.push(`미응답 공급사 ${comparison.missingResponses.length}곳`);
  }
  const reviewRows = comparison.comparableItemRows.filter((r) => r.requiresReview);
  if (reviewRows.length > 0) {
    blockers.push(`검토 필요 항목 ${reviewRows.length}건`);
  }

  let readiness: 'ready' | 'needs_review' | 'blocked' = 'ready';
  if (comparison.missingResponses.length > comparison.vendorsInScope.length / 2) {
    readiness = 'blocked';
  } else if (reviewRows.length > 0 || substituteCount > 0) {
    readiness = 'needs_review';
  }

  return {
    recommendedVendorName: comparison.recommendedVendorId
      ? vendors[comparison.recommendedVendorId]
      : undefined,
    recommendationBasis: scenarioLabels[comparison.recommendedScenario ?? ''] ?? '추천 기준 미정',
    uncoveredItemCount: uncoveredCount,
    substituteItemCount: substituteCount,
    missingResponseVendorCount: comparison.missingResponses.length,
    conversionReadiness: readiness,
    conversionBlockers: blockers,
  };
}

// ===========================================================================
// 3. PO adapters
// ===========================================================================

export function toPurchaseOrderListItemVM(
  po: PurchaseOrderContract,
  approval?: ApprovalExecutionContract,
  ack?: PurchaseOrderAcknowledgementContract,
  vendorName?: string,
): PurchaseOrderListItemVM {
  const statusInfo = PO_STATUS_LABELS[po.status] ?? { label: po.status, tone: 'neutral' };
  const approvalInfo = approval
    ? (APPROVAL_STATUS_LABELS[approval.status] ?? { label: approval.status, tone: 'neutral' })
    : { label: '승인 없음', tone: 'neutral' };

  const nonCancelledLines = po.lines.filter((l) => l.fulfillmentStatus !== 'cancelled');
  const receivedLines = nonCancelledLines.filter((l) => l.fulfillmentStatus === 'received');

  let ackState: { label: string; tone: 'pending' | 'confirmed' | 'issue' };
  if (!ack) {
    ackState = { label: '미발송', tone: 'pending' };
  } else if (ack.status === 'acknowledged') {
    ackState = { label: '확인 완료', tone: 'confirmed' };
  } else if (ack.status === 'declined' || ack.status === 'needs_review') {
    ackState = { label: '이슈 발생', tone: 'issue' };
  } else {
    ackState = { label: '확인 대기', tone: 'pending' };
  }

  const requiredByState = resolveDueState(po.requiredByAt);

  return {
    id: po.id,
    poNumber: po.poNumber,
    vendorName: vendorName ?? po.vendorId,
    statusLabel: statusInfo.label,
    statusTone: statusInfo.tone as PurchaseOrderListItemVM['statusTone'],
    approvalStatusLabel: approvalInfo.label,
    approvalTone: approvalInfo.tone,
    totalAmountText: formatKRW(po.totalAmount),
    requiredByState: {
      label: requiredByState.label,
      isOverdue: requiredByState.isOverdue,
      tone: requiredByState.tone,
    },
    acknowledgementState: ackState,
    lineProgressText: `${receivedLines.length}/${nonCancelledLines.length} 품목 입고`,
    ownerName: po.ownerId,
    riskBadges: [],
    sourceLabel: PO_SOURCE_LABELS[po.sourceType] ?? po.sourceType,
    href: `/dashboard/purchase-orders/${po.id}`,
  };
}

export function toApprovalExecutionVM(exec: ApprovalExecutionContract): ApprovalExecutionVM {
  const overallInfo = APPROVAL_STATUS_LABELS[exec.status] ?? { label: exec.status, tone: 'neutral' };
  const completedSteps = exec.steps.filter((s) => s.status === 'approved' || s.status === 'skipped');
  const currentStep = exec.steps.find((s) => s.status === 'active') ?? exec.steps[exec.steps.length - 1];
  const overdueSteps = exec.steps.filter(
    (s) => s.slaDueAt && new Date(s.slaDueAt) < new Date() && s.status === 'active',
  );
  const pendingApprovers = exec.steps
    .filter((s) => s.status === 'active')
    .flatMap((s) => s.assigneeIds);

  const stepTimeline: ApprovalStepTimelineVM[] = exec.steps.map((s) => ({
    stepOrder: s.stepOrder,
    stepTypeLabel: APPROVAL_STEP_TYPE_LABELS[s.stepType] ?? s.stepType,
    statusLabel: (APPROVAL_STEP_STATUS_LABELS[s.status] ?? { label: s.status }).label,
    tone: (APPROVAL_STEP_STATUS_LABELS[s.status] ?? { tone: 'neutral' }).tone,
    assigneeLabels: s.assigneeIds,
    decisionSummary: s.decisions.length > 0
      ? s.decisions.map((d) => `${d.decision} (${d.decidedBy})`).join(', ')
      : undefined,
    durationLabel: s.startedAt && s.completedAt
      ? `${Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / (1000 * 60 * 60))}시간`
      : undefined,
  }));

  return {
    overallStatusLabel: overallInfo.label,
    overallTone: overallInfo.tone,
    currentStepLabel: currentStep
      ? `${APPROVAL_STEP_TYPE_LABELS[currentStep.stepType] ?? currentStep.stepType} 단계`
      : '완료',
    pendingApproverNames: pendingApprovers,
    completedStepCount: completedSteps.length,
    totalStepCount: exec.steps.length,
    overdueStepCount: overdueSteps.length,
    canIssue: exec.status === 'approved',
    canEscalate: exec.status === 'in_progress' && overdueSteps.length > 0,
    canReopen: exec.status === 'rejected' || exec.status === 'returned',
    stepTimeline,
  };
}

export function toPurchaseOrderLineVM(line: PurchaseOrderLineContract): PurchaseOrderLineVM {
  const fulfillmentInfo = FULFILLMENT_STATUS_LABELS[line.fulfillmentStatus] ?? { label: line.fulfillmentStatus, tone: 'neutral' };
  const docs = (line.requiredDocuments ?? []).map((d) => d.toUpperCase()).join(' · ');

  return {
    id: line.id,
    lineNumber: line.lineNumber,
    itemLabel: `${line.itemName}${line.manufacturer ? ` (${line.manufacturer})` : ''}`,
    orderedSummary: `${line.orderedQuantity} x ${line.packSize ?? line.orderedUnit}`,
    priceSummary: `${formatKRW(line.unitPrice)} x ${line.orderedQuantity} = ${formatKRW(line.lineTotal)}`,
    deliverySummary: line.expectedLeadTimeDays !== undefined ? `납기 ${line.expectedLeadTimeDays}일` : '납기 미정',
    fulfillmentLabel: fulfillmentInfo.label,
    fulfillmentTone: fulfillmentInfo.tone,
    documentCoverageSummary: docs || '문서 요구 없음',
    substituteFlag: line.substituteApproved ? '대체품 승인' : undefined,
    issueSummary: line.riskFlags.length > 0 ? line.riskFlags.join(', ') : undefined,
    receivingReady: line.fulfillmentStatus === 'confirmed' || line.fulfillmentStatus === 'open',
    sourceLineageLabel: line.sourceRequestItemId ? `견적 항목 ${line.sourceRequestItemId}` : undefined,
  };
}

// ===========================================================================
// 4. Receiving adapters
// ===========================================================================

export function toReceivingBatchListItemVM(
  batch: ReceivingBatchContract,
  vendorName?: string,
): ReceivingBatchListItemVM {
  const statusInfo = RECEIVING_BATCH_STATUS_LABELS[batch.status] ?? { label: batch.status, tone: 'neutral' };
  const completedStatuses = ['received', 'over_received', 'posted'];
  const receivedCount = batch.lineReceipts.filter((l) => completedStatuses.includes(l.receiptStatus)).length;
  const inspectionPending = batch.lineReceipts.filter(
    (l) => l.inspectionRequired && l.inspectionStatus !== 'passed' && l.inspectionStatus !== 'not_required',
  ).length;
  const postedCount = batch.lineReceipts.filter((l) => l.receiptStatus === 'posted').length;
  const riskBadges: string[] = [];
  if (batch.lineReceipts.some((l) => l.conditionStatus === 'temperature_excursion')) riskBadges.push('온도 이탈');
  if (batch.lineReceipts.some((l) => l.documentStatus === 'partial' || l.documentStatus === 'missing')) riskBadges.push('문서 누락');
  if (batch.lineReceipts.some((l) => l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'))) riskBadges.push('격리');

  return {
    id: batch.id,
    receivingNumber: batch.receivingNumber,
    vendorName: vendorName ?? batch.vendorId ?? '미상',
    batchStatusLabel: statusInfo.label,
    statusTone: statusInfo.tone as ReceivingBatchListItemVM['statusTone'],
    arrivalState: { label: '도착 완료', isOverdue: false, tone: 'arrived' },
    poReference: batch.poId ? `${batch.poId} 기반` : undefined,
    lineProgressText: `${receivedCount}/${batch.lineReceipts.length} 품목 수령`,
    inspectionSummary: inspectionPending > 0 ? `${inspectionPending}건 검수 대기` : '검수 완료',
    postingSummary: `${postedCount}/${batch.lineReceipts.length} 반영 완료`,
    riskBadges,
    href: `/dashboard/receiving/${batch.id}`,
  };
}

export function toReceivingLineReceiptVM(line: ReceivingLineReceiptContract): ReceivingLineReceiptVM {
  const conditionLabels: Record<string, { label: string; tone: 'ok' | 'warning' | 'danger' }> = {
    ok: { label: '정상', tone: 'ok' },
    damaged: { label: '파손', tone: 'danger' },
    leaking: { label: '누수', tone: 'danger' },
    temperature_excursion: { label: '온도 이탈', tone: 'danger' },
    packaging_issue: { label: '포장 불량', tone: 'warning' },
    label_issue: { label: '라벨 문제', tone: 'warning' },
    unknown: { label: '미확인', tone: 'warning' },
  };

  const inspectionLabels: Record<string, { label: string; tone: 'pass' | 'fail' | 'pending' | 'not_required' }> = {
    not_required: { label: '검수 불요', tone: 'not_required' },
    pending: { label: '검수 대기', tone: 'pending' },
    in_progress: { label: '검수 중', tone: 'pending' },
    passed: { label: '합격', tone: 'pass' },
    failed: { label: '불합격', tone: 'fail' },
    conditional_pass: { label: '조건부 합격', tone: 'pass' },
    reinspect_required: { label: '재검수 필요', tone: 'fail' },
  };

  const condInfo = conditionLabels[line.conditionStatus] ?? { label: line.conditionStatus, tone: 'warning' as const };
  const inspInfo = inspectionLabels[line.inspectionStatus] ?? { label: line.inspectionStatus, tone: 'pending' as const };

  const orderedVsReceived = line.orderedQuantity !== undefined
    ? `주문 ${line.orderedQuantity} / 수령 ${line.receivedQuantity}${line.orderedQuantity > line.receivedQuantity ? ` / 부족 ${line.orderedQuantity - line.receivedQuantity}` : ''}`
    : `수령 ${line.receivedQuantity}`;

  const docs: string[] = [];
  for (const lot of line.lotRecords) {
    if (lot.coaAttached) docs.push('COA');
    if (lot.msdsAttached) docs.push('MSDS');
  }

  const lotSummary = line.lotRecords.length > 0
    ? `${line.lotRecords.length}개 lot (${line.lotRecords.map((l) => l.lotNumber).join(', ')})`
    : 'lot 없음';

  const hasQuarantine = line.lotRecords.some((l) => l.quarantineStatus === 'quarantined');
  let postingReadiness: 'ready' | 'blocked' | 'posted' = 'ready';
  if (line.receiptStatus === 'posted') postingReadiness = 'posted';
  else if (hasQuarantine || line.documentStatus === 'partial' || line.documentStatus === 'missing' || inspInfo.tone === 'fail') {
    postingReadiness = 'blocked';
  }

  return {
    id: line.lineNumber,
    lineNumber: line.lineNumber,
    itemLabel: `${line.itemName}${line.manufacturer ? ` (${line.manufacturer})` : ''}`,
    orderedVsReceivedSummary: orderedVsReceived,
    conditionSummary: condInfo.label,
    conditionTone: condInfo.tone,
    documentSummary: docs.length > 0 ? docs.join(' · ') : '문서 없음',
    inspectionSummary: inspInfo.label,
    inspectionTone: inspInfo.tone,
    lotSummary,
    postingReadiness,
    postingBlockers: postingReadiness === 'blocked'
      ? line.riskFlags.length > 0 ? line.riskFlags : ['이슈 미해결']
      : undefined,
    issueSummary: line.deviationNotes && line.deviationNotes.length > 0
      ? line.deviationNotes.join(', ')
      : undefined,
  };
}

// ===========================================================================
// 5. Stock Risk adapters
// ===========================================================================

export function toInventoryStockHealthVM(
  pos: InventoryStockPositionContract,
): InventoryStockHealthVM {
  const riskInfo = STOCK_RISK_STATUS_LABELS[pos.riskStatus] ?? { label: pos.riskStatus, tone: 'warning' };

  const reorderState = {
    hasOpenRecommendation: false,
    hasLinkedQuote: false,
    hasLinkedPO: false,
    label: '재주문 없음',
  };

  return {
    id: pos.id,
    inventoryItemId: pos.inventoryItemId,
    itemLabel: pos.inventoryItemId,
    locationName: pos.locationId,
    availableVsThresholdSummary: `가용 ${pos.availableQuantity} / 보유 ${pos.onHandQuantity} (격리 ${pos.quarantinedQuantity})`,
    coverageSummary: pos.coverageDays !== undefined
      ? `현재 소비율 기준 ${pos.coverageDays}일분`
      : undefined,
    incomingSummary: pos.incomingQuantity && pos.incomingQuantity > 0
      ? `입고 예정 ${pos.incomingQuantity}${pos.unit}`
      : undefined,
    riskStatusLabel: riskInfo.label,
    riskTone: riskInfo.tone as InventoryStockHealthVM['riskTone'],
    riskBadges: pos.riskFlags,
    reorderState,
    href: `/dashboard/inventory/${pos.id}`,
  };
}

export function toReorderRecommendationVM(
  rec: ReorderRecommendationContract,
  vendorName?: string,
): ReorderRecommendationVM {
  const typeLabel = REORDER_TYPE_LABELS[rec.recommendationType] ?? rec.recommendationType;
  const statusInfo = REORDER_STATUS_LABELS[rec.status] ?? { label: rec.status, tone: 'open' };
  const urgencyInfo = URGENCY_LABELS[rec.urgency] ?? { label: rec.urgency, tone: 'normal' };

  let budgetSummary: string | undefined;
  if (rec.budgetImpactEstimate) {
    budgetSummary = `예상 ${formatKRW(rec.budgetImpactEstimate.amount)}`;
    if (rec.budgetImpactEstimate.budgetRemainingPercent !== undefined) {
      budgetSummary += ` (잔여 예산 ${rec.budgetImpactEstimate.budgetRemainingPercent}%)`;
    }
  }

  return {
    id: rec.id,
    inventoryItemId: rec.inventoryItemId,
    itemLabel: rec.inventoryItemId,
    locationName: rec.locationId,
    recommendationTypeLabel: typeLabel,
    urgencyBadge: urgencyInfo.label,
    urgencyTone: rec.urgency as ReorderRecommendationVM['urgencyTone'],
    recommendedOrderSummary: `${rec.recommendedOrderQuantity} ${rec.recommendedUnit} 권장`,
    vendorHint: vendorName ? `우선 공급사: ${vendorName}` : undefined,
    budgetImpactSummary: budgetSummary,
    reasonSummary: rec.reasonCodes.join(', '),
    conversionState: {
      label: statusInfo.label,
      tone: statusInfo.tone as ReorderRecommendationVM['conversionState']['tone'],
    },
    blockedReason: rec.blockedReasons.length > 0 ? rec.blockedReasons.join(' + ') : undefined,
    statusLabel: statusInfo.label,
    href: `/dashboard/inventory/reorder/${rec.id}`,
  };
}

export function toExpiryActionVM(action: ExpiryActionContract): ExpiryActionVM {
  const typeLabel = EXPIRY_ACTION_TYPE_LABELS[action.actionType] ?? action.actionType;
  const statusInfo = EXPIRY_ACTION_STATUS_LABELS[action.status] ?? { label: action.status, tone: 'warning' };
  const expiryTone = resolveExpiryTone(action.daysToExpiry);

  let dueState: ExpiryActionVM['dueState'];
  if (action.dueAt) {
    const ds = resolveDueState(action.dueAt);
    dueState = { label: ds.label, isOverdue: ds.isOverdue, tone: ds.tone };
  }

  return {
    id: action.id,
    inventoryItemId: action.inventoryItemId,
    itemLabel: action.inventoryItemId,
    lotNumber: action.lotNumber,
    actionTypeLabel: typeLabel,
    daysToExpirySummary: action.daysToExpiry !== undefined
      ? action.daysToExpiry <= 0
        ? '만료됨'
        : `만료까지 ${action.daysToExpiry}일`
      : '만료일 미등록',
    expiryTone,
    affectedQuantitySummary: `${action.affectedQuantity} ${action.unit}`,
    ownerName: action.ownerId,
    dueState,
    statusLabel: statusInfo.label,
    statusTone: statusInfo.tone,
    issueSummary: action.notes ?? undefined,
  };
}

/**
 * ops-console/scenario-registry.ts
 *
 * Canonical P0 시나리오 선언.
 * 각 시나리오는 대표 entity, 기대 inbox 상태, 전이 정의를 가집니다.
 *
 * @module ops-console/scenario-registry
 */

import type { InboxWorkType, InboxTriageGroup, InboxPriority } from './inbox-adapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScenarioId =
  | 'quote_partial_review_required'
  | 'po_approved_ready_to_issue'
  | 'po_issued_ack_pending'
  | 'receiving_blocked_by_docs_and_quarantine'
  | 'stock_constrained_after_partial_posting'
  | 'expiry_replacement_reorder'
  | 'blocked_reorder_budget_or_duplicate';

export type TransitionStep =
  // Quote
  | 'quote_initial'
  | 'quote_vendor_selected'
  | 'quote_po_created'
  // PO
  | 'po_initial'
  | 'po_approved'
  | 'po_issued'
  | 'po_acknowledged'
  // Receiving
  | 'receiving_initial'
  | 'receiving_inspection_completed'
  | 'receiving_lot_captured'
  | 'receiving_posting_partial'
  | 'receiving_posting_completed'
  // Stock risk
  | 'stock_risk_initial'
  | 'stock_risk_quote_created'
  | 'stock_risk_blocker_resolved'
  | 'stock_risk_recommendation_converted';

export interface InboxExpectation {
  workType: InboxWorkType;
  triageGroup: InboxTriageGroup;
  minPriority: InboxPriority;
}

export interface TransitionExpectation {
  from: TransitionStep;
  to: TransitionStep;
  /** Action label (Korean) */
  actionLabel: string;
  /** Inbox items resolved by this transition */
  resolvedInboxTypes: InboxWorkType[];
  /** Inbox items created by this transition */
  createdInboxTypes: InboxWorkType[];
  /** Entity states after transition */
  expectedEntityStates: Record<string, string>;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
  /** Primary entity ID for detail route */
  primaryEntityId: string;
  /** Primary route path */
  primaryRoute: string;
  /** All entity IDs in this scenario's graph */
  entityIds: {
    quoteRequestIds: string[];
    quoteResponseIds: string[];
    quoteComparisonIds: string[];
    purchaseOrderIds: string[];
    approvalExecutionIds: string[];
    acknowledgementIds: string[];
    receivingBatchIds: string[];
    stockPositionIds: string[];
    reorderRecommendationIds: string[];
    expiryActionIds: string[];
    lotRiskIds: string[];
  };
  /** Expected inbox items in initial state */
  initialInboxExpectations: InboxExpectation[];
  /** Defined state transitions */
  transitions: TransitionExpectation[];
}

// ---------------------------------------------------------------------------
// Canonical Scenarios
// ---------------------------------------------------------------------------

export const SCENARIO_QUOTE_PARTIAL_REVIEW: ScenarioDefinition = {
  id: 'quote_partial_review_required',
  label: '견적 부분 응답 검토',
  description: '3개 공급사 중 2개 응답, 대체품 포함, 문서 누락 — 비교 검토 필요',
  primaryEntityId: 'qr-001',
  primaryRoute: '/dashboard/quotes/qr-001',
  entityIds: {
    quoteRequestIds: ['qr-001'],
    quoteResponseIds: ['qresp-thermo-001', 'qresp-sigma-001', 'qresp-corning-001'],
    quoteComparisonIds: ['qc-001'],
    purchaseOrderIds: [],
    approvalExecutionIds: [],
    acknowledgementIds: [],
    receivingBatchIds: [],
    stockPositionIds: [],
    reorderRecommendationIds: [],
    expiryActionIds: [],
    lotRiskIds: [],
  },
  initialInboxExpectations: [
    { workType: 'quote_review_required', triageGroup: 'needs_review', minPriority: 'p1' },
    { workType: 'quote_response_pending', triageGroup: 'waiting_external', minPriority: 'p2' },
  ],
  transitions: [
    {
      from: 'quote_initial',
      to: 'quote_vendor_selected',
      actionLabel: '공급사 선정',
      resolvedInboxTypes: ['quote_review_required'],
      createdInboxTypes: [],
      expectedEntityStates: { 'qr-001': 'vendor_selected', 'qc-001': 'selected' },
    },
    {
      from: 'quote_vendor_selected',
      to: 'quote_po_created',
      actionLabel: '발주 전환',
      resolvedInboxTypes: ['quote_response_pending'],
      createdInboxTypes: ['po_ready_to_issue'],
      expectedEntityStates: { 'qr-001': 'converted_to_po', 'qc-001': 'converted' },
    },
  ],
};

export const SCENARIO_PO_APPROVED_READY: ScenarioDefinition = {
  id: 'po_approved_ready_to_issue',
  label: '발주 승인 완료 — 발행 대기',
  description: '2단계 승인 완료, 공급사 발행 가능 상태',
  primaryEntityId: 'po-001',
  primaryRoute: '/dashboard/purchase-orders/po-001',
  entityIds: {
    quoteRequestIds: ['qr-001'],
    quoteResponseIds: ['qresp-thermo-001'],
    quoteComparisonIds: ['qc-001'],
    purchaseOrderIds: ['po-001'],
    approvalExecutionIds: ['ae-001'],
    acknowledgementIds: [],
    receivingBatchIds: [],
    stockPositionIds: [],
    reorderRecommendationIds: [],
    expiryActionIds: [],
    lotRiskIds: [],
  },
  initialInboxExpectations: [
    { workType: 'po_ready_to_issue', triageGroup: 'now', minPriority: 'p1' },
  ],
  transitions: [
    {
      from: 'po_initial',
      to: 'po_issued',
      actionLabel: '발주서 발행',
      resolvedInboxTypes: ['po_ready_to_issue'],
      createdInboxTypes: ['po_ack_pending'],
      expectedEntityStates: { 'po-001': 'issued' },
    },
    {
      from: 'po_issued',
      to: 'po_acknowledged',
      actionLabel: '공급사 확인',
      resolvedInboxTypes: ['po_ack_pending'],
      createdInboxTypes: [],
      expectedEntityStates: { 'po-001': 'acknowledged' },
    },
  ],
};

export const SCENARIO_PO_ISSUED_ACK_PENDING: ScenarioDefinition = {
  id: 'po_issued_ack_pending',
  label: '발주 발행 완료 — 공급사 확인 대기',
  description: 'Sigma-Aldrich 발주 확인 미응답, 납기 미확정',
  primaryEntityId: 'po-002',
  primaryRoute: '/dashboard/purchase-orders/po-002',
  entityIds: {
    quoteRequestIds: [],
    quoteResponseIds: [],
    quoteComparisonIds: [],
    purchaseOrderIds: ['po-002'],
    approvalExecutionIds: ['ae-002'],
    acknowledgementIds: ['ack-002'],
    receivingBatchIds: [],
    stockPositionIds: [],
    reorderRecommendationIds: [],
    expiryActionIds: [],
    lotRiskIds: [],
  },
  initialInboxExpectations: [
    { workType: 'po_ack_pending', triageGroup: 'waiting_external', minPriority: 'p1' },
  ],
  transitions: [
    {
      from: 'po_issued',
      to: 'po_acknowledged',
      actionLabel: '공급사 확인 수신',
      resolvedInboxTypes: ['po_ack_pending'],
      createdInboxTypes: [],
      expectedEntityStates: { 'po-002': 'acknowledged', 'ack-002': 'acknowledged' },
    },
  ],
};

export const SCENARIO_RECEIVING_BLOCKED: ScenarioDefinition = {
  id: 'receiving_blocked_by_docs_and_quarantine',
  label: '입고 차단 — 문서 누락 + 격리',
  description: 'COA 미첨부 + 온도 이탈 격리로 재고 반영 차단',
  primaryEntityId: 'rb-001',
  primaryRoute: '/dashboard/receiving/rb-001',
  entityIds: {
    quoteRequestIds: [],
    quoteResponseIds: [],
    quoteComparisonIds: [],
    purchaseOrderIds: ['po-003'],
    approvalExecutionIds: [],
    acknowledgementIds: [],
    receivingBatchIds: ['rb-001'],
    stockPositionIds: [],
    reorderRecommendationIds: [],
    expiryActionIds: [],
    lotRiskIds: [],
  },
  initialInboxExpectations: [
    { workType: 'receiving_issue', triageGroup: 'now', minPriority: 'p0' },
    { workType: 'quarantine_constrained', triageGroup: 'now', minPriority: 'p0' },
    { workType: 'posting_blocked', triageGroup: 'blocked', minPriority: 'p1' },
  ],
  transitions: [
    {
      from: 'receiving_initial',
      to: 'receiving_inspection_completed',
      actionLabel: '검수 완료',
      resolvedInboxTypes: [],
      createdInboxTypes: [],
      expectedEntityStates: { 'rb-001': 'inspection_in_progress' },
    },
    {
      from: 'receiving_inspection_completed',
      to: 'receiving_posting_partial',
      actionLabel: '정상 라인 반영',
      resolvedInboxTypes: ['receiving_issue'],
      createdInboxTypes: [],
      expectedEntityStates: { 'rb-001': 'partially_posted' },
    },
    {
      from: 'receiving_posting_partial',
      to: 'receiving_posting_completed',
      actionLabel: '전체 반영 완료',
      resolvedInboxTypes: ['quarantine_constrained', 'posting_blocked'],
      createdInboxTypes: [],
      expectedEntityStates: { 'rb-001': 'posted' },
    },
  ],
};

export const SCENARIO_STOCK_CONSTRAINED: ScenarioDefinition = {
  id: 'stock_constrained_after_partial_posting',
  label: '부분 입고 후 재고 부족',
  description: '일부 입고 반영 후에도 가용 재고 부족, 재주문 필요',
  primaryEntityId: 'sp-001',
  primaryRoute: '/dashboard/stock-risk',
  entityIds: {
    quoteRequestIds: [],
    quoteResponseIds: [],
    quoteComparisonIds: [],
    purchaseOrderIds: [],
    approvalExecutionIds: [],
    acknowledgementIds: [],
    receivingBatchIds: [],
    stockPositionIds: ['sp-001'],
    reorderRecommendationIds: ['rr-001'],
    expiryActionIds: [],
    lotRiskIds: [],
  },
  initialInboxExpectations: [
    { workType: 'reorder_due', triageGroup: 'needs_review', minPriority: 'p2' },
    { workType: 'quarantine_constrained', triageGroup: 'now', minPriority: 'p0' },
  ],
  transitions: [
    {
      from: 'stock_risk_initial',
      to: 'stock_risk_quote_created',
      actionLabel: '견적 요청 생성',
      resolvedInboxTypes: ['reorder_due'],
      createdInboxTypes: ['quote_response_pending'],
      expectedEntityStates: { 'rr-001': 'converted_to_quote' },
    },
  ],
};

export const SCENARIO_EXPIRY_REPLACEMENT: ScenarioDefinition = {
  id: 'expiry_replacement_reorder',
  label: '만료 교체 재주문',
  description: 'FBS 30병 45일 내 만료, 교체 발주 필요',
  primaryEntityId: 'sp-002',
  primaryRoute: '/dashboard/stock-risk',
  entityIds: {
    quoteRequestIds: [],
    quoteResponseIds: [],
    quoteComparisonIds: [],
    purchaseOrderIds: [],
    approvalExecutionIds: [],
    acknowledgementIds: [],
    receivingBatchIds: [],
    stockPositionIds: ['sp-002'],
    reorderRecommendationIds: ['rr-002'],
    expiryActionIds: ['ea-001'],
    lotRiskIds: ['lr-fbs-exp'],
  },
  initialInboxExpectations: [
    { workType: 'expiry_action_due', triageGroup: 'needs_review', minPriority: 'p2' },
    { workType: 'reorder_due', triageGroup: 'needs_review', minPriority: 'p2' },
  ],
  transitions: [
    {
      from: 'stock_risk_initial',
      to: 'stock_risk_quote_created',
      actionLabel: '교체 발주 견적 요청',
      resolvedInboxTypes: ['reorder_due'],
      createdInboxTypes: ['quote_response_pending'],
      expectedEntityStates: { 'rr-002': 'converted_to_quote' },
    },
    {
      from: 'stock_risk_quote_created',
      to: 'stock_risk_recommendation_converted',
      actionLabel: '만료 조치 완료',
      resolvedInboxTypes: ['expiry_action_due'],
      createdInboxTypes: [],
      expectedEntityStates: { 'ea-001': 'completed' },
    },
  ],
};

export const SCENARIO_BLOCKED_REORDER: ScenarioDefinition = {
  id: 'blocked_reorder_budget_or_duplicate',
  label: '재주문 차단 — 예산/중복',
  description: '견적 진행 중 + 월 예산 92%로 재주문 차단',
  primaryEntityId: 'rr-003',
  primaryRoute: '/dashboard/stock-risk',
  entityIds: {
    quoteRequestIds: ['qr-001'],
    quoteResponseIds: [],
    quoteComparisonIds: [],
    purchaseOrderIds: [],
    approvalExecutionIds: [],
    acknowledgementIds: [],
    receivingBatchIds: [],
    stockPositionIds: [],
    reorderRecommendationIds: ['rr-003'],
    expiryActionIds: [],
    lotRiskIds: [],
  },
  initialInboxExpectations: [
    { workType: 'reorder_due', triageGroup: 'blocked', minPriority: 'p0' },
  ],
  transitions: [
    {
      from: 'stock_risk_initial',
      to: 'stock_risk_blocker_resolved',
      actionLabel: '차단 사유 해소',
      resolvedInboxTypes: [],
      createdInboxTypes: ['reorder_due'],
      expectedEntityStates: { 'rr-003': 'open' },
    },
    {
      from: 'stock_risk_blocker_resolved',
      to: 'stock_risk_recommendation_converted',
      actionLabel: '견적 요청 전환',
      resolvedInboxTypes: ['reorder_due'],
      createdInboxTypes: ['quote_response_pending'],
      expectedEntityStates: { 'rr-003': 'converted_to_quote' },
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SCENARIO_REGISTRY: Record<ScenarioId, ScenarioDefinition> = {
  quote_partial_review_required: SCENARIO_QUOTE_PARTIAL_REVIEW,
  po_approved_ready_to_issue: SCENARIO_PO_APPROVED_READY,
  po_issued_ack_pending: SCENARIO_PO_ISSUED_ACK_PENDING,
  receiving_blocked_by_docs_and_quarantine: SCENARIO_RECEIVING_BLOCKED,
  stock_constrained_after_partial_posting: SCENARIO_STOCK_CONSTRAINED,
  expiry_replacement_reorder: SCENARIO_EXPIRY_REPLACEMENT,
  blocked_reorder_budget_or_duplicate: SCENARIO_BLOCKED_REORDER,
};

export const ALL_SCENARIO_IDS: ScenarioId[] = Object.keys(SCENARIO_REGISTRY) as ScenarioId[];

/**
 * 시나리오 ID로 정의를 조회합니다.
 */
export function getScenario(id: ScenarioId): ScenarioDefinition {
  return SCENARIO_REGISTRY[id];
}

/**
 * 주어진 entity ID가 속한 시나리오를 찾습니다.
 */
export function findScenarioByEntityId(entityId: string): ScenarioDefinition | undefined {
  for (const scenario of Object.values(SCENARIO_REGISTRY)) {
    const allIds = [
      ...scenario.entityIds.quoteRequestIds,
      ...scenario.entityIds.quoteResponseIds,
      ...scenario.entityIds.quoteComparisonIds,
      ...scenario.entityIds.purchaseOrderIds,
      ...scenario.entityIds.approvalExecutionIds,
      ...scenario.entityIds.acknowledgementIds,
      ...scenario.entityIds.receivingBatchIds,
      ...scenario.entityIds.stockPositionIds,
      ...scenario.entityIds.reorderRecommendationIds,
      ...scenario.entityIds.expiryActionIds,
      ...scenario.entityIds.lotRiskIds,
    ];
    if (allIds.includes(entityId)) return scenario;
  }
  return undefined;
}

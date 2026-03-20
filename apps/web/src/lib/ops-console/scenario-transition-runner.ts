/**
 * ops-console/scenario-transition-runner.ts
 *
 * Deterministic state transition runner.
 * 데모 액션 클릭 시 상태를 예측 가능하게 변경하고
 * 파생 상태(inbox, list, detail)를 동일 규칙으로 재계산합니다.
 *
 * @module ops-console/scenario-transition-runner
 */

import type { QuoteRequestContract, QuoteResponseContract, QuoteComparisonContract } from '../review-queue/quote-rfq-contract';
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
  InventoryLotRiskContract,
} from '../review-queue/reorder-expiry-stock-risk-contract';
import { buildFullInbox, type UnifiedInboxItem } from './inbox-adapter';
import type { ScenarioId, TransitionStep } from './scenario-registry';
import { SCENARIO_REGISTRY } from './scenario-registry';
import { isoFromNow } from './demo-clock';

// ---------------------------------------------------------------------------
// Entity Graph
// ---------------------------------------------------------------------------

export interface EntityGraph {
  quoteRequests: QuoteRequestContract[];
  quoteResponses: QuoteResponseContract[];
  quoteComparisons: QuoteComparisonContract[];
  purchaseOrders: PurchaseOrderContract[];
  approvalExecutions: ApprovalExecutionContract[];
  acknowledgements: PurchaseOrderAcknowledgementContract[];
  receivingBatches: ReceivingBatchContract[];
  stockPositions: InventoryStockPositionContract[];
  reorderRecommendations: ReorderRecommendationContract[];
  expiryActions: ExpiryActionContract[];
  lotRisks: InventoryLotRiskContract[];
}

// ---------------------------------------------------------------------------
// Transition actions — deterministic state mutations
// ---------------------------------------------------------------------------

export type TransitionAction =
  | { type: 'select_vendor'; quoteRequestId: string; vendorId: string }
  | { type: 'convert_quote_to_po'; quoteRequestId: string }
  | { type: 'issue_po'; poId: string }
  | { type: 'acknowledge_po'; poId: string }
  | { type: 'complete_inspection'; receivingBatchId: string; lineId: string; passed: boolean }
  | { type: 'post_to_inventory'; receivingBatchId: string }
  | { type: 'create_quote_from_reorder'; recommendationId: string }
  | { type: 'complete_expiry_action'; actionId: string }
  | { type: 'resolve_reorder_blocker'; recommendationId: string };

/**
 * Apply a transition action to an entity graph.
 * Returns a NEW graph — does not mutate the input.
 */
export function applyTransition(graph: EntityGraph, action: TransitionAction): EntityGraph {
  const g = cloneGraph(graph);
  const now = new Date().toISOString();

  switch (action.type) {
    case 'select_vendor': {
      g.quoteRequests = g.quoteRequests.map((qr) =>
        qr.id === action.quoteRequestId
          ? { ...qr, status: 'vendor_selected' as const, summary: { ...qr.summary, selectedVendorId: action.vendorId } }
          : qr,
      );
      g.quoteComparisons = g.quoteComparisons.map((qc) =>
        qc.quoteRequestId === action.quoteRequestId
          ? { ...qc, comparisonStatus: 'selected' as const, recommendedVendorId: action.vendorId }
          : qc,
      );
      break;
    }

    case 'convert_quote_to_po': {
      g.quoteRequests = g.quoteRequests.map((qr) =>
        qr.id === action.quoteRequestId
          ? { ...qr, status: 'converted_to_po' as const }
          : qr,
      );
      g.quoteComparisons = g.quoteComparisons.map((qc) =>
        qc.quoteRequestId === action.quoteRequestId
          ? { ...qc, comparisonStatus: 'converted' as const }
          : qc,
      );
      break;
    }

    case 'issue_po': {
      g.purchaseOrders = g.purchaseOrders.map((po) =>
        po.id === action.poId
          ? { ...po, status: 'issued' as const, issuedAt: now }
          : po,
      );
      break;
    }

    case 'acknowledge_po': {
      g.purchaseOrders = g.purchaseOrders.map((po) =>
        po.id === action.poId
          ? { ...po, status: 'acknowledged' as const, acknowledgedAt: now }
          : po,
      );
      g.acknowledgements = g.acknowledgements.map((ack) =>
        ack.poId === action.poId
          ? {
              ...ack,
              status: 'acknowledged' as const,
              acknowledgedAt: now,
              promisedDeliveryAt: isoFromNow(7),
            }
          : ack,
      );
      break;
    }

    case 'complete_inspection': {
      g.receivingBatches = g.receivingBatches.map((rb) => {
        if (rb.id !== action.receivingBatchId) return rb;
        const updatedLines = rb.lineReceipts.map((line) => {
          if (line.id !== action.lineId) return line;
          return {
            ...line,
            inspectionStatus: action.passed ? ('passed' as const) : ('failed' as const),
          };
        });
        const allInspected = updatedLines.every(
          (l) => !l.inspectionRequired || l.inspectionStatus === 'passed' || l.inspectionStatus === 'failed',
        );
        return {
          ...rb,
          lineReceipts: updatedLines,
          status: allInspected ? ('ready_to_post' as const) : rb.status,
        };
      });
      break;
    }

    case 'post_to_inventory': {
      g.receivingBatches = g.receivingBatches.map((rb) =>
        rb.id === action.receivingBatchId
          ? { ...rb, status: 'posted' as const }
          : rb,
      );
      break;
    }

    case 'create_quote_from_reorder': {
      g.reorderRecommendations = g.reorderRecommendations.map((rr) =>
        rr.id === action.recommendationId
          ? { ...rr, status: 'converted_to_quote' as const }
          : rr,
      );
      break;
    }

    case 'complete_expiry_action': {
      g.expiryActions = g.expiryActions.map((ea) =>
        ea.id === action.actionId
          ? { ...ea, status: 'completed' as const, completedAt: now }
          : ea,
      );
      break;
    }

    case 'resolve_reorder_blocker': {
      g.reorderRecommendations = g.reorderRecommendations.map((rr) =>
        rr.id === action.recommendationId
          ? { ...rr, status: 'open' as const, blockedReasons: [] }
          : rr,
      );
      break;
    }
  }

  return g;
}

// ---------------------------------------------------------------------------
// Derived state recalculation
// ---------------------------------------------------------------------------

/**
 * Entity graph에서 unified inbox를 재계산합니다.
 * seed load / action 발생 / scenario reset 시 동일 규칙으로 호출됩니다.
 */
export function recalculateInbox(graph: EntityGraph): UnifiedInboxItem[] {
  return buildFullInbox(
    graph.quoteRequests,
    graph.quoteResponses,
    graph.quoteComparisons,
    graph.purchaseOrders,
    graph.approvalExecutions,
    graph.acknowledgements,
    graph.receivingBatches,
    graph.stockPositions,
    graph.reorderRecommendations,
    graph.expiryActions,
  );
}

/**
 * 시나리오 전이 검증.
 * 현재 inbox에서 기대하는 workType이 존재/부재하는지 확인합니다.
 */
export function validateTransition(
  scenarioId: ScenarioId,
  fromStep: TransitionStep,
  toStep: TransitionStep,
  inbox: UnifiedInboxItem[],
): { valid: boolean; errors: string[] } {
  const scenario = SCENARIO_REGISTRY[scenarioId];
  const transition = scenario.transitions.find(
    (t) => t.from === fromStep && t.to === toStep,
  );

  if (!transition) {
    return { valid: false, errors: [`전이 ${fromStep} → ${toStep}가 정의되지 않음`] };
  }

  const errors: string[] = [];

  // Resolved types should NOT exist
  for (const resolved of transition.resolvedInboxTypes) {
    const found = inbox.filter((i) => i.workType === resolved);
    // Check against scenario entities
    const scenarioEntityIds = [
      ...scenario.entityIds.quoteRequestIds,
      ...scenario.entityIds.purchaseOrderIds,
      ...scenario.entityIds.receivingBatchIds,
      ...scenario.entityIds.stockPositionIds,
      ...scenario.entityIds.reorderRecommendationIds,
      ...scenario.entityIds.expiryActionIds,
    ];
    const scenarioMatches = found.filter((i) => scenarioEntityIds.includes(i.entityId));
    if (scenarioMatches.length > 0) {
      errors.push(`전이 후 ${resolved}가 inbox에 남아 있음 (entity: ${scenarioMatches.map((i) => i.entityId).join(', ')})`);
    }
  }

  // Created types SHOULD exist
  for (const created of transition.createdInboxTypes) {
    const found = inbox.filter((i) => i.workType === created);
    if (found.length === 0) {
      errors.push(`전이 후 ${created}가 inbox에 생성되지 않음`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Graph utilities
// ---------------------------------------------------------------------------

function cloneGraph(graph: EntityGraph): EntityGraph {
  return {
    quoteRequests: graph.quoteRequests.map((qr) => ({ ...qr, items: [...qr.items], summary: { ...qr.summary } })),
    quoteResponses: graph.quoteResponses.map((r) => ({ ...r, responseItems: [...r.responseItems] })),
    quoteComparisons: graph.quoteComparisons.map((c) => ({ ...c, comparableItemRows: [...c.comparableItemRows] })),
    purchaseOrders: graph.purchaseOrders.map((po) => ({ ...po, lines: [...po.lines] })),
    approvalExecutions: graph.approvalExecutions.map((ae) => ({ ...ae, steps: [...ae.steps] })),
    acknowledgements: [...graph.acknowledgements],
    receivingBatches: graph.receivingBatches.map((rb) => ({
      ...rb,
      lineReceipts: rb.lineReceipts.map((lr) => ({ ...lr, lotRecords: [...lr.lotRecords] })),
    })),
    stockPositions: [...graph.stockPositions],
    reorderRecommendations: graph.reorderRecommendations.map((rr) => ({ ...rr, blockedReasons: [...rr.blockedReasons] })),
    expiryActions: [...graph.expiryActions],
    lotRisks: [...graph.lotRisks],
  };
}

/**
 * Seed data에서 초기 entity graph를 만듭니다.
 */
export function buildInitialGraph(
  seedImports: {
    quoteRequests: readonly QuoteRequestContract[];
    quoteResponses: readonly QuoteResponseContract[];
    quoteComparisons: readonly QuoteComparisonContract[];
    purchaseOrders: readonly PurchaseOrderContract[];
    approvalExecutions: readonly ApprovalExecutionContract[];
    acknowledgements: readonly PurchaseOrderAcknowledgementContract[];
    receivingBatches: readonly ReceivingBatchContract[];
    stockPositions: readonly InventoryStockPositionContract[];
    reorderRecommendations: readonly ReorderRecommendationContract[];
    expiryActions: readonly ExpiryActionContract[];
    lotRisks: readonly InventoryLotRiskContract[];
  },
): EntityGraph {
  return {
    quoteRequests: [...seedImports.quoteRequests],
    quoteResponses: [...seedImports.quoteResponses],
    quoteComparisons: [...seedImports.quoteComparisons],
    purchaseOrders: [...seedImports.purchaseOrders],
    approvalExecutions: [...seedImports.approvalExecutions],
    acknowledgements: [...seedImports.acknowledgements],
    receivingBatches: [...seedImports.receivingBatches],
    stockPositions: [...seedImports.stockPositions],
    reorderRecommendations: [...seedImports.reorderRecommendations],
    expiryActions: [...seedImports.expiryActions],
    lotRisks: [...seedImports.lotRisks],
  };
}

/**
 * Entity graph에서 특정 entity를 찾습니다.
 */
export function findEntity(graph: EntityGraph, entityId: string): unknown | undefined {
  const all: { id: string }[] = [
    ...graph.quoteRequests,
    ...graph.quoteResponses,
    ...graph.quoteComparisons,
    ...graph.purchaseOrders,
    ...graph.approvalExecutions,
    ...graph.acknowledgements,
    ...graph.receivingBatches,
    ...graph.stockPositions,
    ...graph.reorderRecommendations,
    ...graph.expiryActions,
    ...graph.lotRisks,
  ];
  return all.find((e) => e.id === entityId);
}

/**
 * ops-console/ops-store.tsx
 *
 * P0 데모용 클라이언트 사이드 상태 저장소.
 * EntityGraph + TransitionRunner 기반으로 deterministic 상태 관리.
 *
 * @module ops-console/ops-store
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

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
} from '../review-queue/reorder-expiry-stock-risk-contract';
import type { OperatorInboxItem } from '../review-queue/operator-console-contract';
import type { UnifiedInboxItem } from './inbox-adapter';
import {
  type EntityGraph,
  buildInitialGraph,
  applyTransition,
  recalculateInbox,
  type TransitionAction,
} from './scenario-transition-runner';
import { resetDemoClock } from './demo-clock';

import {
  ALL_QUOTE_REQUESTS,
  ALL_QUOTE_RESPONSES,
  ALL_QUOTE_COMPARISONS,
  ALL_PURCHASE_ORDERS,
  ALL_APPROVAL_EXECUTIONS,
  ALL_ACKNOWLEDGEMENTS,
  ALL_RECEIVING_BATCHES,
  ALL_STOCK_POSITIONS,
  ALL_REORDER_RECOMMENDATIONS,
  ALL_EXPIRY_ACTIONS,
  ALL_LOT_RISKS,
  INBOX_ITEMS,
  VENDOR_MAP,
} from './seed-data';

// ---------------------------------------------------------------------------
// Initial graph builder
// ---------------------------------------------------------------------------

function createInitialGraph(): EntityGraph {
  return buildInitialGraph({
    quoteRequests: ALL_QUOTE_REQUESTS,
    quoteResponses: ALL_QUOTE_RESPONSES,
    quoteComparisons: ALL_QUOTE_COMPARISONS,
    purchaseOrders: ALL_PURCHASE_ORDERS,
    approvalExecutions: ALL_APPROVAL_EXECUTIONS,
    acknowledgements: ALL_ACKNOWLEDGEMENTS,
    receivingBatches: ALL_RECEIVING_BATCHES,
    stockPositions: ALL_STOCK_POSITIONS,
    reorderRecommendations: ALL_REORDER_RECOMMENDATIONS,
    expiryActions: ALL_EXPIRY_ACTIONS,
    lotRisks: ALL_LOT_RISKS,
  });
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface OpsStore {
  // Data — derived from EntityGraph
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
  inboxItems: OperatorInboxItem[];
  unifiedInboxItems: UnifiedInboxItem[];

  // Entity graph (for direct access)
  graph: EntityGraph;

  // Actions - Quote
  selectVendor: (quoteRequestId: string, vendorId: string) => void;
  convertQuoteToPO: (quoteRequestId: string) => void;

  // Actions - PO
  issuePO: (poId: string) => void;
  acknowledgePO: (poId: string) => void;

  // Actions - Receiving
  recordArrival: (receivingBatchId: string) => void;
  completeInspection: (receivingBatchId: string, lineId: string, passed: boolean) => void;
  postToInventory: (receivingBatchId: string) => void;

  // Actions - Stock Risk
  createQuoteFromReorder: (recommendationId: string) => void;
  completeExpiryAction: (actionId: string) => void;
  resolveReorderBlocker: (recommendationId: string) => void;

  // Refresh & Reset
  refreshInbox: () => void;
  resetToInitial: () => void;

  // Transition dispatch (generic)
  dispatch: (action: TransitionAction) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OpsStoreContext = createContext<OpsStore | null>(null);

// ---------------------------------------------------------------------------
// Legacy inbox generation (for OperatorInboxItem compatibility)
// ---------------------------------------------------------------------------

function generateLegacyInboxItems(
  quoteRequests: QuoteRequestContract[],
  _quoteResponses: QuoteResponseContract[],
  purchaseOrders: PurchaseOrderContract[],
  acknowledgements: PurchaseOrderAcknowledgementContract[],
  receivingBatches: ReceivingBatchContract[],
  stockPositions: InventoryStockPositionContract[],
  reorderRecommendations: ReorderRecommendationContract[],
  _expiryActions: ExpiryActionContract[],
): OperatorInboxItem[] {
  const items: OperatorInboxItem[] = [];
  const now = new Date();

  function hoursSince(iso: string): number {
    return Math.max(0, (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60));
  }

  for (const qr of quoteRequests) {
    if (qr.status === 'partially_responded' || qr.status === 'sent') {
      items.push({
        id: `gen-qr-${qr.id}`,
        itemType: 'request',
        title: `${qr.requestNumber} 공급사 응답 대기`,
        description: `${qr.summary.respondedVendors}/${qr.summary.totalVendors} 공급사 응답`,
        status: 'quote_response_pending',
        priority: qr.priority === 'urgent' ? 'p0' : 'p1',
        ownershipState: 'assigned_to_me',
        createdAt: qr.createdAt,
        dueAt: qr.dueAt,
        slaHours: 72,
        elapsedHours: Math.round(hoursSince(qr.createdAt)),
        isOverdue: new Date(qr.dueAt) < now,
        isBlocked: false,
        sourceContext: {
          type: 'quote_request',
          entityId: qr.id,
          label: qr.requestNumber,
          href: `/dashboard/quotes/${qr.id}`,
        },
        workspaceId: qr.workspaceId,
      });
    }
  }

  for (const po of purchaseOrders) {
    if (po.status === 'approved' || po.status === 'ready_to_issue') {
      items.push({
        id: `gen-po-issue-${po.id}`,
        itemType: 'request',
        title: `${po.poNumber} 발행 대기`,
        description: '승인 완료, 공급사 발행 가능',
        status: 'ready_to_issue',
        priority: 'p1',
        ownershipState: 'assigned_to_me',
        createdAt: po.createdAt,
        slaHours: 8,
        elapsedHours: Math.round(hoursSince(po.createdAt)),
        isOverdue: hoursSince(po.createdAt) > 8,
        isBlocked: false,
        sourceContext: {
          type: 'purchase_order',
          entityId: po.id,
          label: po.poNumber,
          href: `/dashboard/purchase-orders/${po.id}`,
        },
        impactLabel: `${VENDOR_MAP[po.vendorId] ?? po.vendorId} ₩${po.totalAmount.toLocaleString('ko-KR')}`,
        workspaceId: po.workspaceId,
      });
    }

    if (po.status === 'issued') {
      const ack = acknowledgements.find((a) => a.poId === po.id);
      if (!ack || ack.status === 'sent' || ack.status === 'not_sent') {
        items.push({
          id: `gen-po-ack-${po.id}`,
          itemType: 'request',
          title: `${po.poNumber} 공급사 확인 대기`,
          description: `${VENDOR_MAP[po.vendorId] ?? '공급사'} 발주 확인 미응답`,
          status: 'acknowledgement_pending',
          priority: 'p2',
          ownershipState: 'assigned_to_team',
          createdAt: po.issuedAt ?? po.createdAt,
          slaHours: 72,
          elapsedHours: Math.round(hoursSince(po.issuedAt ?? po.createdAt)),
          isOverdue: false,
          isBlocked: false,
          sourceContext: {
            type: 'purchase_order',
            entityId: po.id,
            label: po.poNumber,
            href: `/dashboard/purchase-orders/${po.id}`,
          },
          workspaceId: po.workspaceId,
        });
      }
    }
  }

  for (const rb of receivingBatches) {
    const hasDocMissing = rb.lineReceipts.some(
      (l) => l.documentStatus === 'partial' || l.documentStatus === 'missing',
    );
    const hasQuarantine = rb.lineReceipts.some((l) =>
      l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
    );

    if (hasDocMissing) {
      items.push({
        id: `gen-rb-doc-${rb.id}`,
        itemType: 'document_issue',
        title: `${rb.receivingNumber} 문서 누락`,
        description: '입고 품목 중 필수 문서 미첨부 항목 존재',
        status: 'receiving_doc_missing',
        priority: 'p0',
        ownershipState: 'assigned_to_me',
        createdAt: rb.receivedAt,
        slaHours: 24,
        elapsedHours: Math.round(hoursSince(rb.receivedAt)),
        isOverdue: hoursSince(rb.receivedAt) > 24,
        isBlocked: true,
        blockedReason: '필수 문서 없이 검수 진행 불가',
        sourceContext: {
          type: 'receiving_batch',
          entityId: rb.id,
          label: rb.receivingNumber,
          href: `/dashboard/receiving/${rb.id}`,
        },
        workspaceId: rb.workspaceId,
      });
    }

    if (hasQuarantine) {
      items.push({
        id: `gen-rb-quar-${rb.id}`,
        itemType: 'inventory_action',
        title: `${rb.receivingNumber} 격리 품목`,
        description: '온도 이탈 또는 손상으로 격리 보관 중',
        status: 'receiving_quarantine',
        priority: 'p0',
        ownershipState: 'assigned_to_me',
        createdAt: rb.receivedAt,
        slaHours: 24,
        elapsedHours: Math.round(hoursSince(rb.receivedAt)),
        isOverdue: hoursSince(rb.receivedAt) > 24,
        isBlocked: true,
        blockedReason: '격리 검사 완료 전 출고 불가',
        sourceContext: {
          type: 'receiving_batch',
          entityId: rb.id,
          label: rb.receivingNumber,
          href: `/dashboard/receiving/${rb.id}`,
        },
        workspaceId: rb.workspaceId,
      });
    }

    const hasInspectionPending = rb.lineReceipts.some(
      (l) =>
        l.inspectionRequired &&
        (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
    );

    if ((hasDocMissing || hasQuarantine || hasInspectionPending) && rb.status !== 'posted' && rb.status !== 'closed') {
      items.push({
        id: `gen-rb-post-${rb.id}`,
        itemType: 'inventory_action',
        title: `${rb.receivingNumber} 재고 반영 차단`,
        description: '미해결 이슈로 인해 전체 반영 불가',
        status: 'posting_blocked',
        priority: 'p1',
        ownershipState: 'assigned_to_team',
        createdAt: rb.receivedAt,
        slaHours: 8,
        elapsedHours: Math.round(hoursSince(rb.receivedAt)),
        isOverdue: hoursSince(rb.receivedAt) > 8,
        isBlocked: true,
        blockedReason: '검수 미완료 또는 문서 누락',
        sourceContext: {
          type: 'receiving_batch',
          entityId: rb.id,
          label: rb.receivingNumber,
          href: `/dashboard/receiving/${rb.id}`,
        },
        workspaceId: rb.workspaceId,
      });
    }
  }

  for (const sp of stockPositions) {
    if (sp.riskStatus === 'reorder_due' || sp.riskStatus === 'critical_shortage') {
      items.push({
        id: `gen-sp-reorder-${sp.id}`,
        itemType: 'inventory_action',
        title: `${sp.inventoryItemId} 재주문 필요`,
        description: `가용 ${sp.availableQuantity}${sp.unit} (격리 ${sp.quarantinedQuantity})`,
        status: 'reorder_due',
        priority: sp.riskStatus === 'critical_shortage' ? 'p0' : 'p1',
        ownershipState: 'assigned_to_team',
        createdAt: sp.snapshotAt,
        slaHours: 48,
        elapsedHours: Math.round(hoursSince(sp.snapshotAt)),
        isOverdue: false,
        isBlocked: false,
        sourceContext: {
          type: 'stock_position',
          entityId: sp.id,
          label: `${sp.inventoryItemId} 재고`,
          href: `/dashboard/stock-risk`,
        },
        workspaceId: sp.workspaceId,
      });
    }

    if (sp.riskStatus === 'expiry_risk') {
      items.push({
        id: `gen-sp-expiry-${sp.id}`,
        itemType: 'inventory_action',
        title: `${sp.inventoryItemId} 유효기간 위험`,
        description: '만료 임박 재고 포함',
        status: 'expiry_risk',
        priority: 'p2',
        ownershipState: 'assigned_to_team',
        createdAt: sp.snapshotAt,
        slaHours: 168,
        elapsedHours: Math.round(hoursSince(sp.snapshotAt)),
        isOverdue: false,
        isBlocked: false,
        sourceContext: {
          type: 'stock_position',
          entityId: sp.id,
          label: `${sp.inventoryItemId} 재고`,
          href: `/dashboard/stock-risk`,
        },
        workspaceId: sp.workspaceId,
      });
    }
  }

  for (const rr of reorderRecommendations) {
    if (rr.status === 'blocked') {
      items.push({
        id: `gen-rr-blocked-${rr.id}`,
        itemType: 'budget_risk',
        title: `${rr.inventoryItemId} 재주문 차단`,
        description: rr.blockedReasons.join(' / '),
        status: 'blocked_reorder',
        priority: rr.urgency === 'urgent' ? 'p0' : 'p1',
        ownershipState: 'unassigned',
        createdAt: rr.generatedAt,
        slaHours: 24,
        elapsedHours: Math.round(hoursSince(rr.generatedAt)),
        isOverdue: hoursSince(rr.generatedAt) > 24,
        isBlocked: true,
        blockedReason: rr.blockedReasons.join(' + '),
        sourceContext: {
          type: 'reorder_recommendation',
          entityId: rr.id,
          label: `재주문 추천 ${rr.id.toUpperCase()}`,
          href: `/dashboard/stock-risk`,
        },
        workspaceId: rr.workspaceId,
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface OpsStoreProviderProps {
  children: ReactNode;
}

export function OpsStoreProvider({ children }: OpsStoreProviderProps) {
  const [graph, setGraph] = useState<EntityGraph>(() => createInitialGraph());
  const [inboxItems, setInboxItems] = useState<OperatorInboxItem[]>(
    () => [...INBOX_ITEMS],
  );

  // Derived unified inbox
  const unifiedInboxItems = useMemo(() => recalculateInbox(graph), [graph]);

  // -----------------------------------------------------------------------
  // Core dispatch — all mutations go through here
  // -----------------------------------------------------------------------

  const dispatch = useCallback((action: TransitionAction) => {
    setGraph((prev) => {
      const next = applyTransition(prev, action);
      // Also update legacy inbox
      setInboxItems(
        generateLegacyInboxItems(
          next.quoteRequests,
          next.quoteResponses,
          next.purchaseOrders,
          next.acknowledgements,
          next.receivingBatches,
          next.stockPositions,
          next.reorderRecommendations,
          next.expiryActions,
        ) as OperatorInboxItem[],
      );
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Typed action wrappers
  // -----------------------------------------------------------------------

  const selectVendor = useCallback(
    (quoteRequestId: string, vendorId: string) =>
      dispatch({ type: 'select_vendor', quoteRequestId, vendorId }),
    [dispatch],
  );

  const convertQuoteToPO = useCallback(
    (quoteRequestId: string) =>
      dispatch({ type: 'convert_quote_to_po', quoteRequestId }),
    [dispatch],
  );

  const issuePO = useCallback(
    (poId: string) => dispatch({ type: 'issue_po', poId }),
    [dispatch],
  );

  const acknowledgePO = useCallback(
    (poId: string) => dispatch({ type: 'acknowledge_po', poId }),
    [dispatch],
  );

  const recordArrival = useCallback(
    (receivingBatchId: string) => {
      setGraph((prev) => {
        const next = { ...prev };
        next.receivingBatches = prev.receivingBatches.map((rb) =>
          rb.id === receivingBatchId
            ? { ...rb, status: 'arrived' as const, receivedAt: new Date().toISOString() }
            : rb,
        );
        return next;
      });
    },
    [],
  );

  const completeInspection = useCallback(
    (receivingBatchId: string, lineId: string, passed: boolean) =>
      dispatch({ type: 'complete_inspection', receivingBatchId, lineId, passed }),
    [dispatch],
  );

  const postToInventory = useCallback(
    (receivingBatchId: string) =>
      dispatch({ type: 'post_to_inventory', receivingBatchId }),
    [dispatch],
  );

  const createQuoteFromReorder = useCallback(
    (recommendationId: string) =>
      dispatch({ type: 'create_quote_from_reorder', recommendationId }),
    [dispatch],
  );

  const completeExpiryAction = useCallback(
    (actionId: string) =>
      dispatch({ type: 'complete_expiry_action', actionId }),
    [dispatch],
  );

  const resolveReorderBlocker = useCallback(
    (recommendationId: string) =>
      dispatch({ type: 'resolve_reorder_blocker', recommendationId }),
    [dispatch],
  );

  const refreshInbox = useCallback(() => {
    // Force recalculation by triggering graph identity change
    setGraph((prev) => ({ ...prev }));
  }, []);

  const resetToInitial = useCallback(() => {
    resetDemoClock();
    setGraph(createInitialGraph());
    setInboxItems([...INBOX_ITEMS] as OperatorInboxItem[]);
  }, []);

  // -----------------------------------------------------------------------
  // Memoized store value
  // -----------------------------------------------------------------------

  const store = useMemo<OpsStore>(
    () => ({
      quoteRequests: graph.quoteRequests,
      quoteResponses: graph.quoteResponses,
      quoteComparisons: graph.quoteComparisons,
      purchaseOrders: graph.purchaseOrders,
      approvalExecutions: graph.approvalExecutions,
      acknowledgements: graph.acknowledgements,
      receivingBatches: graph.receivingBatches,
      stockPositions: graph.stockPositions,
      reorderRecommendations: graph.reorderRecommendations,
      expiryActions: graph.expiryActions,
      inboxItems: Array.isArray(inboxItems) ? inboxItems : [],
      unifiedInboxItems,
      graph,
      selectVendor,
      convertQuoteToPO,
      issuePO,
      acknowledgePO,
      recordArrival,
      completeInspection,
      postToInventory,
      createQuoteFromReorder,
      completeExpiryAction,
      resolveReorderBlocker,
      refreshInbox,
      resetToInitial,
      dispatch,
    }),
    [
      graph, inboxItems, unifiedInboxItems,
      selectVendor, convertQuoteToPO, issuePO, acknowledgePO,
      recordArrival, completeInspection, postToInventory,
      createQuoteFromReorder, completeExpiryAction, resolveReorderBlocker,
      refreshInbox, resetToInitial, dispatch,
    ],
  );

  return (
    <OpsStoreContext.Provider value={store}>
      {children}
    </OpsStoreContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOpsStore(): OpsStore {
  const store = useContext(OpsStoreContext);
  if (!store) {
    throw new Error('useOpsStore must be used within <OpsStoreProvider>');
  }
  return store;
}

/**
 * Safe variant — returns null when rendered outside OpsStoreProvider.
 * Use in shared components (e.g. DashboardSidebar) that may appear on
 * pages outside the dashboard layout.
 */
export function useOpsStoreSafe(): OpsStore | null {
  return useContext(OpsStoreContext);
}

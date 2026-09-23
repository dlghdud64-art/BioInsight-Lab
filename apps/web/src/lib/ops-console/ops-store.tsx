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
  /**
   * §inbound-quarantine-temp-exclude (P2): 입고 라인에 필수문서 첨부.
   * 필수세트(COA+MSDS) 충족 시 documentStatus가 complete로 전이(게이트 실제 해제).
   */
  attachReceivingDocument: (
    receivingBatchId: string,
    lineId: string,
    docType: 'coa' | 'msds' | 'validation' | 'warranty',
    lotId?: string,
  ) => void;

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
// Provider
// ---------------------------------------------------------------------------

interface OpsStoreProviderProps {
  children: ReactNode;
}

export function OpsStoreProvider({ children }: OpsStoreProviderProps) {
  const [graph, setGraph] = useState<EntityGraph>(() => createInitialGraph());

  // Derived unified inbox
  const unifiedInboxItems = useMemo(() => recalculateInbox(graph), [graph]);

  // -----------------------------------------------------------------------
  // Core dispatch — all mutations go through here
  // -----------------------------------------------------------------------

  const dispatch = useCallback((action: TransitionAction) => {
    setGraph((prev) => {
      const next = applyTransition(prev, action);
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

  const attachReceivingDocument = useCallback(
    (
      receivingBatchId: string,
      lineId: string,
      docType: 'coa' | 'msds' | 'validation' | 'warranty',
      lotId?: string,
    ) => dispatch({ type: 'attach_receiving_document', receivingBatchId, lineId, docType, lotId }),
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
      unifiedInboxItems,
      graph,
      selectVendor,
      convertQuoteToPO,
      issuePO,
      acknowledgePO,
      recordArrival,
      completeInspection,
      postToInventory,
      attachReceivingDocument,
      createQuoteFromReorder,
      completeExpiryAction,
      resolveReorderBlocker,
      refreshInbox,
      resetToInitial,
      dispatch,
    }),
    [
      graph, unifiedInboxItems,
      selectVendor, convertQuoteToPO, issuePO, acknowledgePO,
      recordArrival, completeInspection, postToInventory, attachReceivingDocument,
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

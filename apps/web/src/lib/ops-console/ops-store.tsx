/**
 * ops-console/ops-store.ts
 *
 * P0 데모용 클라이언트 사이드 상태 저장소.
 * React Context + useState 패턴으로 외부 라이브러리 없이 구현.
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
import { buildFullInbox, type UnifiedInboxItem } from './inbox-adapter';

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
  INBOX_ITEMS,
  VENDOR_MAP,
} from './seed-data';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface OpsStore {
  // Data
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

  // Refresh
  refreshInbox: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OpsStoreContext = createContext<OpsStore | null>(null);

// ---------------------------------------------------------------------------
// Inbox regeneration
// ---------------------------------------------------------------------------

function generateInboxItems(
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

  // Quote requests with pending responses
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

  // POs: approved -> ready to issue
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

    // POs: issued, ack pending
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

  // Receiving: doc issues + quarantine + posting
  for (const rb of receivingBatches) {
    const hasDocMissing = rb.lineReceipts.some(
      (l) => l.documentStatus === 'partial' || l.documentStatus === 'missing',
    );
    const hasQuarantine = rb.lineReceipts.some((l) =>
      l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
    );
    const hasInspectionPending = rb.lineReceipts.some(
      (l) =>
        l.inspectionRequired &&
        (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
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

  // Stock positions: reorder due / expiry risk
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
          href: `/dashboard/inventory/${sp.id}`,
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
          href: `/dashboard/inventory/${sp.id}`,
        },
        workspaceId: sp.workspaceId,
      });
    }
  }

  // Blocked reorder recommendations
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
          href: `/dashboard/inventory/reorder/${rr.id}`,
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
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequestContract[]>(
    () => [...ALL_QUOTE_REQUESTS],
  );
  const [quoteResponses, setQuoteResponses] = useState<QuoteResponseContract[]>(
    () => [...ALL_QUOTE_RESPONSES],
  );
  const [quoteComparisons, setQuoteComparisons] = useState<QuoteComparisonContract[]>(
    () => [...ALL_QUOTE_COMPARISONS],
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderContract[]>(
    () => [...ALL_PURCHASE_ORDERS],
  );
  const [approvalExecutions, setApprovalExecutions] = useState<ApprovalExecutionContract[]>(
    () => [...ALL_APPROVAL_EXECUTIONS],
  );
  const [acknowledgements, setAcknowledgements] = useState<PurchaseOrderAcknowledgementContract[]>(
    () => [...ALL_ACKNOWLEDGEMENTS],
  );
  const [receivingBatches, setReceivingBatches] = useState<ReceivingBatchContract[]>(
    () => [...ALL_RECEIVING_BATCHES],
  );
  const [stockPositions, setStockPositions] = useState<InventoryStockPositionContract[]>(
    () => [...ALL_STOCK_POSITIONS],
  );
  const [reorderRecommendations, setReorderRecommendations] = useState<ReorderRecommendationContract[]>(
    () => [...ALL_REORDER_RECOMMENDATIONS],
  );
  const [expiryActions, setExpiryActions] = useState<ExpiryActionContract[]>(
    () => [...ALL_EXPIRY_ACTIONS],
  );
  const [inboxItems, setInboxItems] = useState<OperatorInboxItem[]>(
    () => [...INBOX_ITEMS],
  );
  const [unifiedInboxItems, setUnifiedInboxItems] = useState<UnifiedInboxItem[]>(
    () =>
      buildFullInbox(
        [...ALL_QUOTE_REQUESTS],
        [...ALL_QUOTE_RESPONSES],
        [...ALL_QUOTE_COMPARISONS],
        [...ALL_PURCHASE_ORDERS],
        [...ALL_APPROVAL_EXECUTIONS],
        [...ALL_ACKNOWLEDGEMENTS],
        [...ALL_RECEIVING_BATCHES],
        [...ALL_STOCK_POSITIONS],
        [...ALL_REORDER_RECOMMENDATIONS],
        [...ALL_EXPIRY_ACTIONS],
      ),
  );

  // -----------------------------------------------------------------------
  // refreshInbox
  // -----------------------------------------------------------------------

  const doRefreshInbox = useCallback(
    (
      qr: QuoteRequestContract[],
      qresp: QuoteResponseContract[],
      pos: PurchaseOrderContract[],
      acks: PurchaseOrderAcknowledgementContract[],
      rbs: ReceivingBatchContract[],
      sps: InventoryStockPositionContract[],
      rrs: ReorderRecommendationContract[],
      eas: ExpiryActionContract[],
      qcs: QuoteComparisonContract[],
      aes: ApprovalExecutionContract[],
    ) => {
      setInboxItems(generateInboxItems(qr, qresp, pos, acks, rbs, sps, rrs, eas));
      setUnifiedInboxItems(buildFullInbox(qr, qresp, qcs, pos, aes, acks, rbs, sps, rrs, eas));
    },
    [],
  );

  const refreshInbox = useCallback(() => {
    doRefreshInbox(
      quoteRequests,
      quoteResponses,
      purchaseOrders,
      acknowledgements,
      receivingBatches,
      stockPositions,
      reorderRecommendations,
      expiryActions,
      quoteComparisons,
      approvalExecutions,
    );
  }, [
    quoteRequests, quoteResponses, purchaseOrders, acknowledgements,
    receivingBatches, stockPositions, reorderRecommendations, expiryActions,
    quoteComparisons, approvalExecutions,
    doRefreshInbox,
  ]);

  // -----------------------------------------------------------------------
  // Quote actions
  // -----------------------------------------------------------------------

  const selectVendor = useCallback((quoteRequestId: string, vendorId: string) => {
    setQuoteRequests((prev) =>
      prev.map((qr) =>
        qr.id === quoteRequestId
          ? { ...qr, status: 'vendor_selected' as const, summary: { ...qr.summary, selectedVendorId: vendorId } }
          : qr,
      ),
    );
    setQuoteComparisons((prev) =>
      prev.map((qc) =>
        qc.quoteRequestId === quoteRequestId
          ? { ...qc, comparisonStatus: 'selected' as const, recommendedVendorId: vendorId }
          : qc,
      ),
    );
  }, []);

  const convertQuoteToPO = useCallback((quoteRequestId: string) => {
    setQuoteRequests((prev) =>
      prev.map((qr) =>
        qr.id === quoteRequestId
          ? { ...qr, status: 'converted_to_po' as const }
          : qr,
      ),
    );
    setQuoteComparisons((prev) =>
      prev.map((qc) =>
        qc.quoteRequestId === quoteRequestId
          ? { ...qc, comparisonStatus: 'converted' as const }
          : qc,
      ),
    );
  }, []);

  // -----------------------------------------------------------------------
  // PO actions
  // -----------------------------------------------------------------------

  const issuePO = useCallback((poId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.id === poId
          ? { ...po, status: 'issued' as const, issuedAt: new Date().toISOString() }
          : po,
      ),
    );
  }, []);

  const acknowledgePO = useCallback((poId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.id === poId
          ? { ...po, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() }
          : po,
      ),
    );
    setAcknowledgements((prev) =>
      prev.map((ack) =>
        ack.poId === poId
          ? {
              ...ack,
              status: 'acknowledged' as const,
              acknowledgedAt: new Date().toISOString(),
              promisedDeliveryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }
          : ack,
      ),
    );
  }, []);

  // -----------------------------------------------------------------------
  // Receiving actions
  // -----------------------------------------------------------------------

  const recordArrival = useCallback((receivingBatchId: string) => {
    setReceivingBatches((prev) =>
      prev.map((rb) =>
        rb.id === receivingBatchId
          ? { ...rb, status: 'arrived' as const, receivedAt: new Date().toISOString() }
          : rb,
      ),
    );
  }, []);

  const completeInspection = useCallback(
    (receivingBatchId: string, lineId: string, passed: boolean) => {
      setReceivingBatches((prev) =>
        prev.map((rb) => {
          if (rb.id !== receivingBatchId) return rb;
          const updatedLines = rb.lineReceipts.map((line) => {
            if (line.id !== lineId) return line;
            return {
              ...line,
              inspectionStatus: passed ? ('passed' as const) : ('failed' as const),
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
        }),
      );
    },
    [],
  );

  const postToInventory = useCallback((receivingBatchId: string) => {
    setReceivingBatches((prev) =>
      prev.map((rb) =>
        rb.id === receivingBatchId
          ? { ...rb, status: 'posted' as const }
          : rb,
      ),
    );
  }, []);

  // -----------------------------------------------------------------------
  // Stock Risk actions
  // -----------------------------------------------------------------------

  const createQuoteFromReorder = useCallback((recommendationId: string) => {
    setReorderRecommendations((prev) =>
      prev.map((rr) =>
        rr.id === recommendationId
          ? { ...rr, status: 'converted_to_quote' as const }
          : rr,
      ),
    );
  }, []);

  const completeExpiryAction = useCallback((actionId: string) => {
    setExpiryActions((prev) =>
      prev.map((ea) =>
        ea.id === actionId
          ? { ...ea, status: 'completed' as const, completedAt: new Date().toISOString() }
          : ea,
      ),
    );
  }, []);

  // -----------------------------------------------------------------------
  // Memoized store value
  // -----------------------------------------------------------------------

  const store = useMemo<OpsStore>(
    () => ({
      quoteRequests,
      quoteResponses,
      quoteComparisons,
      purchaseOrders,
      approvalExecutions,
      acknowledgements,
      receivingBatches,
      stockPositions,
      reorderRecommendations,
      expiryActions,
      inboxItems,
      unifiedInboxItems,
      selectVendor,
      convertQuoteToPO,
      issuePO,
      acknowledgePO,
      recordArrival,
      completeInspection,
      postToInventory,
      createQuoteFromReorder,
      completeExpiryAction,
      refreshInbox,
    }),
    [
      quoteRequests, quoteResponses, quoteComparisons,
      purchaseOrders, approvalExecutions, acknowledgements,
      receivingBatches, stockPositions, reorderRecommendations,
      expiryActions, inboxItems, unifiedInboxItems,
      selectVendor, convertQuoteToPO, issuePO, acknowledgePO,
      recordArrival, completeInspection, postToInventory,
      createQuoteFromReorder, completeExpiryAction, refreshInbox,
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

/**
 * backend-contract-alignment.ts
 *
 * Backend Contract Alignment / API Integration Plan.
 * UI operational semantics → backend resource model → read/write contract
 * → idempotent mutation → linked entity handoff → cache/recalculation strategy
 *
 * 이 파일은 런타임 코드가 아니라 구현 참조용 설계 문서.
 *
 * @module ops-console/backend-contract-alignment
 */

// ===========================================================================
// 1. Backend Resource Model ↔ Frontend Contract Mapping
// ===========================================================================

/**
 * Resource-to-Contract Mapping Table.
 * backend resource → frontend contract/view-model input → transform rules
 */
export const RESOURCE_CONTRACT_MAP = {
  // ── Quote Domain ──────────────────────────────────────────────
  quotes: {
    backendResource: 'quotes',
    frontendContract: 'QuoteRequestContract',
    primaryFields: ['id', 'requestNumber', 'status', 'vendorIds', 'dueAt', 'createdAt', 'sourceType'],
    linkageFields: ['linkedInventoryItemId', 'linkedProjectId'],
    versionFields: ['version', 'updatedAt'],
    transformRules: 'Direct mapping; status enum must match contract',
  },
  quoteResponses: {
    backendResource: 'quote_vendor_responses + quote_response_items',
    frontendContract: 'QuoteResponseContract',
    primaryFields: ['id', 'quoteRequestId', 'vendorId', 'responseStatus', 'respondedAt'],
    linkageFields: ['responseItems[].substituteOffered', 'responseItems[].matchesRequested'],
    versionFields: ['updatedAt'],
    transformRules: 'Flatten response items into contract; compute substituteOffered flag',
  },
  quoteComparisons: {
    backendResource: 'quote_comparisons + comparison_rows',
    frontendContract: 'QuoteComparisonContract',
    primaryFields: ['id', 'quoteRequestId', 'comparisonStatus', 'recommendedVendorId'],
    linkageFields: ['comparableItemRows[].requiresReview', 'missingResponses'],
    versionFields: ['updatedAt'],
    transformRules: 'Aggregate row-level review flags; compute missingResponses from response coverage',
  },

  // ── PO Domain ─────────────────────────────────────────────────
  purchaseOrders: {
    backendResource: 'purchase_orders + po_lines',
    frontendContract: 'PurchaseOrderContract',
    primaryFields: ['id', 'poNumber', 'status', 'ownerId', 'requiredByAt', 'issuedAt'],
    linkageFields: ['sourceQuoteId', 'sourceComparisonId', 'vendorId'],
    versionFields: ['version', 'updatedAt'],
    transformRules: 'Status enum mapping; compute totalAmount from lines',
  },
  approvalExecutions: {
    backendResource: 'approval_executions + approval_steps + approval_decisions',
    frontendContract: 'ApprovalExecutionContract',
    primaryFields: ['id', 'entityType', 'entityId', 'status', 'steps[]'],
    linkageFields: ['steps[].approverIds', 'steps[].decisions[]'],
    versionFields: ['updatedAt'],
    transformRules: 'Flatten step hierarchy; compute current active step',
  },
  acknowledgements: {
    backendResource: 'po_acknowledgements + po_ack_lines',
    frontendContract: 'PurchaseOrderAcknowledgementContract',
    primaryFields: ['id', 'poId', 'status', 'promisedDeliveryAt'],
    linkageFields: ['lineAcknowledgements[].ackLineStatus'],
    versionFields: ['updatedAt'],
    transformRules: 'Flatten line ack data; compute partial/issue flags',
  },

  // ── Receiving Domain ──────────────────────────────────────────
  receivingBatches: {
    backendResource: 'receiving_batches + receiving_line_receipts + lot_records',
    frontendContract: 'ReceivingBatchContract',
    primaryFields: ['id', 'receivingNumber', 'status', 'vendorId', 'receivedAt', 'receivedBy'],
    linkageFields: ['poId', 'lineReceipts[].poLineId', 'lineReceipts[].lotRecords[].inventoryPostingId'],
    versionFields: ['version', 'updatedAt'],
    transformRules: 'Deep join lines→lots; compute doc/inspection/quarantine flags from lot records',
  },

  // ── Stock Risk Domain ─────────────────────────────────────────
  stockPositions: {
    backendResource: 'stock_positions + stock_lot_risks',
    frontendContract: 'InventoryStockPositionContract',
    primaryFields: ['id', 'inventoryItemId', 'riskStatus', 'availableQuantity', 'quarantinedQuantity'],
    linkageFields: ['incomingReceivingBatchIds', 'linkedReorderIds'],
    versionFields: ['snapshotAt'],
    transformRules: 'Compute riskStatus from lot-level signals; aggregate quantities',
  },
  reorderRecommendations: {
    backendResource: 'reorder_recommendations',
    frontendContract: 'ReorderRecommendationContract',
    primaryFields: ['id', 'inventoryItemId', 'status', 'urgency', 'blockedReasons'],
    linkageFields: ['supportingStockPositionId', 'linkedQuoteRequestId'],
    versionFields: ['generatedAt', 'updatedAt'],
    transformRules: 'Direct mapping; blockedReasons as string array',
  },
  expiryActions: {
    backendResource: 'expiry_actions',
    frontendContract: 'ExpiryActionContract',
    primaryFields: ['id', 'inventoryItemId', 'actionType', 'status', 'dueAt', 'daysToExpiry'],
    linkageFields: ['ownerId'],
    versionFields: ['triggeredAt', 'updatedAt'],
    transformRules: 'Direct mapping',
  },
} as const;

// ===========================================================================
// 2. Read Endpoint Matrix
// ===========================================================================

export const READ_ENDPOINT_MATRIX = [
  {
    route: '/dashboard (Today Hub)',
    endpoint: 'GET /api/ops/dashboard/today',
    responseShape: 'TodayHeaderStats + TopPriorityQueue + OwnerWorkloads + BlockerSection + ReadyActions + RecoveryEntries',
    fallback: 'Partial render; empty sections OK; show "loading" per section',
  },
  {
    route: '/dashboard/inbox',
    endpoint: 'GET /api/ops/inbox?module=&filter=&owner=&due=',
    responseShape: 'UnifiedInboxItem[]',
    fallback: 'Empty state with guided first action',
  },
  {
    route: '/dashboard/quotes (Landing)',
    endpoint: 'GET /api/ops/modules/quotes/summary',
    responseShape: 'ModuleHeaderStats + PriorityQueue + BucketedItems + Downstream',
    fallback: 'Empty state: "견적에서 시작하세요"',
  },
  {
    route: '/dashboard/quotes/:id',
    endpoint: 'GET /api/ops/quotes/:id/execution',
    responseShape: 'QuoteRequestContract + QuoteResponseContract[] + QuoteComparisonContract + EntityOperationalState',
    fallback: 'Header renders; degraded comparison panel; "비교 데이터 로드 중"',
  },
  {
    route: '/dashboard/purchase-orders (Landing)',
    endpoint: 'GET /api/ops/modules/po/summary',
    responseShape: 'ModuleHeaderStats + PriorityQueue + BucketedItems + Downstream',
    fallback: 'Empty state: "발주에서 시작하세요"',
  },
  {
    route: '/dashboard/purchase-orders/:id',
    endpoint: 'GET /api/ops/po/:id/execution',
    responseShape: 'POExecutionModel (po + approval + ack + lines unified)',
    fallback: 'Header renders; degraded approval/ack panels',
  },
  {
    route: '/dashboard/receiving (Landing)',
    endpoint: 'GET /api/ops/modules/receiving/summary',
    responseShape: 'ModuleHeaderStats + PriorityQueue + BucketedItems + Downstream',
    fallback: 'Empty state: "입고 대기 없음"',
  },
  {
    route: '/dashboard/receiving/:id',
    endpoint: 'GET /api/ops/receiving/:id/execution',
    responseShape: 'ReceivingExecutionModel (batch + lines + lots + inspection unified)',
    fallback: 'Header renders; degraded line/lot tables',
  },
  {
    route: '/dashboard/stock-risk',
    endpoint: 'GET /api/ops/modules/stock-risk/summary',
    responseShape: 'ModuleHeaderStats + PriorityQueue + BucketedItems + Recovery',
    fallback: 'Empty state: "재고 위험 없음"',
  },
] as const;

// ===========================================================================
// 3. Mutation Command Matrix
// ===========================================================================

export const MUTATION_COMMAND_MATRIX = [
  {
    action: 'select_quote_vendor',
    endpoint: 'POST /api/ops/quotes/:id/select-vendor',
    request: '{ vendorId, responseId, selectionReason? }',
    successResponse: '{ quoteId, updatedStatus, vendorName }',
    idempotency: 'Not required — selecting same vendor is no-op',
    invalidationScope: ['quote_detail', 'quotes_landing', 'inbox', 'dashboard'],
    conflictHandling: 'Stale check on quote version; 409 if already selected different vendor',
  },
  {
    action: 'create_po_from_quote',
    endpoint: 'POST /api/ops/quotes/:id/create-po',
    request: '{ idempotencyKey, lineOverrides?, shipTo?, billTo?, paymentTerms? }',
    successResponse: '{ poId, poNumber, poRoute }',
    idempotency: 'Required — idempotencyKey prevents duplicate PO',
    invalidationScope: ['quote_detail', 'po_landing', 'inbox', 'dashboard'],
    conflictHandling: 'Duplicate key returns existing PO id; stale quote version → 409',
  },
  {
    action: 'submit_po_issue',
    endpoint: 'POST /api/ops/po/:id/issue',
    request: '{ idempotencyKey, issuedBy? }',
    successResponse: '{ poId, issuedAt, status: "issued" }',
    idempotency: 'Required — prevents double issue',
    invalidationScope: ['po_detail', 'po_landing', 'inbox', 'dashboard'],
    conflictHandling: 'Already issued → returns existing state; approval not complete → 422',
  },
  {
    action: 'record_vendor_acknowledgement',
    endpoint: 'POST /api/ops/po/:id/acknowledgement',
    request: '{ status, promisedDeliveryAt?, lineAcks[]? }',
    successResponse: '{ ackId, poId, status }',
    idempotency: 'Not required — upsert semantics',
    invalidationScope: ['po_detail', 'po_landing', 'inbox', 'dashboard'],
    conflictHandling: 'Upsert; no conflict expected',
  },
  {
    action: 'complete_receiving_inspection',
    endpoint: 'POST /api/ops/receiving/:id/inspection/:lineId/complete',
    request: '{ passed: boolean, notes?, reinspectRequired? }',
    successResponse: '{ lineId, inspectionStatus, postingReadiness }',
    idempotency: 'Not required — idempotent by nature',
    invalidationScope: ['receiving_detail', 'receiving_landing', 'inbox', 'dashboard'],
    conflictHandling: 'Already completed → return current status',
  },
  {
    action: 'post_inventory_inbound',
    endpoint: 'POST /api/ops/receiving/:id/post',
    request: '{ idempotencyKey, postAll?: boolean, lineIds?: string[] }',
    successResponse: '{ postingId, postedLineCount, stockRiskRecalcRequired }',
    idempotency: 'Required — prevents duplicate posting',
    invalidationScope: ['receiving_detail', 'receiving_landing', 'stock_risk', 'inbox', 'dashboard'],
    conflictHandling: 'Already posted → return existing posting; partial → return partial result',
  },
  {
    action: 'create_quote_from_reorder',
    endpoint: 'POST /api/ops/stock-risk/reorder/:id/create-quote',
    request: '{ idempotencyKey, vendorHints?, itemHints?, urgency? }',
    successResponse: '{ quoteId, quoteNumber, quoteRoute }',
    idempotency: 'Required — prevents duplicate quote from same reorder',
    invalidationScope: ['stock_risk_detail', 'quotes_landing', 'inbox', 'dashboard', 'recovery'],
    conflictHandling: 'Duplicate key returns existing quote; already converted → return linked quote',
  },
] as const;

// ===========================================================================
// 4. UI Semantics ↔ Backend Status Mapping
// ===========================================================================

export const QUOTE_STATUS_MAPPING = {
  backend_statuses: ['draft', 'sent', 'partially_responded', 'responded', 'comparison_ready', 'vendor_selected', 'converted_to_po', 'cancelled', 'expired'],
  frontend_semantics: {
    ready: '(comparison_ready OR responded) + comparison exists + no review blockers',
    needs_review: '(comparison_ready OR responded) + has review items OR substitutes',
    waiting_external: 'sent OR partially_responded',
    handoff_ready: 'vendor_selected + not converted',
    blocked: 'N/A for quotes (no hard blockers, only review gates)',
    terminal: 'converted_to_po OR cancelled OR expired',
  },
} as const;

export const PO_STATUS_MAPPING = {
  backend_statuses: ['draft', 'pending_approval', 'approval_in_progress', 'approved', 'ready_to_issue', 'issued', 'acknowledged', 'partially_received', 'fully_received', 'cancelled', 'closed'],
  frontend_semantics: {
    ready: '(approved OR ready_to_issue) + issue blockers clear',
    needs_review: 'ack received + line issues (backorder/substitute)',
    waiting_external: 'issued + ack pending',
    handoff_ready: 'acknowledged + delivery context → receiving handoff',
    blocked: 'pending_approval OR approval_in_progress (issue blocked)',
    terminal: 'cancelled OR closed',
  },
} as const;

export const RECEIVING_STATUS_MAPPING = {
  backend_statuses: ['expected', 'arrived', 'inspection_in_progress', 'ready_to_post', 'partially_posted', 'posted', 'issue_flagged', 'closed', 'cancelled'],
  frontend_semantics: {
    ready: 'no doc missing + no quarantine + no inspection pending + not posted',
    needs_review: 'inspection pending (review_gate severity)',
    waiting_external: 'docs missing (external resend)',
    handoff_ready: 'posted → stock risk handoff',
    blocked: 'quarantine active OR docs missing with posting impact',
    terminal: 'closed OR cancelled',
  },
} as const;

export const STOCK_RISK_STATUS_MAPPING = {
  backend_statuses: ['open', 'review_required', 'blocked', 'converted_to_quote', 'converted_to_po', 'dismissed'],
  frontend_semantics: {
    ready: 'open + not blocked + no duplicate flow',
    needs_review: 'review_required OR budget near threshold',
    waiting_external: 'vendor availability follow-up',
    handoff_ready: 'converted_to_quote OR converted_to_po → sourcing handoff',
    blocked: 'blocked (budget/duplicate/policy)',
    terminal: 'dismissed',
  },
} as const;

// ===========================================================================
// 5. Repository Interface
// ===========================================================================

/**
 * Repository 인터페이스 정의.
 * screen이 직접 여러 repository를 난사하지 않도록 조정.
 */
export interface RepositoryInterfaces {
  DashboardRepository: {
    getTodaySummary(): Promise<unknown>;
  };
  InboxRepository: {
    getInboxItems(filter: unknown): Promise<unknown[]>;
    getInboxSummaryStats(): Promise<unknown>;
  };
  QuoteRepository: {
    getQuoteList(filter: unknown): Promise<unknown[]>;
    getQuoteDetail(id: string): Promise<unknown>;
    getQuoteModuleSummary(): Promise<unknown>;
    selectVendor(id: string, payload: unknown): Promise<unknown>;
    createPOFromQuote(id: string, payload: unknown): Promise<unknown>;
  };
  PurchaseOrderRepository: {
    getPOList(filter: unknown): Promise<unknown[]>;
    getPODetail(id: string): Promise<unknown>;
    getPOModuleSummary(): Promise<unknown>;
    submitIssue(id: string, payload: unknown): Promise<unknown>;
    recordAck(id: string, payload: unknown): Promise<unknown>;
  };
  ReceivingRepository: {
    getReceivingList(filter: unknown): Promise<unknown[]>;
    getReceivingDetail(id: string): Promise<unknown>;
    getReceivingModuleSummary(): Promise<unknown>;
    completeInspection(batchId: string, lineId: string, payload: unknown): Promise<unknown>;
    postInventory(id: string, payload: unknown): Promise<unknown>;
  };
  StockRiskRepository: {
    getStockRiskSummary(): Promise<unknown>;
    getStockRiskDetail(id: string): Promise<unknown>;
    createQuoteFromReorder(recommendationId: string, payload: unknown): Promise<unknown>;
  };
}

// ===========================================================================
// 6. Cache/Invalidation Plan
// ===========================================================================

export const INVALIDATION_PLAN: Record<string, string[]> = {
  select_quote_vendor: ['quote_detail', 'quotes_landing', 'inbox', 'dashboard', 'po_handoff_preview'],
  create_po_from_quote: ['quote_detail', 'po_landing', 'inbox', 'dashboard'],
  submit_po_issue: ['po_detail', 'po_landing', 'inbox', 'dashboard', 'receiving_handoff_preview'],
  record_vendor_ack: ['po_detail', 'po_landing', 'inbox', 'dashboard'],
  complete_inspection: ['receiving_detail', 'receiving_landing', 'inbox', 'dashboard'],
  post_inventory: ['receiving_detail', 'receiving_landing', 'stock_risk', 'inbox', 'dashboard'],
  create_quote_from_reorder: ['stock_risk_detail', 'quotes_landing', 'inbox', 'dashboard', 'recovery_summary'],
};

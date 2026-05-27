/**
 * db-event-audit-plan.ts
 *
 * DB Schema / Event Flow / Audit Log Alignment Plan.
 * command accepted → entity state persisted → domain event emitted
 * → downstream aggregate recalculated → audit trail recorded → linked handoff preserved
 *
 * 이 파일은 런타임 코드가 아니라 구현 참조용 설계 문서.
 *
 * @module ops-console/db-event-audit-plan
 */

// ===========================================================================
// 1. Entity Table Matrix
// ===========================================================================

export const ENTITY_TABLE_MATRIX = [
  // ── Quote Domain ──────────────────────────────────────────────
  {
    table: 'quotes',
    purpose: '견적 요청 헤더',
    primaryFields: ['id', 'workspaceId', 'requestNumber', 'status', 'sourceType', 'dueAt', 'createdBy', 'ownerId'],
    foreignKeys: ['workspaceId → workspaces.id'],
    versionFields: ['version', 'createdAt', 'updatedAt'],
    notes: 'status enum = draft|sent|partially_responded|responded|comparison_ready|vendor_selected|converted_to_po|cancelled|expired',
  },
  {
    table: 'quote_request_items',
    purpose: '견적 요청 품목',
    primaryFields: ['id', 'quoteId', 'productName', 'catalogNumber', 'quantity', 'unit', 'specifications'],
    foreignKeys: ['quoteId → quotes.id', 'linkedInventoryItemId → inventory_items.id (nullable)'],
    versionFields: ['createdAt'],
    notes: '검색/재진입 시 item hint 역할',
  },
  {
    table: 'quote_vendor_responses',
    purpose: '공급사별 응답 헤더',
    primaryFields: ['id', 'quoteId', 'vendorId', 'responseStatus', 'respondedAt', 'expiresAt'],
    foreignKeys: ['quoteId → quotes.id'],
    versionFields: ['updatedAt'],
    notes: 'responseStatus = pending|responded|incomplete|declined|expired',
  },
  {
    table: 'quote_response_items',
    purpose: '공급사 응답 품목별 상세',
    primaryFields: ['id', 'responseId', 'requestItemId', 'unitPrice', 'leadTimeDays', 'substituteOffered', 'substituteDescription'],
    foreignKeys: ['responseId → quote_vendor_responses.id', 'requestItemId → quote_request_items.id'],
    versionFields: [],
    notes: 'substituteOffered flag → review_gate trigger',
  },
  {
    table: 'quote_comparisons',
    purpose: '비교 요약',
    primaryFields: ['id', 'quoteId', 'comparisonStatus', 'recommendedVendorId', 'selectedVendorId', 'selectedResponseId'],
    foreignKeys: ['quoteId → quotes.id'],
    versionFields: ['createdAt', 'updatedAt'],
    notes: 'selectedVendorId + selectedResponseId → PO 생성 시 lineage',
  },
  {
    table: 'quote_comparison_rows',
    purpose: '비교 행별 상세',
    primaryFields: ['id', 'comparisonId', 'requestItemId', 'requiresReview', 'reviewReason', 'bestVendorId'],
    foreignKeys: ['comparisonId → quote_comparisons.id'],
    versionFields: [],
    notes: 'requiresReview → needs_review semantics',
  },

  // ── PO Domain ─────────────────────────────────────────────────
  {
    table: 'purchase_orders',
    purpose: '발주서 헤더',
    primaryFields: ['id', 'workspaceId', 'poNumber', 'status', 'vendorId', 'ownerId', 'requiredByAt', 'issuedAt', 'totalAmount', 'currency'],
    foreignKeys: ['workspaceId → workspaces.id', 'sourceQuoteId → quotes.id (nullable)', 'sourceComparisonId → quote_comparisons.id (nullable)'],
    versionFields: ['version', 'createdAt', 'updatedAt'],
    notes: 'sourceQuoteId + sourceComparisonId = upstream lineage',
  },
  {
    table: 'purchase_order_lines',
    purpose: '발주서 품목 라인',
    primaryFields: ['id', 'poId', 'lineNumber', 'productName', 'catalogNumber', 'quantity', 'unit', 'unitPrice'],
    foreignKeys: ['poId → purchase_orders.id', 'sourceResponseItemId → quote_response_items.id (nullable)'],
    versionFields: [],
    notes: 'sourceResponseItemId = quote 연결 lineage',
  },
  {
    table: 'approval_executions',
    purpose: '승인 실행 헤더',
    primaryFields: ['id', 'entityType', 'entityId', 'status', 'startedAt', 'completedAt'],
    foreignKeys: ['entityId → purchase_orders.id (polymorphic)'],
    versionFields: ['updatedAt'],
    notes: 'status = pending|in_progress|approved|rejected|cancelled',
  },
  {
    table: 'approval_steps',
    purpose: '승인 단계',
    primaryFields: ['id', 'executionId', 'stepOrder', 'stepType', 'status', 'approverIds', 'slaDueAt'],
    foreignKeys: ['executionId → approval_executions.id'],
    versionFields: [],
    notes: 'stepType = budget_check|manager_approval|compliance|final_approval',
  },
  {
    table: 'approval_decisions',
    purpose: '승인 결정 기록',
    primaryFields: ['id', 'stepId', 'decidedBy', 'decision', 'reason', 'decidedAt', 'conditions'],
    foreignKeys: ['stepId → approval_steps.id'],
    versionFields: [],
    notes: 'decision = approved|rejected|conditional|returned. 감사 필수.',
  },
  {
    table: 'po_acknowledgements',
    purpose: '공급사 확인 헤더',
    primaryFields: ['id', 'poId', 'status', 'acknowledgedAt', 'promisedDeliveryAt', 'vendorNotes'],
    foreignKeys: ['poId → purchase_orders.id'],
    versionFields: ['updatedAt'],
    notes: 'status = not_sent|sent|acknowledged|partially_confirmed|confirmed|rejected|issue_flagged',
  },
  {
    table: 'po_ack_lines',
    purpose: '공급사 라인별 확인',
    primaryFields: ['id', 'ackId', 'poLineId', 'ackLineStatus', 'confirmedQuantity', 'promisedDate', 'notes'],
    foreignKeys: ['ackId → po_acknowledgements.id', 'poLineId → purchase_order_lines.id'],
    versionFields: [],
    notes: 'ackLineStatus = confirmed|backorder|substitute_offered|issue_flagged|not_confirmed',
  },

  // ── Receiving Domain ──────────────────────────────────────────
  {
    table: 'receiving_batches',
    purpose: '입고 배치 헤더',
    primaryFields: ['id', 'workspaceId', 'receivingNumber', 'status', 'vendorId', 'poId', 'receivedAt', 'receivedBy', 'sourceType', 'carrierName', 'trackingNumber'],
    foreignKeys: ['workspaceId → workspaces.id', 'poId → purchase_orders.id (nullable)'],
    versionFields: ['version', 'updatedAt'],
    notes: 'sourceType = purchase_order|manual_return|transfer|sample',
  },
  {
    table: 'receiving_line_receipts',
    purpose: '수령 라인',
    primaryFields: ['id', 'batchId', 'lineNumber', 'itemName', 'catalogNumber', 'orderedQuantity', 'receivedQuantity', 'receivedUnit', 'receiptStatus', 'conditionStatus', 'documentStatus', 'inspectionRequired', 'inspectionStatus'],
    foreignKeys: ['batchId → receiving_batches.id', 'poLineId → purchase_order_lines.id (nullable)'],
    versionFields: ['updatedAt'],
    notes: 'receiptStatus/conditionStatus/documentStatus/inspectionStatus enums match contract',
  },
  {
    table: 'receiving_lot_records',
    purpose: 'Lot 개별 기록',
    primaryFields: ['id', 'lineReceiptId', 'lotNumber', 'quantity', 'unit', 'expiryDate', 'storageCondition', 'quarantineStatus', 'labelStatus', 'coaAttached', 'msdsAttached', 'validationAttached', 'warrantyAttached', 'notes'],
    foreignKeys: ['lineReceiptId → receiving_line_receipts.id', 'inventoryPostingId → inventory_inbound_postings.id (nullable)'],
    versionFields: [],
    notes: 'quarantineStatus → blockerClass 결정 핵심; inventoryPostingId → stock position lineage',
  },
  {
    table: 'inventory_inbound_postings',
    purpose: '재고 입고 반영 기록',
    primaryFields: ['id', 'batchId', 'postingStatus', 'postedAt', 'postedBy', 'totalPostedQuantity'],
    foreignKeys: ['batchId → receiving_batches.id'],
    versionFields: [],
    notes: 'postingStatus = pending|partial|complete|reversed',
  },

  // ── Stock Risk Domain ─────────────────────────────────────────
  {
    table: 'stock_positions',
    purpose: '재고 포지션 스냅샷',
    primaryFields: ['id', 'workspaceId', 'inventoryItemId', 'location', 'riskStatus', 'availableQuantity', 'reservedQuantity', 'quarantinedQuantity', 'damagedQuantity', 'unit', 'riskFlags'],
    foreignKeys: ['workspaceId → workspaces.id'],
    versionFields: ['snapshotAt'],
    notes: 'riskStatus = healthy|low_stock|critical_shortage|expiring_soon|quarantine_constrained',
  },
  {
    table: 'reorder_recommendations',
    purpose: '재주문 권고',
    primaryFields: ['id', 'workspaceId', 'inventoryItemId', 'status', 'urgency', 'recommendedOrderQuantity', 'recommendedUnit', 'currentAvailableQuantity', 'blockedReasons', 'budgetImpactEstimate'],
    foreignKeys: ['supportingStockPositionId → stock_positions.id', 'linkedQuoteRequestId → quotes.id (nullable)'],
    versionFields: ['generatedAt', 'updatedAt'],
    notes: 'status = open|review_required|blocked|converted_to_quote|converted_to_po|dismissed',
  },
  {
    table: 'expiry_actions',
    purpose: '유효기한 조치',
    primaryFields: ['id', 'workspaceId', 'inventoryItemId', 'actionType', 'status', 'dueAt', 'daysToExpiry', 'affectedQuantity', 'unit', 'ownerId'],
    foreignKeys: ['workspaceId → workspaces.id'],
    versionFields: ['triggeredAt', 'updatedAt'],
    notes: 'actionType = replace_order|consume_first|dispose|monitor',
  },

  // ── Shared/Ops Domain ─────────────────────────────────────────
  {
    table: 'assignments',
    purpose: '작업 배정',
    primaryFields: ['id', 'workspaceId', 'entityType', 'entityId', 'assigneeId', 'assignedBy', 'assignedAt', 'role'],
    foreignKeys: ['workspaceId → workspaces.id'],
    versionFields: ['updatedAt'],
    notes: 'role = owner|reviewer|approver|observer',
  },
  {
    table: 'domain_events',
    purpose: '도메인 이벤트 저장소',
    primaryFields: ['id', 'workspaceId', 'eventType', 'entityType', 'entityId', 'emittedAt', 'payload', 'correlationId', 'causationId'],
    foreignKeys: [],
    versionFields: [],
    notes: 'Append-only. correlationId for end-to-end tracing.',
  },
  {
    table: 'audit_entries',
    purpose: '감사 로그',
    primaryFields: ['id', 'workspaceId', 'actor', 'actedAt', 'entityType', 'entityId', 'actionType', 'preVersion', 'postVersion', 'idempotencyKey', 'correlationId', 'linkedCreatedEntityId', 'metadata'],
    foreignKeys: [],
    versionFields: [],
    notes: 'Append-only. actionType = entity lifecycle 중심. 승인/발행/반영/정책변경 필수.',
  },
] as const;

// ===========================================================================
// 2. Lineage Mapping Matrix
// ===========================================================================

export const LINEAGE_MATRIX = [
  { upstream: 'search/re-entry', downstream: 'quote', linkageField: 'quotes.sourceType + quotes.metadata', optional: true, staleRecovery: 're-entry context can bootstrap new quote' },
  { upstream: 'quote_request_item', downstream: 'quote_response_item', linkageField: 'quote_response_items.requestItemId', optional: false, staleRecovery: 'response always links to request item' },
  { upstream: 'selected_response', downstream: 'po_line', linkageField: 'purchase_order_lines.sourceResponseItemId', optional: true, staleRecovery: 'PO can exist without quote lineage (manual PO)' },
  { upstream: 'po_line', downstream: 'receiving_line', linkageField: 'receiving_line_receipts.poLineId', optional: true, staleRecovery: 'receiving can be manual; partial match OK' },
  { upstream: 'receiving_lot', downstream: 'posting', linkageField: 'receiving_lot_records.inventoryPostingId', optional: true, staleRecovery: 'lot exists before posting; posting id added on commit' },
  { upstream: 'posting', downstream: 'stock_position', linkageField: 'implicit via inventory item/location; snapshot recalculated', optional: false, staleRecovery: 'stock position rebuilt from all postings' },
  { upstream: 'reorder_recommendation', downstream: 'quote', linkageField: 'reorder_recommendations.linkedQuoteRequestId', optional: true, staleRecovery: 'recommendation tracks created quote id' },
  { upstream: 'exception/blocker', downstream: 'entity', linkageField: 'domain_events correlation + audit_entries', optional: false, staleRecovery: 'event history preserves blocker→resolution lineage' },
] as const;

// ===========================================================================
// 3. Command → Write → Event → Audit Mapping
// ===========================================================================

export const COMMAND_WRITE_EVENT_AUDIT = [
  {
    command: 'select_quote_vendor',
    writtenTables: ['quotes (status→vendor_selected)', 'quote_comparisons (selectedVendorId, selectedResponseId)'],
    emittedEvents: ['quote_vendor_selected'],
    auditEntry: '{ actor, actionType: "vendor_selected", entityType: "quote", entityId, metadata: { vendorId, responseId } }',
    projectionRecalc: ['inbox_items', 'dashboard_summary', 'quotes_module_summary'],
    idempotency: 'Selecting same vendor → no-op; different vendor → conflict',
    transactionBoundary: 'Single transaction: quote update + comparison update + event + audit',
  },
  {
    command: 'create_po_from_quote',
    writtenTables: ['purchase_orders (INSERT)', 'purchase_order_lines (INSERT)', 'quotes (status→converted_to_po)'],
    emittedEvents: ['po_created', 'quote_converted_to_po'],
    auditEntry: '{ actor, actionType: "po_created_from_quote", entityType: "po", entityId: newPoId, linkedCreatedEntityId: newPoId, metadata: { sourceQuoteId } }',
    projectionRecalc: ['inbox_items', 'dashboard_summary', 'quotes_module_summary', 'po_module_summary'],
    idempotency: 'idempotencyKey → return existing PO if already created',
    transactionBoundary: 'Single transaction: PO insert + lines insert + quote status update + events + audit',
  },
  {
    command: 'submit_po_issue',
    writtenTables: ['purchase_orders (status→issued, issuedAt)'],
    emittedEvents: ['po_issued'],
    auditEntry: '{ actor, actionType: "po_issued", entityType: "po", entityId }',
    projectionRecalc: ['inbox_items', 'dashboard_summary', 'po_module_summary'],
    idempotency: 'Already issued → return current state',
    transactionBoundary: 'Single transaction: PO update + event + audit',
  },
  {
    command: 'complete_receiving_inspection',
    writtenTables: ['receiving_line_receipts (inspectionStatus)'],
    emittedEvents: ['inspection_completed'],
    auditEntry: '{ actor, actionType: "inspection_completed", entityType: "receiving_line", entityId: lineId, metadata: { passed, batchId } }',
    projectionRecalc: ['inbox_items', 'dashboard_summary', 'receiving_module_summary'],
    idempotency: 'Idempotent by nature (same result)',
    transactionBoundary: 'Single transaction: line update + event + audit',
  },
  {
    command: 'post_inventory_inbound',
    writtenTables: ['inventory_inbound_postings (INSERT)', 'receiving_lot_records (inventoryPostingId)', 'receiving_batches (status→posted)', 'stock_positions (recalc)'],
    emittedEvents: ['posting_completed', 'stock_risk_recalculation_requested'],
    auditEntry: '{ actor, actionType: "inventory_posted", entityType: "receiving", entityId, linkedCreatedEntityId: postingId }',
    projectionRecalc: ['inbox_items', 'dashboard_summary', 'receiving_module_summary', 'stock_risk_module_summary'],
    idempotency: 'Already posted → return existing posting',
    transactionBoundary: 'Single transaction: posting + lot updates + batch status + stock recalc + events + audit',
  },
  {
    command: 'create_quote_from_reorder',
    writtenTables: ['quotes (INSERT)', 'quote_request_items (INSERT)', 'reorder_recommendations (status→converted_to_quote, linkedQuoteRequestId)'],
    emittedEvents: ['reorder_converted_to_quote', 'quote_created'],
    auditEntry: '{ actor, actionType: "reorder_converted", entityType: "reorder_recommendation", entityId, linkedCreatedEntityId: newQuoteId }',
    projectionRecalc: ['inbox_items', 'dashboard_summary', 'stock_risk_module_summary', 'quotes_module_summary', 'recovery_summary'],
    idempotency: 'idempotencyKey → return existing quote if already created',
    transactionBoundary: 'Single transaction: quote insert + items insert + recommendation update + events + audit',
  },
] as const;

// ===========================================================================
// 4. Event → Projection Matrix
// ===========================================================================

export const EVENT_PROJECTION_MATRIX = [
  { event: 'quote_vendor_selected', projections: ['inbox_items', 'quotes_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'quote_converted_to_po', projections: ['inbox_items', 'quotes_module_summary', 'po_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'po_approved', projections: ['inbox_items', 'po_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'po_issued', projections: ['inbox_items', 'po_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'po_acknowledgement_received', projections: ['inbox_items', 'po_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'medium' },
  { event: 'inspection_completed', projections: ['inbox_items', 'receiving_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'posting_completed', projections: ['inbox_items', 'receiving_module_summary', 'stock_risk_module_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'reorder_converted_to_quote', projections: ['inbox_items', 'stock_risk_module_summary', 'quotes_module_summary', 'dashboard_summary', 'recovery_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'stock_position_updated', projections: ['stock_risk_module_summary', 'dashboard_summary'], refreshStrategy: 'on-demand', staleTolerance: 'medium' },
  { event: 'owner_assigned', projections: ['inbox_items', 'ownership_workload_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
  { event: 'blocker_resolved', projections: ['inbox_items', 'blocker_summary', 'dashboard_summary'], refreshStrategy: 'event-driven', staleTolerance: 'low' },
] as const;

// ===========================================================================
// 5. Audit Coverage Matrix
// ===========================================================================

export const AUDIT_COVERAGE_MATRIX = [
  { action: 'vendor_selection', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'medium' },
  { action: 'po_creation', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'high' },
  { action: 'po_issue', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'high' },
  { action: 'approval_decision', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'critical' },
  { action: 'inspection_completion', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'high' },
  { action: 'inventory_posting', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'high' },
  { action: 'reorder_conversion', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'medium' },
  { action: 'policy_change', requiredAudit: true, actor: true, linkedIds: false, approvalSensitivity: 'critical' },
  { action: 'owner_assignment', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'low' },
  { action: 'blocker_resolution', requiredAudit: true, actor: true, linkedIds: true, approvalSensitivity: 'medium' },
] as const;

// ===========================================================================
// 6. Reconciliation / Repair Matrix
// ===========================================================================

export const RECONCILIATION_MATRIX = [
  {
    failureType: 'stale_linkage',
    detectionMethod: 'Periodic check: linked entity version mismatch or null',
    automatedRepair: true,
    manualIntervention: false,
    affectedSurfaces: ['detail pages', 'upstream/downstream panels'],
    repairStrategy: 'Re-resolve link from entity id; update linkage field',
  },
  {
    failureType: 'projection_stale',
    detectionMethod: 'Compare projection timestamp vs latest event timestamp',
    automatedRepair: true,
    manualIntervention: false,
    affectedSurfaces: ['inbox', 'dashboard', 'module landing'],
    repairStrategy: 'Full projection rebuild from source events',
  },
  {
    failureType: 'duplicate_entity',
    detectionMethod: 'Idempotency key collision detection; duplicate check on create',
    automatedRepair: false,
    manualIntervention: true,
    affectedSurfaces: ['PO list', 'quote list'],
    repairStrategy: 'Dedup merge or soft-delete duplicate; preserve lineage',
  },
  {
    failureType: 'orphan_event',
    detectionMethod: 'Event referencing non-existent entity',
    automatedRepair: false,
    manualIntervention: true,
    affectedSurfaces: ['audit trail'],
    repairStrategy: 'Archive orphan event; flag for review',
  },
  {
    failureType: 'stock_mismatch',
    detectionMethod: 'Stock position != sum of postings - sum of outflows',
    automatedRepair: true,
    manualIntervention: false,
    affectedSurfaces: ['stock risk', 'dashboard'],
    repairStrategy: 'Full stock position rebuild from posting records',
  },
  {
    failureType: 'partial_posting',
    detectionMethod: 'Posting marked partial but no follow-up action for 48h',
    automatedRepair: false,
    manualIntervention: true,
    affectedSurfaces: ['receiving detail', 'stock risk'],
    repairStrategy: 'Flag for operator review; suggest complete-or-cancel',
  },
] as const;

// ===========================================================================
// 7. Concurrency / Transaction Boundary
// ===========================================================================

export const TRANSACTION_BOUNDARIES = [
  { command: 'select_quote_vendor', scope: 'Single TX: quote + comparison + event + audit', optimisticLock: 'quote.version', outbox: false },
  { command: 'create_po_from_quote', scope: 'Single TX: PO rows + quote status + events + audit', optimisticLock: 'quote.version', outbox: true },
  { command: 'submit_po_issue', scope: 'Single TX: PO status + event + audit', optimisticLock: 'po.version', outbox: false },
  { command: 'post_inventory_inbound', scope: 'Single TX: posting + lot updates + batch status + stock recalc + events + audit', optimisticLock: 'receiving_batch.version', outbox: true },
  { command: 'create_quote_from_reorder', scope: 'Single TX: quote insert + recommendation update + events + audit', optimisticLock: 'recommendation.version', outbox: true },
] as const;

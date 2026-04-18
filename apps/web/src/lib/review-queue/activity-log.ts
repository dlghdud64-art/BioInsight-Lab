/**
 * Step 1~3 Activity Log / Approval Boundary / Audit Trail
 *
 * 모든 상태 변화를 운영 이벤트로 기록한다.
 * item별 audit trail + flow별 activity feed.
 */

// ═══════════════════════════════════════════════════
// Activity Event Schema
// ═══════════════════════════════════════════════════

export type EntityType =
  | "review_queue_item"
  | "compare_queue_item"
  | "quote_draft_item"
  | "quote_request"
  | "uploaded_document";

export type ActorType = "user" | "system" | "assistant" | "integration";

export type ApprovalState =
  | "not_required"
  | "pending_approval"
  | "approved"
  | "rejected";

// ── Event Types ──

export type Step1EventType =
  | "review_item_created"
  | "review_item_updated"
  | "review_item_status_changed"
  | "review_item_approved"
  | "review_item_excluded"
  | "review_item_restored"
  | "review_item_sent_to_compare"
  | "review_item_sent_to_quote_draft";

export type Step2EventType =
  | "compare_item_created"
  | "compare_candidate_selected"
  | "compare_selection_confirmed"
  | "compare_selection_cleared"
  | "compare_item_removed"
  | "compare_item_sent_to_quote_draft";

export type Step3EventType =
  | "quote_draft_item_created"
  | "quote_draft_item_updated"
  | "quote_draft_status_changed"
  | "quote_draft_item_removed"
  | "quote_draft_submission_requested"
  | "quote_draft_submission_ready"
  | "quote_draft_submission_blocked";

export type CommonEventType =
  | "document_uploaded"
  | "document_parsed"
  | "excel_mapping_confirmed"
  | "protocol_evidence_linked"
  | "bulk_action_executed"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected";

export type ActivityEventType =
  | Step1EventType
  | Step2EventType
  | Step3EventType
  | CommonEventType;

// ── Event Schema ──

export interface ActivityEvent {
  eventId: string;
  eventType: ActivityEventType;
  entityType: EntityType;
  entityId: string;
  parentEntityType: EntityType | null;
  parentEntityId: string | null;
  actorType: ActorType;
  actorId: string;
  actorLabel: string;
  timestamp: string;
  sourceType: string | null;
  previousState: string | null;
  nextState: string | null;
  reasonCodes: string[];
  message: string;
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════
// Event Builder
// ═══════════════════════════════════════════════════

let eventCounter = 0;

function generateEventId(): string {
  return `evt-${Date.now()}-${++eventCounter}`;
}

export function createEvent(params: {
  eventType: ActivityEventType;
  entityType: EntityType;
  entityId: string;
  parentEntityType?: EntityType | null;
  parentEntityId?: string | null;
  actorType?: ActorType;
  actorId?: string;
  actorLabel?: string;
  sourceType?: string | null;
  previousState?: string | null;
  nextState?: string | null;
  reasonCodes?: string[];
  message: string;
  metadata?: Record<string, unknown>;
}): ActivityEvent {
  return {
    eventId: generateEventId(),
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    parentEntityType: params.parentEntityType ?? null,
    parentEntityId: params.parentEntityId ?? null,
    actorType: params.actorType ?? "user",
    actorId: params.actorId ?? "current_user",
    actorLabel: params.actorLabel ?? "사용자",
    timestamp: new Date().toISOString(),
    sourceType: params.sourceType ?? null,
    previousState: params.previousState ?? null,
    nextState: params.nextState ?? null,
    reasonCodes: params.reasonCodes ?? [],
    message: params.message,
    metadata: params.metadata ?? {},
  };
}

// ═══════════════════════════════════════════════════
// Step 1 Event Helpers
// ═══════════════════════════════════════════════════

export function logReviewItemCreated(entityId: string, sourceType: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "review_item_created",
    entityType: "review_queue_item",
    entityId,
    actorType: "system",
    actorLabel: "시스템",
    sourceType,
    nextState: "created",
    message: `${itemName} 항목이 검토 큐에 추가되었습니다`,
    metadata: { sourceType, itemName },
  });
}

export function logReviewItemStatusChanged(
  entityId: string,
  itemName: string,
  prevStatus: string,
  nextStatus: string,
  reasonCodes: string[] = []
): ActivityEvent {
  return createEvent({
    eventType: "review_item_status_changed",
    entityType: "review_queue_item",
    entityId,
    previousState: prevStatus,
    nextState: nextStatus,
    reasonCodes,
    message: `${itemName} 항목 상태가 ${prevStatus} → ${nextStatus}로 변경되었습니다`,
  });
}

export function logReviewItemApproved(entityId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "review_item_approved",
    entityType: "review_queue_item",
    entityId,
    previousState: "confirmed",
    nextState: "approved",
    reasonCodes: ["approved_by_user"],
    message: `${itemName} 항목이 승인되었습니다`,
  });
}

export function logReviewItemExcluded(entityId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "review_item_excluded",
    entityType: "review_queue_item",
    entityId,
    nextState: "excluded",
    reasonCodes: ["excluded_by_user"],
    message: `${itemName} 항목이 제외되었습니다`,
  });
}

export function logReviewItemRestored(entityId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "review_item_restored",
    entityType: "review_queue_item",
    entityId,
    previousState: "excluded",
    nextState: "confirmed",
    message: `${itemName} 항목이 복구되었습니다`,
  });
}

export function logSentToCompare(entityId: string, compareItemId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "review_item_sent_to_compare",
    entityType: "review_queue_item",
    entityId,
    reasonCodes: ["sent_to_compare"],
    message: `${itemName} 항목이 비교 큐로 전송되었습니다`,
    metadata: { compareItemId },
  });
}

export function logSentToQuoteDraft(entityId: string, quoteDraftId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "review_item_sent_to_quote_draft",
    entityType: "review_queue_item",
    entityId,
    reasonCodes: ["sent_to_quote_draft"],
    message: `${itemName} 항목이 견적 초안으로 전송되었습니다`,
    metadata: { quoteDraftId },
  });
}

// ═══════════════════════════════════════════════════
// Step 2 Event Helpers
// ═══════════════════════════════════════════════════

export function logCompareCandidateSelected(entityId: string, itemName: string, productName: string): ActivityEvent {
  return createEvent({
    eventType: "compare_candidate_selected",
    entityType: "compare_queue_item",
    entityId,
    nextState: "selection_needed",
    message: `후보 비교 후 ${productName} 제품이 선택되었습니다`,
    metadata: { itemName, productName },
  });
}

export function logCompareSelectionConfirmed(entityId: string, itemName: string, productName: string): ActivityEvent {
  return createEvent({
    eventType: "compare_selection_confirmed",
    entityType: "compare_queue_item",
    entityId,
    previousState: "selection_needed",
    nextState: "selection_confirmed",
    message: `${itemName} 항목의 후보 선택이 확정되었습니다: ${productName}`,
    metadata: { itemName, productName },
  });
}

export function logCompareSentToQuoteDraft(entityId: string, quoteDraftId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "compare_item_sent_to_quote_draft",
    entityType: "compare_queue_item",
    entityId,
    reasonCodes: ["sent_to_quote_draft"],
    message: `${itemName} 항목이 견적 초안으로 전송되었습니다`,
    metadata: { quoteDraftId },
  });
}

// ═══════════════════════════════════════════════════
// Step 3 Event Helpers
// ═══════════════════════════════════════════════════

export function logQuoteDraftCreated(entityId: string, itemName: string, sourceType: string): ActivityEvent {
  return createEvent({
    eventType: "quote_draft_item_created",
    entityType: "quote_draft_item",
    entityId,
    actorType: "system",
    actorLabel: "시스템",
    sourceType,
    nextState: "draft_ready",
    message: `${itemName} 견적 초안이 생성되었습니다`,
  });
}

export function logQuoteDraftUpdated(entityId: string, itemName: string, field: string, newValue: string): ActivityEvent {
  return createEvent({
    eventType: "quote_draft_item_updated",
    entityType: "quote_draft_item",
    entityId,
    reasonCodes: ["manual_override"],
    message: `${itemName}의 ${field}이(가) ${newValue}(으)로 수정되었습니다`,
    metadata: { field, newValue },
  });
}

export function logQuoteDraftStatusChanged(entityId: string, itemName: string, prevStatus: string, nextStatus: string): ActivityEvent {
  return createEvent({
    eventType: "quote_draft_status_changed",
    entityType: "quote_draft_item",
    entityId,
    previousState: prevStatus,
    nextState: nextStatus,
    message: `${itemName} 견적 초안 상태가 ${prevStatus} → ${nextStatus}로 변경되었습니다`,
  });
}

export function logQuoteDraftSubmissionRequested(entityId: string, itemName: string): ActivityEvent {
  return createEvent({
    eventType: "quote_draft_submission_requested",
    entityType: "quote_draft_item",
    entityId,
    message: `${itemName} 견적 요청 제출이 요청되었습니다`,
  });
}

export function logQuoteDraftSubmissionBlocked(entityId: string, itemName: string, reasons: string[]): ActivityEvent {
  return createEvent({
    eventType: "quote_draft_submission_blocked",
    entityType: "quote_draft_item",
    entityId,
    reasonCodes: reasons,
    message: `${itemName} 견적 제출이 보류되었습니다`,
    metadata: { blockReasons: reasons },
  });
}

// ═══════════════════════════════════════════════════
// Approval Event Helpers
// ═══════════════════════════════════════════════════

export function logApprovalRequested(entityType: EntityType, entityId: string, reason: string): ActivityEvent {
  return createEvent({
    eventType: "approval_requested",
    entityType,
    entityId,
    nextState: "pending_approval",
    message: `승인 요청이 생성되었습니다: ${reason}`,
    metadata: { reason },
  });
}

export function logApprovalGranted(entityType: EntityType, entityId: string, approverLabel: string, memo?: string): ActivityEvent {
  return createEvent({
    eventType: "approval_granted",
    entityType,
    entityId,
    actorLabel: approverLabel,
    previousState: "pending_approval",
    nextState: "approved",
    message: `${approverLabel}님이 승인했습니다${memo ? `: ${memo}` : ""}`,
    metadata: { approverLabel, memo },
  });
}

export function logApprovalRejected(entityType: EntityType, entityId: string, rejectorLabel: string, reason: string): ActivityEvent {
  return createEvent({
    eventType: "approval_rejected",
    entityType,
    entityId,
    actorLabel: rejectorLabel,
    previousState: "pending_approval",
    nextState: "rejected",
    reasonCodes: ["approval_rejected"],
    message: `${rejectorLabel}님이 반려했습니다: ${reason}`,
    metadata: { rejectorLabel, reason },
  });
}

// ═══════════════════════════════════════════════════
// Bulk / Upload Event Helpers
// ═══════════════════════════════════════════════════

export function logBulkAction(action: string, count: number, entityType: EntityType): ActivityEvent {
  return createEvent({
    eventType: "bulk_action_executed",
    entityType,
    entityId: "bulk",
    actorType: "user",
    message: `${count}개 항목 ${action}`,
    metadata: { action, count },
  });
}

export function logDocumentUploaded(fileName: string, fileType: string): ActivityEvent {
  return createEvent({
    eventType: "document_uploaded",
    entityType: "uploaded_document",
    entityId: `doc-${Date.now()}`,
    actorType: "user",
    message: `${fileName} 파일이 업로드되었습니다`,
    metadata: { fileName, fileType },
  });
}

export function logDocumentParsed(fileName: string, extractedCount: number): ActivityEvent {
  return createEvent({
    eventType: "document_parsed",
    entityType: "uploaded_document",
    entityId: `doc-${Date.now()}`,
    actorType: "system",
    actorLabel: "시스템",
    message: `${fileName}에서 ${extractedCount}개 항목이 추출되었습니다`,
    metadata: { fileName, extractedCount },
  });
}

// ═══════════════════════════════════════════════════
// Activity Log Store (in-memory + sessionStorage)
// ═══════════════════════════════════════════════════

const STORAGE_KEY = "labaxis_activity_log";

function loadEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: ActivityEvent[]) {
  if (typeof window === "undefined") return;
  try {
    // 최근 500건만 유지
    const trimmed = events.slice(-500);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // silent
  }
}

let _events: ActivityEvent[] = loadEvents();

/** 이벤트 추가 */
export function pushEvent(event: ActivityEvent) {
  _events.push(event);
  saveEvents(_events);
}

/** 전체 이벤트 조회 */
export function getEvents(): ActivityEvent[] {
  return [..._events];
}

/** 특정 entity의 audit trail 조회 */
export function getAuditTrail(entityId: string): ActivityEvent[] {
  return _events.filter((e) => e.entityId === entityId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** 특정 entity type의 이벤트 조회 */
export function getEventsByEntityType(entityType: EntityType): ActivityEvent[] {
  return _events.filter((e) => e.entityType === entityType);
}

/** 오늘의 이벤트 요약 */
export function getTodaySummary(): {
  totalEvents: number;
  itemsCreated: number;
  itemsApproved: number;
  sentToCompare: number;
  sentToQuoteDraft: number;
  approvalPending: number;
  approvalRejected: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = _events.filter((e) => e.timestamp.startsWith(today));
  return {
    totalEvents: todayEvents.length,
    itemsCreated: todayEvents.filter((e) => e.eventType.endsWith("_created")).length,
    itemsApproved: todayEvents.filter((e) => e.eventType.includes("approved") || e.eventType === "approval_granted").length,
    sentToCompare: todayEvents.filter((e) => e.eventType === "review_item_sent_to_compare").length,
    sentToQuoteDraft: todayEvents.filter((e) => e.eventType.includes("sent_to_quote_draft")).length,
    approvalPending: todayEvents.filter((e) => e.eventType === "approval_requested").length,
    approvalRejected: todayEvents.filter((e) => e.eventType === "approval_rejected").length,
  };
}

/** 이벤트 초기화 */
export function clearEvents() {
  _events = [];
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// ═══════════════════════════════════════════════════
// Review Reason → 사용자 문구 매핑
// ═══════════════════════════════════════════════════

export const REASON_LABELS: Record<string, string> = {
  name_missing: "품목명 확인 필요",
  manufacturer_missing: "제조사 확인 필요",
  catalog_missing: "카탈로그 번호 확인 필요",
  spec_unclear: "규격 확인 필요",
  quantity_missing: "수량 확인 필요",
  unit_missing: "단위 확인 필요",
  multiple_candidates: "후보 비교 필요",
  category_level_only: "제품군 수준으로만 추출되었습니다",
  spec_collision: "규격이 유사한 후보가 여러 개 있습니다",
  brand_ambiguous: "제조사 구분이 필요합니다",
  packaging_unclear: "포장 단위 확인 필요",
  protocol_to_product_gap: "문서 표현과 실제 구매 단위 연결 검토가 필요합니다",
  no_match: "일치하는 후보를 찾지 못했습니다",
  evidence_only: "근거 문장은 있으나 제품 후보를 특정하지 못했습니다",
  row_empty: "유효한 입력 행이 아닙니다",
  spec_mismatch: "원문 규격과 후보 규격이 다를 수 있습니다",
  manual_override: "사용자가 직접 수정했습니다",
  approved_by_user: "사용자가 승인했습니다",
  excluded_by_user: "사용자가 제외했습니다",
  sent_to_compare: "비교 큐로 전송됨",
  sent_to_quote_draft: "견적 초안으로 전송됨",
  budget_override_requested: "예산 경고를 확인 후 진행",
  inventory_warning_acknowledged: "재고 중복 가능성 확인 후 진행",
  approval_rejected: "승인이 반려됨",
};

/** 내부 코드 → 사용자 문구 변환 */
export function reasonToLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

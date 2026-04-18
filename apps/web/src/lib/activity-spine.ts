/**
 * Canonical Activity Timeline + Evidence Spine
 *
 * 모든 procurement stage의 판단/근거/상태 전이 기록을 하나의 spine으로 통합합니다.
 * 각 화면에서 같은 객체의 과거 판단과 근거를 즉시 참조할 수 있는 공통 기록 구조입니다.
 *
 * 설계 원칙:
 * - 화면별 개별 note/log 금지 → canonical event stream
 * - procurement / PO / inventory가 하나의 linked spine
 * - timeline은 읽기 전용 로그가 아닌 작업면 보조 surface
 * - override/예외는 1급 이벤트로 기록
 */

import type { ProcurementStage } from "./procurement-stage";

// ── Event Types ─────────────────────────────────────────────────

export type ActivityEventType =
  | "request_created"
  | "candidate_added"
  | "candidate_removed"
  | "compare_started"
  | "selection_changed"
  | "blocker_flagged"
  | "blocker_resolved"
  | "review_completed"
  | "approval_package_prepared"
  | "external_approval_marked"
  | "po_created"
  | "receiving_recorded"
  | "partial_receiving"
  | "discrepancy_logged"
  | "inventory_stocked"
  | "reorder_candidate_created"
  | "policy_override_recorded"
  | "note_added"
  | "document_attached"
  | "stage_changed"
  | "status_changed";

// ── Core Event Model ────────────────────────────────────────────

export interface ActivityEvent {
  eventId: string;
  eventType: ActivityEventType;
  objectId: string;
  objectStage: ProcurementStage;
  actor: string;
  occurredAt: string; // ISO
  summary: string;
  detailPayload?: Record<string, unknown>;
  linkedEvidenceIds: string[];
  severity?: "info" | "warning" | "critical";
}

// ── Evidence Model ──────────────────────────────────────────────

export type EvidenceType =
  | "quote_pdf"
  | "vendor_message"
  | "coa"
  | "sds"
  | "approval_package"
  | "receiving_photo"
  | "discrepancy_note"
  | "inventory_lot_note"
  | "policy_exception_note"
  | "selection_reason"
  | "blocker_resolution"
  | "approval_handoff"
  | "vendor_followup"
  | "receiving_issue"
  | "inventory_warning"
  | "reorder_context";

export interface Evidence {
  evidenceId: string;
  evidenceType: EvidenceType;
  linkedObjectId: string;
  linkedEventIds: string[];
  title: string;
  content?: string;
  source: string;
  createdAt: string;
  status: "active" | "superseded" | "archived";
}

// ── Linked Spine ────────────────────────────────────────────────

export interface ProcurementSpine {
  procurementObjectId: string;
  sourceRequestId?: string;
  selectedQuoteId?: string;
  poId?: string;
  receivingBatchId?: string;
  inventoryRecordIds: string[];
  reorderOriginInventoryRecordId?: string;
  currentStage: ProcurementStage;
  events: ActivityEvent[];
  evidence: Evidence[];
}

// ── Override Event ──────────────────────────────────────────────

export interface OverrideEvent extends ActivityEvent {
  eventType: "policy_override_recorded";
  detailPayload: {
    overrideReason: string;
    scope: string;
    temporary: boolean;
    expiresAt?: string;
    originalRule: string;
    actor: string;
  };
}

// ── Note Categories ─────────────────────────────────────────────

export type NoteCategory =
  | "selection_reason"
  | "blocker_resolution"
  | "approval_handoff"
  | "vendor_followup"
  | "receiving_issue"
  | "inventory_warning"
  | "reorder_context"
  | "general";

// ── Timeline Summary (for header signals) ───────────────────────

export interface TimelineSummary {
  recentChanges: number;
  unresolvedBlockers: number;
  linkedDocs: number;
  hasOverride: boolean;
  lastEventAt?: string;
  lastEventSummary?: string;
}

export function computeTimelineSummary(events: ActivityEvent[], evidence: Evidence[]): TimelineSummary {
  const now = Date.now();
  const oneDayAgo = now - 86400000;

  const recentEvents = events.filter(e => new Date(e.occurredAt).getTime() > oneDayAgo);
  const blockerEvents = events.filter(e => e.eventType === "blocker_flagged");
  const resolvedEvents = events.filter(e => e.eventType === "blocker_resolved");
  const resolvedIds = new Set(resolvedEvents.flatMap(e => e.linkedEvidenceIds));
  const unresolvedBlockers = blockerEvents.filter(e => !resolvedIds.has(e.eventId)).length;
  const overrideEvents = events.filter(e => e.eventType === "policy_override_recorded");
  const activeDocs = evidence.filter(e => e.status === "active");

  const lastEvent = events.length > 0 ? events[events.length - 1] : undefined;

  return {
    recentChanges: recentEvents.length,
    unresolvedBlockers,
    linkedDocs: activeDocs.length,
    hasOverride: overrideEvents.length > 0,
    lastEventAt: lastEvent?.occurredAt,
    lastEventSummary: lastEvent?.summary,
  };
}

// ── Event Display Config ────────────────────────────────────────

export const EVENT_TYPE_CONFIG: Record<ActivityEventType, { label: string; color: string; icon: string }> = {
  request_created:            { label: "요청 생성",       color: "text-blue-400",    icon: "FileText" },
  candidate_added:            { label: "후보 추가",       color: "text-blue-400",    icon: "Plus" },
  candidate_removed:          { label: "후보 제거",       color: "text-slate-400",   icon: "Minus" },
  compare_started:            { label: "비교 시작",       color: "text-purple-400",  icon: "GitCompare" },
  selection_changed:          { label: "선택 변경",       color: "text-blue-400",    icon: "Check" },
  blocker_flagged:            { label: "차단 발생",       color: "text-red-400",     icon: "AlertCircle" },
  blocker_resolved:           { label: "차단 해소",       color: "text-emerald-400", icon: "CheckCircle2" },
  review_completed:           { label: "검토 완료",       color: "text-emerald-400", icon: "CheckCircle2" },
  approval_package_prepared:  { label: "승인 패키지 준비", color: "text-blue-400",    icon: "Package" },
  external_approval_marked:   { label: "외부 승인 반영",  color: "text-emerald-400", icon: "Shield" },
  po_created:                 { label: "발주 생성",       color: "text-emerald-400", icon: "Truck" },
  receiving_recorded:         { label: "입고 기록",       color: "text-blue-400",    icon: "Package" },
  partial_receiving:          { label: "부분 입고",       color: "text-amber-400",   icon: "Package" },
  discrepancy_logged:         { label: "이슈 등록",       color: "text-red-400",     icon: "AlertTriangle" },
  inventory_stocked:          { label: "재고 반영",       color: "text-emerald-400", icon: "CheckCircle2" },
  reorder_candidate_created:  { label: "재주문 후보",     color: "text-amber-400",   icon: "RotateCcw" },
  policy_override_recorded:   { label: "정책 예외",       color: "text-red-400",     icon: "ShieldAlert" },
  note_added:                 { label: "메모 추가",       color: "text-slate-400",   icon: "FileText" },
  document_attached:          { label: "문서 첨부",       color: "text-blue-400",    icon: "Paperclip" },
  stage_changed:              { label: "단계 전환",       color: "text-blue-400",    icon: "ArrowRight" },
  status_changed:             { label: "상태 변경",       color: "text-slate-400",   icon: "RefreshCw" },
};

// ── Helpers ─────────────────────────────────────────────────────

/** 최근 N개 이벤트 (최신순) */
export function getRecentEvents(events: ActivityEvent[], count: number = 5): ActivityEvent[] {
  return [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, count);
}

/** 특정 stage의 이벤트만 필터 */
export function getEventsForStage(events: ActivityEvent[], stage: ProcurementStage): ActivityEvent[] {
  return events.filter(e => e.objectStage === stage);
}

/** override 이벤트만 필터 */
export function getOverrideEvents(events: ActivityEvent[]): ActivityEvent[] {
  return events.filter(e => e.eventType === "policy_override_recorded");
}

/** evidence를 type별로 그룹 */
export function groupEvidenceByType(evidence: Evidence[]): Record<EvidenceType, Evidence[]> {
  const result = {} as Record<EvidenceType, Evidence[]>;
  for (const e of evidence) {
    if (!result[e.evidenceType]) result[e.evidenceType] = [];
    result[e.evidenceType].push(e);
  }
  return result;
}

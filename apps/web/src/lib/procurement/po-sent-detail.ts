/**
 * PO Sent Detail — post-send acknowledgment tracking + supplier response + follow-up
 *
 * 고정 규칙:
 * 1. po_sent는 완료 상태가 아니라 "응답 대기 + 후속조치" surface.
 * 2. supplier acknowledgment은 canonical substatus로 관리. 메모 추론 금지.
 * 3. supplier response는 구조화된 이벤트. raw text만으로 source of truth 금지.
 * 4. follow-up evaluator는 policy 기반. 감(感) 기반 금지.
 * 5. po_sent → supplier_acknowledged 단방향.
 * 6. receiving entry는 verified handoff. 자동 연결 금지.
 * 7. queue badge와 detail substatus는 동일 source.
 */

import type { PODetailModel, PODraftState } from "./po-created-detail";
import type { DispatchLog } from "./po-dispatch";

// ══════════════════════════════════════════════════════════════════════════════
// Acknowledgment Status (canonical substatus for po_sent)
// ══════════════════════════════════════════════════════════════════════════════

export type AcknowledgmentSubstatus =
  | "awaiting_acknowledgment"
  | "acknowledgment_received"
  | "follow_up_required"
  | "supplier_issue_flagged";

export const ACKNOWLEDGMENT_SUBSTATUS_LABELS: Record<AcknowledgmentSubstatus, string> = {
  awaiting_acknowledgment: "응답 대기",
  acknowledgment_received: "확인 수신",
  follow_up_required: "후속 확인 필요",
  supplier_issue_flagged: "공급사 이슈 발생",
};

// ══════════════════════════════════════════════════════════════════════════════
// Post-Send Tracking Model
// ══════════════════════════════════════════════════════════════════════════════

export interface PostSendTracking {
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;

  // ── Dispatch result ──
  sentAt: string;
  sentBy: string | null;
  dispatchLogId: string | null;

  // ── Acknowledgment ──
  acknowledgmentStatus: AcknowledgmentSubstatus;
  acknowledgmentReceivedAt: string | null;
  acknowledgmentReceivedBy: string | null;
  acknowledgmentSource: string | null;

  // ── Follow-up ──
  followUpRequired: boolean;
  followUpReason: string | null;
  followUpDueAt: string | null;

  // ── Supplier issue ──
  supplierIssueFlag: boolean;
  supplierIssueSummary: string | null;

  // ── Delivery confirmation ──
  confirmedEta: string | null;
  confirmedQtyChanged: boolean;
  confirmedPriceChanged: boolean;
  deliveryNote: string | null;

  // ── Response tracking ──
  lastReplyAt: string | null;
  totalResponseCount: number;
}

export function createInitialPostSendTracking(input: {
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;
  sentAt: string;
  sentBy: string | null;
  dispatchLogId: string | null;
}): PostSendTracking {
  return {
    purchaseOrderId: input.purchaseOrderId,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    sentAt: input.sentAt,
    sentBy: input.sentBy,
    dispatchLogId: input.dispatchLogId,
    acknowledgmentStatus: "awaiting_acknowledgment",
    acknowledgmentReceivedAt: null,
    acknowledgmentReceivedBy: null,
    acknowledgmentSource: null,
    followUpRequired: false,
    followUpReason: null,
    followUpDueAt: null,
    supplierIssueFlag: false,
    supplierIssueSummary: null,
    confirmedEta: null,
    confirmedQtyChanged: false,
    confirmedPriceChanged: false,
    deliveryNote: null,
    lastReplyAt: null,
    totalResponseCount: 0,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Supplier Response (canonical event — not free-text memo)
// ══════════════════════════════════════════════════════════════════════════════

export type SupplierResponseType =
  | "acknowledgment_only"
  | "eta_confirmed"
  | "quantity_confirmed"
  | "issue_raised"
  | "revision_requested"
  | "no_response_follow_up";

export const SUPPLIER_RESPONSE_TYPE_LABELS: Record<SupplierResponseType, string> = {
  acknowledgment_only: "수신 확인",
  eta_confirmed: "납기 확인",
  quantity_confirmed: "수량 확인",
  issue_raised: "이슈 발생",
  revision_requested: "수정 요청",
  no_response_follow_up: "미응답 후속",
};

export type SupplierResponseSource =
  | "email"
  | "phone"
  | "portal"
  | "in_person"
  | "other";

export interface SupplierResponseRecord {
  responseId: string;
  purchaseOrderId: string;
  responseType: SupplierResponseType;
  responseSource: SupplierResponseSource;
  receivedAt: string;
  recordedAt: string;
  recordedBy: string | null;
  summary: string;
  confirmedEta: string | null;
  confirmedQtyChanged: boolean;
  confirmedPriceChanged: boolean;
  issueFlag: boolean;
  issueSummary: string | null;
  operatorNote: string | null;
  rawMessageRef: string | null;
}

let _src = 0;
function srUid(): string { return `sr_${Date.now()}_${++_src}`; }

export interface RecordSupplierResponseInput {
  purchaseOrderId: string;
  responseType: SupplierResponseType;
  responseSource: SupplierResponseSource;
  summary: string;
  confirmedEta?: string | null;
  confirmedQtyChanged?: boolean;
  confirmedPriceChanged?: boolean;
  issueFlag?: boolean;
  issueSummary?: string | null;
  operatorNote?: string | null;
  rawMessageRef?: string | null;
  recordedBy?: string | null;
}

export function recordSupplierResponse(
  tracking: PostSendTracking,
  input: RecordSupplierResponseInput
): { tracking: PostSendTracking; response: SupplierResponseRecord } {
  const now = new Date().toISOString();

  const response: SupplierResponseRecord = {
    responseId: srUid(),
    purchaseOrderId: input.purchaseOrderId,
    responseType: input.responseType,
    responseSource: input.responseSource,
    receivedAt: now,
    recordedAt: now,
    recordedBy: input.recordedBy ?? null,
    summary: input.summary,
    confirmedEta: input.confirmedEta ?? null,
    confirmedQtyChanged: input.confirmedQtyChanged ?? false,
    confirmedPriceChanged: input.confirmedPriceChanged ?? false,
    issueFlag: input.issueFlag ?? false,
    issueSummary: input.issueSummary ?? null,
    operatorNote: input.operatorNote ?? null,
    rawMessageRef: input.rawMessageRef ?? null,
  };

  // Update tracking from response
  const updatedTracking: PostSendTracking = {
    ...tracking,
    lastReplyAt: now,
    totalResponseCount: tracking.totalResponseCount + 1,
  };

  // Update confirmed fields if provided
  if (input.confirmedEta) {
    updatedTracking.confirmedEta = input.confirmedEta;
  }
  if (input.confirmedQtyChanged) {
    updatedTracking.confirmedQtyChanged = true;
  }
  if (input.confirmedPriceChanged) {
    updatedTracking.confirmedPriceChanged = true;
  }

  // Update issue flag
  if (input.issueFlag) {
    updatedTracking.supplierIssueFlag = true;
    updatedTracking.supplierIssueSummary = input.issueSummary ?? updatedTracking.supplierIssueSummary;
    updatedTracking.acknowledgmentStatus = "supplier_issue_flagged";
  }

  // If acknowledgment-like response and no issue, set received
  if (
    (input.responseType === "acknowledgment_only" ||
      input.responseType === "eta_confirmed" ||
      input.responseType === "quantity_confirmed") &&
    !input.issueFlag &&
    updatedTracking.acknowledgmentStatus === "awaiting_acknowledgment"
  ) {
    updatedTracking.acknowledgmentStatus = "acknowledgment_received";
    updatedTracking.acknowledgmentReceivedAt = now;
    updatedTracking.acknowledgmentReceivedBy = input.recordedBy ?? null;
    updatedTracking.acknowledgmentSource = input.responseSource;
  }

  return { tracking: updatedTracking, response };
}

// ══════════════════════════════════════════════════════════════════════════════
// Mark Supplier Acknowledged (canonical state transition)
// ══════════════════════════════════════════════════════════════════════════════

export interface MarkAcknowledgedInput {
  acknowledgedAt?: string;
  acknowledgedBy?: string | null;
  responseSource: SupplierResponseSource;
  operatorNote?: string | null;
}

export interface MarkAcknowledgedResult {
  success: boolean;
  newState: PODraftState;
  tracking: PostSendTracking;
  reason: string | null;
}

export function markSupplierAcknowledged(
  detail: PODetailModel,
  tracking: PostSendTracking,
  input: MarkAcknowledgedInput
): MarkAcknowledgedResult {
  // Guard: must be po_sent
  if (detail.draftState !== "po_sent") {
    return {
      success: false,
      newState: detail.draftState,
      tracking,
      reason: "현재 상태에서 공급사 확인을 기록할 수 없습니다.",
    };
  }

  // Guard: already acknowledged
  if (tracking.acknowledgmentStatus === "acknowledgment_received" && (detail.draftState as any) === "po_acknowledged") {
    return {
      success: false,
      newState: detail.draftState,
      tracking,
      reason: "이미 공급사 확인이 완료된 상태입니다.",
    };
  }

  // Guard: must have response source (no baseless acknowledgment)
  if (!input.responseSource) {
    return {
      success: false,
      newState: detail.draftState,
      tracking,
      reason: "확인 출처가 없으면 acknowledgment를 기록할 수 없습니다.",
    };
  }

  const now = input.acknowledgedAt ?? new Date().toISOString();

  const updatedTracking: PostSendTracking = {
    ...tracking,
    acknowledgmentStatus: "acknowledgment_received",
    acknowledgmentReceivedAt: now,
    acknowledgmentReceivedBy: input.acknowledgedBy ?? null,
    acknowledgmentSource: input.responseSource,
  };

  return {
    success: true,
    newState: "po_acknowledged",
    tracking: updatedTracking,
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Follow-up Required Evaluator (policy-based, not intuition)
// ══════════════════════════════════════════════════════════════════════════════

export interface FollowUpPolicy {
  maxHoursBeforeFollowUp: number;
  requireEtaConfirmation: boolean;
  requireQtyConfirmation: boolean;
  autoFlagOnIssue: boolean;
}

export const DEFAULT_FOLLOW_UP_POLICY: FollowUpPolicy = {
  maxHoursBeforeFollowUp: 48,
  requireEtaConfirmation: true,
  requireQtyConfirmation: false,
  autoFlagOnIssue: true,
};

export type FollowUpReasonCode =
  | "no_response_timeout"
  | "supplier_issue_open"
  | "eta_unconfirmed"
  | "qty_discrepancy"
  | "price_discrepancy"
  | "acknowledgment_missing"
  | "response_insufficient";

export type FollowUpUrgency = "low" | "medium" | "high" | "critical";

export interface FollowUpEvaluation {
  requiresFollowUp: boolean;
  followUpReasonCodes: FollowUpReasonCode[];
  urgencyLevel: FollowUpUrgency;
  recommendedNextAction: string;
}

export function evaluatePoFollowUpRequirement(
  tracking: PostSendTracking,
  policy: FollowUpPolicy = DEFAULT_FOLLOW_UP_POLICY,
  nowIso?: string
): FollowUpEvaluation {
  const reasons: FollowUpReasonCode[] = [];
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const sentTime = new Date(tracking.sentAt).getTime();
  const hoursSinceSent = (now - sentTime) / (1000 * 60 * 60);

  // Check no-response timeout
  if (
    tracking.acknowledgmentStatus === "awaiting_acknowledgment" &&
    hoursSinceSent >= policy.maxHoursBeforeFollowUp
  ) {
    reasons.push("no_response_timeout");
  }

  // Check acknowledgment missing
  if (
    tracking.acknowledgmentStatus === "awaiting_acknowledgment" &&
    tracking.totalResponseCount === 0
  ) {
    reasons.push("acknowledgment_missing");
  }

  // Check supplier issue
  if (tracking.supplierIssueFlag && policy.autoFlagOnIssue) {
    reasons.push("supplier_issue_open");
  }

  // Check ETA unconfirmed
  if (policy.requireEtaConfirmation && !tracking.confirmedEta) {
    reasons.push("eta_unconfirmed");
  }

  // Check qty discrepancy
  if (tracking.confirmedQtyChanged) {
    reasons.push("qty_discrepancy");
  }

  // Check price discrepancy
  if (tracking.confirmedPriceChanged) {
    reasons.push("price_discrepancy");
  }

  // Determine urgency
  let urgency: FollowUpUrgency = "low";
  if (reasons.includes("supplier_issue_open")) {
    urgency = "critical";
  } else if (reasons.includes("no_response_timeout")) {
    urgency = "high";
  } else if (reasons.includes("qty_discrepancy") || reasons.includes("price_discrepancy")) {
    urgency = "high";
  } else if (reasons.includes("eta_unconfirmed") || reasons.includes("acknowledgment_missing")) {
    urgency = "medium";
  }

  // Determine recommended action
  let recommendedNextAction: string;
  if (reasons.includes("supplier_issue_open")) {
    recommendedNextAction = "공급사 이슈 해결 필요";
  } else if (reasons.includes("no_response_timeout")) {
    recommendedNextAction = "공급사에 후속 연락 필요";
  } else if (reasons.includes("qty_discrepancy") || reasons.includes("price_discrepancy")) {
    recommendedNextAction = "수량/가격 변동 확인 필요";
  } else if (reasons.includes("eta_unconfirmed")) {
    recommendedNextAction = "납기 확인 요청 필요";
  } else if (reasons.includes("acknowledgment_missing")) {
    recommendedNextAction = "수신 확인 대기 중";
  } else {
    recommendedNextAction = "후속 조치 없음";
  }

  return {
    requiresFollowUp: reasons.length > 0,
    followUpReasonCodes: reasons,
    urgencyLevel: urgency,
    recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Receiving Preparation Entry Gate
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceivingPrepGateIssue {
  code: string;
  message: string;
}

export interface ReceivingPreparationGate {
  allowed: boolean;
  blockingIssues: ReceivingPrepGateIssue[];
  warnings: ReceivingPrepGateIssue[];
  missingConfirmationItems: string[];
}

export function canEnterReceivingPreparation(
  detail: PODetailModel,
  tracking: PostSendTracking,
  policy: FollowUpPolicy = DEFAULT_FOLLOW_UP_POLICY
): ReceivingPreparationGate {
  const blockingIssues: ReceivingPrepGateIssue[] = [];
  const warnings: ReceivingPrepGateIssue[] = [];
  const missingItems: string[] = [];

  // Must be at least po_sent
  if (detail.draftState !== "po_sent" && detail.draftState !== "po_acknowledged") {
    blockingIssues.push({ code: "invalid_state", message: "전송 완료 상태가 아닙니다." });
  }

  // Must have acknowledgment
  if (tracking.acknowledgmentStatus === "awaiting_acknowledgment") {
    blockingIssues.push({ code: "no_acknowledgment", message: "공급사 수신 확인이 없습니다." });
    missingItems.push("공급사 수신 확인");
  }

  // Must not have open issues
  if (tracking.supplierIssueFlag) {
    blockingIssues.push({ code: "unresolved_issue", message: "미해결 공급사 이슈가 있습니다." });
    missingItems.push("공급사 이슈 해결");
  }

  // ETA if required
  if (policy.requireEtaConfirmation && !tracking.confirmedEta) {
    warnings.push({ code: "eta_unconfirmed", message: "납기가 확정되지 않았습니다." });
    missingItems.push("납기 확인");
  }

  // Qty discrepancy
  if (tracking.confirmedQtyChanged) {
    warnings.push({ code: "qty_discrepancy", message: "수량 변동이 감지되었습니다." });
    missingItems.push("수량 변동 확인");
  }

  // Price discrepancy
  if (tracking.confirmedPriceChanged) {
    warnings.push({ code: "price_discrepancy", message: "가격 변동이 감지되었습니다." });
    missingItems.push("가격 변동 확인");
  }

  // Follow-up status
  if (tracking.followUpRequired) {
    warnings.push({ code: "follow_up_pending", message: "후속 확인이 완료되지 않았습니다." });
  }

  return {
    allowed: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingConfirmationItems: missingItems,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Post-Send Workbench Model (center + rail + dock common truth)
// ══════════════════════════════════════════════════════════════════════════════

export interface PostSendWorkbenchModel {
  detail: PODetailModel | null;
  tracking: PostSendTracking | null;
  responses: SupplierResponseRecord[];

  isPostSendTrackingVisible: boolean;
  followUpEvaluation: FollowUpEvaluation;
  receivingGate: ReceivingPreparationGate | null;

  // ── Header substatus ──
  substatusBadge: string;
  substatusColor: "slate" | "amber" | "emerald" | "red" | "blue";

  // ── Sent tracking strip ──
  sentAtDisplay: string;
  lastReplyDisplay: string | null;
  agingHours: number;

  // ── Dock CTAs ──
  primaryAction: PostSendDockAction;
  secondaryActions: PostSendDockAction[];

  // ── Rail checklist ──
  checklistItems: PostSendChecklistItem[];
}

export interface PostSendDockAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface PostSendChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildPostSendWorkbenchModel(input: {
  detail: PODetailModel | null;
  tracking: PostSendTracking | null;
  responses: SupplierResponseRecord[];
  dispatchLog: DispatchLog | null;
  nowIso?: string;
}): PostSendWorkbenchModel {
  const { detail, tracking, responses } = input;

  // Not visible if not in post-send state
  if (!detail || !tracking || (detail.draftState !== "po_sent" && detail.draftState !== "po_acknowledged")) {
    return {
      detail: null,
      tracking: null,
      responses: [],
      isPostSendTrackingVisible: false,
      followUpEvaluation: { requiresFollowUp: false, followUpReasonCodes: [], urgencyLevel: "low", recommendedNextAction: "해당 없음" },
      receivingGate: null,
      substatusBadge: "—",
      substatusColor: "slate",
      sentAtDisplay: "—",
      lastReplyDisplay: null,
      agingHours: 0,
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [],
      checklistItems: [],
    };
  }

  const followUpEval = evaluatePoFollowUpRequirement(tracking, undefined, input.nowIso);
  const receivingGate = canEnterReceivingPreparation(detail, tracking);

  // Aging
  const now = input.nowIso ? new Date(input.nowIso).getTime() : Date.now();
  const sentTime = new Date(tracking.sentAt).getTime();
  const agingHours = Math.round((now - sentTime) / (1000 * 60 * 60));

  // Substatus badge
  let substatusBadge: string;
  let substatusColor: PostSendWorkbenchModel["substatusColor"];
  switch (tracking.acknowledgmentStatus) {
    case "awaiting_acknowledgment":
      substatusBadge = "응답 대기";
      substatusColor = agingHours >= 48 ? "amber" : "slate";
      break;
    case "acknowledgment_received":
      substatusBadge = "확인 수신";
      substatusColor = "emerald";
      break;
    case "follow_up_required":
      substatusBadge = "후속 확인 필요";
      substatusColor = "amber";
      break;
    case "supplier_issue_flagged":
      substatusBadge = "이슈 발생";
      substatusColor = "red";
      break;
  }

  // Checklist
  const checklist: PostSendChecklistItem[] = [
    { label: "발송 완료", status: "done" },
    {
      label: "수신 확인",
      status: tracking.acknowledgmentStatus === "awaiting_acknowledgment" ? "pending"
        : tracking.acknowledgmentStatus === "supplier_issue_flagged" ? "blocked"
          : "done",
    },
    {
      label: "납기 확인",
      status: tracking.confirmedEta ? "done" : "pending",
    },
    {
      label: "수량/가격 확인",
      status: tracking.confirmedQtyChanged || tracking.confirmedPriceChanged ? "blocked" : (tracking.totalResponseCount > 0 ? "done" : "pending"),
    },
    {
      label: "입고 준비 가능",
      status: receivingGate.allowed ? "done" : receivingGate.blockingIssues.length > 0 ? "blocked" : "pending",
    },
  ];

  // Dock actions
  const hasAcknowledgment = tracking.acknowledgmentStatus === "acknowledgment_received";
  const hasIssue = tracking.supplierIssueFlag;

  let primaryAction: PostSendDockAction;
  if (tracking.acknowledgmentStatus === "awaiting_acknowledgment") {
    primaryAction = {
      id: "record_reply",
      label: "공급사 응답 기록",
      enabled: true,
      reason: null,
    };
  } else if (hasIssue) {
    primaryAction = {
      id: "resolve_issue",
      label: "이슈 해결",
      enabled: true,
      reason: null,
    };
  } else if (hasAcknowledgment && !receivingGate.allowed) {
    primaryAction = {
      id: "record_reply",
      label: "추가 확인 기록",
      enabled: true,
      reason: null,
    };
  } else {
    primaryAction = {
      id: "prepare_receiving",
      label: "입고 준비 진행",
      enabled: receivingGate.allowed,
      reason: receivingGate.allowed ? null : `미충족 ${receivingGate.blockingIssues.length}건`,
    };
  }

  const secondaryActions: PostSendDockAction[] = [];

  if (tracking.acknowledgmentStatus === "awaiting_acknowledgment") {
    secondaryActions.push({
      id: "mark_acknowledged",
      label: "수신 확인 처리",
      enabled: tracking.totalResponseCount > 0,
      reason: tracking.totalResponseCount === 0 ? "응답 기록 없이 확인 불가" : null,
    });
  }

  if (!hasIssue) {
    secondaryActions.push({
      id: "open_followup",
      label: "후속 연락 준비",
      enabled: true,
      reason: null,
    });
  }

  if (receivingGate.allowed && primaryAction.id !== "prepare_receiving") {
    secondaryActions.push({
      id: "prepare_receiving",
      label: "입고 준비 진행",
      enabled: true,
      reason: null,
    });
  }

  return {
    detail,
    tracking,
    responses,
    isPostSendTrackingVisible: true,
    followUpEvaluation: followUpEval,
    receivingGate,
    substatusBadge,
    substatusColor,
    sentAtDisplay: tracking.sentAt,
    lastReplyDisplay: tracking.lastReplyAt,
    agingHours,
    primaryAction,
    secondaryActions,
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Sent Queue Row Badge (operations hub sync)
// ══════════════════════════════════════════════════════════════════════════════

export interface SentQueueRowBadge {
  purchaseOrderId: string;
  vendorName: string;
  stateBadge: string;
  substatusBadge: string;
  stateColor: "slate" | "amber" | "emerald" | "red" | "blue";
  agingHours: number;
  followUpRequired: boolean;
  urgencyLevel: FollowUpUrgency;
  nextAction: string;
}

export function buildSentQueueRowBadge(
  detail: PODetailModel,
  tracking: PostSendTracking,
  nowIso?: string
): SentQueueRowBadge {
  const followUp = evaluatePoFollowUpRequirement(tracking, undefined, nowIso);
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const agingHours = Math.round((now - new Date(tracking.sentAt).getTime()) / (1000 * 60 * 60));

  let stateColor: SentQueueRowBadge["stateColor"];
  if (tracking.supplierIssueFlag) {
    stateColor = "red";
  } else if (followUp.requiresFollowUp && followUp.urgencyLevel === "high") {
    stateColor = "amber";
  } else if (tracking.acknowledgmentStatus === "acknowledgment_received") {
    stateColor = "emerald";
  } else if (detail.draftState === "po_acknowledged") {
    stateColor = "blue";
  } else {
    stateColor = "slate";
  }

  const substatusBadge = ACKNOWLEDGMENT_SUBSTATUS_LABELS[tracking.acknowledgmentStatus];

  return {
    purchaseOrderId: detail.purchaseOrderId,
    vendorName: detail.supplierName,
    stateBadge: detail.draftState === "po_acknowledged" ? "공급사 확인" : "전송됨",
    substatusBadge,
    stateColor,
    agingHours,
    followUpRequired: followUp.requiresFollowUp,
    urgencyLevel: followUp.urgencyLevel,
    nextAction: followUp.recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Post-Send Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type PostSendActivityType =
  | "po_sent_confirmed"
  | "supplier_response_recorded"
  | "acknowledgment_marked"
  | "follow_up_flagged"
  | "follow_up_resolved"
  | "supplier_issue_flagged"
  | "supplier_issue_resolved"
  | "receiving_prep_allowed"
  | "receiving_prep_blocked";

export interface PostSendActivity {
  type: PostSendActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  responseId: string | null;
}

export function createPostSendActivity(input: {
  type: PostSendActivityType;
  actorId?: string;
  summary: string;
  responseId?: string;
}): PostSendActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    responseId: input.responseId ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Resolve Supplier Issue
// ══════════════════════════════════════════════════════════════════════════════

export interface ResolveIssueInput {
  resolutionNote: string;
  resolvedBy?: string | null;
}

export function resolveSupplierIssue(
  tracking: PostSendTracking,
  input: ResolveIssueInput
): PostSendTracking {
  if (!tracking.supplierIssueFlag) return tracking;

  return {
    ...tracking,
    supplierIssueFlag: false,
    supplierIssueSummary: null,
    acknowledgmentStatus:
      tracking.acknowledgmentReceivedAt ? "acknowledgment_received" : "awaiting_acknowledgment",
    followUpRequired: false,
    followUpReason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Follow-up Status
// ══════════════════════════════════════════════════════════════════════════════

export function applyFollowUpEvaluation(
  tracking: PostSendTracking,
  evaluation: FollowUpEvaluation
): PostSendTracking {
  const updated: PostSendTracking = {
    ...tracking,
    followUpRequired: evaluation.requiresFollowUp,
    followUpReason: evaluation.followUpReasonCodes.length > 0
      ? evaluation.followUpReasonCodes.join(", ")
      : null,
  };

  // If follow-up required and currently just awaiting, escalate substatus
  if (
    evaluation.requiresFollowUp &&
    tracking.acknowledgmentStatus === "awaiting_acknowledgment" &&
    evaluation.urgencyLevel !== "low"
  ) {
    updated.acknowledgmentStatus = "follow_up_required";
  }

  return updated;
}

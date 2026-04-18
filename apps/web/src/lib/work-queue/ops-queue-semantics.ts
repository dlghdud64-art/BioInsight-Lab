/**
 * Operational Queue Semantics — Canonical Definitions
 *
 * 운영 도메인(견적→발주→입고→재고) 큐 아이템의 substatus별 의미·SLA·CTA·핸드오프를 정의합니다.
 * compare-queue-semantics.ts의 패턴을 운영 체인 전체로 확장한 단일 진실 원천입니다.
 */

import type { TaskStatus, ApprovalStatus, AiActionType } from "./state-mapper";

// ── Types ──

export type OpsStage = "quote" | "order" | "receiving" | "inventory";

export interface OpsSubstatusDefinition {
  substatus: string;
  label: string;
  description: string;
  stage: OpsStage;
  ownerActionType: AiActionType;
  taskStatus: TaskStatus;
  approvalStatus: ApprovalStatus;
  cta: string;
  slaWarningDays: number;
  staleDays: number;
  isTerminal: boolean;
  escalationMeaning: string;
  scoringBoostOnBreach: number;
}

// ── Canonical Substatus Definitions ──

export const OPS_SUBSTATUS_DEFS: Record<string, OpsSubstatusDefinition> = {
  // ═══ 견적 단계 ═══
  quote_draft_generated: {
    substatus: "quote_draft_generated",
    label: "견적 초안 생성",
    description: "AI가 견적 초안을 생성함, 사용자 검토 필요",
    stage: "quote",
    ownerActionType: "QUOTE_DRAFT",
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
    cta: "견적 검토",
    slaWarningDays: 3,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "견적 초안 3일 이상 미검토",
    scoringBoostOnBreach: 10,
  },
  quote_draft_approved: {
    substatus: "quote_draft_approved",
    label: "견적 초안 승인",
    description: "견적 초안이 승인됨, 벤더 발송 대기",
    stage: "quote",
    ownerActionType: "QUOTE_DRAFT",
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
    cta: "이메일 발송",
    slaWarningDays: 1,
    staleDays: 7,
    isTerminal: false,
    escalationMeaning: "승인 후 1일 이상 미발송",
    scoringBoostOnBreach: 15,
  },
  quote_draft_dismissed: {
    substatus: "quote_draft_dismissed",
    label: "견적 초안 거절",
    description: "견적 초안이 거절됨",
    stage: "quote",
    ownerActionType: "QUOTE_DRAFT",
    taskStatus: "COMPLETED",
    approvalStatus: "REJECTED",
    cta: "",
    slaWarningDays: 0,
    staleDays: 0,
    isTerminal: true,
    escalationMeaning: "",
    scoringBoostOnBreach: 0,
  },
  vendor_email_generated: {
    substatus: "vendor_email_generated",
    label: "벤더 이메일 생성",
    description: "벤더 이메일 초안이 준비됨, 검토 필요",
    stage: "quote",
    ownerActionType: "VENDOR_EMAIL_DRAFT",
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
    cta: "이메일 검토",
    slaWarningDays: 3,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "벤더 이메일 3일 이상 미검토",
    scoringBoostOnBreach: 10,
  },
  vendor_email_approved: {
    substatus: "vendor_email_approved",
    label: "벤더 이메일 승인",
    description: "벤더 이메일이 승인됨, 발송 대기",
    stage: "quote",
    ownerActionType: "VENDOR_EMAIL_DRAFT",
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
    cta: "이메일 발송",
    slaWarningDays: 1,
    staleDays: 7,
    isTerminal: false,
    escalationMeaning: "승인 후 1일 이상 미발송",
    scoringBoostOnBreach: 15,
  },
  email_sent: {
    substatus: "email_sent",
    label: "이메일 발송 완료",
    description: "벤더 이메일 발송됨, 응답 대기",
    stage: "quote",
    ownerActionType: "VENDOR_EMAIL_DRAFT",
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "APPROVED",
    cta: "응답 확인",
    slaWarningDays: 7,
    staleDays: 30,
    isTerminal: false,
    escalationMeaning: "벤더 응답 7일 이상 미수신",
    scoringBoostOnBreach: 10,
  },
  vendor_reply_received: {
    substatus: "vendor_reply_received",
    label: "벤더 응답 수신",
    description: "벤더 응답이 도착함, 견적 처리 필요",
    stage: "quote",
    ownerActionType: "VENDOR_RESPONSE_PARSED",
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
    cta: "견적 처리",
    slaWarningDays: 3,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "벤더 응답 3일 이상 미처리",
    scoringBoostOnBreach: 15,
  },
  quote_completed: {
    substatus: "quote_completed",
    label: "견적 완료",
    description: "견적 처리가 완료됨",
    stage: "quote",
    ownerActionType: "QUOTE_DRAFT",
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
    cta: "",
    slaWarningDays: 0,
    staleDays: 0,
    isTerminal: true,
    escalationMeaning: "",
    scoringBoostOnBreach: 0,
  },

  // ═══ 발주 단계 ═══
  followup_draft_generated: {
    substatus: "followup_draft_generated",
    label: "후속 이메일 생성",
    description: "Follow-up 이메일 초안이 생성됨, 검토 필요",
    stage: "order",
    ownerActionType: "FOLLOWUP_DRAFT",
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
    cta: "이메일 검토",
    slaWarningDays: 3,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "후속 이메일 3일 이상 미검토",
    scoringBoostOnBreach: 10,
  },
  followup_approved: {
    substatus: "followup_approved",
    label: "후속 이메일 승인",
    description: "Follow-up 이메일이 승인됨, 발송 대기",
    stage: "order",
    ownerActionType: "FOLLOWUP_DRAFT",
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
    cta: "이메일 발송",
    slaWarningDays: 1,
    staleDays: 7,
    isTerminal: false,
    escalationMeaning: "승인 후 1일 이상 미발송",
    scoringBoostOnBreach: 15,
  },
  followup_sent: {
    substatus: "followup_sent",
    label: "후속 이메일 발송",
    description: "Follow-up 이메일 발송됨, 응답 대기",
    stage: "order",
    ownerActionType: "FOLLOWUP_DRAFT",
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "APPROVED",
    cta: "응답 확인",
    slaWarningDays: 7,
    staleDays: 30,
    isTerminal: false,
    escalationMeaning: "벤더 응답 7일 이상 미수신",
    scoringBoostOnBreach: 10,
  },
  status_change_proposed: {
    substatus: "status_change_proposed",
    label: "상태 변경 제안",
    description: "주문 상태 변경이 제안됨, 승인 필요",
    stage: "order",
    ownerActionType: "STATUS_CHANGE_SUGGEST",
    taskStatus: "REVIEW_NEEDED",
    approvalStatus: "PENDING",
    cta: "상태 변경 검토",
    slaWarningDays: 3,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "상태 변경 3일 이상 미승인",
    scoringBoostOnBreach: 15,
  },
  status_change_approved: {
    substatus: "status_change_approved",
    label: "상태 변경 승인",
    description: "주문 상태 변경이 승인됨",
    stage: "order",
    ownerActionType: "STATUS_CHANGE_SUGGEST",
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
    cta: "",
    slaWarningDays: 0,
    staleDays: 0,
    isTerminal: true,
    escalationMeaning: "",
    scoringBoostOnBreach: 0,
  },
  vendor_response_parsed: {
    substatus: "vendor_response_parsed",
    label: "벤더 응답 분석",
    description: "벤더 응답이 분석됨, 조치 필요",
    stage: "order",
    ownerActionType: "VENDOR_RESPONSE_PARSED",
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
    cta: "응답 확인",
    slaWarningDays: 5,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "벤더 응답 5일 이상 미처리",
    scoringBoostOnBreach: 15,
  },
  purchase_request_created: {
    substatus: "purchase_request_created",
    label: "구매 요청 생성",
    description: "구매 요청이 생성됨, 승인 대기",
    stage: "order",
    ownerActionType: "STATUS_CHANGE_SUGGEST",
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "PENDING",
    cta: "구매 승인",
    slaWarningDays: 5,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "구매 요청 5일 이상 미승인",
    scoringBoostOnBreach: 15,
  },

  // ═══ 입고 단계 ═══
  restock_suggested: {
    substatus: "restock_suggested",
    label: "재발주 제안",
    description: "재발주가 제안됨, 승인 필요",
    stage: "receiving",
    ownerActionType: "REORDER_SUGGESTION",
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "PENDING",
    cta: "재발주 검토",
    slaWarningDays: 5,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "재발주 5일 이상 미승인",
    scoringBoostOnBreach: 15,
  },
  restock_approved: {
    substatus: "restock_approved",
    label: "재발주 승인",
    description: "재발주가 승인됨, 발주 진행 대기",
    stage: "receiving",
    ownerActionType: "REORDER_SUGGESTION",
    taskStatus: "IN_PROGRESS",
    approvalStatus: "APPROVED",
    cta: "발주 진행",
    slaWarningDays: 3,
    staleDays: 14,
    isTerminal: false,
    escalationMeaning: "승인 후 3일 이상 미발주",
    scoringBoostOnBreach: 10,
  },
  restock_ordered: {
    substatus: "restock_ordered",
    label: "재발주 진행",
    description: "재발주가 발주됨, 입고 대기",
    stage: "receiving",
    ownerActionType: "REORDER_SUGGESTION",
    taskStatus: "WAITING_RESPONSE",
    approvalStatus: "APPROVED",
    cta: "입고 확인",
    slaWarningDays: 10,
    staleDays: 30,
    isTerminal: false,
    escalationMeaning: "발주 후 10일 이상 미입고",
    scoringBoostOnBreach: 10,
  },

  // ═══ 재고 단계 ═══
  restock_completed: {
    substatus: "restock_completed",
    label: "입고 완료",
    description: "입고가 완료되어 재고에 반영됨",
    stage: "inventory",
    ownerActionType: "REORDER_SUGGESTION",
    taskStatus: "COMPLETED",
    approvalStatus: "APPROVED",
    cta: "",
    slaWarningDays: 0,
    staleDays: 0,
    isTerminal: true,
    escalationMeaning: "",
    scoringBoostOnBreach: 0,
  },
  expiry_alert_created: {
    substatus: "expiry_alert_created",
    label: "유효기한 알림",
    description: "유효기한 임박 알림이 생성됨, 조치 필요",
    stage: "inventory",
    ownerActionType: "EXPIRY_ALERT",
    taskStatus: "ACTION_NEEDED",
    approvalStatus: "NOT_REQUIRED",
    cta: "재고 확인",
    slaWarningDays: 7,
    staleDays: 30,
    isTerminal: false,
    escalationMeaning: "유효기한 알림 7일 이상 미조치",
    scoringBoostOnBreach: 20,
  },
  expiry_acknowledged: {
    substatus: "expiry_acknowledged",
    label: "유효기한 확인",
    description: "유효기한 알림이 확인됨",
    stage: "inventory",
    ownerActionType: "EXPIRY_ALERT",
    taskStatus: "COMPLETED",
    approvalStatus: "NOT_REQUIRED",
    cta: "",
    slaWarningDays: 0,
    staleDays: 0,
    isTerminal: true,
    escalationMeaning: "",
    scoringBoostOnBreach: 0,
  },
};

// ── Pure Helper Functions ──

/**
 * substatus의 운영 단계를 반환합니다. 운영 도메인이 아니면 null.
 */
export function getOpsStage(substatus: string): OpsStage | null {
  return OPS_SUBSTATUS_DEFS[substatus]?.stage ?? null;
}

/**
 * substatus가 운영 도메인의 터미널 상태인지 확인합니다.
 */
export function isOpsTerminal(substatus: string): boolean {
  return OPS_SUBSTATUS_DEFS[substatus]?.isTerminal ?? false;
}

/**
 * substatus가 운영 도메인 substatus인지 확인합니다.
 */
export function isOpsSubstatus(substatus: string): boolean {
  return substatus in OPS_SUBSTATUS_DEFS;
}

/**
 * substatus의 SLA 경고 임계값을 초과했는지 확인합니다.
 */
export function isOpsSlaBreach(substatus: string, ageDays: number): boolean {
  const def = OPS_SUBSTATUS_DEFS[substatus];
  if (!def || def.isTerminal) return false;
  return def.slaWarningDays > 0 && ageDays >= def.slaWarningDays;
}

/**
 * substatus의 장기 미처리(stale) 임계값을 초과했는지 확인합니다.
 */
export function isOpsStale(substatus: string, ageDays: number): boolean {
  const def = OPS_SUBSTATUS_DEFS[substatus];
  if (!def || def.isTerminal) return false;
  return def.staleDays > 0 && ageDays >= def.staleDays;
}

// ── Handoff Ownership Rules ──

export interface OpsHandoffRule {
  id: string;
  label: string;
  fromStage: OpsStage;
  toStage: OpsStage;
  trigger: string;
  fromActionType: AiActionType;
  toActionType: AiActionType;
}

export const OPS_HANDOFF_RULES: OpsHandoffRule[] = [
  {
    id: "quote_to_order",
    label: "견적 → 발주",
    fromStage: "quote",
    toStage: "order",
    trigger: "Quote.status = PURCHASED",
    fromActionType: "QUOTE_DRAFT",
    toActionType: "STATUS_CHANGE_SUGGEST",
  },
  {
    id: "order_to_receiving",
    label: "발주 → 입고",
    fromStage: "order",
    toStage: "receiving",
    trigger: "Order.status IN (CONFIRMED,SHIPPING) AND InventoryRestock exists",
    fromActionType: "STATUS_CHANGE_SUGGEST",
    toActionType: "REORDER_SUGGESTION",
  },
  {
    id: "receiving_to_inventory",
    label: "입고 → 재고",
    fromStage: "receiving",
    toStage: "inventory",
    trigger: "InventoryRestock.receivingStatus = COMPLETED",
    fromActionType: "REORDER_SUGGESTION",
    toActionType: "EXPIRY_ALERT",
  },
];

// ── Operational Funnel ──

export const OPS_FUNNEL_STAGES: { id: OpsStage; label: string }[] = [
  { id: "quote", label: "견적" },
  { id: "order", label: "발주" },
  { id: "receiving", label: "입고" },
  { id: "inventory", label: "재고 반영" },
];

export type OpsStallPoint = "quote" | "order" | "receiving" | "none";

export const OPS_STALL_LABELS: Record<OpsStallPoint, string> = {
  quote: "견적→발주 전환 정체",
  order: "발주→입고 전환 정체",
  receiving: "입고→재고 반영 정체",
  none: "정체 없음",
};

/**
 * 운영 퍼널에서 가장 큰 드롭오프가 발생하는 단계를 식별합니다.
 */
export function determineOpsStallPoint(counts: {
  totalQuotes: number;
  purchasedQuotes: number;
  confirmedOrders: number;
  completedReceiving: number;
}): OpsStallPoint {
  const { totalQuotes, purchasedQuotes, confirmedOrders, completedReceiving } = counts;
  if (totalQuotes === 0) return "none";
  const drops = [
    { point: "quote" as const, drop: totalQuotes - purchasedQuotes },
    { point: "order" as const, drop: purchasedQuotes - confirmedOrders },
    { point: "receiving" as const, drop: confirmedOrders - completedReceiving },
  ];
  const max = drops.reduce((a, b) => (b.drop > a.drop ? b : a));
  return max.drop > 0 ? max.point : "none";
}

// ── Centralized Activity Labels ──

/** Substatus → Korean activity label. 워크 큐 카드의 1줄 상태 설명. */
export const OPS_ACTIVITY_LABELS: Record<string, string> = {
  // 견적
  quote_draft_generated: "견적 초안이 생성되었습니다",
  quote_draft_approved: "견적 초안이 승인되었습니다",
  quote_draft_dismissed: "견적 초안이 거절되었습니다",
  vendor_email_generated: "벤더 이메일 초안이 준비되었습니다",
  vendor_email_approved: "벤더 이메일이 승인되었습니다",
  email_sent: "이메일이 발송되었습니다",
  vendor_reply_received: "벤더 응답이 도착했습니다",
  quote_completed: "견적 처리가 완료되었습니다",
  // 발주
  followup_draft_generated: "Follow-up 이메일 초안이 생성되었습니다",
  followup_approved: "Follow-up 이메일이 승인되었습니다",
  followup_sent: "Follow-up 이메일이 발송되었습니다",
  status_change_proposed: "상태 변경이 제안되었습니다",
  status_change_approved: "상태 변경이 승인되었습니다",
  vendor_response_parsed: "벤더 응답이 분석되었습니다",
  purchase_request_created: "구매 요청이 생성되었습니다",
  // 입고
  restock_suggested: "재발주가 제안되었습니다",
  restock_approved: "재발주가 승인되었습니다",
  restock_ordered: "재발주가 발주되었습니다",
  // 재고
  restock_completed: "입고가 완료되었습니다",
  expiry_alert_created: "유효기한 알림이 생성되었습니다",
  expiry_acknowledged: "유효기한 알림이 확인되었습니다",
  // 공통
  execution_failed: "실행 중 오류가 발생했습니다",
  budget_insufficient: "예산이 부족합니다",
  permission_denied: "권한이 부족합니다",
};

// ── Canonical Ops Queue Item Types ──

/** 운영자 큐 아이템 타입 — 실행 가능한 단위 */
export interface OpsQueueItemType {
  id: string;
  label: string;
  meaning: string;
  stage: OpsStage;
  sourceSubstatuses: string[];
  sourceEntityType: string;
  owner: "REQUESTER" | "APPROVER" | "OPERATOR";
  primaryCta: { label: string; variant: "default" | "destructive" | "outline"; actionId: string };
  secondaryCta?: { label: string; variant: "default" | "destructive" | "outline"; actionId: string };
  completionRule: string;
  staleRule: { days: number; message: string };
  targetSubstatusOnComplete: string;
}

export const OPS_QUEUE_ITEM_TYPES: Record<string, OpsQueueItemType> = {
  ops_quote_followup: {
    id: "ops_quote_followup",
    label: "견적 후속 조치",
    meaning: "벤더에 견적 발송 후 응답 대기 또는 응답 처리 필요",
    stage: "quote",
    sourceSubstatuses: ["email_sent", "vendor_reply_received"],
    sourceEntityType: "QUOTE",
    owner: "REQUESTER",
    primaryCta: { label: "견적 확인", variant: "default", actionId: "navigate_quote" },
    completionRule: "Quote.status = COMPLETED 또는 PURCHASED",
    staleRule: { days: 14, message: "견적 후속 14일 초과 — 벤더 확인 필요" },
    targetSubstatusOnComplete: "quote_completed",
  },
  ops_purchase_approval: {
    id: "ops_purchase_approval",
    label: "구매 승인 대기",
    meaning: "구매 요청이 승인자 검토를 기다리는 중",
    stage: "order",
    sourceSubstatuses: ["purchase_request_created"],
    sourceEntityType: "PURCHASE_REQUEST",
    owner: "APPROVER",
    primaryCta: { label: "구매 승인", variant: "default", actionId: "approve_purchase" },
    secondaryCta: { label: "구매 반려", variant: "destructive", actionId: "reject_purchase" },
    completionRule: "PurchaseRequest.status = APPROVED 또는 REJECTED",
    staleRule: { days: 5, message: "구매 승인 5일 초과 — 승인자 확인 필요" },
    targetSubstatusOnComplete: "status_change_approved",
  },
  ops_order_tracking: {
    id: "ops_order_tracking",
    label: "발주 추적",
    meaning: "발주 완료 후 배송 확인까지 추적 필요",
    stage: "order",
    sourceSubstatuses: ["followup_sent", "status_change_proposed", "vendor_response_parsed"],
    sourceEntityType: "ORDER",
    owner: "OPERATOR",
    primaryCta: { label: "발주 확인", variant: "outline", actionId: "navigate_order" },
    completionRule: "Order.status = DELIVERED 또는 CANCELLED",
    staleRule: { days: 14, message: "발주 추적 14일 초과 — 배송 확인 필요" },
    targetSubstatusOnComplete: "status_change_approved",
  },
  ops_receiving_pending: {
    id: "ops_receiving_pending",
    label: "입고 대기",
    meaning: "배송 완료 후 입고 등록 필요",
    stage: "receiving",
    sourceSubstatuses: ["restock_ordered"],
    sourceEntityType: "INVENTORY_RESTOCK",
    owner: "OPERATOR",
    primaryCta: { label: "입고 등록", variant: "default", actionId: "navigate_receiving" },
    completionRule: "InventoryRestock.receivingStatus = COMPLETED",
    staleRule: { days: 10, message: "입고 대기 10일 초과 — 입고 처리 필요" },
    targetSubstatusOnComplete: "restock_completed",
  },
  ops_receiving_issue: {
    id: "ops_receiving_issue",
    label: "입고 이슈",
    meaning: "입고 과정에서 문제가 발생하여 해결 필요",
    stage: "receiving",
    sourceSubstatuses: ["restock_suggested"],
    sourceEntityType: "INVENTORY_RESTOCK",
    owner: "OPERATOR",
    primaryCta: { label: "이슈 해결", variant: "destructive", actionId: "navigate_receiving" },
    completionRule: "InventoryRestock.receivingStatus = COMPLETED 또는 재발주",
    staleRule: { days: 5, message: "입고 이슈 5일 초과 — 즉시 해결 필요" },
    targetSubstatusOnComplete: "restock_completed",
  },
  ops_restock_confirm: {
    id: "ops_restock_confirm",
    label: "재고 반영 확인",
    meaning: "입고 완료 후 재고 수량 반영 확인 필요",
    stage: "inventory",
    sourceSubstatuses: ["restock_completed"],
    sourceEntityType: "INVENTORY_RESTOCK",
    owner: "OPERATOR",
    primaryCta: { label: "재고 확인", variant: "default", actionId: "confirm_restock" },
    completionRule: "ProductInventory.currentQuantity 반영 확인",
    staleRule: { days: 3, message: "재고 반영 3일 초과 — 확인 필요" },
    targetSubstatusOnComplete: "restock_completed",
  },
  ops_stalled_handoff: {
    id: "ops_stalled_handoff",
    label: "정체 핸드오프",
    meaning: "다음 단계로의 전환이 SLA를 초과하여 정체됨",
    stage: "quote",
    sourceSubstatuses: [],
    sourceEntityType: "MIXED",
    owner: "OPERATOR",
    primaryCta: { label: "정체 해소", variant: "destructive", actionId: "resolve_stall" },
    completionRule: "하위 단계 진행 또는 취소",
    staleRule: { days: 7, message: "핸드오프 정체 7일 초과 — 즉시 조치 필요" },
    targetSubstatusOnComplete: "execution_failed",
  },
};

// ── Queue Ownership Transfer Rules ──

export interface OpsOwnershipTransfer {
  id: string;
  label: string;
  previousOwner: "REQUESTER" | "APPROVER" | "OPERATOR";
  nextOwner: "REQUESTER" | "APPROVER" | "OPERATOR";
  fromQueueItemType: string;
  toQueueItemType: string;
  transferEvent: string;
  blockingCondition: string;
  closesSubstatus: string;
  opensSubstatus: string;
}

export const OPS_OWNERSHIP_TRANSFERS: OpsOwnershipTransfer[] = [
  {
    id: "quote_to_purchase",
    label: "견적 → 구매 승인",
    previousOwner: "REQUESTER",
    nextOwner: "APPROVER",
    fromQueueItemType: "ops_quote_followup",
    toQueueItemType: "ops_purchase_approval",
    transferEvent: "Quote.status = COMPLETED → PurchaseRequest 생성",
    blockingCondition: "예산 부족 또는 승인자 미지정",
    closesSubstatus: "quote_completed",
    opensSubstatus: "purchase_request_created",
  },
  {
    id: "order_to_receiving",
    label: "발주 → 입고",
    previousOwner: "OPERATOR",
    nextOwner: "OPERATOR",
    fromQueueItemType: "ops_order_tracking",
    toQueueItemType: "ops_receiving_pending",
    transferEvent: "Order.status = DELIVERED → InventoryRestock 입고 대기",
    blockingCondition: "배송 지연 또는 주문 취소",
    closesSubstatus: "status_change_approved",
    opensSubstatus: "restock_ordered",
  },
  {
    id: "receiving_to_inventory",
    label: "입고 → 재고 반영",
    previousOwner: "OPERATOR",
    nextOwner: "OPERATOR",
    fromQueueItemType: "ops_receiving_pending",
    toQueueItemType: "ops_restock_confirm",
    transferEvent: "InventoryRestock.receivingStatus = COMPLETED",
    blockingCondition: "입고 이슈 미해결",
    closesSubstatus: "restock_ordered",
    opensSubstatus: "restock_completed",
  },
];

// ── Ops Queue CTA Map (for work-queue-inbox.tsx) ──

/** substatus → 큐 카드 CTA 매핑. COMPARE_CTA_MAP 패턴과 동일. */
export const OPS_QUEUE_CTA_MAP: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = {
  // 견적 단계
  quote_draft_generated: { label: "견적 검토", variant: "default" },
  quote_draft_approved: { label: "이메일 발송", variant: "default" },
  vendor_email_generated: { label: "이메일 검토", variant: "default" },
  vendor_email_approved: { label: "이메일 발송", variant: "default" },
  email_sent: { label: "응답 확인", variant: "outline" },
  vendor_reply_received: { label: "견적 처리", variant: "destructive" },
  // 발주 단계
  followup_draft_generated: { label: "이메일 검토", variant: "default" },
  followup_approved: { label: "이메일 발송", variant: "default" },
  followup_sent: { label: "응답 확인", variant: "outline" },
  status_change_proposed: { label: "상태 변경 검토", variant: "default" },
  vendor_response_parsed: { label: "응답 확인", variant: "destructive" },
  purchase_request_created: { label: "구매 승인", variant: "default" },
  // 입고 단계
  restock_suggested: { label: "재발주 검토", variant: "default" },
  restock_approved: { label: "발주 진행", variant: "default" },
  restock_ordered: { label: "입고 확인", variant: "outline" },
  // 재고 단계
  expiry_alert_created: { label: "재고 확인", variant: "destructive" },
};

// ── determineOpsQueueItemType ──

export interface OpsQueueItemTypeInput {
  entityType: "QUOTE" | "PURCHASE_REQUEST" | "ORDER" | "INVENTORY_RESTOCK";
  quoteStatus?: string;
  purchaseRequestStatus?: string;
  orderStatus?: string;
  receivingStatus?: string;
  inventoryReflected?: boolean;
  ageDays?: number;
  slaWarningDays?: number;
}

/**
 * 엔티티 상태를 기반으로 적절한 큐 아이템 타입 ID를 반환합니다.
 * 해당 없으면 null.
 */
export function determineOpsQueueItemType(input: OpsQueueItemTypeInput): string | null {
  const { entityType, quoteStatus, purchaseRequestStatus, orderStatus, receivingStatus, inventoryReflected, ageDays, slaWarningDays } = input;

  // SLA 초과 시 stalled handoff
  if (ageDays !== undefined && slaWarningDays !== undefined && slaWarningDays > 0 && ageDays >= slaWarningDays * 2) {
    return "ops_stalled_handoff";
  }

  switch (entityType) {
    case "QUOTE":
      if (quoteStatus === "SENT" || quoteStatus === "RESPONDED") {
        return "ops_quote_followup";
      }
      return null;

    case "PURCHASE_REQUEST":
      if (purchaseRequestStatus === "PENDING") {
        return "ops_purchase_approval";
      }
      return null;

    case "ORDER":
      if (orderStatus === "ORDERED" || orderStatus === "CONFIRMED" || orderStatus === "SHIPPING") {
        return "ops_order_tracking";
      }
      return null;

    case "INVENTORY_RESTOCK":
      if (receivingStatus === "ISSUE") {
        return "ops_receiving_issue";
      }
      if (receivingStatus === "PENDING" || receivingStatus === "PARTIAL") {
        return "ops_receiving_pending";
      }
      if (receivingStatus === "COMPLETED" && !inventoryReflected) {
        return "ops_restock_confirm";
      }
      return null;

    default:
      return null;
  }
}

// ── CTA Completion Definitions ──

/** CTA 실행 시 발생하는 상태 전이·소유권 이전·다음 큐 생성을 정의합니다. */
export interface OpsCTACompletionDef {
  ctaId: string;
  label: string;
  sourceQueueItemType: string;
  sourceSubstatuses: string[];
  successTransition: string;
  failureTransition: string;
  ownershipTransferId: string | null;
  nextQueueItemType: string | null;
  activityLogEvent: string;
  duplicateProtection: "taskStatus";
}

export const OPS_CTA_COMPLETION_DEFS: Record<string, OpsCTACompletionDef> = {
  review_quote: {
    ctaId: "review_quote",
    label: "견적 확인 완료",
    sourceQueueItemType: "ops_quote_followup",
    sourceSubstatuses: ["email_sent", "vendor_reply_received"],
    successTransition: "quote_completed",
    failureTransition: "execution_failed",
    ownershipTransferId: null,
    nextQueueItemType: null,
    activityLogEvent: "QUOTE_DRAFT_REVIEWED",
    duplicateProtection: "taskStatus",
  },
  approve_purchase: {
    ctaId: "approve_purchase",
    label: "구매 승인",
    sourceQueueItemType: "ops_purchase_approval",
    sourceSubstatuses: ["purchase_request_created"],
    successTransition: "status_change_approved",
    failureTransition: "execution_failed",
    ownershipTransferId: "quote_to_purchase",
    nextQueueItemType: "ops_order_tracking",
    activityLogEvent: "ORDER_STATUS_CHANGE_APPROVED",
    duplicateProtection: "taskStatus",
  },
  reject_purchase: {
    ctaId: "reject_purchase",
    label: "구매 반려",
    sourceQueueItemType: "ops_purchase_approval",
    sourceSubstatuses: ["purchase_request_created"],
    successTransition: "execution_failed",
    failureTransition: "execution_failed",
    ownershipTransferId: null,
    nextQueueItemType: null,
    activityLogEvent: "AI_TASK_FAILED",
    duplicateProtection: "taskStatus",
  },
  complete_order: {
    ctaId: "complete_order",
    label: "발주 완료 확인",
    sourceQueueItemType: "ops_order_tracking",
    sourceSubstatuses: ["followup_sent", "status_change_proposed", "vendor_response_parsed"],
    successTransition: "status_change_approved",
    failureTransition: "execution_failed",
    ownershipTransferId: "order_to_receiving",
    nextQueueItemType: "ops_receiving_pending",
    activityLogEvent: "ORDER_STATUS_CHANGE_APPROVED",
    duplicateProtection: "taskStatus",
  },
  confirm_receiving: {
    ctaId: "confirm_receiving",
    label: "입고 완료 확인",
    sourceQueueItemType: "ops_receiving_pending",
    sourceSubstatuses: ["restock_ordered"],
    successTransition: "restock_completed",
    failureTransition: "execution_failed",
    ownershipTransferId: "receiving_to_inventory",
    nextQueueItemType: "ops_restock_confirm",
    activityLogEvent: "AI_TASK_COMPLETED",
    duplicateProtection: "taskStatus",
  },
  resolve_receiving_issue: {
    ctaId: "resolve_receiving_issue",
    label: "입고 이슈 해결",
    sourceQueueItemType: "ops_receiving_issue",
    sourceSubstatuses: ["restock_suggested"],
    successTransition: "restock_ordered",
    failureTransition: "execution_failed",
    ownershipTransferId: null,
    nextQueueItemType: null,
    activityLogEvent: "INVENTORY_RESTOCK_REVIEWED",
    duplicateProtection: "taskStatus",
  },
  confirm_restock: {
    ctaId: "confirm_restock",
    label: "재고 반영 확인",
    sourceQueueItemType: "ops_restock_confirm",
    sourceSubstatuses: ["restock_completed"],
    successTransition: "restock_completed",
    failureTransition: "execution_failed",
    ownershipTransferId: null,
    nextQueueItemType: null,
    activityLogEvent: "AI_TASK_COMPLETED",
    duplicateProtection: "taskStatus",
  },
  resolve_stall: {
    ctaId: "resolve_stall",
    label: "정체 해소",
    sourceQueueItemType: "ops_stalled_handoff",
    sourceSubstatuses: [],
    successTransition: "execution_failed",
    failureTransition: "execution_failed",
    ownershipTransferId: null,
    nextQueueItemType: null,
    activityLogEvent: "AI_TASK_FAILED",
    duplicateProtection: "taskStatus",
  },
};

/** ctaId로 CTA 완료 정의를 찾습니다. */
export function findCompletionDef(ctaId: string): OpsCTACompletionDef | null {
  return OPS_CTA_COMPLETION_DEFS[ctaId] ?? null;
}

/** transferId로 소유권 이전 규칙을 찾습니다. */
export function resolveOwnershipTransfer(transferId: string): OpsOwnershipTransfer | null {
  return OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === transferId) ?? null;
}

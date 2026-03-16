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

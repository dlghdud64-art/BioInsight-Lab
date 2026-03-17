/**
 * 이벤트-액션 매핑 레이어
 *
 * 각 이벤트 타입이 발생하면 어떤 알림 액션을 생성해야 하는지 결정한다.
 *
 * 규칙:
 * - 내부 이벤트 → IN_APP 알림 + QUEUE_ITEM (작업 큐 항목)
 * - 외부 이벤트 → EMAIL_DRAFT (검토 필수 워크플로: GENERATED → REVIEWED → APPROVED → SENT)
 * - 긴급 이벤트 → ESCALATION (관리자 즉시 알림)
 * - 모든 외부 이메일은 자동 발송 불가 — 반드시 검토 후 승인
 * - 모든 액션은 entityType + entityId 필수 (연결 없는 알림 금지)
 */

import {
  type NotificationEventType,
  type NotificationActionType,
  EVENT_TYPE_META,
} from "./event-types";

// ── 액션 생성 파라미터 ──

export interface ActionGenerationParams {
  /** 이벤트 타입 */
  eventType: NotificationEventType;
  /** 대상 엔티티 타입 */
  entityType: string;
  /** 대상 엔티티 ID */
  entityId: string;
  /** 수신자 userId (IN_APP, QUEUE_ITEM 등) */
  recipientId?: string;
  /** 수신자 이메일 (EMAIL_DRAFT) */
  recipientEmail?: string;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
}

export interface ActionTemplate {
  actionType: NotificationActionType;
  /** 초기 상태 — EMAIL_DRAFT는 GENERATED, 나머지는 PENDING */
  initialStatus: string;
  /** 수신자 필드 매핑 */
  requiresRecipientId: boolean;
  requiresRecipientEmail: boolean;
}

// ── 액션 타입별 템플릿 ──

const ACTION_TEMPLATES: Record<NotificationActionType, ActionTemplate> = {
  IN_APP: {
    actionType: "IN_APP",
    initialStatus: "PENDING",
    requiresRecipientId: true,
    requiresRecipientEmail: false,
  },
  EMAIL_DRAFT: {
    actionType: "EMAIL_DRAFT",
    // 이메일은 생성 즉시 GENERATED 상태 — 자동 발송 절대 불가
    initialStatus: "PENDING",
    requiresRecipientId: false,
    requiresRecipientEmail: true,
  },
  QUEUE_ITEM: {
    actionType: "QUEUE_ITEM",
    initialStatus: "PENDING",
    requiresRecipientId: true,
    requiresRecipientEmail: false,
  },
  ESCALATION: {
    actionType: "ESCALATION",
    initialStatus: "PENDING",
    requiresRecipientId: true,
    requiresRecipientEmail: false,
  },
};

/**
 * 이벤트 타입에 대한 기본 액션 목록을 조회한다.
 */
export function getDefaultActionsForEvent(
  eventType: NotificationEventType
): NotificationActionType[] {
  const meta = EVENT_TYPE_META[eventType];
  return meta?.defaultActions ?? [];
}

/**
 * 액션 타입에 대한 템플릿(초기 상태, 필수 필드) 조회
 */
export function getActionTemplate(
  actionType: NotificationActionType
): ActionTemplate {
  return ACTION_TEMPLATES[actionType];
}

/**
 * 이메일 액션의 상태 전이 규칙 검증
 *
 * EMAIL_DRAFT 워크플로: PENDING → GENERATED → REVIEWED → APPROVED → SENT
 * 각 전이는 반드시 순서대로 진행되어야 한다.
 */
export const EMAIL_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["GENERATED", "FAILED"],
  GENERATED: ["REVIEWED", "FAILED"],
  REVIEWED: ["APPROVED", "FAILED"],
  APPROVED: ["SENT", "FAILED"],
  SENT: ["READ"],
  READ: [],
  FAILED: [],
};

/**
 * 상태 전이가 유효한지 검증
 */
export function isValidStatusTransition(
  currentStatus: string,
  nextStatus: string
): boolean {
  const allowed = EMAIL_STATUS_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(nextStatus);
}

/**
 * IN_APP / QUEUE_ITEM 상태 전이 규칙
 */
export const SIMPLE_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["SENT", "FAILED"],
  SENT: ["READ"],
  READ: [],
  FAILED: [],
};

/**
 * 액션 타입에 따른 상태 전이 규칙 조회
 */
export function getStatusTransitions(
  actionType: NotificationActionType
): Record<string, string[]> {
  if (actionType === "EMAIL_DRAFT") {
    return EMAIL_STATUS_TRANSITIONS;
  }
  return SIMPLE_STATUS_TRANSITIONS;
}

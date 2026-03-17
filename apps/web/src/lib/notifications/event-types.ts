/**
 * 알림 이벤트 타입 정의
 *
 * 12개 정규 이벤트 타입 — 비즈니스 도메인별 분류.
 * 각 이벤트는 label(한국어), entityType, defaultActions 를 가진다.
 */

// ── 액션 타입 ──

export const NOTIFICATION_ACTION_TYPES = {
  IN_APP: "IN_APP",
  EMAIL_DRAFT: "EMAIL_DRAFT",
  QUEUE_ITEM: "QUEUE_ITEM",
  ESCALATION: "ESCALATION",
} as const;

export type NotificationActionType =
  (typeof NOTIFICATION_ACTION_TYPES)[keyof typeof NOTIFICATION_ACTION_TYPES];

// ── 이벤트 타입 ──

export const NOTIFICATION_EVENT_TYPES = {
  // 견적 관련
  QUOTE_REQUESTED: "QUOTE_REQUESTED",
  QUOTE_RECEIVED: "QUOTE_RECEIVED",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
  // 주문 관련
  ORDER_PLACED: "ORDER_PLACED",
  ORDER_SHIPPED: "ORDER_SHIPPED",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  // 재고 관련
  INVENTORY_LOW: "INVENTORY_LOW",
  INVENTORY_EXPIRING: "INVENTORY_EXPIRING",
  INVENTORY_RECEIVED: "INVENTORY_RECEIVED",
  // 비교·승인·에스컬레이션
  COMPARE_COMPLETED: "COMPARE_COMPLETED",
  APPROVAL_NEEDED: "APPROVAL_NEEDED",
  ESCALATION_TRIGGERED: "ESCALATION_TRIGGERED",
} as const;

export type NotificationEventType =
  (typeof NOTIFICATION_EVENT_TYPES)[keyof typeof NOTIFICATION_EVENT_TYPES];

// ── 이벤트 메타 정의 ──

export interface EventTypeMeta {
  /** 이벤트 타입 키 */
  key: NotificationEventType;
  /** 한국어 라벨 */
  label: string;
  /** 연결 엔티티 도메인 */
  entityType: string;
  /** 기본 생성 액션 목록 */
  defaultActions: NotificationActionType[];
}

/**
 * 이벤트 타입별 메타 맵
 * - 내부 이벤트: IN_APP + QUEUE_ITEM
 * - 외부 이벤트(이메일 필요): EMAIL_DRAFT (발송 전 검토 필수)
 * - 긴급 이벤트: ESCALATION 포함
 */
export const EVENT_TYPE_META: Record<NotificationEventType, EventTypeMeta> = {
  // ── 견적 ──
  QUOTE_REQUESTED: {
    key: "QUOTE_REQUESTED",
    label: "견적 요청 접수",
    entityType: "QUOTE",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },
  QUOTE_RECEIVED: {
    key: "QUOTE_RECEIVED",
    label: "견적서 수신",
    entityType: "QUOTE",
    defaultActions: ["IN_APP", "QUEUE_ITEM", "EMAIL_DRAFT"],
  },
  QUOTE_EXPIRED: {
    key: "QUOTE_EXPIRED",
    label: "견적 만료",
    entityType: "QUOTE",
    defaultActions: ["IN_APP", "EMAIL_DRAFT"],
  },

  // ── 주문 ──
  ORDER_PLACED: {
    key: "ORDER_PLACED",
    label: "주문 생성",
    entityType: "ORDER",
    defaultActions: ["IN_APP", "QUEUE_ITEM", "EMAIL_DRAFT"],
  },
  ORDER_SHIPPED: {
    key: "ORDER_SHIPPED",
    label: "주문 배송 시작",
    entityType: "ORDER",
    defaultActions: ["IN_APP", "EMAIL_DRAFT"],
  },
  ORDER_DELIVERED: {
    key: "ORDER_DELIVERED",
    label: "주문 배송 완료",
    entityType: "ORDER",
    defaultActions: ["IN_APP", "EMAIL_DRAFT"],
  },

  // ── 재고 ──
  INVENTORY_LOW: {
    key: "INVENTORY_LOW",
    label: "재고 부족 경고",
    entityType: "INVENTORY",
    defaultActions: ["IN_APP", "QUEUE_ITEM", "ESCALATION"],
  },
  INVENTORY_EXPIRING: {
    key: "INVENTORY_EXPIRING",
    label: "재고 유효기한 임박",
    entityType: "INVENTORY",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },
  INVENTORY_RECEIVED: {
    key: "INVENTORY_RECEIVED",
    label: "재고 입고 완료",
    entityType: "INVENTORY",
    defaultActions: ["IN_APP"],
  },

  // ── 비교·승인·에스컬레이션 ──
  COMPARE_COMPLETED: {
    key: "COMPARE_COMPLETED",
    label: "비교 분석 완료",
    entityType: "COMPARE",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },
  APPROVAL_NEEDED: {
    key: "APPROVAL_NEEDED",
    label: "승인 요청",
    entityType: "APPROVAL",
    defaultActions: ["IN_APP", "QUEUE_ITEM", "EMAIL_DRAFT"],
  },
  ESCALATION_TRIGGERED: {
    key: "ESCALATION_TRIGGERED",
    label: "에스컬레이션 발생",
    entityType: "ESCALATION",
    defaultActions: ["IN_APP", "ESCALATION"],
  },
};

/**
 * 이벤트 타입이 유효한지 검증
 */
export function isValidEventType(type: string): type is NotificationEventType {
  return type in EVENT_TYPE_META;
}

/**
 * 이벤트 타입의 메타 정보 조회 (타입 가드 포함)
 */
export function getEventTypeMeta(
  type: string
): EventTypeMeta | undefined {
  if (isValidEventType(type)) {
    return EVENT_TYPE_META[type];
  }
  return undefined;
}

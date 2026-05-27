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
  // 예산·공급사 응답·Fast-Track
  BUDGET_WARNING: "BUDGET_WARNING",
  VENDOR_REPLIED: "VENDOR_REPLIED",
  FAST_TRACK_ELIGIBLE: "FAST_TRACK_ELIGIBLE",
  // §11.209d-notification-inapp-server-wiring — 결재 lifecycle 3 type.
  // APPROVAL_NEEDED 와 별개 (defaultActions 의 EMAIL_DRAFT 와 Stage 1
  // sendEmail contract 충돌 방지). entityType = "PURCHASE_REQUEST".
  PURCHASE_APPROVAL_REQUESTED: "PURCHASE_APPROVAL_REQUESTED",
  PURCHASE_APPROVED: "PURCHASE_APPROVED",
  PURCHASE_REJECTED: "PURCHASE_REJECTED",
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
  /**
   * §11.250-p2-review #event-types-semantic-drift — P2 REVIEW cleanup.
   *
   * @deprecated dead path audit 발견 — dispatchNotificationEvent caller 0 (orphan).
   *   vendor 가 quote 응답을 보낸 경우는 VENDOR_REPLIED 를 사용 권장 (§11.229b-5/-6 active path).
   *   QUOTE_RECEIVED 는 향후 quote-level (multi-vendor 응답 집계 / quote document scan 등)
   *   semantic 으로 재정의되지 않는 한 신규 caller 추가 금지.
   *   호환성 위해 enum + meta 보존 (event-category-map 매핑 + isValidEventType 정합).
   */
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
  /**
   * §11.250-p2-review #event-types-semantic-drift — P2 REVIEW cleanup.
   *
   * semantic note: APPROVAL_NEEDED 는 governance-bridge.ts 가 active caller (3 mapping):
   *   - approval_snapshot_invalidated (승인 스냅샷 무효화)
   *   - dispatch_prep_blocked (발송 준비 차단)
   *   - po_data_changed_after_approval (승인 후 PO 본문 변경)
   *
   * PURCHASE_APPROVAL_REQUESTED (§11.209d 결재 lifecycle) 와 의도 분리:
   *   - APPROVAL_NEEDED entityType=APPROVAL, governance-level event (snapshot/dispatch 보호 관점)
   *   - PURCHASE_APPROVAL_REQUESTED entityType=PURCHASE_REQUEST, purchase request 결재 진입 알림
   *   두 path 가 서로 다른 surface (governance ledger vs purchase queue) 에 정합.
   *   신규 caller 는 의도에 맞는 type 을 명시적으로 선택.
   */
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

  // ── 예산·공급사 응답·Fast-Track ──
  BUDGET_WARNING: {
    key: "BUDGET_WARNING",
    label: "예산 경고",
    entityType: "BUDGET",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },
  VENDOR_REPLIED: {
    key: "VENDOR_REPLIED",
    label: "공급사 응답 도착",
    entityType: "QUOTE",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },
  FAST_TRACK_ELIGIBLE: {
    key: "FAST_TRACK_ELIGIBLE",
    label: "즉시 승인 가능 권장",
    entityType: "QUOTE",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },

  // ── §11.209d-notification-inapp-server-wiring — 결재 lifecycle ──
  // EMAIL_DRAFT 제외 (Stage 1 sendEmail 이 직접 즉시 발송 처리).
  PURCHASE_APPROVAL_REQUESTED: {
    key: "PURCHASE_APPROVAL_REQUESTED",
    label: "결재 요청 도착",
    entityType: "PURCHASE_REQUEST",
    defaultActions: ["IN_APP", "QUEUE_ITEM"],
  },
  PURCHASE_APPROVED: {
    key: "PURCHASE_APPROVED",
    label: "결재 승인 완료",
    entityType: "PURCHASE_REQUEST",
    defaultActions: ["IN_APP"],
  },
  PURCHASE_REJECTED: {
    key: "PURCHASE_REJECTED",
    label: "결재 반려",
    entityType: "PURCHASE_REQUEST",
    defaultActions: ["IN_APP"],
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

/**
 * 알림 오케스트레이션 레이어 — 공개 API
 */

// 이벤트 타입 정의
export {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_ACTION_TYPES,
  EVENT_TYPE_META,
  isValidEventType,
  getEventTypeMeta,
  type NotificationEventType,
  type NotificationActionType,
  type EventTypeMeta,
} from "./event-types";

// 이벤트-액션 매핑
export {
  getDefaultActionsForEvent,
  getActionTemplate,
  isValidStatusTransition,
  getStatusTransitions,
  EMAIL_STATUS_TRANSITIONS,
  SIMPLE_STATUS_TRANSITIONS,
} from "./event-action-map";

// 이벤트 디스패처
export {
  dispatchNotificationEvent,
  type DispatchNotificationEventParams,
} from "./event-dispatcher";

// 액션 실행기
export {
  executeNotificationAction,
  reviewEmailDraft,
  approveEmailDraft,
} from "./action-executor";

// 조회 함수
export {
  getUserNotifications,
  markNotificationRead,
  getUnreadCount,
  getEntityNotifications,
  getPendingEmailDrafts,
  type GetUserNotificationsOptions,
  type NotificationItem,
} from "./notification-query";

/**
 * Notification / Escalation 운영 정책 페이지 중앙 계약
 *
 * 핵심 원칙: 알림(Notification)의 목적은 정보 전달이 아니라 운영 행동 유도이다.
 * 에스컬레이션(Escalation)은 예외 처리기가 아니라 SLA 제어 메커니즘이다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** 알림/에스컬레이션 정책 페이지의 필수 섹션 순서 */
export const NOTIFICATION_PAGE_SECTIONS = [
  "header",
  "healthPolicySummary",
  "priorityGaps",
  "policyNavigation",
  "currentPolicySection",
  "deliveryEscalationRules",
  "channelRecipientMapping",
  "deliveryIssuesAudit",
] as const;

export type NotificationPageSection =
  (typeof NOTIFICATION_PAGE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. 알림 이벤트 유형
// ---------------------------------------------------------------------------

/** 운영 이벤트 유형 — 알림 발생의 근거 */
export type NotificationEventType =
  | "approval_requested"
  | "approval_rejected"
  | "delay_warning"
  | "low_stock_detected"
  | "document_missing"
  | "budget_risk_detected"
  | "integration_failure"
  | "sla_exceeded"
  | "vendor_response_received"
  | "order_status_changed"
  | "inventory_expiry_approaching"
  | "permission_escalation";

// ---------------------------------------------------------------------------
// 3. 알림 우선순위
// ---------------------------------------------------------------------------

/** 알림 우선순위 — 채널·톤·배치 여부를 결정 */
export type NotificationPriority =
  | "critical"
  | "high"
  | "normal"
  | "low"
  | "digest";

// ---------------------------------------------------------------------------
// 4. 알림 채널
// ---------------------------------------------------------------------------

/** 알림 전달 채널 */
export type NotificationChannel =
  | "in_app"
  | "email"
  | "team_inbox"
  | "webhook"
  | "sms";

// ---------------------------------------------------------------------------
// 5. 에스컬레이션 트리거
// ---------------------------------------------------------------------------

/** 에스컬레이션 발동 조건 정의 */
export interface EscalationTrigger {
  /** 대상 이벤트 유형 */
  eventType: NotificationEventType;
  /** 발동 조건 */
  condition:
    | "unacknowledged"
    | "unresolved"
    | "sla_exceeded"
    | "repeated_failure";
  /** 발동까지 대기 시간(분) */
  thresholdMinutes: number;
  /** 에스컬레이션 수신 역할 */
  escalateToRole:
    | "approver"
    | "team_lead"
    | "admin"
    | "owner"
    | "budget_owner";
  /** 에스컬레이션 단계 (1→2→3 순차 상승) */
  escalationLevel: 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// 6. 에스컬레이션 기본값
// ---------------------------------------------------------------------------

/** 운영 환경 기본 에스컬레이션 규칙 */
export const ESCALATION_DEFAULTS: readonly EscalationTrigger[] = [
  // 승인 요청 — 4시간 미응답 → 팀 리더
  {
    eventType: "approval_requested",
    condition: "unacknowledged",
    thresholdMinutes: 240,
    escalateToRole: "team_lead",
    escalationLevel: 1,
  },
  // 승인 요청 — 8시간 미응답 → 관리자
  {
    eventType: "approval_requested",
    condition: "unacknowledged",
    thresholdMinutes: 480,
    escalateToRole: "admin",
    escalationLevel: 2,
  },
  // 저재고 감지 — 24시간 미처리 → 관리자
  {
    eventType: "low_stock_detected",
    condition: "unresolved",
    thresholdMinutes: 1440,
    escalateToRole: "admin",
    escalationLevel: 1,
  },
  // SLA 초과 — 1시간 경과 → 관리자
  {
    eventType: "sla_exceeded",
    condition: "sla_exceeded",
    thresholdMinutes: 60,
    escalateToRole: "admin",
    escalationLevel: 1,
  },
  // SLA 초과 — 4시간 경과 → 오너
  {
    eventType: "sla_exceeded",
    condition: "sla_exceeded",
    thresholdMinutes: 240,
    escalateToRole: "owner",
    escalationLevel: 2,
  },
  // 예산 위험 — 2시간 미확인 → 예산 책임자
  {
    eventType: "budget_risk_detected",
    condition: "unacknowledged",
    thresholdMinutes: 120,
    escalateToRole: "budget_owner",
    escalationLevel: 1,
  },
  // 연동 실패 — 6시간 미해결 → 관리자
  {
    eventType: "integration_failure",
    condition: "unresolved",
    thresholdMinutes: 360,
    escalateToRole: "admin",
    escalationLevel: 1,
  },
] as const;

// ---------------------------------------------------------------------------
// 7. 수신자 규칙
// ---------------------------------------------------------------------------

/** 이벤트별 수신자·채널·우선순위 매핑 규칙 */
export interface RecipientRule {
  /** 대상 이벤트 유형 */
  eventType: NotificationEventType;
  /** 수신자 역할 유형 */
  recipientType:
    | "assignee"
    | "approver"
    | "team_lead"
    | "admin"
    | "owner"
    | "requester"
    | "team_inbox";
  /** 전달 채널 */
  channel: NotificationChannel;
  /** 우선순위 */
  priority: NotificationPriority;
  /** 수신 이유 (한국어) — 예: "승인 권한 보유자" */
  reason: string;
}

// ---------------------------------------------------------------------------
// 8. 소음 제어 규칙
// ---------------------------------------------------------------------------

/** 알림 소음 억제 규칙 정의 */
export interface NoiseControlRule {
  /** 규칙 유형 */
  ruleType:
    | "dedup_window"
    | "digest_batch"
    | "suppress_resolved"
    | "suppress_low_value"
    | "cooldown";
  /** 규칙 설명 (한국어) */
  description: string;
  /** 적용 시간 창(분) — 해당하는 경우 */
  windowMinutes?: number;
  /** 시간 창 내 최대 발송 수 — 해당하는 경우 */
  maxPerWindow?: number;
}

// ---------------------------------------------------------------------------
// 9. 소음 제어 기본값
// ---------------------------------------------------------------------------

/** 운영 환경 기본 소음 제어 규칙 */
export const NOISE_CONTROL_DEFAULTS: readonly NoiseControlRule[] = [
  {
    ruleType: "dedup_window",
    description: "동일 이벤트 중복 알림 5분 억제",
    windowMinutes: 5,
    maxPerWindow: 1,
  },
  {
    ruleType: "digest_batch",
    description: "low priority 이벤트 4시간 단위 묶음 발송",
    windowMinutes: 240,
  },
  {
    ruleType: "suppress_resolved",
    description: "이미 처리된 항목 재알림 차단",
  },
  {
    ruleType: "suppress_low_value",
    description: "정보성 알림 자동 in_app 전용 전환",
  },
  {
    ruleType: "cooldown",
    description: "동일 수신자 동일 유형 30분 쿨다운",
    windowMinutes: 30,
    maxPerWindow: 1,
  },
] as const;

// ---------------------------------------------------------------------------
// 10. 전달 상태
// ---------------------------------------------------------------------------

/** 알림 전달 상태 */
export type DeliveryStatus =
  | "sent"
  | "delivered"
  | "failed"
  | "retrying"
  | "suppressed"
  | "escalated";

// ---------------------------------------------------------------------------
// 11. 정책 범위
// ---------------------------------------------------------------------------

/** 알림 정책 범위 — 조직 정책과 개인 수신 설정을 분리 */
export type NotificationPolicyScope = "organization" | "personal";

// ---------------------------------------------------------------------------
// 12. 상태별 문구
// ---------------------------------------------------------------------------

/** 빈 상태 문구 */
export const NOTIFICATION_EMPTY_COPY = {
  title: "설정된 알림 정책이 없습니다",
  description:
    "운영 이벤트에 대한 알림 규칙을 추가하면 미처리 항목을 자동으로 감지하고 에스컬레이션할 수 있습니다.",
  actionLabel: "첫 번째 정책 추가",
  actionHref: "/dashboard/settings/notifications/new",
} as const;

/** 오류 상태 문구 */
export const NOTIFICATION_ERROR_COPY = {
  title: "알림 정책을 불러올 수 없습니다",
  description:
    "일시적인 문제가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.",
  actionLabel: "다시 시도",
  actionHref: "/dashboard/settings/notifications",
} as const;

/** 접근 불가 상태 문구 */
export const NOTIFICATION_UNAVAILABLE_COPY = {
  title: "알림 정책 관리 권한이 없습니다",
  description:
    "조직 알림 정책을 수정하려면 관리자 또는 오너 역할이 필요합니다. 개인 알림 설정은 프로필에서 변경할 수 있습니다.",
  actionLabel: "개인 설정으로 이동",
  actionHref: "/settings/notifications",
} as const;

// ---------------------------------------------------------------------------
// 13. 안티패턴
// ---------------------------------------------------------------------------

/** 알림/에스컬레이션 설계 시 반드시 피해야 할 안티패턴 */
export const NOTIFICATION_ANTI_PATTERNS: readonly string[] = [
  "긴급 이벤트와 일반 안내가 같은 채널/톤으로 전달됨",
  "수신자 기준이 불명확하고 모든 관리자에게 broadcast",
  "escalation 조건 없이 미처리 상태 방치",
  "이미 처리된 항목 알림 반복으로 신뢰 상실",
  "알림에서 queue/detail/action 연결 없음",
  "조직 정책과 개인 설정 혼재",
  "delivery 실패/지연 가시성 없음",
  "알림 과다로 중요 신호 매몰",
] as const;

// ---------------------------------------------------------------------------
// 14. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 알림/에스컬레이션 관련 코드 리뷰 시 점검 항목 */
export const notificationCodeReviewChecklist: readonly string[] = [
  "이벤트 중요도에 따라 채널과 톤이 달라지는가",
  "수신자가 역할 기반으로 결정되고 이유가 있는가",
  "미처리 시 escalation 경로가 정의되어 있는가",
  "중복/소음 억제 규칙이 적용되어 있는가",
  "알림에서 queue/detail/action으로 바로 이동 가능한가",
  "조직 정책과 개인 preference가 분리되어 있는가",
  "delivery 실패와 재시도가 추적되는가",
  "escalation 규칙 변경이 감사 대상인가",
  "이미 처리된 항목 재알림이 차단되는가",
  "모바일에서도 critical 알림이 즉시 도달하는가",
] as const;

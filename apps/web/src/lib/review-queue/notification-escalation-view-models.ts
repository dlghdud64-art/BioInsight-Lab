/**
 * Notification / Escalation UI ViewModel 타입 정의
 *
 * 알림 정책 페이지의 모든 섹션에 대응하는 뷰모델.
 * contract 파일의 운영 타입을 UI 표현 계층으로 변환한다.
 */

import type {
  DeliveryStatus,
  EscalationTrigger,
  NotificationEventType,
  NotificationPriority,
  RecipientRule,
} from "./notification-escalation-contract";

// ---------------------------------------------------------------------------
// 1. 정책 건강 요약 뷰모델
// ---------------------------------------------------------------------------

/** 알림 정책 전반의 운영 건강 상태 요약 */
export interface NotificationHealthSummaryViewModel {
  /** 전체 정책 수 */
  totalPoliciesCount: number;
  /** 활성 정책 수 */
  activePoliciesCount: number;
  /** 에스컬레이션 규칙 수 */
  escalationRulesCount: number;
  /** 소음 제어 규칙 수 */
  noiseControlRulesCount: number;
  /** 최근 전달 실패 수 */
  recentDeliveryFailureCount: number;
  /** 미해결 에스컬레이션 수 */
  unresolvedEscalationCount: number;
  /** 정책 커버리지 갭 목록 (한국어) — 예: "예산 초과 이벤트에 escalation 규칙 없음" */
  coverageGaps: string[];
}

// ---------------------------------------------------------------------------
// 2. 우선순위 갭 뷰모델
// ---------------------------------------------------------------------------

/** 정책 우선순위 갭 — 즉시 조치가 필요한 정책 미비 항목 */
export interface NotificationPriorityGapViewModel {
  id: string;
  /** 갭 제목 */
  title: string;
  /** 갭 상세 설명 */
  description: string;
  /** 갭 유형 */
  gapType:
    | "no_escalation"
    | "no_recipient"
    | "delivery_failing"
    | "noise_excessive"
    | "policy_conflict";
  /** 심각도 */
  severity: "critical" | "high" | "medium";
  /** 조치 버튼 라벨 */
  actionLabel: string;
  /** 조치 대상 경로 */
  actionHref: string;
}

// ---------------------------------------------------------------------------
// 3. 정책 카드 뷰모델
// ---------------------------------------------------------------------------

/** 개별 알림 정책 카드 표시 데이터 */
export interface NotificationPolicyCardViewModel {
  id: string;
  /** 이벤트 유형 라벨 (한국어) */
  eventTypeLabel: string;
  /** 우선순위 라벨 (한국어) */
  priorityLabel: string;
  /** 수신자 역할 라벨 목록 */
  recipientLabels: string[];
  /** 채널 라벨 목록 */
  channelLabels: string[];
  /** 에스컬레이션 요약 — 예: "4시간 미처리 시 팀 리더에게 전달" */
  escalationSummary?: string;
  /** 소음 제어 요약 */
  noiseControlSummary?: string;
  /** 조직 정책 여부 (false이면 개인 설정) */
  isOrgPolicy: boolean;
  /** 카드 톤 — 건강/경고/위험 */
  tone: "healthy" | "warning" | "danger";
}

// ---------------------------------------------------------------------------
// 4. 에스컬레이션 규칙 뷰모델
// ---------------------------------------------------------------------------

/** 에스컬레이션 규칙 행 표시 데이터 */
export interface EscalationRuleViewModel {
  id: string;
  /** 이벤트 유형 라벨 */
  eventTypeLabel: string;
  /** 발동 조건 라벨 */
  conditionLabel: string;
  /** 대기 시간 라벨 — 예: "4시간 미응답" */
  thresholdLabel: string;
  /** 에스컬레이션 대상 라벨 — 예: "팀 리더" */
  escalateToLabel: string;
  /** 단계 라벨 — 예: "1단계" */
  levelLabel: string;
  /** 활성 여부 */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// 5. 전달 이슈 뷰모델
// ---------------------------------------------------------------------------

/** 알림 전달 문제 행 표시 데이터 */
export interface DeliveryIssueViewModel {
  id: string;
  /** 이벤트 라벨 */
  eventLabel: string;
  /** 수신자 라벨 */
  recipientLabel: string;
  /** 채널 라벨 */
  channelLabel: string;
  /** 전달 상태 */
  status: DeliveryStatus;
  /** 전달 상태 라벨 (한국어) */
  statusLabel: string;
  /** 실패 사유 */
  failureReason?: string;
  /** 최근 시도 시각 라벨 */
  lastAttemptLabel: string;
  /** 재시도 액션 라벨 */
  retryActionLabel?: string;
}

// ---------------------------------------------------------------------------
// 6. 감사 기록 뷰모델
// ---------------------------------------------------------------------------

/** 알림 정책 변경 감사 기록 행 */
export interface NotificationAuditEntryViewModel {
  id: string;
  /** 수행자 이름 */
  actorName: string;
  /** 수행 행위 */
  action: string;
  /** 대상 라벨 */
  targetLabel: string;
  /** 시각 라벨 */
  timeLabel: string;
}

// ---------------------------------------------------------------------------
// 7. 페이지 최상위 뷰모델
// ---------------------------------------------------------------------------

/** 알림/에스컬레이션 정책 페이지 전체 뷰모델 */
export interface NotificationPageViewModel {
  /** 페이지 헤더 */
  header: {
    title: string;
    purposeDescription: string;
    primaryActionLabel?: string;
    primaryActionHref?: string;
  };
  /** 건강 요약 */
  healthSummary: NotificationHealthSummaryViewModel;
  /** 우선순위 갭 목록 */
  priorityGaps: NotificationPriorityGapViewModel[];
  /** 정책 카드 목록 */
  policies: NotificationPolicyCardViewModel[];
  /** 에스컬레이션 규칙 목록 */
  escalationRules: EscalationRuleViewModel[];
  /** 소음 제어 규칙 목록 */
  noiseControlRules: {
    ruleTypeLabel: string;
    description: string;
    isActive: boolean;
  }[];
  /** 전달 문제 목록 */
  deliveryIssues: DeliveryIssueViewModel[];
  /** 감사 기록 목록 */
  auditEntries: NotificationAuditEntryViewModel[];
  /** 페이지 상태 */
  pageState: {
    isEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
    unavailableReason?: string;
  };
}

// ---------------------------------------------------------------------------
// 8. 헬퍼: 이벤트 → 우선순위 해석
// ---------------------------------------------------------------------------

/**
 * 이벤트 유형으로부터 기본 알림 우선순위를 결정한다.
 *
 * - critical: SLA 초과, 연동 실패 등 즉시 대응 필요
 * - high: 승인 요청, 예산 위험 등 행동 필요
 * - normal: 주문 상태 변경, 벤더 응답 등 상태 업데이트
 * - low: 정보성 이벤트
 */
export function resolveNotificationPriority(
  eventType: NotificationEventType,
): NotificationPriority {
  switch (eventType) {
    case "sla_exceeded":
    case "integration_failure":
      return "critical";

    case "approval_requested":
    case "approval_rejected":
    case "budget_risk_detected":
    case "low_stock_detected":
    case "permission_escalation":
      return "high";

    case "order_status_changed":
    case "vendor_response_received":
    case "delay_warning":
    case "document_missing":
      return "normal";

    case "inventory_expiry_approaching":
      return "low";

    default: {
      const _exhaustive: never = eventType;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// 9. 헬퍼: 에스컬레이션 체인 문자열 생성
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<EscalationTrigger["escalateToRole"], string> = {
  approver: "승인자",
  team_lead: "팀 리더",
  admin: "관리자",
  owner: "오너",
  budget_owner: "예산 책임자",
};

/**
 * 에스컬레이션 트리거 배열을 한국어 체인 문자열로 변환한다.
 *
 * @example
 * formatEscalationChain(triggers)
 * // "4시간 미응답 → 팀 리더 → 8시간 미응답 → 관리자"
 */
export function formatEscalationChain(triggers: EscalationTrigger[]): string {
  const sorted = [...triggers].sort(
    (a, b) => a.escalationLevel - b.escalationLevel,
  );

  return sorted
    .map((t) => {
      const hours = Math.floor(t.thresholdMinutes / 60);
      const mins = t.thresholdMinutes % 60;
      const timeLabel =
        hours > 0 && mins > 0
          ? `${hours}시간 ${mins}분`
          : hours > 0
            ? `${hours}시간`
            : `${mins}분`;

      const conditionLabel =
        t.condition === "unacknowledged"
          ? "미응답"
          : t.condition === "unresolved"
            ? "미해결"
            : t.condition === "sla_exceeded"
              ? "SLA 초과"
              : "반복 실패";

      const role = ROLE_LABELS[t.escalateToRole] ?? t.escalateToRole;
      return `${timeLabel} ${conditionLabel} → ${role}`;
    })
    .join(" → ");
}

// ---------------------------------------------------------------------------
// 10. 헬퍼: 정책 갭 탐지
// ---------------------------------------------------------------------------

/** 모든 알림 이벤트 유형 목록 */
const ALL_EVENT_TYPES: NotificationEventType[] = [
  "approval_requested",
  "approval_rejected",
  "delay_warning",
  "low_stock_detected",
  "document_missing",
  "budget_risk_detected",
  "integration_failure",
  "sla_exceeded",
  "vendor_response_received",
  "order_status_changed",
  "inventory_expiry_approaching",
  "permission_escalation",
];

/** critical/high 우선순위 이벤트 — 에스컬레이션 필수 대상 */
const ESCALATION_REQUIRED_EVENTS: NotificationEventType[] = [
  "sla_exceeded",
  "integration_failure",
  "approval_requested",
  "budget_risk_detected",
  "low_stock_detected",
  "permission_escalation",
];

/**
 * 현재 수신자 규칙과 에스컬레이션 규칙을 분석하여
 * 정책 커버리지 갭을 탐지한다.
 *
 * @param policies - 현재 등록된 수신자 규칙
 * @param escalations - 현재 등록된 에스컬레이션 규칙
 * @returns 탐지된 갭 뷰모델 목록
 */
export function detectPolicyGaps(
  policies: RecipientRule[],
  escalations: EscalationTrigger[],
): NotificationPriorityGapViewModel[] {
  const gaps: NotificationPriorityGapViewModel[] = [];

  const coveredEvents = new Set(policies.map((p) => p.eventType));
  const escalatedEvents = new Set(escalations.map((e) => e.eventType));

  let gapIdx = 0;

  // 수신자 미지정 이벤트 탐지
  for (const eventType of ALL_EVENT_TYPES) {
    if (!coveredEvents.has(eventType)) {
      const priority = resolveNotificationPriority(eventType);
      const severity =
        priority === "critical"
          ? "critical"
          : priority === "high"
            ? "high"
            : "medium";

      gaps.push({
        id: `gap-no-recipient-${gapIdx++}`,
        title: `${eventType} 이벤트에 수신자 없음`,
        description: `${eventType} 이벤트 발생 시 알림을 받을 수신자가 지정되지 않았습니다.`,
        gapType: "no_recipient",
        severity,
        actionLabel: "수신자 규칙 추가",
        actionHref: `/dashboard/settings/notifications/recipients?event=${eventType}`,
      });
    }
  }

  // 에스컬레이션 미설정 이벤트 탐지 (critical/high 이벤트 대상)
  for (const eventType of ESCALATION_REQUIRED_EVENTS) {
    if (!escalatedEvents.has(eventType)) {
      gaps.push({
        id: `gap-no-escalation-${gapIdx++}`,
        title: `${eventType} 이벤트에 에스컬레이션 규칙 없음`,
        description: `${eventType} 이벤트가 미처리 상태로 방치될 경우 상위 역할로 전달되는 경로가 없습니다.`,
        gapType: "no_escalation",
        severity: "high",
        actionLabel: "에스컬레이션 규칙 추가",
        actionHref: `/dashboard/settings/notifications/escalation?event=${eventType}`,
      });
    }
  }

  return gaps;
}

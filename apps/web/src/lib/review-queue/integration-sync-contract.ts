/**
 * Integration / Sync 운영 상태 페이지 중앙 계약
 *
 * 핵심 원칙: 연동(Integration)은 ON/OFF 설정이 아니라,
 * 운영 의존성을 가진 시스템 연결이다.
 * 동기화(Sync) 상태는 연결(Connection) 상태와 반드시 분리하여 표시한다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** 연동 상태 페이지의 필수 섹션 순서 */
export const INTEGRATION_PAGE_SECTIONS = [
  "header",
  "healthSummary",
  "priorityIssues",
  "integrationList",
  "integrationDetail",
  "syncTimeline",
  "impactDependencies",
  "auditSupport",
] as const;

export type IntegrationPageSection =
  (typeof INTEGRATION_PAGE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. 연결 상태
// ---------------------------------------------------------------------------

/** 외부 시스템 연결 상태 — 인증/네트워크 수준 */
export type IntegrationConnectionStatus =
  | "connected"
  | "disconnected"
  | "auth_expired"
  | "scope_insufficient"
  | "rate_limited"
  | "suspended";

// ---------------------------------------------------------------------------
// 3. 동기화 상태
// ---------------------------------------------------------------------------

/** 데이터 동기화 상태 — 연결 상태와 독립적으로 추적 */
export type SyncStatus =
  | "healthy"
  | "syncing"
  | "partial_failure"
  | "full_failure"
  | "stale"
  | "pending"
  | "disabled";

// ---------------------------------------------------------------------------
// 4. 동기화 실패 원인
// ---------------------------------------------------------------------------

/** 동기화 실패의 근본 원인 분류 */
export type SyncFailureReason =
  | "auth_expired"
  | "scope_insufficient"
  | "rate_limit"
  | "vendor_outage"
  | "network_error"
  | "schema_mismatch"
  | "data_conflict"
  | "quota_exceeded"
  | "unknown";

// ---------------------------------------------------------------------------
// 5. 연동 정의
// ---------------------------------------------------------------------------

/** 연동 카테고리 */
export type IntegrationCategory =
  | "vendor_catalog"
  | "procurement"
  | "inventory"
  | "accounting"
  | "auth_sso"
  | "notification"
  | "document";

/** 동기화 주기 */
export type SyncInterval =
  | "realtime"
  | "hourly"
  | "daily"
  | "weekly"
  | "manual";

/** 재시도 정책 */
export interface RetryPolicy {
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 재시도 간 백오프 시간(분) */
  backoffMinutes: number;
  /** 자동 재시도 활성화 여부 */
  autoRetry: boolean;
}

/**
 * 외부 시스템 연동 정의
 *
 * 연동이 어떤 기능과 데이터에 의존하는지,
 * 동기화 주기와 재시도 정책을 포함한다.
 */
export interface IntegrationDefinition {
  /** 연동 고유 식별자 */
  id: string;
  /** 연동 표시 이름 (한국어) */
  name: string;
  /** 연동 설명 (한국어) */
  description: string;
  /** 공급업체 이름 (예: "Thermo Fisher", "VWR", "Sigma-Aldrich") */
  provider: string;
  /** 연동 카테고리 */
  category: IntegrationCategory;
  /** 이 연동에 의존하는 기능 목록 */
  dependentFeatures: string[];
  /** 이 연동에 영향받는 데이터 유형 목록 */
  dependentDataTypes: string[];
  /** 동기화 주기 */
  syncInterval: SyncInterval;
  /** 재시도 정책 */
  retryPolicy: RetryPolicy;
}

// ---------------------------------------------------------------------------
// 6. 연동 건강 임계값
// ---------------------------------------------------------------------------

/**
 * 연동 건강 상태 판단 임계값
 *
 * - syncStalenessMinutes: 마지막 성공 동기화 이후 경과 시간
 * - consecutiveFailures: 연속 실패 횟수
 * - partialFailureRatio: 부분 실패 비율 (0~1)
 */
export const INTEGRATION_HEALTH_THRESHOLDS = {
  syncStalenessMinutes: { warning: 60, danger: 360 },
  consecutiveFailures: { warning: 3, danger: 10 },
  partialFailureRatio: { warning: 0.1, danger: 0.3 },
} as const;

// ---------------------------------------------------------------------------
// 7. 연동 이슈
// ---------------------------------------------------------------------------

/** 연동 이슈 유형 */
export type IntegrationIssueType =
  | "auth_expired"
  | "sync_failure"
  | "scope_change_needed"
  | "rate_limit_hit"
  | "vendor_outage"
  | "data_stale"
  | "partial_sync";

/** 이슈 심각도 */
export type IssueSeverity = "critical" | "high" | "medium" | "low";

/**
 * 연동에서 감지된 이슈
 *
 * 이슈별로 복구 조치, 영향 범위, 감지 시점을 포함하여
 * 운영자가 즉시 행동할 수 있도록 한다.
 */
export interface IntegrationIssue {
  /** 이슈 고유 식별자 */
  id: string;
  /** 해당 연동 식별자 */
  integrationId: string;
  /** 이슈 제목 */
  title: string;
  /** 이슈 상세 설명 */
  description: string;
  /** 이슈 유형 */
  issueType: IntegrationIssueType;
  /** 심각도 */
  severity: IssueSeverity;
  /** 복구 조치 목록 */
  recoveryActions: {
    label: string;
    actionType: RecoveryActionType;
    href?: string;
  }[];
  /** 감지 시점 (ISO 8601) */
  detectedAt: string;
  /** 영향받는 기능 목록 */
  affectedFeatures: string[];
}

// ---------------------------------------------------------------------------
// 8. 복구 조치 유형
// ---------------------------------------------------------------------------

/** 이슈 복구 조치 유형 */
export type RecoveryActionType =
  | "retry"
  | "reconnect"
  | "reauthorize"
  | "adjust_scope"
  | "check_vendor_status"
  | "switch_to_manual"
  | "contact_support"
  | "adjust_rate_limit";

// ---------------------------------------------------------------------------
// 9. 동기화 이벤트 유형
// ---------------------------------------------------------------------------

/** 동기화 타임라인 이벤트 유형 */
export type SyncEventType =
  | "sync_started"
  | "sync_completed"
  | "sync_failed"
  | "partial_sync"
  | "retry_attempted"
  | "connection_changed"
  | "scope_changed"
  | "auth_refreshed";

// ---------------------------------------------------------------------------
// 10~12. 빈 상태 / 에러 / 권한 부족 문구
// ---------------------------------------------------------------------------

/** 연동 목록이 비어있을 때 표시할 문구 */
export const INTEGRATION_EMPTY_COPY = {
  title: "연결된 외부 시스템이 없습니다",
  description:
    "벤더 카탈로그, 조달, 재고, 인증 등 외부 시스템을 연결하면 자동 동기화와 운영 추적이 시작됩니다.",
  actionLabel: "연동 설정으로 이동",
  actionHref: "/dashboard/settings/integrations",
} as const;

/** 연동 상태 로드 실패 시 표시할 문구 */
export const INTEGRATION_ERROR_COPY = {
  title: "연동 상태를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요.",
  actionLabel: "다시 시도",
} as const;

/** 권한 부족으로 연동 설정에 접근 불가할 때 표시할 문구 */
export const INTEGRATION_UNAVAILABLE_COPY = {
  title: "현재 권한으로 연동 설정에 접근할 수 없습니다",
  description: "관리자 또는 Business 플랜 이상에서 사용할 수 있습니다.",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ---------------------------------------------------------------------------
// 13. 안티패턴 목록
// ---------------------------------------------------------------------------

/** 연동 상태 UI에서 반드시 피해야 할 안티패턴 */
export const INTEGRATION_ANTI_PATTERNS: string[] = [
  "연결됨 표시만 있고 실제 sync 상태 불명",
  "마지막 성공/실패 시점 미표시",
  "부분 실패와 전체 실패 미구분",
  "영향 기능/데이터 설명 없음",
  "복구 경로 없이 에러 메시지만 표시",
  "권한 만료/rate limit/벤더 장애 등 원인 미분류",
  "수동 재시도와 자동 재시도 구분 없음",
  "stale 데이터인데 경고 없음",
];

// ---------------------------------------------------------------------------
// 14. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 연동/동기화 UI 코드 리뷰 시 확인할 항목 */
export const integrationCodeReviewChecklist: string[] = [
  "연결 상태와 동기화 상태가 분리되어 보이는가",
  "마지막 성공, 마지막 실패, 현재 상태가 함께 보이는가",
  "영향받는 기능과 데이터 범위가 설명되는가",
  "오류 원인 유형이 분류되어 보이는가",
  "복구 조치(재시도/재연결/재승인/수동 전환)가 제공되는가",
  "부분 실패와 전체 실패가 구분되는가",
  "stale 데이터 경고가 적시에 표시되는가",
  "sync timeline에서 오류 패턴이 보이는가",
  "감사 기록(연결/해제/scope 변경)이 추적되는가",
  "모바일에서 health summary + recovery action 흐름이 유지되는가",
];

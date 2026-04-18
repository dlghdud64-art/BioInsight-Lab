/**
 * Exception Handling / Manual Intervention 운영 계층 중앙 계약
 *
 * 핵심 원칙: 예외(Exception)는 숨겨진 실패가 아니라 관리되는 운영 상태이다.
 * 자동 복구, 사용자 조치, 관리자 개입, 정책 오버라이드는 명확히 분리되어야 한다.
 * 수동 개입(Manual Intervention)은 통제·감사 가능해야 하며,
 * 예외 해결은 정상 워크플로우로의 안전한 복귀로 종료되어야 한다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** 예외 처리 페이지의 필수 섹션 순서 */
export const EXCEPTION_PAGE_SECTIONS = [
  "exceptionSummary",
  "typeOwnerSeverity",
  "recoveryOptions",
  "requiredConditions",
  "relatedContextImpact",
  "confirmExecute",
  "recoveryResultReturn",
  "auditTimelineRootCause",
] as const;

export type ExceptionPageSection =
  (typeof EXCEPTION_PAGE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. 예외 유형
// ---------------------------------------------------------------------------

/** 운영 예외 유형 — 예외 발생 원인 분류 */
export type ExceptionType =
  | "auto_process_failure"
  | "missing_required_input"
  | "integration_failure"
  | "policy_conflict"
  | "data_integrity_error"
  | "user_input_incomplete"
  | "invalid_state_transition"
  | "timeout"
  | "permission_denied"
  | "budget_exceeded"
  | "document_missing"
  | "mapping_conflict"
  | "vendor_unresponsive";

// ---------------------------------------------------------------------------
// 3. 예외 심각도
// ---------------------------------------------------------------------------

/** 예외 심각도 — SLA·에스컬레이션 기준 결정 */
export type ExceptionSeverity = "critical" | "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// 4. 예외 카테고리
// ---------------------------------------------------------------------------

/** 예외 카테고리 — 복구 전략 방향을 결정 */
export type ExceptionCategory =
  | "retryable"
  | "blocked_missing_input"
  | "permission_policy_conflict"
  | "data_conflict"
  | "upstream_failure"
  | "manual_review_required"
  | "override_required";

// ---------------------------------------------------------------------------
// 5. 예외 담당자 역할
// ---------------------------------------------------------------------------

/** 예외 담당자 역할 — 예외 처리 책임 소재 */
export type ExceptionOwnerRole =
  | "current_assignee"
  | "ops_admin"
  | "budget_admin"
  | "catalog_admin"
  | "security_admin"
  | "integration_admin"
  | "team_leader"
  | "approver";

// ---------------------------------------------------------------------------
// 6. 예외 상태
// ---------------------------------------------------------------------------

/** 예외 상태 — 예외 처리 진행 단계 */
export type ExceptionStatus =
  | "detected"
  | "assigned"
  | "in_progress"
  | "waiting_input"
  | "escalated"
  | "partially_resolved"
  | "resolved"
  | "auto_resolved"
  | "cancelled";

// ---------------------------------------------------------------------------
// 7. 복구 액션 유형
// ---------------------------------------------------------------------------

/** 복구 액션 유형 — 예외에 대해 수행 가능한 조치 */
export type RecoveryActionType =
  | "retry"
  | "re_run"
  | "reprocess"
  | "override"
  | "manual_approve"
  | "reassign"
  | "attach_document"
  | "fix_mapping"
  | "bypass"
  | "cancel"
  | "reopen"
  | "escalate";

// ---------------------------------------------------------------------------
// 8. 복구 액션 설명
// ---------------------------------------------------------------------------

/** 복구 액션별 레이블·설명·위험도·확인/사유/감사 요구 수준 */
export const RECOVERY_ACTION_DESCRIPTIONS: Record<
  RecoveryActionType,
  {
    /** 액션 레이블 */
    label: string;
    /** 액션 설명 */
    description: string;
    /** 위험 수준 */
    riskLevel: "low" | "medium" | "high";
    /** 실행 전 확인 필요 여부 */
    requiresConfirm: boolean;
    /** 사유 입력 필요 여부 */
    requiresReasonInput: boolean;
    /** 감사 기록 필요 여부 */
    requiresAudit: boolean;
    /** 실행 권한 수준 */
    permissionLevel: "assignee" | "admin" | "owner";
  }
> = {
  retry: {
    label: "재시도",
    description: "동일 조건으로 다시 실행합니다",
    riskLevel: "low",
    requiresConfirm: false,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "assignee",
  },
  re_run: {
    label: "재실행",
    description: "변경된 입력으로 처음부터 다시 실행합니다",
    riskLevel: "medium",
    requiresConfirm: true,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "assignee",
  },
  reprocess: {
    label: "재처리",
    description: "이전 단계부터 전체 프로세스를 다시 수행합니다",
    riskLevel: "medium",
    requiresConfirm: true,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "admin",
  },
  override: {
    label: "강제 승인/우회",
    description: "정책 또는 조건을 무시하고 강제로 진행합니다",
    riskLevel: "high",
    requiresConfirm: true,
    requiresReasonInput: true,
    requiresAudit: true,
    permissionLevel: "owner",
  },
  manual_approve: {
    label: "수동 승인",
    description: "자동 승인 조건을 충족하지 못한 항목을 수동 승인합니다",
    riskLevel: "medium",
    requiresConfirm: true,
    requiresReasonInput: true,
    requiresAudit: true,
    permissionLevel: "admin",
  },
  reassign: {
    label: "담당자 변경",
    description: "다른 담당자에게 예외 처리를 이관합니다",
    riskLevel: "low",
    requiresConfirm: false,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "admin",
  },
  attach_document: {
    label: "문서 첨부",
    description: "누락된 필수 문서를 첨부하여 차단을 해제합니다",
    riskLevel: "low",
    requiresConfirm: false,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "assignee",
  },
  fix_mapping: {
    label: "매핑 수정",
    description: "데이터 매핑 충돌을 수동으로 해결합니다",
    riskLevel: "medium",
    requiresConfirm: true,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "admin",
  },
  bypass: {
    label: "단계 건너뛰기",
    description: "현재 차단된 단계를 건너뛰고 다음으로 진행합니다",
    riskLevel: "high",
    requiresConfirm: true,
    requiresReasonInput: true,
    requiresAudit: true,
    permissionLevel: "owner",
  },
  cancel: {
    label: "예외 취소",
    description: "예외 처리를 취소하고 원래 상태로 되돌립니다",
    riskLevel: "medium",
    requiresConfirm: true,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "admin",
  },
  reopen: {
    label: "재개",
    description: "종료된 예외를 다시 열어 추가 처리합니다",
    riskLevel: "low",
    requiresConfirm: false,
    requiresReasonInput: false,
    requiresAudit: true,
    permissionLevel: "admin",
  },
  escalate: {
    label: "상위 에스컬레이션",
    description: "더 높은 권한의 담당자에게 에스컬레이션합니다",
    riskLevel: "low",
    requiresConfirm: false,
    requiresReasonInput: true,
    requiresAudit: true,
    permissionLevel: "assignee",
  },
};

// ---------------------------------------------------------------------------
// 9. 예외 항목 인터페이스
// ---------------------------------------------------------------------------

/** 예외 항목 — 운영 예외의 전체 상태 모델 */
export interface ExceptionItem {
  /** 고유 식별자 */
  id: string;
  /** 예외 유형 */
  type: ExceptionType;
  /** 예외 카테고리 */
  category: ExceptionCategory;
  /** 심각도 */
  severity: ExceptionSeverity;
  /** 현재 상태 */
  status: ExceptionStatus;
  /** 예외 제목 (한국어) */
  title: string;
  /** 예외 설명 (한국어) */
  description: string;
  /** 원본 엔티티 유형 (예: "purchase_request", "quote_draft", "approval") */
  sourceEntityType: string;
  /** 원본 엔티티 ID */
  sourceEntityId: string;
  /** 원본 엔티티 표시명 */
  sourceEntityLabel: string;
  /** 담당자 ID */
  ownerId?: string;
  /** 담당자 역할 */
  ownerRole?: ExceptionOwnerRole;
  /** 담당자 이름 */
  ownerName?: string;
  /** 감지 시각 (ISO 8601) */
  detectedAt: string;
  /** 배정 시각 (ISO 8601) */
  assignedAt?: string;
  /** 해결 시각 (ISO 8601) */
  resolvedAt?: string;
  /** 감지 후 경과 시간 (분) */
  elapsedMinutes: number;
  /** SLA 제한 시간 (분) */
  slaMinutes?: number;
  /** 에스컬레이션 여부 */
  isEscalated: boolean;
  /** 현재 에스컬레이션 단계 */
  escalationLevel: number;
  /** 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 차단 조건 목록 */
  blockedConditions: BlockedCondition[];
  /** 사용 가능한 복구 액션 목록 */
  availableActions: RecoveryActionType[];
  /** 워크플로우 복귀 상태 */
  workflowReturnState?: string;
  /** 관련 예외 ID 목록 */
  relatedExceptionIds: string[];
  /** 근본 원인 메모 */
  rootCauseNote?: string;
  /** 태그 */
  tags: string[];
}

// ---------------------------------------------------------------------------
// 10. 차단 조건 인터페이스
// ---------------------------------------------------------------------------

/** 차단 조건 — 예외 해결을 위해 충족해야 할 전제 조건 */
export interface BlockedCondition {
  /** 고유 식별자 */
  id: string;
  /** 조건 레이블 (한국어) */
  label: string;
  /** 조건 유형 */
  type:
    | "document"
    | "permission"
    | "budget"
    | "data"
    | "integration"
    | "predecessor"
    | "input";
  /** 충족 여부 */
  isMet: boolean;
  /** 해결 액션 레이블 (한국어) */
  resolveActionLabel?: string;
  /** 해결 액션 링크 */
  resolveActionHref?: string;
}

// ---------------------------------------------------------------------------
// 11. 에스컬레이션 규칙 인터페이스
// ---------------------------------------------------------------------------

/** 에스컬레이션 규칙 — 자동 에스컬레이션 조건 정의 */
export interface ExceptionEscalationRule {
  /** 출발 에스컬레이션 레벨 */
  fromLevel: number;
  /** 도착 에스컬레이션 레벨 */
  toLevel: number;
  /** 트리거 조건 */
  triggerCondition:
    | "elapsed_time"
    | "retry_exhausted"
    | "severity_upgrade"
    | "manual";
  /** 트리거 기준 시간 (분) */
  triggerThresholdMinutes?: number;
  /** 에스컬레이션 대상 역할 */
  targetRole: ExceptionOwnerRole;
  /** 알림 채널 */
  notifyChannels: ("in_app" | "email" | "slack")[];
}

// ---------------------------------------------------------------------------
// 12. 기본 에스컬레이션 규칙
// ---------------------------------------------------------------------------

/** 기본 에스컬레이션 규칙 — 시간·재시도 기반 자동 단계 상승 */
export const DEFAULT_ESCALATION_RULES: ExceptionEscalationRule[] = [
  {
    fromLevel: 0,
    toLevel: 1,
    triggerCondition: "elapsed_time",
    triggerThresholdMinutes: 60,
    targetRole: "team_leader",
    notifyChannels: ["in_app", "email"],
  },
  {
    fromLevel: 1,
    toLevel: 2,
    triggerCondition: "elapsed_time",
    triggerThresholdMinutes: 240,
    targetRole: "ops_admin",
    notifyChannels: ["in_app", "email", "slack"],
  },
  {
    fromLevel: 2,
    toLevel: 3,
    triggerCondition: "elapsed_time",
    triggerThresholdMinutes: 480,
    targetRole: "security_admin",
    notifyChannels: ["in_app", "email", "slack"],
  },
  {
    fromLevel: 0,
    toLevel: 1,
    triggerCondition: "retry_exhausted",
    targetRole: "ops_admin",
    notifyChannels: ["in_app", "email"],
  },
];

// ---------------------------------------------------------------------------
// 13. 워크플로우 복귀 매핑 인터페이스
// ---------------------------------------------------------------------------

/** 워크플로우 복귀 매핑 — 예외 해결 후 정상 워크플로우로 복귀하는 경로 정의 */
export interface WorkflowReturnMapping {
  /** 예외 유형 */
  exceptionType: ExceptionType;
  /** 해결에 사용된 복구 액션 */
  resolvedVia: RecoveryActionType;
  /** 복귀할 워크플로우 상태 */
  returnToState: string;
  /** 다음 예상 조치 (한국어) */
  nextExpectedAction: string;
  /** 워크플로우 자동 재개 여부 */
  autoResumeWorkflow: boolean;
}

// ---------------------------------------------------------------------------
// 14. 기본 워크플로우 복귀 매핑
// ---------------------------------------------------------------------------

/** 기본 워크플로우 복귀 매핑 — 예외 유형·복구 액션별 복귀 경로 */
export const WORKFLOW_RETURN_MAPPINGS: WorkflowReturnMapping[] = [
  {
    exceptionType: "missing_required_input",
    resolvedVia: "attach_document",
    returnToState: "review_pending",
    nextExpectedAction: "검토 재개",
    autoResumeWorkflow: true,
  },
  {
    exceptionType: "policy_conflict",
    resolvedVia: "override",
    returnToState: "approval_pending",
    nextExpectedAction: "승인 재진행",
    autoResumeWorkflow: false,
  },
  {
    exceptionType: "integration_failure",
    resolvedVia: "retry",
    returnToState: "previous_state",
    nextExpectedAction: "자동 재시도",
    autoResumeWorkflow: true,
  },
  {
    exceptionType: "data_integrity_error",
    resolvedVia: "fix_mapping",
    returnToState: "review_pending",
    nextExpectedAction: "데이터 재검증",
    autoResumeWorkflow: true,
  },
  {
    exceptionType: "budget_exceeded",
    resolvedVia: "manual_approve",
    returnToState: "approved",
    nextExpectedAction: "승인 완료",
    autoResumeWorkflow: true,
  },
  {
    exceptionType: "document_missing",
    resolvedVia: "attach_document",
    returnToState: "submission_ready",
    nextExpectedAction: "제출 준비",
    autoResumeWorkflow: true,
  },
  {
    exceptionType: "vendor_unresponsive",
    resolvedVia: "reassign",
    returnToState: "vendor_contact_pending",
    nextExpectedAction: "벤더 재연락",
    autoResumeWorkflow: false,
  },
  {
    exceptionType: "timeout",
    resolvedVia: "reprocess",
    returnToState: "initial_state",
    nextExpectedAction: "처음부터 재처리",
    autoResumeWorkflow: true,
  },
  {
    exceptionType: "permission_denied",
    resolvedVia: "escalate",
    returnToState: "escalated",
    nextExpectedAction: "상위 검토",
    autoResumeWorkflow: false,
  },
  {
    exceptionType: "mapping_conflict",
    resolvedVia: "fix_mapping",
    returnToState: "compare_needed",
    nextExpectedAction: "비교 재실행",
    autoResumeWorkflow: true,
  },
];

// ---------------------------------------------------------------------------
// 15. 부분 복구 상태 인터페이스
// ---------------------------------------------------------------------------

/** 부분 복구 상태 — 복수 이슈 중 일부만 해결된 중간 상태 */
export interface PartialRecoveryState {
  /** 전체 이슈 수 */
  totalIssues: number;
  /** 해결된 이슈 수 */
  resolvedCount: number;
  /** 미해결 이슈 수 */
  remainingCount: number;
  /** 미해결 항목 목록 */
  remainingItems: {
    id: string;
    title: string;
    severity: ExceptionSeverity;
  }[];
  /** 완전 해결 여부 */
  isFullyResolved: boolean;
}

// ---------------------------------------------------------------------------
// 16. 반복 실패 패턴 인터페이스
// ---------------------------------------------------------------------------

/** 반복 실패 패턴 — 동일 유형 예외의 반복 발생 분석 */
export interface RepeatedFailurePattern {
  /** 패턴 식별자 */
  patternId: string;
  /** 예외 유형 */
  exceptionType: ExceptionType;
  /** 발생 횟수 */
  occurrenceCount: number;
  /** 최초 감지 시각 (ISO 8601) */
  firstDetectedAt: string;
  /** 최근 감지 시각 (ISO 8601) */
  lastDetectedAt: string;
  /** 영향 받은 엔티티 ID 목록 */
  affectedEntities: string[];
  /** 추정 근본 원인 (한국어) */
  suggestedRootCause: string;
  /** 정책 변경 제안 (한국어) */
  suggestedPolicyChange?: string;
  /** 자동화 제안 (한국어) */
  suggestedAutomation?: string;
}

// ---------------------------------------------------------------------------
// 17. 심각도별 SLA 임계값
// ---------------------------------------------------------------------------

/** 심각도별 SLA 임계값 — 응답·해결·자동 에스컬레이션 시간 기준 (분) */
export const EXCEPTION_SEVERITY_THRESHOLDS: Record<
  ExceptionSeverity,
  {
    /** 최대 응답 시간 (분) */
    maxResponseMinutes: number;
    /** 최대 해결 시간 (분) */
    maxResolutionMinutes: number;
    /** 자동 에스컬레이션 시간 (분) */
    autoEscalateAfterMinutes: number;
  }
> = {
  critical: {
    maxResponseMinutes: 30,
    maxResolutionMinutes: 120,
    autoEscalateAfterMinutes: 60,
  },
  high: {
    maxResponseMinutes: 120,
    maxResolutionMinutes: 480,
    autoEscalateAfterMinutes: 240,
  },
  medium: {
    maxResponseMinutes: 480,
    maxResolutionMinutes: 1440,
    autoEscalateAfterMinutes: 720,
  },
  low: {
    maxResponseMinutes: 1440,
    maxResolutionMinutes: 4320,
    autoEscalateAfterMinutes: 2880,
  },
};

// ---------------------------------------------------------------------------
// 18. 상태별 안내 문구
// ---------------------------------------------------------------------------

/** 빈 상태 문구 — 처리 대기 중인 예외가 없을 때 */
export const EXCEPTION_EMPTY_COPY = {
  title: "처리 대기 중인 예외가 없습니다",
  description: "모든 운영 흐름이 정상적으로 작동하고 있습니다",
  actionLabel: null,
} as const;

/** 오류 상태 문구 — 예외 정보를 불러오지 못했을 때 */
export const EXCEPTION_ERROR_COPY = {
  title: "예외 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 접근 불가 문구 — 권한 부족으로 접근할 수 없을 때 */
export const EXCEPTION_UNAVAILABLE_COPY = {
  title: "현재 권한으로 예외 처리 화면에 접근할 수 없습니다",
  description: "운영 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
} as const;

// ---------------------------------------------------------------------------
// 19. 안티 패턴
// ---------------------------------------------------------------------------

/** 예외 처리 UI/UX 안티 패턴 — 운영 화면에서 피해야 할 설계 오류 */
export const EXCEPTION_ANTI_PATTERNS: string[] = [
  "실패는 보이지만 무엇을 해야 하는지 모름",
  "자동 처리 실패와 업무 예외가 같은 오류로 표시",
  "예외에 owner가 없어 방치됨",
  "수동 개입 가능해도 영향 범위가 안 보임",
  "override/retry/reassign/bypass가 구분 없이 섞임",
  "예외 처리 후 workflow 복귀 경로 불명확",
  "반복 예외의 root cause가 드러나지 않음",
  "manual intervention이 audit 없이 수행됨",
];

// ---------------------------------------------------------------------------
// 20. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 예외 처리 코드 리뷰 체크리스트 — PR 검토 시 확인 항목 */
export const exceptionCodeReviewChecklist: string[] = [
  "예외 유형과 심각도가 분류되어 표시되는가",
  "owner가 할당되고 경과 시간이 보이는가",
  "recovery action이 예외 유형에 맞게 필터링되는가",
  "retry/re-run/reprocess가 명확히 구분되는가",
  "override에 강한 confirm과 사유 입력이 요구되는가",
  "blocked condition 목록과 해결 경로가 보이는가",
  "workflow return state가 예측 가능한가",
  "partial recovery가 success와 분리되는가",
  "escalation 규칙이 시간/severity 기반으로 작동하는가",
  "audit/timeline에 모든 intervention이 기록되는가",
];

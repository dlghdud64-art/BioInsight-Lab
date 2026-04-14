/**
 * Task / Assignment / Ownership 중앙 계약
 *
 * 핵심 원칙:
 * - Task는 메모가 아니라 실행 단위이다.
 * - Assignment는 단순 라벨이 아니라 책임 이전이다.
 * - Ownership은 현재 핸들러(owner), 에스컬레이션 소유자(escalationOwner),
 *   검증자(reviewer)를 구분한다.
 * - Task는 생성부터 완료까지 운영 워크플로 및 감사 이력과 연결된다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** Task 상세 페이지의 필수 섹션 순서 */
export const TASK_PAGE_SECTIONS = [
  "taskHeader",
  "currentStatusOwnerDue",
  "taskDefinitionCriteria",
  "dependenciesRelated",
  "actionPanel",
  "timelineAudit",
  "followupNotes",
] as const;

/** 페이지 섹션 유니언 타입 */
export type TaskPageSection = (typeof TASK_PAGE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. Task 유형
// ---------------------------------------------------------------------------

/**
 * 작업 유형 — 작업의 성격에 따라 분류
 *
 * - review: 검토 작업
 * - approval: 승인 작업
 * - follow_up: 후속 조치
 * - remediation: 시정 조치
 * - exception_resolution: 예외 해결
 * - assignment: 배정 작업
 * - document_check: 문서 확인
 * - budget_review: 예산 검토
 * - integration_recovery: 연동 복구
 * - data_fix: 데이터 수정
 * - escalation_followup: 에스컬레이션 후속
 */
export type TaskType =
  | "review"
  | "approval"
  | "follow_up"
  | "remediation"
  | "exception_resolution"
  | "assignment"
  | "document_check"
  | "budget_review"
  | "integration_recovery"
  | "data_fix"
  | "escalation_followup";

// ---------------------------------------------------------------------------
// 3. Task 상태
// ---------------------------------------------------------------------------

/**
 * 작업 상태 — 전이 규칙은 TASK_STATUS_TRANSITIONS 참조
 */
export type TaskStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "done"
  | "verified"
  | "rejected"
  | "reopened"
  | "cancelled";

// ---------------------------------------------------------------------------
// 4. Task 우선순위
// ---------------------------------------------------------------------------

/** 작업 우선순위 */
export type TaskPriority = "critical" | "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// 5. TaskDefinition
// ---------------------------------------------------------------------------

/** 작업 정의 — 실행 단위의 전체 명세 */
export interface TaskDefinition {
  /** 작업 고유 식별자 */
  id: string;
  /** 작업 제목 */
  title: string;
  /** 작업 유형 */
  taskType: TaskType;
  /** 현재 상태 */
  status: TaskStatus;
  /** 우선순위 */
  priority: TaskPriority;
  /** 작업 상세 설명 */
  description: string;
  /** 작업이 발생한 원천 워크플로 컨텍스트 */
  sourceContext: {
    /** 원천 엔티티 유형 (e.g. "quote", "order", "budget") */
    type: string;
    /** 원천 엔티티 ID */
    entityId: string;
    /** 사람이 읽을 수 있는 라벨 */
    label: string;
  };
  /** 기대 결과 — 이 작업이 완료되었을 때 달성해야 하는 상태 (한국어 완료 조건 서술) */
  expectedOutcome: string;
  /** 관련 엔티티 ID 목록 */
  relatedEntityIds: string[];
  /** 완료 조건 */
  completionCriteria: {
    /** 완료 조건 설명 */
    description: string;
    /** 기계 자동 검증 가능 여부 */
    machineVerifiable: boolean;
    /** 사람 검토 필요 여부 */
    humanReviewRequired: boolean;
  };
  /** 작업 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 작업 생성자 ID */
  createdBy: string;
  /** 기한 (ISO 8601, 선택) */
  dueAt?: string;
  /** SLA 시간(시간 단위, 선택) */
  slaHours?: number;
  /** 태그 목록 */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// 6. TaskOwnership
// ---------------------------------------------------------------------------

/** 사용자 슬롯 — 소유권/담당/검증 등에 공통 사용 */
interface UserSlot {
  userId: string;
  name: string;
  role: string;
}

/** 시간이 포함된 사용자 슬롯 */
interface UserSlotWithTime extends UserSlot {
  assignedAt: string;
}

/**
 * 작업 소유권 — currentOwner, assignee, reviewer, escalationOwner를 구분
 *
 * - currentOwner: 현재 실제로 작업을 처리 중인 사람
 * - assignee: 작업이 배정된 사람 (아직 처리 시작 전일 수 있음)
 * - reviewer: 완료 후 검증 책임자
 * - escalationOwner: SLA 위반/차단 시 에스컬레이션 대상
 * - requestedBy: 작업을 요청한 사람
 */
export interface TaskOwnership {
  /** 작업 ID */
  taskId: string;
  /** 현재 핸들러 (처리 중인 사람) */
  currentOwner?: UserSlotWithTime;
  /** 배정된 담당자 */
  assignee?: UserSlot;
  /** 검증/리뷰 담당자 */
  reviewer?: UserSlot;
  /** 에스컬레이션 소유자 */
  escalationOwner?: UserSlot;
  /** 작업 요청자 */
  requestedBy: { userId: string; name: string };
  /** 공유 큐 여부 — true이면 특정 담당자 없이 팀 큐에 있음 */
  isSharedQueue: boolean;
}

// ---------------------------------------------------------------------------
// 7. AssignmentAction
// ---------------------------------------------------------------------------

/** 배정 액션 — 작업을 특정 사용자에게 배정하는 행위 기록 */
export interface AssignmentAction {
  /** 작업 ID */
  taskId: string;
  /** 이전 담당자 (최초 배정 시 없을 수 있음) */
  fromUserId?: string;
  /** 새 담당자 */
  toUserId: string;
  /** 새 담당자 역할 */
  toRole: string;
  /** 배정 사유 (한국어) */
  reason: string;
  /** 인수인계 메모 */
  handoffNote?: string;
  /** 배정 시각 (ISO 8601) */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 8. HandoffRecord
// ---------------------------------------------------------------------------

/** 인수인계 기록 — 작업 책임 이전의 전체 맥락 보존 */
export interface HandoffRecord {
  /** 인수인계 기록 ID */
  id: string;
  /** 작업 ID */
  taskId: string;
  /** 이전 소유자 */
  previousOwner: { userId: string; name: string };
  /** 새 소유자 */
  newOwner: { userId: string; name: string };
  /** 인수인계 사유 (한국어) */
  reason: string;
  /** 인수인계 시점의 작업 상태 */
  currentStatusAtHandoff: TaskStatus;
  /** 인수인계 후 기대되는 다음 행동 (한국어) */
  expectedNextAction: string;
  /** 추가 메모 */
  note?: string;
  /** 인수인계 시각 (ISO 8601) */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 9. TaskCompletionRecord
// ---------------------------------------------------------------------------

/** 작업 완료 기록 — 완료/검증/거부/취소 이력 */
export interface TaskCompletionRecord {
  /** 작업 ID */
  taskId: string;
  /** 완료 처리자 ID */
  completedBy: string;
  /** 완료 시각 (ISO 8601) */
  completedAt: string;
  /** 완료 유형 */
  completionType: "done" | "verified" | "rejected" | "cancelled";
  /** 완료 근거/증빙 */
  evidence?: string;
  /** 검증자 확인 기록 */
  reviewerVerification?: {
    verifiedBy: string;
    verifiedAt: string;
    accepted: boolean;
    rejectReason?: string;
  };
  /** 후속 작업 ID (거부/재오픈 시 생성되는 작업) */
  followUpTaskId?: string;
}

// ---------------------------------------------------------------------------
// 10. 상태 전이 규칙
// ---------------------------------------------------------------------------

/**
 * 작업 상태 전이 규칙 — 각 상태에서 전이 가능한 다음 상태 목록
 *
 * 이 규칙을 벗어나는 전이는 시스템에서 거부해야 한다.
 */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  new: ["assigned", "cancelled"],
  assigned: ["in_progress", "waiting", "cancelled"],
  in_progress: ["waiting", "blocked", "done", "cancelled"],
  waiting: ["in_progress", "blocked", "cancelled"],
  blocked: ["in_progress", "waiting", "cancelled"],
  done: ["verified", "rejected", "reopened"],
  verified: ["reopened"],
  rejected: ["in_progress", "reopened"],
  reopened: ["assigned", "in_progress"],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// 11. 검증 필수 작업 유형
// ---------------------------------------------------------------------------

/**
 * 검증(verification)이 반드시 필요한 작업 유형 목록
 *
 * 이 유형의 작업은 done → verified 전이가 필수이며,
 * reviewer의 승인 없이 완료 처리할 수 없다.
 */
export const VERIFICATION_REQUIRED_TYPES: TaskType[] = [
  "exception_resolution",
  "budget_review",
  "data_fix",
];

// ---------------------------------------------------------------------------
// 12. TaskDependency
// ---------------------------------------------------------------------------

/** 작업 간 의존 관계 — 선행 작업 완료/검증/승인 요구 */
export interface TaskDependency {
  /** 현재 작업 ID */
  taskId: string;
  /** 선행 작업 ID */
  dependsOnTaskId: string;
  /** 의존 유형 */
  dependsOnType: "completion" | "verification" | "approval";
  /** 의존 조건 충족 여부 */
  isMet: boolean;
  /** 의존 관계 설명 (한국어) */
  label: string;
}

// ---------------------------------------------------------------------------
// 13. TaskEscalationRule
// ---------------------------------------------------------------------------

/** 에스컬레이션 규칙 — 조건 발생 시 자동 에스컬레이션 대상 및 메시지 */
export interface TaskEscalationRule {
  /** 적용 대상 작업 유형 */
  taskType: TaskType | "*";
  /** 에스컬레이션 트리거 조건 */
  condition:
    | "overdue"
    | "no_owner"
    | "blocked_long"
    | "repeated_reject"
    | "critical_aging";
  /** 조건 판정 기준 시간 (시간 단위) */
  thresholdHours: number;
  /** 에스컬레이션 대상 역할 */
  escalateTo: string;
  /** 에스컬레이션 메시지 (한국어) */
  message: string;
}

// ---------------------------------------------------------------------------
// 14. 기본 에스컬레이션 규칙
// ---------------------------------------------------------------------------

/** 기본 에스컬레이션 규칙 목록 */
export const DEFAULT_ESCALATION_RULES: TaskEscalationRule[] = [
  {
    taskType: "approval",
    condition: "overdue",
    thresholdHours: 24,
    escalateTo: "operations_manager",
    message: "승인 검토가 24시간 이상 지연되고 있습니다",
  },
  {
    taskType: "*",
    condition: "no_owner",
    thresholdHours: 8,
    escalateTo: "team_lead",
    message: "담당자 미지정 작업이 8시간 이상 방치되고 있습니다",
  },
  {
    taskType: "*",
    condition: "blocked_long",
    thresholdHours: 48,
    escalateTo: "operations_manager",
    message: "차단 상태가 48시간 이상 지속되고 있습니다",
  },
  {
    taskType: "exception_resolution",
    condition: "critical_aging",
    thresholdHours: 12,
    escalateTo: "admin",
    message: "긴급 예외 해결 작업이 12시간 이상 미처리입니다",
  },
];

// ---------------------------------------------------------------------------
// 15. SnoozeSetting
// ---------------------------------------------------------------------------

/** 작업 일시 중단(스누즈) 설정 */
export interface SnoozeSetting {
  /** 작업 ID */
  taskId: string;
  /** 스누즈 설정자 ID */
  snoozedBy: string;
  /** 스누즈 설정 시각 (ISO 8601) */
  snoozedAt: string;
  /** 스누즈 해제 시각 (ISO 8601) */
  snoozeUntil: string;
  /** 스누즈 사유 (한국어) */
  reason: string;
}

// ---------------------------------------------------------------------------
// 16. 상태별 안내 문구 (한국어)
// ---------------------------------------------------------------------------

/** 작업 목록이 비어있을 때 표시할 문구 */
export const TASK_EMPTY_COPY = {
  title: "현재 처리할 작업이 없습니다",
  description: "할당 대기 또는 팀 작업을 확인해보세요",
  actionLabel: "팀 작업 보기",
  actionHref: "/dashboard/tasks?view=team",
} as const;

/** 작업 목록 로드 실패 시 표시할 문구 */
export const TASK_ERROR_COPY = {
  title: "작업 목록을 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 작업 관리 기능 접근 불가 시 표시할 문구 */
export const TASK_UNAVAILABLE_COPY = {
  title: "현재 권한으로 작업 관리 기능에 접근할 수 없습니다",
  description: "관리자에게 권한을 요청하세요",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ---------------------------------------------------------------------------
// 17. 안티패턴 목록
// ---------------------------------------------------------------------------

/**
 * Task/Ownership 구현 시 피해야 할 안티패턴 (한국어)
 *
 * 코드 리뷰 및 설계 검증 시 참조
 */
export const TASK_ANTI_PATTERNS: string[] = [
  "작업 제목만 있고 완료 조건이 없음",
  "owner/assignee/reviewer를 구분하지 않음",
  "shared queue에만 머물며 책임자 부여가 안 됨",
  "due와 SLA가 분리되지 않음",
  "재할당에 이유/이력이 없음",
  "done만 있고 verification/reopen 흐름이 없음",
  "작업이 source workflow와 단절됨",
  "metrics 없이 backlog만 쌓임",
];

// ---------------------------------------------------------------------------
// 18. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/**
 * Task/Ownership 관련 코드 리뷰 체크리스트 (한국어)
 *
 * PR 리뷰 시 아래 항목을 확인한다.
 */
export const taskCodeReviewChecklist: string[] = [
  "TaskDefinition에 completionCriteria가 빠짐없이 명시되어 있는가",
  "상태 전이가 TASK_STATUS_TRANSITIONS 규칙을 준수하는가",
  "VERIFICATION_REQUIRED_TYPES에 해당하는 작업이 done→verified 흐름을 강제하는가",
  "AssignmentAction에 reason(사유)이 필수로 기록되는가",
  "HandoffRecord에 currentStatusAtHandoff와 expectedNextAction이 포함되는가",
  "TaskOwnership의 currentOwner와 assignee가 혼용되지 않는가",
  "에스컬레이션 규칙(DEFAULT_ESCALATION_RULES)이 실제 SLA 정책과 일치하는가",
  "sourceContext를 통해 원천 워크플로와의 연결이 유지되는가",
  "TaskDependency의 isMet 판정 로직이 dependsOnType에 맞게 구현되었는가",
  "SnoozeSetting의 snoozeUntil 이후 자동 재활성화 로직이 존재하는가",
];

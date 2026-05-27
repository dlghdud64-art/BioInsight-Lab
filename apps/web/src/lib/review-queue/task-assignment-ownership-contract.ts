/**
 * Task / Assignment / Ownership 운영 레이어 중앙 계약
 *
 * 핵심 원칙:
 * - Task는 메모가 아니라 실행 단위이다.
 * - Assignment는 단순 라벨이 아니라 책임 이전이다.
 * - Ownership은 현재 핸들러, 에스컬레이션 소유자, 검증자를 구분한다.
 * - Task는 생성부터 완료까지 운영 워크플로 및 감사 이력과 연결된다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** Task 페이지의 필수 섹션 순서 */
export const TASK_PAGE_SECTIONS = [
  "taskDefinition",
  "assignmentOwnership",
  "priorityDueSla",
  "currentStatus",
  "actionHandoffEscalation",
  "completionVerification",
  "auditTimelineContext",
] as const;

export type TaskPageSection = (typeof TASK_PAGE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. Task 유형
// ---------------------------------------------------------------------------

/** 운영 Task 유형 — 작업의 성격과 기본 SLA·검증 여부를 결정 */
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
  | "escalation_followup"
  | "override_review"
  | "vendor_followup";

// ---------------------------------------------------------------------------
// 3. Task 상태
// ---------------------------------------------------------------------------

/** Task 상태 — 전이(transition) 규칙과 UI 표현을 결정 */
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

/** Task 우선순위 — 정렬, 에스컬레이션 트리거, SLA 임계치에 영향 */
export type TaskPriority = "critical" | "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// 5. 상태 → UI 매핑
// ---------------------------------------------------------------------------

/** 상태별 UI 표현 정의 */
export const TASK_STATUS_UI_MAP: Record<
  TaskStatus,
  {
    /** 화면 표시 라벨 */
    label: string;
    /** 색상 톤 */
    tone: "neutral" | "info" | "warning" | "danger" | "success" | "muted";
    /** 종료 상태 여부 — 종료 상태에서는 재개/취소만 가능 */
    isTerminal: boolean;
    /** 차단 상태 여부 — 차단 시 별도 해소 필요 */
    isBlocked: boolean;
  }
> = {
  new: { label: "신규", tone: "neutral", isTerminal: false, isBlocked: false },
  assigned: {
    label: "할당됨",
    tone: "info",
    isTerminal: false,
    isBlocked: false,
  },
  in_progress: {
    label: "처리 중",
    tone: "info",
    isTerminal: false,
    isBlocked: false,
  },
  waiting: {
    label: "대기 중",
    tone: "warning",
    isTerminal: false,
    isBlocked: false,
  },
  blocked: {
    label: "차단됨",
    tone: "danger",
    isTerminal: false,
    isBlocked: true,
  },
  /** done은 종료가 아님 — 검증(verification)이 뒤따를 수 있음 */
  done: {
    label: "완료",
    tone: "success",
    isTerminal: false,
    isBlocked: false,
  },
  verified: {
    label: "검증 완료",
    tone: "success",
    isTerminal: true,
    isBlocked: false,
  },
  rejected: {
    label: "반려됨",
    tone: "danger",
    isTerminal: false,
    isBlocked: false,
  },
  reopened: {
    label: "재개됨",
    tone: "warning",
    isTerminal: false,
    isBlocked: false,
  },
  cancelled: {
    label: "취소됨",
    tone: "muted",
    isTerminal: true,
    isBlocked: false,
  },
};

// ---------------------------------------------------------------------------
// 6. Task 유형별 설명·기본 우선순위·SLA
// ---------------------------------------------------------------------------

/** Task 유형별 기본 설정 — 라벨, 설명, 기본 우선순위, 검증 필수 여부, 일반적 SLA(시간) */
export const TASK_TYPE_DESCRIPTIONS: Record<
  TaskType,
  {
    /** 유형 라벨 */
    label: string;
    /** 유형 설명 */
    description: string;
    /** 기본 우선순위 */
    defaultPriority: TaskPriority;
    /** 검증 필수 여부 */
    verificationRequired: boolean;
    /** 일반적 SLA (시간 단위) */
    typicalSlaHours: number;
  }
> = {
  review: {
    label: "검토",
    description: "항목 검토가 필요합니다",
    defaultPriority: "medium",
    verificationRequired: false,
    typicalSlaHours: 24,
  },
  approval: {
    label: "승인",
    description: "승인 결정이 필요합니다",
    defaultPriority: "high",
    verificationRequired: false,
    typicalSlaHours: 8,
  },
  follow_up: {
    label: "후속 조치",
    description: "이전 처리에 대한 후속 확인이 필요합니다",
    defaultPriority: "medium",
    verificationRequired: false,
    typicalSlaHours: 48,
  },
  remediation: {
    label: "보정/해소",
    description: "누락 또는 오류를 해소해야 합니다",
    defaultPriority: "high",
    verificationRequired: true,
    typicalSlaHours: 24,
  },
  exception_resolution: {
    label: "예외 해결",
    description: "예외 상태를 해결해야 합니다",
    defaultPriority: "high",
    verificationRequired: true,
    typicalSlaHours: 8,
  },
  assignment: {
    label: "배정",
    description: "담당자 지정이 필요합니다",
    defaultPriority: "high",
    verificationRequired: false,
    typicalSlaHours: 4,
  },
  document_check: {
    label: "문서 확인",
    description: "필수 문서를 확인하거나 첨부해야 합니다",
    defaultPriority: "medium",
    verificationRequired: true,
    typicalSlaHours: 24,
  },
  budget_review: {
    label: "예산 검토",
    description: "예산 조건을 검토해야 합니다",
    defaultPriority: "high",
    verificationRequired: true,
    typicalSlaHours: 8,
  },
  integration_recovery: {
    label: "연동 복구",
    description: "외부 시스템 연동을 복구해야 합니다",
    defaultPriority: "critical",
    verificationRequired: true,
    typicalSlaHours: 4,
  },
  data_fix: {
    label: "데이터 수정",
    description: "데이터 정합성 문제를 수정해야 합니다",
    defaultPriority: "medium",
    verificationRequired: true,
    typicalSlaHours: 24,
  },
  escalation_followup: {
    label: "에스컬레이션 후속",
    description: "에스컬레이션된 항목의 후속 처리가 필요합니다",
    defaultPriority: "critical",
    verificationRequired: false,
    typicalSlaHours: 4,
  },
  override_review: {
    label: "예외 승인 검토",
    description: "강제 우회/승인에 대한 사후 검토가 필요합니다",
    defaultPriority: "high",
    verificationRequired: true,
    typicalSlaHours: 24,
  },
  vendor_followup: {
    label: "벤더 팔로업",
    description: "공급사 응답 확인 또는 재연락이 필요합니다",
    defaultPriority: "medium",
    verificationRequired: false,
    typicalSlaHours: 48,
  },
};

// ---------------------------------------------------------------------------
// 7. Task 소유권 (Ownership)
// ---------------------------------------------------------------------------

/** Task 소유권 — 현재 핸들러, 배정자, 검증자, 에스컬레이션 소유자를 구분 */
export interface TaskOwnership {
  /** 현재 소유자 ID */
  currentOwnerId?: string;
  /** 현재 소유자 이름 */
  currentOwnerName?: string;
  /** 현재 소유자 역할 */
  currentOwnerRole?: string;
  /** 배정된 실행자 ID */
  assigneeId?: string;
  /** 배정된 실행자 이름 */
  assigneeName?: string;
  /** 검증자 ID */
  reviewerId?: string;
  /** 검증자 이름 */
  reviewerName?: string;
  /** 에스컬레이션 소유자 ID */
  escalationOwnerId?: string;
  /** 에스컬레이션 소유자 이름 */
  escalationOwnerName?: string;
  /** 요청자 ID */
  requestedById?: string;
  /** 요청자 이름 */
  requestedByName?: string;
  /** 백업 소유자 ID */
  backupOwnerId?: string;
}

// ---------------------------------------------------------------------------
// 8. Task 항목
// ---------------------------------------------------------------------------

/** Task 항목 — 실행 단위로서의 전체 데이터 */
export interface TaskItem {
  /** 고유 식별자 */
  id: string;
  /** 작업 제목 (한국어) */
  title: string;
  /** 작업 설명 (한국어) */
  description?: string;
  /** 작업 유형 */
  taskType: TaskType;
  /** 현재 상태 */
  status: TaskStatus;
  /** 우선순위 */
  priority: TaskPriority;
  /** 소유권 정보 */
  ownership: TaskOwnership;

  // -- 출처 연결 --
  /** 원본 엔티티 유형 (예: "QuoteRequest", "PurchaseOrder") */
  sourceEntityType?: string;
  /** 원본 엔티티 ID */
  sourceEntityId?: string;
  /** 원본 엔티티 표시 라벨 */
  sourceEntityLabel?: string;
  /** 원본 맥락 설명 (한국어, 예: "견적 요청 #Q-2041 차단 해소") */
  sourceContext?: string;

  // -- 완료 조건 --
  /** 기대 결과 (한국어) */
  expectedOutcome: string;
  /** 완료 기준 목록 */
  completionCriteria: CompletionCriterion[];
  /** 검증 필수 여부 */
  verificationRequired: boolean;

  // -- 의존성 --
  /** 선행 의존 항목 */
  dependencies: TaskDependency[];

  // -- 기한·SLA --
  /** 마감 시각 (ISO 8601) */
  dueAt?: string;
  /** SLA 시간 (시간 단위) */
  slaHours?: number;
  /** SLA 마감 시각 (ISO 8601) */
  slaDeadline?: string;

  // -- 타임스탬프 --
  /** 생성 시각 */
  createdAt: string;
  /** 할당 시각 */
  assignedAt?: string;
  /** 작업 시작 시각 */
  startedAt?: string;
  /** 완료 시각 */
  completedAt?: string;
  /** 검증 시각 */
  verifiedAt?: string;

  // -- 경과·상태 플래그 --
  /** 경과 시간 (분) */
  elapsedMinutes: number;
  /** 기한 초과 여부 */
  isOverdue: boolean;
  /** 에스컬레이션 여부 */
  isEscalated: boolean;
  /** 에스컬레이션 레벨 (0 = 미에스컬레이션) */
  escalationLevel: number;

  // -- 다시 알림(Snooze) --
  /** 보류 해제 시각 (ISO 8601) */
  snoozedUntil?: string;
  /** 보류 사유 (한국어) */
  snoozeReason?: string;

  // -- 관계 --
  /** 상위 Task ID */
  parentTaskId?: string;
  /** 후속 Task ID 목록 */
  followUpTaskIds: string[];
  /** 태그 목록 */
  tags: string[];
}

// ---------------------------------------------------------------------------
// 9. 완료 기준 (Completion Criterion)
// ---------------------------------------------------------------------------

/** 완료 기준 — 자동 검증 가능 또는 사람 검토 필요 */
export interface CompletionCriterion {
  /** 고유 식별자 */
  id: string;
  /** 기준 설명 (한국어) */
  label: string;
  /** 검증 방식 */
  type: "auto_verifiable" | "human_review";
  /** 충족 여부 */
  isMet: boolean;
  /** 충족 시각 (ISO 8601) */
  metAt?: string;
}

// ---------------------------------------------------------------------------
// 10. Task 의존성 (Dependency)
// ---------------------------------------------------------------------------

/** Task 의존성 — 선행 조건이 해소되어야 다음 상태로 전이 가능 */
export interface TaskDependency {
  /** 의존 대상 Task ID */
  dependsOnTaskId?: string;
  /** 의존 대상 엔티티 유형 */
  dependsOnEntityType?: string;
  /** 의존 대상 엔티티 ID */
  dependsOnEntityId?: string;
  /** 의존 관계 설명 (한국어) */
  label: string;
  /** 해소 여부 */
  isResolved: boolean;
  /** 해소 전 전이 차단 대상 상태 */
  blocksTransitionTo?: TaskStatus;
}

// ---------------------------------------------------------------------------
// 11. 인수인계 기록 (Handoff Record)
// ---------------------------------------------------------------------------

/** 인수인계 기록 — 책임 이전의 감사 이력 */
export interface HandoffRecord {
  /** 고유 식별자 */
  id: string;
  /** 대상 Task ID */
  taskId: string;
  /** 이전 소유자 ID */
  fromOwnerId: string;
  /** 이전 소유자 이름 */
  fromOwnerName: string;
  /** 새 소유자 ID */
  toOwnerId: string;
  /** 새 소유자 이름 */
  toOwnerName: string;
  /** 인수인계 사유 (한국어) */
  reason: string;
  /** 인수인계 시점의 Task 상태 */
  currentStatus: TaskStatus;
  /** 인수인계 후 기대 행동 (한국어) */
  expectedAction: string;
  /** 추가 메모 (한국어) */
  note?: string;
  /** 인수인계 시각 (ISO 8601) */
  handoffAt: string;
}

// ---------------------------------------------------------------------------
// 12. 다시 알림 기록 (Snooze Record)
// ---------------------------------------------------------------------------

/** 다시 알림 기록 — 보류 이력 추적 */
export interface SnoozeRecord {
  /** 대상 Task ID */
  taskId: string;
  /** 보류 처리자 */
  snoozedBy: string;
  /** 보류 해제 시각 (ISO 8601) */
  snoozedUntil: string;
  /** 보류 사유 (한국어) */
  reason: string;
  /** 보류 등록 시각 (ISO 8601) */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 13. 에스컬레이션 규칙 (Escalation Rule)
// ---------------------------------------------------------------------------

/** Task 에스컬레이션 규칙 — 조건 충족 시 자동 에스컬레이션 */
export interface TaskEscalationRule {
  /** 대상 Task 유형 (모든 유형이면 생략 가능) */
  taskType: TaskType | "*";
  /** 발동 조건 */
  triggerCondition:
    | "overdue"
    | "ownerless"
    | "blocked_long"
    | "repeated_reject"
    | "repeated_reopen";
  /** 시간 기반 임계치 (분) */
  thresholdMinutes?: number;
  /** 횟수 기반 임계치 */
  thresholdCount?: number;
  /** 에스컬레이션 대상 역할 */
  targetRole: string;
  /** 알림 채널 */
  notifyChannels: ("in_app" | "email")[];
}

// ---------------------------------------------------------------------------
// 14. 기본 에스컬레이션 규칙
// ---------------------------------------------------------------------------

/** 기본 에스컬레이션 규칙 — 운영 환경에서 커스터마이징 가능 */
export const DEFAULT_TASK_ESCALATION_RULES: TaskEscalationRule[] = [
  {
    taskType: "approval",
    triggerCondition: "overdue",
    thresholdMinutes: 480,
    targetRole: "team_leader",
    notifyChannels: ["in_app", "email"],
  },
  {
    taskType: "exception_resolution",
    triggerCondition: "overdue",
    thresholdMinutes: 240,
    targetRole: "ops_admin",
    notifyChannels: ["in_app", "email"],
  },
  {
    taskType: "*",
    triggerCondition: "ownerless",
    thresholdMinutes: 120,
    targetRole: "team_leader",
    notifyChannels: ["in_app"],
  },
  {
    taskType: "*",
    triggerCondition: "blocked_long",
    thresholdMinutes: 720,
    targetRole: "ops_admin",
    notifyChannels: ["in_app", "email"],
  },
  {
    taskType: "*",
    triggerCondition: "repeated_reject",
    thresholdCount: 3,
    targetRole: "ops_admin",
    notifyChannels: ["in_app", "email"],
  },
  {
    taskType: "*",
    triggerCondition: "repeated_reopen",
    thresholdCount: 2,
    targetRole: "team_leader",
    notifyChannels: ["in_app"],
  },
  {
    taskType: "integration_recovery",
    triggerCondition: "overdue",
    thresholdMinutes: 120,
    targetRole: "integration_admin",
    notifyChannels: ["in_app", "email"],
  },
  {
    taskType: "budget_review",
    triggerCondition: "overdue",
    thresholdMinutes: 240,
    targetRole: "budget_admin",
    notifyChannels: ["in_app", "email"],
  },
];

// ---------------------------------------------------------------------------
// 15. 검증 필수 Task 유형 목록
// ---------------------------------------------------------------------------

/** 완료 후 반드시 검증(verification)을 거쳐야 하는 Task 유형 */
export const VERIFICATION_REQUIRED_TYPES: TaskType[] = [
  "remediation",
  "exception_resolution",
  "document_check",
  "budget_review",
  "integration_recovery",
  "data_fix",
  "override_review",
];

// ---------------------------------------------------------------------------
// 16. 빠른 액션 유형
// ---------------------------------------------------------------------------

/** Task 빠른 액션 유형 — 목록/상세에서 즉시 수행 가능한 액션 */
export type TaskQuickActionType =
  | "start"
  | "accept"
  | "assign"
  | "done"
  | "verify"
  | "reject"
  | "reopen"
  | "escalate"
  | "snooze"
  | "cancel"
  | "open_detail"
  | "handoff";

// ---------------------------------------------------------------------------
// 17. 빠른 액션 정의
// ---------------------------------------------------------------------------

/** 빠른 액션별 라벨, 설명, 톤, 확인 필요 여부, 유효 시작 상태 */
export const TASK_QUICK_ACTION_DESCRIPTIONS: Record<
  TaskQuickActionType,
  {
    /** 액션 라벨 */
    label: string;
    /** 액션 설명 */
    description: string;
    /** 버튼 톤 */
    tone: "primary" | "danger" | "secondary" | "warning";
    /** 실행 전 확인 필요 여부 */
    requiresConfirm: boolean;
    /** 이 액션을 수행할 수 있는 출발 상태 목록 */
    validFromStatuses: TaskStatus[];
  }
> = {
  start: {
    label: "시작",
    description: "작업 처리를 시작합니다",
    tone: "primary",
    requiresConfirm: false,
    validFromStatuses: ["assigned", "reopened"],
  },
  accept: {
    label: "수락",
    description: "할당된 작업을 수락합니다",
    tone: "primary",
    requiresConfirm: false,
    validFromStatuses: ["assigned"],
  },
  assign: {
    label: "할당",
    description: "담당자를 지정합니다",
    tone: "secondary",
    requiresConfirm: false,
    validFromStatuses: ["new", "reopened"],
  },
  done: {
    label: "완료",
    description: "작업을 완료 처리합니다",
    tone: "primary",
    requiresConfirm: true,
    validFromStatuses: ["in_progress", "waiting"],
  },
  verify: {
    label: "검증",
    description: "완료된 작업을 검증합니다",
    tone: "primary",
    requiresConfirm: true,
    validFromStatuses: ["done"],
  },
  reject: {
    label: "반려",
    description: "완료를 인정하지 않습니다",
    tone: "danger",
    requiresConfirm: true,
    validFromStatuses: ["done"],
  },
  reopen: {
    label: "재개",
    description: "작업을 다시 엽니다",
    tone: "warning",
    requiresConfirm: true,
    validFromStatuses: ["done", "verified", "cancelled"],
  },
  escalate: {
    label: "에스컬레이션",
    description: "상위 책임자에게 에스컬레이션합니다",
    tone: "warning",
    requiresConfirm: true,
    validFromStatuses: ["in_progress", "waiting", "blocked"],
  },
  snooze: {
    label: "다시 알림",
    description: "지정 시간까지 보류합니다",
    tone: "secondary",
    requiresConfirm: false,
    validFromStatuses: ["assigned", "in_progress", "waiting"],
  },
  cancel: {
    label: "취소",
    description: "작업을 취소합니다",
    tone: "danger",
    requiresConfirm: true,
    validFromStatuses: [
      "new",
      "assigned",
      "in_progress",
      "waiting",
      "blocked",
    ],
  },
  open_detail: {
    label: "상세 보기",
    description: "작업 상세를 엽니다",
    tone: "secondary",
    requiresConfirm: false,
    validFromStatuses: [
      "new",
      "assigned",
      "in_progress",
      "waiting",
      "blocked",
      "done",
      "verified",
      "rejected",
      "reopened",
      "cancelled",
    ],
  },
  handoff: {
    label: "인수인계",
    description: "다른 담당자에게 넘깁니다",
    tone: "secondary",
    requiresConfirm: true,
    validFromStatuses: ["assigned", "in_progress", "waiting", "blocked"],
  },
};

// ---------------------------------------------------------------------------
// 18. 가용 액션 필터 함수
// ---------------------------------------------------------------------------

/**
 * 주어진 Task, 사용자 ID, 역할에 따라 수행 가능한 빠른 액션 목록을 반환한다.
 *
 * - 상태 기반 필터링: 현재 상태에서 유효한 액션만 포함
 * - 소유권 기반 필터링: 본인 소유/배정이 아닌 경우 일부 액션 제한
 * - 역할 기반 필터링: verify/reject는 reviewer 또는 admin만 가능
 * - open_detail은 항상 포함
 */
export function getAvailableTaskActions(
  task: TaskItem,
  userId: string,
  userRole: string,
): TaskQuickActionType[] {
  const actions: TaskQuickActionType[] = [];

  const isOwner = task.ownership.currentOwnerId === userId;
  const isAssignee = task.ownership.assigneeId === userId;
  const isReviewer = task.ownership.reviewerId === userId;
  const isAdmin = userRole === "admin" || userRole === "ops_admin";
  const isLeader = userRole === "team_leader";
  const canManage = isAdmin || isLeader;

  for (const [actionKey, def] of Object.entries(
    TASK_QUICK_ACTION_DESCRIPTIONS,
  )) {
    const action = actionKey as TaskQuickActionType;

    // open_detail은 항상 가능
    if (action === "open_detail") {
      actions.push(action);
      continue;
    }

    // 상태 기반 필터
    if (!def.validFromStatuses.includes(task.status)) continue;

    // 액션별 소유권·역할 필터
    switch (action) {
      case "start":
      case "accept":
        if (!isAssignee && !isOwner && !canManage) continue;
        break;
      case "assign":
        if (!canManage) continue;
        break;
      case "done":
        if (!isAssignee && !isOwner && !canManage) continue;
        break;
      case "verify":
      case "reject":
        if (!isReviewer && !isAdmin) continue;
        break;
      case "reopen":
        if (!canManage && !isReviewer) continue;
        break;
      case "escalate":
        if (!isOwner && !isAssignee && !canManage) continue;
        break;
      case "snooze":
        if (!isOwner && !isAssignee && !canManage) continue;
        break;
      case "cancel":
        if (!canManage) continue;
        break;
      case "handoff":
        if (!isOwner && !isAssignee && !canManage) continue;
        break;
    }

    actions.push(action);
  }

  return actions;
}

// ---------------------------------------------------------------------------
// 19. Empty / Error / Unavailable 문구
// ---------------------------------------------------------------------------

/** 작업 목록이 비어있을 때 표시할 문구 */
export const TASK_EMPTY_COPY = {
  /** 주 메시지 */
  title: "현재 처리할 작업이 없습니다",
  /** 보조 설명 */
  description: "할당 대기 또는 팀 작업을 확인해보세요",
  /** CTA 라벨 */
  actionLabel: "팀 작업 보기",
  /** CTA 경로 */
  actionHref: "/dashboard/tasks?view=team",
} as const;

/** 작업 목록 로드 실패 시 표시할 문구 */
export const TASK_ERROR_COPY = {
  /** 주 메시지 */
  title: "작업 목록을 불러오지 못했습니다",
  /** 보조 설명 */
  description: "잠시 후 다시 시도해주세요",
  /** CTA 라벨 */
  actionLabel: "다시 시도",
} as const;

/** 권한 부족으로 접근 불가 시 표시할 문구 */
export const TASK_UNAVAILABLE_COPY = {
  /** 주 메시지 */
  title: "현재 권한으로 작업 관리 기능에 접근할 수 없습니다",
  /** 보조 설명 */
  description: "관리자에게 권한을 요청하세요",
  /** CTA 라벨 */
  actionLabel: "권한 요청하기",
} as const;

// ---------------------------------------------------------------------------
// 20. Anti-Pattern 목록
// ---------------------------------------------------------------------------

/** Task/Assignment/Ownership 구현 시 피해야 할 안티패턴 */
export const TASK_ANTI_PATTERNS: string[] = [
  "task title만 있고 완료 조건이 없음",
  "owner/assignee/reviewer를 구분하지 않음",
  "shared queue에만 머물며 책임자 부여가 안 됨",
  "due와 SLA가 분리되지 않음",
  "reassignment에 이유/trace가 없음",
  "done만 있고 verification/reopen 흐름이 없음",
  "task가 source workflow와 단절됨",
  "metrics 없이 backlog만 쌓임",
];

// ---------------------------------------------------------------------------
// 21. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** Task/Assignment/Ownership 관련 코드 리뷰 시 점검 항목 */
export const taskCodeReviewChecklist: string[] = [
  "task가 실행 가능한 단위로 정의되는가",
  "owner/assignee/reviewer/escalation owner가 구분되는가",
  "priority/due/SLA/overdue가 보이는가",
  "completion criteria가 명확한가",
  "verification이 필요한 task를 분리하는가",
  "handoff/reassignment가 audit와 연결되는가",
  "waiting과 blocked가 구분되는가",
  "task가 source entity 및 next workflow와 연결되는가",
  "empty/error/unavailable가 분리되는가",
  "presenter가 해석된 task view-model만 소비하는가",
];

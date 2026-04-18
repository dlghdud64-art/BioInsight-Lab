/**
 * Task / Assignment / Ownership ViewModel 유형 정의
 *
 * presenter(컴포넌트)는 이 파일의 ViewModel만 소비한다.
 * 도메인 모델 → ViewModel 변환은 mapper 레이어에서 수행한다.
 */

import type {
  CompletionCriterion,
  TaskItem,
  TaskPriority,
  TaskQuickActionType,
  TaskStatus,
  TaskType,
} from "./task-assignment-ownership-contract";

// ---------------------------------------------------------------------------
// 1. Task 목록 요약 ViewModel
// ---------------------------------------------------------------------------

/** Task 목록 상단에 표시하는 요약 KPI */
export interface TaskListSummaryViewModel {
  /** 전체 Task 수 */
  totalCount: number;
  /** 내 Task 수 */
  myTaskCount: number;
  /** 미배정 Task 수 */
  unassignedCount: number;
  /** 차단된 Task 수 */
  blockedCount: number;
  /** 기한 초과 Task 수 */
  overdueCount: number;
  /** 오늘 마감 Task 수 */
  dueToday: number;
  /** 검증 대기 중인 Task 수 */
  verificationPending: number;
  /** 전체 건강 톤 */
  healthTone: "healthy" | "warning" | "danger";
  /** 건강 상태 라벨 (한국어) */
  healthLabel: string;
}

// ---------------------------------------------------------------------------
// 2. Task 항목 ViewModel
// ---------------------------------------------------------------------------

/** Task 목록의 개별 행(row) ViewModel */
export interface TaskItemViewModel {
  /** 고유 식별자 */
  id: string;
  /** 작업 제목 */
  title: string;
  /** 작업 설명 */
  description?: string;

  // -- 유형·상태·우선순위 해석 --
  /** Task 유형 라벨 (한국어) */
  taskTypeLabel: string;
  /** 상태 라벨 (한국어) */
  statusLabel: string;
  /** 상태 톤 */
  statusTone: string;
  /** 우선순위 라벨 (한국어) */
  priorityLabel: string;
  /** 우선순위 톤 */
  priorityTone: "critical" | "high" | "medium" | "low";

  // -- 소유권 해석 --
  /** 소유자 라벨 (한국어, 없으면 "미배정") */
  ownerLabel: string;
  /** 배정자 라벨 */
  assigneeLabel?: string;
  /** 검증자 라벨 */
  reviewerLabel?: string;

  // -- 기한·SLA 해석 --
  /** 마감 표시 (한국어) */
  dueLabel?: string;
  /** SLA 표시 (한국어) */
  slaLabel?: string;
  /** SLA 톤 */
  slaTone?: "within" | "warning" | "exceeded";
  /** 경과 시간 표시 (한국어) */
  elapsedLabel: string;

  // -- 상태 플래그 --
  /** 기한 초과 여부 */
  isOverdue: boolean;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단 사유 (한국어) */
  blockedReasonLabel?: string;
  /** 에스컬레이션 여부 */
  isEscalated: boolean;

  // -- 맥락·진행률 --
  /** 원본 맥락 라벨 (한국어) */
  sourceContextLabel?: string;
  /** 완료 진행률 */
  completionProgress: { met: number; total: number; label: string };
  /** 검증 필수 여부 */
  verificationRequired: boolean;
  /** 전체 의존성 수 */
  dependencyCount: number;
  /** 미해소 의존성 수 */
  unresolvedDependencyCount: number;

  // -- 액션 --
  /** 사용 가능한 빠른 액션 */
  quickActions: {
    type: TaskQuickActionType;
    label: string;
    tone: string;
    isEnabled: boolean;
  }[];

  /** 상세 페이지 경로 */
  href: string;
}

// ---------------------------------------------------------------------------
// 3. Task 소유권 ViewModel
// ---------------------------------------------------------------------------

/** Task 소유권 상세 — 인수인계 이력 포함 */
export interface TaskOwnershipViewModel {
  /** 현재 소유자 라벨 (한국어, 없으면 "미배정") */
  currentOwnerLabel: string;
  /** 배정자 라벨 */
  assigneeLabel?: string;
  /** 검증자 라벨 */
  reviewerLabel?: string;
  /** 에스컬레이션 소유자 라벨 */
  escalationOwnerLabel?: string;
  /** 요청자 라벨 */
  requestedByLabel?: string;
  /** 인수인계 이력 */
  handoffHistory: {
    /** 이전 소유자 */
    fromLabel: string;
    /** 새 소유자 */
    toLabel: string;
    /** 인수인계 사유 */
    reason: string;
    /** 시간 표시 */
    timeLabel: string;
  }[];
}

// ---------------------------------------------------------------------------
// 4. Task 상세 ViewModel
// ---------------------------------------------------------------------------

/** Task 상세 페이지 ViewModel */
export interface TaskDetailViewModel {
  /** 고유 식별자 */
  id: string;
  /** 작업 제목 */
  title: string;
  /** 작업 설명 */
  description?: string;

  // -- 유형·상태·우선순위 --
  /** Task 유형 라벨 (한국어) */
  taskTypeLabel: string;
  /** 상태 라벨 (한국어) */
  statusLabel: string;
  /** 상태 톤 */
  statusTone: string;
  /** 우선순위 라벨 (한국어) */
  priorityLabel: string;
  /** 우선순위 톤 */
  priorityTone: "critical" | "high" | "medium" | "low";

  // -- 소유권 --
  /** 소유권 상세 ViewModel */
  ownership: TaskOwnershipViewModel;

  // -- 기한·SLA --
  /** 마감 표시 (한국어) */
  dueLabel?: string;
  /** SLA 표시 (한국어) */
  slaLabel?: string;
  /** SLA 톤 */
  slaTone?: "within" | "warning" | "exceeded";
  /** 경과 시간 표시 (한국어) */
  elapsedLabel?: string;
  /** 기한 초과 여부 */
  isOverdue: boolean;

  // -- 원본 연결 --
  /** 원본 엔티티 정보 */
  sourceEntity?: {
    label: string;
    type: string;
    href: string;
  };

  // -- 완료·검증 --
  /** 기대 결과 (한국어) */
  expectedOutcome: string;
  /** 완료 기준 목록 */
  completionCriteria: {
    label: string;
    type: string;
    isMet: boolean;
  }[];
  /** 의존성 목록 */
  dependencies: {
    label: string;
    isResolved: boolean;
    href?: string;
  }[];
  /** 검증 필수 여부 */
  verificationRequired: boolean;
  /** 검증 상태 */
  verificationStatus?: "pending" | "verified" | "rejected";

  // -- 액션 --
  /** 사용 가능한 빠른 액션 */
  quickActions: {
    type: TaskQuickActionType;
    label: string;
    tone: string;
    isEnabled: boolean;
    confirmMessage?: string;
  }[];

  // -- 타임라인 --
  /** 이력 타임라인 */
  timeline: {
    action: string;
    actor: string;
    timeLabel: string;
    note?: string;
  }[];

  // -- 후속·보류 --
  /** 후속 Task 목록 */
  followUpTasks: {
    id: string;
    title: string;
    statusLabel: string;
    href: string;
  }[];
  /** 보류 해제 시각 표시 (한국어) */
  snoozedUntilLabel?: string;
  /** 보류 사유 (한국어) */
  snoozeReason?: string;
}

// ---------------------------------------------------------------------------
// 5. Task 페이지 최상위 ViewModel
// ---------------------------------------------------------------------------

/** Task 페이지 전체를 구동하는 최상위 ViewModel */
export interface TaskPageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 목적 설명 */
    purposeDescription: string;
  };
  /** 요약 KPI */
  summary: TaskListSummaryViewModel;
  /** Task 목록 */
  tasks: TaskItemViewModel[];
  /** 선택된 Task 상세 (사이드패널 등) */
  selectedDetail?: TaskDetailViewModel;
  /** 필터 상태 */
  filters: {
    /** 보기 모드 */
    view: "my" | "team" | "unassigned" | "blocked" | "all";
    /** 우선순위 필터 */
    priority?: TaskPriority;
    /** 상태 필터 */
    status?: TaskStatus;
    /** 유형 필터 */
    type?: TaskType;
    /** 정렬 기준 */
    sortBy: "priority" | "due" | "created" | "elapsed";
  };
  /** 페이지 상태 */
  pageState: {
    /** 목록 비어있음 */
    isEmpty: boolean;
    /** 로드 오류 */
    hasError: boolean;
    /** 접근 불가 */
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 6. 헬퍼: 건강 톤 결정
// ---------------------------------------------------------------------------

/**
 * Task 요약 지표로부터 전체 건강 톤을 결정한다.
 *
 * - danger: 기한 초과 또는 차단 항목이 1개 이상
 * - warning: 미배정 항목이 3개 이상
 * - healthy: 그 외
 */
export function resolveTaskHealthTone(summary: {
  overdueCount: number;
  blockedCount: number;
  unassignedCount: number;
}): "healthy" | "warning" | "danger" {
  if (summary.overdueCount > 0 || summary.blockedCount > 0) return "danger";
  if (summary.unassignedCount >= 3) return "warning";
  return "healthy";
}

// ---------------------------------------------------------------------------
// 7. 헬퍼: SLA 톤 결정
// ---------------------------------------------------------------------------

/**
 * Task의 SLA 마감과 경과 시간으로부터 SLA 톤을 결정한다.
 *
 * - exceeded: 경과 시간이 SLA를 초과
 * - warning: SLA의 80% 이상 소진
 * - within: 여유 있음
 * - null: SLA 정보 없음
 */
export function resolveTaskSlaTone(task: {
  slaDeadline?: string;
  elapsedMinutes: number;
  slaHours?: number;
}): "within" | "warning" | "exceeded" | null {
  if (task.slaHours == null) return null;

  const slaMinutes = task.slaHours * 60;
  if (task.elapsedMinutes >= slaMinutes) return "exceeded";
  if (task.elapsedMinutes >= slaMinutes * 0.8) return "warning";
  return "within";
}

// ---------------------------------------------------------------------------
// 8. 헬퍼: 완료 진행률 생성
// ---------------------------------------------------------------------------

/**
 * 완료 기준 배열로부터 진행률 객체를 생성한다.
 *
 * @returns met(충족 수), total(전체 수), label(한국어 "2/4 충족")
 */
export function buildCompletionProgress(criteria: CompletionCriterion[]): {
  met: number;
  total: number;
  label: string;
} {
  const total = criteria.length;
  const met = criteria.filter((c) => c.isMet).length;
  const label = total === 0 ? "기준 없음" : `${met}/${total} 충족`;
  return { met, total, label };
}

// ---------------------------------------------------------------------------
// 9. 헬퍼: Task 정렬
// ---------------------------------------------------------------------------

/** 우선순위 수치 매핑 (낮을수록 높은 우선순위) */
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Task 목록을 지정된 기준으로 정렬한다.
 *
 * 1차 정렬: 우선순위 (critical → low)
 * 2차 정렬: sortBy 파라미터에 따름
 *   - priority: 우선순위만 (1차와 동일하므로 id로 안정 정렬)
 *   - due: 마감 임박 순 (마감 없으면 뒤로)
 *   - created: 생성 오래된 순
 *   - elapsed: 경과 시간 긴 순
 */
export function sortTasks(
  tasks: TaskItemViewModel[],
  sortBy: string,
): TaskItemViewModel[] {
  return [...tasks].sort((a, b) => {
    // 1차: 우선순위
    const pa = PRIORITY_ORDER[a.priorityTone] ?? 99;
    const pb = PRIORITY_ORDER[b.priorityTone] ?? 99;
    if (pa !== pb) return pa - pb;

    // 2차: sortBy
    switch (sortBy) {
      case "due": {
        const da = a.dueLabel ?? "";
        const db = b.dueLabel ?? "";
        if (!da && db) return 1;
        if (da && !db) return -1;
        return da.localeCompare(db);
      }
      case "created":
        return a.id.localeCompare(b.id);
      case "elapsed":
        // 경과 시간은 원본 데이터에서 파싱해야 하나 VM에는 문자열만 있으므로
        // isOverdue 우선, 그다음 id 안정 정렬
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return a.id.localeCompare(b.id);
      case "priority":
      default:
        return a.id.localeCompare(b.id);
    }
  });
}

// ---------------------------------------------------------------------------
// 10. 헬퍼: 경과 시간 포맷
// ---------------------------------------------------------------------------

/**
 * 분 단위 경과 시간을 한국어 문자열로 변환한다.
 *
 * @example
 * formatTaskElapsed(30)   // "30분"
 * formatTaskElapsed(135)  // "2시간 15분"
 * formatTaskElapsed(1620) // "1일 3시간"
 */
export function formatTaskElapsed(minutes: number): string {
  if (minutes < 0) return "0분";

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (mins > 0 && days === 0) parts.push(`${mins}분`);

  return parts.length > 0 ? parts.join(" ") : "0분";
}

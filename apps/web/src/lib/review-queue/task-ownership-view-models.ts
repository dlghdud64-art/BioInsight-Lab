/**
 * Task / Assignment / Ownership 뷰모델
 *
 * task-ownership-contract.ts의 도메인 타입을 UI 렌더링에 필요한 형태로 변환한다.
 * 모든 라벨은 한국어이며, 상태/톤/액션은 UI 컴포넌트에서 직접 바인딩 가능하다.
 */

import type {
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskOwnership,
} from "./task-ownership-contract";
import {
  TASK_STATUS_TRANSITIONS,
  VERIFICATION_REQUIRED_TYPES,
} from "./task-ownership-contract";

// ---------------------------------------------------------------------------
// 1. TaskItemViewModel
// ---------------------------------------------------------------------------

/** 작업 목록 및 카드에 바인딩되는 단일 작업 뷰모델 */
export interface TaskItemViewModel {
  /** 작업 ID */
  id: string;
  /** 작업 제목 */
  title: string;
  /** 작업 유형 코드 */
  taskType: string;
  /** 작업 유형 한국어 라벨 */
  taskTypeLabel: string;
  /** 상태 한국어 라벨 */
  statusLabel: string;
  /** 상태에 따른 시각적 톤 */
  statusTone: "neutral" | "info" | "warning" | "danger" | "success";
  /** 우선순위 */
  priority: TaskPriority;
  /** 우선순위 한국어 라벨 */
  priorityLabel: string;
  /** 현재 담당자 라벨 */
  ownerLabel?: string;
  /** 검증자 라벨 */
  reviewerLabel?: string;
  /** 에스컬레이션 소유자 라벨 */
  escalationOwnerLabel?: string;
  /** 기한 라벨 (e.g. "3시간 남음", "2일 초과") */
  dueLabel?: string;
  /** 경과 시간 라벨 (e.g. "2시간 전 시작") */
  elapsedTimeLabel?: string;
  /** SLA 라벨 (e.g. "SLA 24h 중 18h 경과") */
  slaLabel?: string;
  /** 기한 초과 여부 */
  isOverdue: boolean;
  /** 차단 상태 여부 */
  isBlocked: boolean;
  /** 대기 상태 여부 */
  isWaiting: boolean;
  /** 원천 컨텍스트 라벨 */
  sourceContextLabel?: string;
  /** 원천 컨텍스트 링크 */
  sourceContextHref?: string;
  /** 완료 조건 요약 라벨 */
  completionCriteriaLabel?: string;
  /** 의존 관계 라벨 목록 */
  dependencyLabels?: string[];
  /** 주요 액션 라벨 (e.g. "처리 시작", "완료 처리") */
  primaryActionLabel?: string;
  /** 보조 액션 라벨 목록 */
  secondaryActionLabels?: string[];
  /** 작업 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 2. TaskOwnershipViewModel
// ---------------------------------------------------------------------------

/** 작업 소유권 요약 뷰모델 — 소유권 패널에 바인딩 */
export interface TaskOwnershipViewModel {
  /** 현재 핸들러 라벨 */
  currentOwnerLabel?: string;
  /** 배정 담당자 라벨 */
  assigneeLabel?: string;
  /** 검증자 라벨 */
  reviewerLabel?: string;
  /** 에스컬레이션 소유자 라벨 */
  escalationOwnerLabel?: string;
  /** 요청자 라벨 */
  requestedByLabel?: string;
  /** 공유 큐 여부 */
  isSharedQueue: boolean;
  /** 소유권 요약 문구 (한국어, e.g. "김OO 처리 중 · 검증: 이OO") */
  ownershipSummaryLabel: string;
}

// ---------------------------------------------------------------------------
// 3. TaskListSegmentViewModel
// ---------------------------------------------------------------------------

/** 작업 목록 세그먼트 뷰모델 — 탭/필터 그룹에 바인딩 */
export interface TaskListSegmentViewModel {
  /** 세그먼트 식별 키 */
  segmentKey:
    | "my_tasks"
    | "team_unassigned"
    | "blocked"
    | "waiting"
    | "overdue"
    | "follow_up";
  /** 세그먼트 한국어 라벨 */
  label: string;
  /** 해당 세그먼트의 작업 수 */
  count: number;
  /** 우선순위 힌트 (e.g. "긴급 2건 포함") */
  priorityHint?: string;
}

// ---------------------------------------------------------------------------
// 4. TaskHandoffViewModel
// ---------------------------------------------------------------------------

/** 인수인계 뷰모델 — 인수인계 이력 표시에 바인딩 */
export interface TaskHandoffViewModel {
  /** 이전 담당자 라벨 */
  fromLabel: string;
  /** 새 담당자 라벨 */
  toLabel: string;
  /** 인수인계 사유 (한국어) */
  reason: string;
  /** 기대되는 다음 행동 (한국어) */
  expectedAction: string;
  /** 추가 메모 */
  note?: string;
  /** 인수인계 시각 라벨 */
  timeLabel: string;
}

// ---------------------------------------------------------------------------
// 5. TaskTimelineEntryViewModel
// ---------------------------------------------------------------------------

/** 타임라인 항목 뷰모델 — 작업 이력 타임라인에 바인딩 */
export interface TaskTimelineEntryViewModel {
  /** 타임라인 항목 ID */
  id: string;
  /** 행위자 라벨 */
  actor: string;
  /** 행위 설명 (한국어, 사람이 읽을 수 있는 형태) */
  action: string;
  /** 사유 */
  reason?: string;
  /** 시각 라벨 */
  timeLabel: string;
  /** 항목 유형 */
  entryType:
    | "assignment"
    | "status_change"
    | "handoff"
    | "escalation"
    | "completion"
    | "verification"
    | "snooze"
    | "note";
}

// ---------------------------------------------------------------------------
// 6. TaskPageViewModel (최상위)
// ---------------------------------------------------------------------------

/** 작업 페이지 전체 뷰모델 — 페이지 레이아웃 최상위 바인딩 */
export interface TaskPageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 페이지 목적 설명 */
    purposeDescription: string;
    /** 범위 라벨 (e.g. "내 작업", "팀 작업") */
    scopeLabel: string;
  };
  /** 세그먼트 목록 */
  segments: TaskListSegmentViewModel[];
  /** 작업 목록 */
  tasks: TaskItemViewModel[];
  /** 선택된 작업 상세 */
  selectedTask?: {
    /** 작업 정의 뷰모델 */
    definition: TaskItemViewModel;
    /** 소유권 뷰모델 */
    ownership: TaskOwnershipViewModel;
    /** 의존 관계 목록 */
    dependencies: { label: string; isMet: boolean }[];
    /** 타임라인 이력 */
    timeline: TaskTimelineEntryViewModel[];
    /** 완료 기록 */
    completionRecord?: {
      /** 완료 정보 라벨 */
      completedLabel: string;
      /** 검증 정보 라벨 */
      verificationLabel?: string;
    };
  };
  /** 페이지 상태 플래그 */
  pageState: {
    /** 작업 목록이 비어있는지 */
    isEmpty: boolean;
    /** 로드 에러 발생 여부 */
    hasError: boolean;
    /** 접근 불가 여부 */
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 7. resolveTaskStatusTone
// ---------------------------------------------------------------------------

/** 상태 코드에 대응하는 시각적 톤을 반환한다 */
export function resolveTaskStatusTone(
  status: TaskStatus,
): "neutral" | "info" | "warning" | "danger" | "success" {
  switch (status) {
    case "new":
      return "neutral";
    case "assigned":
      return "info";
    case "in_progress":
      return "info";
    case "waiting":
      return "warning";
    case "blocked":
      return "danger";
    case "done":
      return "success";
    case "verified":
      return "success";
    case "rejected":
      return "danger";
    case "reopened":
      return "warning";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// 8. resolveTaskDueState
// ---------------------------------------------------------------------------

/** 기한/SLA 기준 현재 상태를 판정하여 라벨·초과 여부·톤을 반환한다 */
export function resolveTaskDueState(
  dueAt: string | undefined,
  slaHours: number | undefined,
  now?: Date,
): { label: string; isOverdue: boolean; tone: "normal" | "due_soon" | "overdue" } {
  const currentTime = now ?? new Date();

  if (!dueAt && !slaHours) {
    return { label: "기한 없음", isOverdue: false, tone: "normal" };
  }

  if (dueAt) {
    const due = new Date(dueAt);
    const diffMs = due.getTime() - currentTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) {
      const overdueHours = Math.abs(Math.floor(diffHours));
      if (overdueHours < 24) {
        return {
          label: `${overdueHours}시간 초과`,
          isOverdue: true,
          tone: "overdue",
        };
      }
      const overdueDays = Math.floor(overdueHours / 24);
      return {
        label: `${overdueDays}일 초과`,
        isOverdue: true,
        tone: "overdue",
      };
    }

    if (diffHours <= 4) {
      return {
        label: `${Math.ceil(diffHours)}시간 남음`,
        isOverdue: false,
        tone: "due_soon",
      };
    }

    if (diffHours <= 24) {
      return {
        label: `${Math.ceil(diffHours)}시간 남음`,
        isOverdue: false,
        tone: "normal",
      };
    }

    const daysLeft = Math.ceil(diffHours / 24);
    return {
      label: `${daysLeft}일 남음`,
      isOverdue: false,
      tone: "normal",
    };
  }

  // slaHours만 있는 경우 — 라벨만 표시 (기준 시점 없이 SLA 시간만 표기)
  return {
    label: `SLA ${slaHours}h`,
    isOverdue: false,
    tone: "normal",
  };
}

// ---------------------------------------------------------------------------
// 9. getAvailableTaskActions
// ---------------------------------------------------------------------------

/** 현재 상태·유형·소유권에 따라 사용 가능한 액션 라벨 목록을 반환한다 */
export function getAvailableTaskActions(
  status: TaskStatus,
  taskType: TaskType,
  hasOwner: boolean,
  isReviewer: boolean,
): string[] {
  const actions: string[] = [];
  const nextStatuses = TASK_STATUS_TRANSITIONS[status] ?? [];

  switch (status) {
    case "new":
      actions.push("배정하기");
      if (nextStatuses.includes("cancelled")) actions.push("취소");
      break;

    case "assigned":
      actions.push("처리 시작");
      if (!hasOwner) actions.push("담당자 지정");
      if (nextStatuses.includes("cancelled")) actions.push("취소");
      break;

    case "in_progress":
      actions.push("완료 처리");
      if (nextStatuses.includes("waiting")) actions.push("대기 전환");
      if (nextStatuses.includes("blocked")) actions.push("차단 보고");
      actions.push("재배정");
      break;

    case "waiting":
      actions.push("처리 재개");
      if (nextStatuses.includes("blocked")) actions.push("차단 보고");
      break;

    case "blocked":
      actions.push("차단 해제");
      actions.push("에스컬레이션");
      break;

    case "done": {
      const needsVerification = VERIFICATION_REQUIRED_TYPES.includes(taskType);
      if (needsVerification || isReviewer) {
        actions.push("검증 승인");
        actions.push("검증 거부");
      }
      actions.push("재오픈");
      break;
    }

    case "verified":
      actions.push("재오픈");
      break;

    case "rejected":
      actions.push("처리 재개");
      actions.push("재오픈");
      break;

    case "reopened":
      actions.push("배정하기");
      actions.push("처리 시작");
      break;

    case "cancelled":
      // 취소 상태에서는 액션 없음
      break;
  }

  // 공통 보조 액션
  if (status !== "cancelled" && status !== "verified") {
    actions.push("스누즈");
    actions.push("메모 추가");
  }

  return actions;
}

// ---------------------------------------------------------------------------
// 10. formatTaskOwnershipSummary
// ---------------------------------------------------------------------------

/**
 * TaskOwnership을 한국어 요약 문구로 변환한다.
 *
 * 예시:
 * - "김철수 처리 중 · 검증: 이영희"
 * - "팀 큐 대기 · 담당자 미지정"
 * - "박지훈 배정 · 에스컬레이션: 관리자"
 */
export function formatTaskOwnershipSummary(ownership: TaskOwnership): string {
  const parts: string[] = [];

  if (ownership.isSharedQueue && !ownership.currentOwner && !ownership.assignee) {
    parts.push("팀 큐 대기 · 담당자 미지정");
  } else if (ownership.currentOwner) {
    parts.push(`${ownership.currentOwner.name} 처리 중`);
  } else if (ownership.assignee) {
    parts.push(`${ownership.assignee.name} 배정`);
  } else {
    parts.push("담당자 미지정");
  }

  if (ownership.reviewer) {
    parts.push(`검증: ${ownership.reviewer.name}`);
  }

  if (ownership.escalationOwner) {
    parts.push(`에스컬레이션: ${ownership.escalationOwner.name}`);
  }

  return parts.join(" · ");
}

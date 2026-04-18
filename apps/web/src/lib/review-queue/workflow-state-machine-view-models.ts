/**
 * Workflow / State Machine ViewModel 타입 및 헬퍼 함수
 *
 * 워크플로우 상태 머신의 UI 렌더링을 위한 ViewModel 정의.
 * 모든 UI 컴포넌트는 이 ViewModel을 통해 워크플로우 상태를 표시한다.
 * contract 파일의 타입과 상수를 기반으로 UI 계층에서 필요한 형태를 제공한다.
 */

import type {
  WorkflowEntityType,
  StateUIMapping,
  RecoveryAction,
  GuardCondition,
  TransitionRule,
} from "./workflow-state-machine-contract";
import {
  PURCHASE_REQUEST_TRANSITIONS,
  QUOTE_DRAFT_TRANSITIONS,
  PURCHASE_REQUEST_UI_MAP,
  PURCHASE_RECOVERY_RULES,
  evaluateGuards,
} from "./workflow-state-machine-contract";

// ---------------------------------------------------------------------------
// 1. StateProgressViewModel — 진행 상태 표시 ViewModel
// ---------------------------------------------------------------------------

/** 워크플로우 진행 단계를 Progress/Stepper UI로 표시하기 위한 ViewModel */
export interface StateProgressViewModel {
  /** 엔티티 유형 */
  entityType: WorkflowEntityType;
  /** 엔티티 식별자 */
  entityId: string;
  /** 현재 상태 키 */
  currentState: string;
  /** 현재 상태 라벨 (한국어) */
  currentStateLabel: string;
  /** 현재 상태 톤 */
  currentStateTone: StateUIMapping["tone"];
  /** 종료 상태인지 여부 */
  isTerminal: boolean;
  /** 차단 상태인지 여부 */
  isBlocked: boolean;
  /** 차단 사유 (한국어) */
  blockedReason?: string;
  /** 순서대로 나열된 진행 단계 목록 */
  progressSteps: {
    /** 단계 상태 키 */
    state: string;
    /** 단계 라벨 (한국어) */
    label: string;
    /** 완료 여부 */
    isCompleted: boolean;
    /** 현재 활성 여부 */
    isCurrent: boolean;
    /** 건너뛴 단계 여부 */
    isSkipped: boolean;
  }[];
  /** SLA 기한 (ISO 문자열) */
  slaDeadline?: string;
  /** SLA 상태 */
  slaStatus?: "within" | "warning" | "exceeded";
}

// ---------------------------------------------------------------------------
// 2. AvailableActionViewModel — 수행 가능한 액션 ViewModel
// ---------------------------------------------------------------------------

/** 현재 워크플로우 상태에서 사용자가 수행할 수 있는 액션 ViewModel */
export interface AvailableActionViewModel {
  /** 액션 식별자 */
  action: string;
  /** 액션 라벨 (한국어) */
  label: string;
  /** 전이 후 도착 상태 라벨 (한국어) */
  toStateLabel: string;
  /** 버튼 톤 */
  tone: "primary" | "danger" | "secondary" | "warning";
  /** 활성화 여부 */
  isEnabled: boolean;
  /** 비활성 사유 (한국어) */
  disabledReason?: string;
  /** guard 조건별 충족 상태 */
  guardStatus: { label: string; isMet: boolean }[];
  /** 사용자 확인이 필요한지 여부 */
  confirmationRequired: boolean;
  /** 확인 대화상자 메시지 (한국어) */
  confirmationMessage?: string;
  /** 영향 범위 설명 (한국어) */
  impactDescription?: string;
}

// ---------------------------------------------------------------------------
// 3. TransitionTimelineViewModel — 전이 타임라인 ViewModel
// ---------------------------------------------------------------------------

/** 워크플로우 전이 이력을 타임라인 UI로 표시하기 위한 ViewModel */
export interface TransitionTimelineViewModel {
  /** 타임라인 항목 목록 (시간순) */
  entries: {
    /** 출발 상태 키 */
    fromState: string;
    /** 도착 상태 키 */
    toState: string;
    /** 출발 상태 라벨 (한국어) */
    fromLabel: string;
    /** 도착 상태 라벨 (한국어) */
    toLabel: string;
    /** 실행된 액션 라벨 (한국어) */
    action: string;
    /** 수행자 이름 */
    actor: string;
    /** 전이 시각 (ISO 문자열) */
    timestamp: string;
    /** 상대 시간 라벨 (한국어, 예: "2시간 전") */
    timeLabel: string;
    /** 부가 메모 */
    note?: string;
    /** 자동 전이 여부 */
    isAutomatic: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// 4. RecoveryOptionViewModel — 복구 옵션 ViewModel
// ---------------------------------------------------------------------------

/** 비정상 상태에서 사용 가능한 복구 옵션 ViewModel */
export interface RecoveryOptionViewModel {
  /** 복구 액션 유형 */
  action: RecoveryAction;
  /** 복구 액션 라벨 (한국어) */
  label: string;
  /** 복구 액션 설명 (한국어) */
  description: string;
  /** 필요한 역할 라벨 (한국어) */
  requiredRoleLabel: string;
  /** 현재 사용자가 수행 가능한지 여부 */
  isAvailable: boolean;
  /** 영향 범위 설명 (한국어) */
  impactDescription?: string;
}

// ---------------------------------------------------------------------------
// 5. WorkflowDetailViewModel — 상세 페이지 최상위 ViewModel
// ---------------------------------------------------------------------------

/** 단일 항목의 전체 워크플로우 상태를 상세 페이지에 표현하는 ViewModel */
export interface WorkflowDetailViewModel {
  /** 진행 상태 */
  progress: StateProgressViewModel;
  /** 수행 가능한 액션 목록 */
  availableActions: AvailableActionViewModel[];
  /** 전이 타임라인 */
  timeline: TransitionTimelineViewModel;
  /** 복구 옵션 목록 */
  recoveryOptions: RecoveryOptionViewModel[];
  /** guard 조건 요약 */
  guardSummary: {
    /** 전체 guard 수 */
    totalGuards: number;
    /** 충족된 guard 수 */
    metGuards: number;
    /** 미충족 차단 조건 목록 */
    blockers: { label: string; message: string }[];
  };
}

// ---------------------------------------------------------------------------
// 6. buildProgressSteps — 진행 단계 목록 생성
// ---------------------------------------------------------------------------

/** 구매 요청의 정상 진행 순서 */
const PURCHASE_REQUEST_HAPPY_PATH = [
  "draft",
  "review_pending",
  "review_in_progress",
  "approval_pending",
  "approved",
  "order_placed",
  "received",
  "closed",
] as const;

/** 견적 초안의 정상 진행 순서 */
const QUOTE_DRAFT_HAPPY_PATH = [
  "collecting",
  "compare_needed",
  "comparing",
  "selection_pending",
  "selected",
  "submission_ready",
  "submitted",
  "vendor_responded",
] as const;

/** 역할 라벨 매핑 (한국어) */
const ROLE_LABELS: Record<string, string> = {
  VIEWER: "조회자",
  REQUESTER: "요청자",
  APPROVER: "승인자",
  ADMIN: "관리자",
  OWNER: "소유자",
};

/**
 * 주어진 엔티티 유형과 현재 상태를 기반으로
 * 정렬된 진행 단계 목록(completed/current/skipped)을 반환한다.
 *
 * @param entityType - 워크플로우 엔티티 유형
 * @param currentState - 현재 상태
 * @returns 진행 단계 배열
 */
export function buildProgressSteps(
  entityType: WorkflowEntityType,
  currentState: string,
): StateProgressViewModel["progressSteps"] {
  const happyPath: readonly string[] =
    entityType === "purchase_request"
      ? PURCHASE_REQUEST_HAPPY_PATH
      : entityType === "quote_draft"
        ? QUOTE_DRAFT_HAPPY_PATH
        : [];

  const currentIndex = happyPath.indexOf(currentState);

  return happyPath.map((state, index) => {
    const uiInfo = PURCHASE_REQUEST_UI_MAP[state as keyof typeof PURCHASE_REQUEST_UI_MAP];
    const label = uiInfo?.label ?? state;

    let isCompleted = false;
    let isCurrent = false;
    let isSkipped = false;

    if (currentIndex >= 0) {
      if (index < currentIndex) {
        isCompleted = true;
      } else if (index === currentIndex) {
        isCurrent = true;
      }
    } else {
      // 현재 상태가 happy path에 없으면 (blocked, cancelled 등) 모두 미완료
      isCurrent = state === currentState;
    }

    return { state, label, isCompleted, isCurrent, isSkipped };
  });
}

// ---------------------------------------------------------------------------
// 7. buildAvailableActions — 수행 가능한 액션 ViewModel 생성
// ---------------------------------------------------------------------------

/**
 * 전이 규칙 + guard 평가 + 역할 확인을 결합하여
 * AvailableActionViewModel 배열을 생성한다.
 *
 * @param entityType - 워크플로우 엔티티 유형
 * @param currentState - 현재 상태
 * @param userRole - 현재 사용자의 역할
 * @param guardResults - 실제 평가된 guard 조건 배열
 * @returns 수행 가능한 액션 ViewModel 배열
 */
export function buildAvailableActions(
  entityType: WorkflowEntityType,
  currentState: string,
  userRole: string,
  guardResults: GuardCondition[],
): AvailableActionViewModel[] {
  const transitions: TransitionRule[] =
    entityType === "purchase_request"
      ? PURCHASE_REQUEST_TRANSITIONS
      : entityType === "quote_draft"
        ? QUOTE_DRAFT_TRANSITIONS
        : [];

  const matching = transitions.filter(
    (t) => t.from === currentState || t.from === "*",
  );

  // guard 결과를 id로 빠르게 조회
  const guardMap = new Map(guardResults.map((g) => [g.id, g]));

  return matching.map((t): AvailableActionViewModel => {
    const roleOk =
      !t.requiredRole ||
      t.requiredRole === userRole ||
      userRole === "OWNER" ||
      userRole === "ADMIN";

    // 전이 규칙의 guard를 실제 결과로 매핑
    const guardStatus = t.guardConditions.map((gc) => {
      const actual = guardMap.get(gc.id);
      return {
        label: gc.description,
        isMet: actual ? actual.isMet : gc.isMet,
      };
    });

    const unmetGuards = guardStatus.filter((g) => !g.isMet);
    const isEnabled = roleOk && unmetGuards.length === 0;

    let disabledReason: string | undefined;
    if (!roleOk) {
      disabledReason = `이 액션은 ${ROLE_LABELS[t.requiredRole!] ?? t.requiredRole} 역할이 필요합니다`;
    } else if (unmetGuards.length > 0) {
      disabledReason = unmetGuards.map((g) => g.label).join("; ");
    }

    // 도착 상태 라벨 조회
    const toUi = PURCHASE_REQUEST_UI_MAP[t.to as keyof typeof PURCHASE_REQUEST_UI_MAP];
    const toStateLabel = toUi?.label ?? t.to;

    return {
      action: t.action,
      label: t.action,
      toStateLabel,
      tone: resolveActionTone(t),
      isEnabled,
      disabledReason,
      guardStatus,
      confirmationRequired: t.confirmationRequired,
      confirmationMessage: t.confirmationMessage,
    };
  });
}

// ---------------------------------------------------------------------------
// 8. resolveSlaStatus — SLA 상태 판정
// ---------------------------------------------------------------------------

/**
 * SLA 기한을 기준으로 현재 SLA 상태를 판정한다.
 *
 * @param deadline - SLA 기한 (ISO 문자열 또는 null)
 * @returns "exceeded"(초과), "warning"(24시간 이내), "within"(정상), null(기한 없음)
 */
export function resolveSlaStatus(
  deadline: string | null,
): "within" | "warning" | "exceeded" | null {
  if (!deadline) return null;

  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();

  if (Number.isNaN(deadlineMs)) return null;

  if (now > deadlineMs) {
    return "exceeded";
  }

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  if (deadlineMs - now <= twentyFourHoursMs) {
    return "warning";
  }

  return "within";
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/**
 * 전이 규칙의 특성에 따라 버튼 톤을 결정한다.
 *
 * @param rule - 전이 규칙
 * @returns 버튼 톤
 */
function resolveActionTone(
  rule: TransitionRule,
): "primary" | "danger" | "secondary" | "warning" {
  // 취소/차단/반려 → danger
  if (
    rule.to === "cancelled" ||
    rule.to === "blocked" ||
    rule.to === "rejected"
  ) {
    return "danger";
  }

  // 승인/발주/입고/종료 → primary
  if (
    rule.to === "approved" ||
    rule.to === "order_placed" ||
    rule.to === "received" ||
    rule.to === "closed" ||
    rule.to === "submitted"
  ) {
    return "primary";
  }

  // 수정/재작성/차단해제 → warning
  if (
    rule.to === "draft" ||
    rule.to === "revision_requested"
  ) {
    return "warning";
  }

  return "secondary";
}

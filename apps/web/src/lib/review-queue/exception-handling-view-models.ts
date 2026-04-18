/**
 * Exception Handling / Manual Intervention ViewModel 타입
 *
 * 예외 처리 UI에서 사용되는 표시용 뷰모델 타입과 헬퍼 함수를 정의한다.
 * 모든 라벨은 한국어이며, contract 파일의 원본 타입을 참조한다.
 */

import type {
  ExceptionCategory,
  ExceptionItem,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
  RecoveryActionType,
} from "./exception-handling-contract";

import {
  RECOVERY_ACTION_DESCRIPTIONS,
  WORKFLOW_RETURN_MAPPINGS,
} from "./exception-handling-contract";

// ---------------------------------------------------------------------------
// 1. 예외 요약 뷰모델
// ---------------------------------------------------------------------------

/** 예외 요약 뷰모델 — 대시보드 상단 KPI 영역 */
export interface ExceptionSummaryViewModel {
  /** 전체 예외 건수 */
  totalExceptions: number;
  /** Critical 건수 */
  criticalCount: number;
  /** High 건수 */
  highCount: number;
  /** 미배정 건수 */
  unassignedCount: number;
  /** SLA 초과 건수 */
  overSlaCount: number;
  /** 에스컬레이션 건수 */
  escalatedCount: number;
  /** 평균 해결 시간 레이블 (한국어, 예: "평균 2시간 30분") */
  avgResolutionMinutesLabel: string;
  /** 운영 건강도 톤 */
  healthTone: "healthy" | "warning" | "danger";
  /** 운영 건강도 레이블 (한국어, 예: "정상 운영 중") */
  healthLabel: string;
}

// ---------------------------------------------------------------------------
// 2. 예외 큐 항목 뷰모델
// ---------------------------------------------------------------------------

/** 예외 큐 항목 뷰모델 — 예외 목록 테이블의 행 */
export interface ExceptionQueueItemViewModel {
  /** 고유 식별자 */
  id: string;
  /** 예외 제목 */
  title: string;
  /** 예외 설명 */
  description: string;
  /** 예외 유형 레이블 (한국어) */
  typeLabel: string;
  /** 카테고리 레이블 (한국어) */
  categoryLabel: string;
  /** 심각도 레이블 (한국어) */
  severityLabel: string;
  /** 심각도 톤 */
  severityTone: "critical" | "high" | "medium" | "low";
  /** 상태 레이블 (한국어) */
  statusLabel: string;
  /** 담당자 레이블 (한국어, 미배정 시 "미배정") */
  ownerLabel: string;
  /** 경과 시간 레이블 (한국어, 예: "2시간 30분 경과") */
  elapsedLabel: string;
  /** SLA 상태 레이블 (한국어, 예: "SLA 초과 1시간") */
  slaStatusLabel?: string;
  /** SLA 톤 */
  slaTone?: "within" | "warning" | "exceeded";
  /** 원본 엔티티 표시명 */
  sourceEntityLabel: string;
  /** 재시도 횟수 레이블 (예: "재시도 2/3") */
  retryCountLabel: string;
  /** 에스컬레이션 여부 */
  isEscalated: boolean;
  /** 에스컬레이션 레이블 */
  escalationLabel?: string;
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 3. 예외 상세 뷰모델
// ---------------------------------------------------------------------------

/** 예외 상세 뷰모델 — 예외 상세 페이지 전체 */
export interface ExceptionDetailViewModel {
  /** 고유 식별자 */
  id: string;
  /** 예외 제목 */
  title: string;
  /** 예외 설명 */
  description: string;
  /** 예외 유형 레이블 (한국어) */
  typeLabel: string;
  /** 카테고리 레이블 (한국어) */
  categoryLabel: string;
  /** 심각도 레이블 (한국어) */
  severityLabel: string;
  /** 심각도 톤 */
  severityTone: "critical" | "high" | "medium" | "low";
  /** 상태 레이블 (한국어) */
  statusLabel: string;
  /** 상태 톤 */
  statusTone: "active" | "waiting" | "resolved" | "cancelled";
  /** 담당자 레이블 (한국어) */
  ownerLabel: string;
  /** 담당자 역할 */
  ownerRole?: string;
  /** 경과 시간 레이블 (한국어) */
  elapsedLabel: string;
  /** SLA 상태 레이블 (한국어) */
  slaStatusLabel?: string;
  /** SLA 톤 */
  slaTone?: "within" | "warning" | "exceeded";
  /** 원본 엔티티 정보 */
  sourceEntity: {
    label: string;
    type: string;
    href: string;
  };
  /** 차단 조건 목록 */
  blockedConditions: {
    label: string;
    isMet: boolean;
    resolveLabel?: string;
    resolveHref?: string;
  }[];
  /** 사용 가능한 복구 액션 목록 */
  recoveryActions: RecoveryActionViewModel[];
  /** 워크플로우 복귀 정보 */
  workflowReturn?: {
    returnStateLabel: string;
    nextActionLabel: string;
    autoResume: boolean;
  };
  /** 타임라인 항목 */
  timeline: {
    action: string;
    actor: string;
    timeLabel: string;
    note?: string;
  }[];
  /** 관련 예외 목록 */
  relatedExceptions: {
    id: string;
    title: string;
    severity: string;
  }[];
  /** 근본 원인 메모 */
  rootCauseNote?: string;
  /** 반복 패턴 정보 */
  repeatedPattern?: {
    count: number;
    suggestedCause: string;
    suggestedFix?: string;
  };
}

// ---------------------------------------------------------------------------
// 4. 복구 액션 뷰모델
// ---------------------------------------------------------------------------

/** 복구 액션 뷰모델 — 개별 복구 액션 버튼/카드 */
export interface RecoveryActionViewModel {
  /** 액션 유형 */
  action: RecoveryActionType;
  /** 액션 레이블 (한국어) */
  label: string;
  /** 액션 설명 (한국어) */
  description: string;
  /** 위험 수준 */
  riskLevel: "low" | "medium" | "high";
  /** 위험 수준 톤 */
  riskTone: "success" | "warning" | "danger";
  /** 실행 가능 여부 */
  isEnabled: boolean;
  /** 비활성 사유 (한국어) */
  disabledReason?: string;
  /** 실행 전 확인 필요 여부 */
  requiresConfirm: boolean;
  /** 확인 메시지 (한국어) */
  confirmMessage?: string;
  /** 사유 입력 필요 여부 */
  requiresReasonInput: boolean;
  /** 영향 범위 설명 (한국어) */
  impactDescription?: string;
}

// ---------------------------------------------------------------------------
// 5. 부분 복구 뷰모델
// ---------------------------------------------------------------------------

/** 부분 복구 뷰모델 — 복수 이슈 중 일부만 해결된 상태 표시 */
export interface PartialRecoveryViewModel {
  /** 전체 건수 레이블 (한국어, 예: "전체 5건") */
  totalLabel: string;
  /** 해결 건수 레이블 (한국어, 예: "해결 3건") */
  resolvedLabel: string;
  /** 미해결 건수 레이블 (한국어, 예: "미해결 2건") */
  remainingLabel: string;
  /** 진행률 (0–100) */
  progressPercent: number;
  /** 미해결 항목 목록 */
  remainingItems: {
    title: string;
    severity: string;
    href: string;
  }[];
  /** 완전 해결 여부 */
  isFullyResolved: boolean;
}

// ---------------------------------------------------------------------------
// 6. 페이지 뷰모델
// ---------------------------------------------------------------------------

/** 예외 처리 페이지 최상위 뷰모델 */
export interface ExceptionPageViewModel {
  /** 요약 KPI */
  summary: ExceptionSummaryViewModel;
  /** 예외 큐 목록 */
  queue: ExceptionQueueItemViewModel[];
  /** 선택된 예외 상세 */
  selectedDetail?: ExceptionDetailViewModel;
  /** 부분 복구 상태 */
  partialRecovery?: PartialRecoveryViewModel;
  /** 필터 조건 */
  filters: {
    severity?: ExceptionSeverity;
    category?: ExceptionCategory;
    owner?: string;
    status?: ExceptionStatus;
  };
  /** 정렬 기준 */
  sortBy: "severity" | "elapsed" | "detected" | "owner";
  /** 페이지 상태 */
  pageState: {
    isEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 7. 헬퍼: 운영 건강도 톤 판정
// ---------------------------------------------------------------------------

/**
 * 예외 요약 지표로부터 운영 건강도 톤을 판정한다.
 *
 * - danger: critical 건수 > 0 또는 SLA 초과 > 2
 * - warning: high 건수 > 0 또는 SLA 초과 > 0 또는 미배정 > 0
 * - healthy: 그 외
 */
export function resolveExceptionHealthTone(summary: {
  criticalCount: number;
  overSlaCount: number;
  unassignedCount: number;
  highCount?: number;
}): "healthy" | "warning" | "danger" {
  if (summary.criticalCount > 0 || summary.overSlaCount > 2) {
    return "danger";
  }
  if (
    (summary.highCount ?? 0) > 0 ||
    summary.overSlaCount > 0 ||
    summary.unassignedCount > 0
  ) {
    return "warning";
  }
  return "healthy";
}

// ---------------------------------------------------------------------------
// 8. 헬퍼: 복구 액션 필터링
// ---------------------------------------------------------------------------

/** 권한 수준 우선순위 맵 */
const PERMISSION_RANK: Record<string, number> = {
  assignee: 1,
  admin: 2,
  owner: 3,
};

/**
 * 예외 항목과 사용자 역할에 따라 사용 가능한 복구 액션 뷰모델을 반환한다.
 *
 * - 예외의 availableActions 목록을 기반으로 필터
 * - 사용자 권한 수준에 따라 isEnabled 결정
 * - 위험 수준에 따른 riskTone 매핑
 */
export function filterRecoveryActions(
  exception: ExceptionItem,
  userRole: string,
): RecoveryActionViewModel[] {
  const userRank = PERMISSION_RANK[userRole] ?? 0;

  const riskToneMap: Record<string, "success" | "warning" | "danger"> = {
    low: "success",
    medium: "warning",
    high: "danger",
  };

  return exception.availableActions.map((actionType) => {
    const desc = RECOVERY_ACTION_DESCRIPTIONS[actionType];
    const requiredRank = PERMISSION_RANK[desc.permissionLevel] ?? 0;
    const isEnabled = userRank >= requiredRank;

    return {
      action: actionType,
      label: desc.label,
      description: desc.description,
      riskLevel: desc.riskLevel,
      riskTone: riskToneMap[desc.riskLevel] ?? "warning",
      isEnabled,
      disabledReason: isEnabled
        ? undefined
        : `${desc.permissionLevel} 이상 권한이 필요합니다`,
      requiresConfirm: desc.requiresConfirm,
      confirmMessage: desc.requiresConfirm
        ? `"${desc.label}" 작업을 실행하시겠습니까?`
        : undefined,
      requiresReasonInput: desc.requiresReasonInput,
    };
  });
}

// ---------------------------------------------------------------------------
// 9. 헬퍼: 워크플로우 복귀 경로 조회
// ---------------------------------------------------------------------------

/**
 * 예외 유형과 복구 액션으로부터 워크플로우 복귀 경로를 조회한다.
 *
 * WORKFLOW_RETURN_MAPPINGS에서 일치하는 매핑을 찾아 반환한다.
 * 일치하는 매핑이 없으면 null을 반환한다.
 */
export function resolveWorkflowReturn(
  exceptionType: ExceptionType,
  recoveryAction: RecoveryActionType,
): {
  returnState: string;
  nextAction: string;
  autoResume: boolean;
} | null {
  const mapping = WORKFLOW_RETURN_MAPPINGS.find(
    (m) =>
      m.exceptionType === exceptionType && m.resolvedVia === recoveryAction,
  );

  if (!mapping) return null;

  return {
    returnState: mapping.returnToState,
    nextAction: mapping.nextExpectedAction,
    autoResume: mapping.autoResumeWorkflow,
  };
}

// ---------------------------------------------------------------------------
// 10. 헬퍼: 경과 시간 포맷
// ---------------------------------------------------------------------------

/**
 * 분(minutes)을 한국어 경과 시간 문자열로 변환한다.
 *
 * - 60분 미만: "30분"
 * - 24시간 미만: "2시간 15분"
 * - 24시간 이상: "1일 3시간"
 */
export function formatElapsedTime(minutes: number): string {
  if (minutes < 0) return "0분";

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  }
  return `${mins}분`;
}

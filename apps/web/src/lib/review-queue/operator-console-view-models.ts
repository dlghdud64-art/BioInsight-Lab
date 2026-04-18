/**
 * operator-console-view-models.ts
 *
 * Operator Console ViewModel 및 헬퍼 함수.
 * operator-console-contract.ts의 도메인 타입을 UI 표시용으로 변환한다.
 *
 * @module operator-console-view-models
 */

import type {
  OperatorInboxItem,
  OperatorItemType,
  OperatorOwnershipState,
  OperatorPriority,
  OperatorQuickAction,
} from "./operator-console-contract";

// ---------------------------------------------------------------------------
// 1. 오늘 우선순위 요약 ViewModel
// ---------------------------------------------------------------------------

/** 오늘의 운영 우선순위 요약 */
export interface TodayPrioritySummaryViewModel {
  /** 긴급(p0) 항목 수 */
  urgentCount: number;
  /** SLA 초과 항목 수 */
  slaOverdueCount: number;
  /** 차단/예외 항목 수 */
  blockedExceptionCount: number;
  /** 미할당 항목 수 */
  unassignedCount: number;
  /** 오늘 기한인 항목 수 */
  dueTodayCount: number;
  /** 에스컬레이션 항목 수 */
  escalationCount: number;
  /** 가장 중요한 CTA */
  primaryCallToAction: { label: string; href: string };
  /** 요약 톤 (calm: 안정, attention: 주의, critical: 위험) */
  summaryTone: "calm" | "attention" | "critical";
}

// ---------------------------------------------------------------------------
// 2. Intake 세그먼트 ViewModel
// ---------------------------------------------------------------------------

/** Intake 세그먼트 UI 표시용 */
export interface IntakeSegmentViewModel {
  /** 세그먼트 고유 키 */
  key: string;
  /** 세그먼트 표시명 (한국어) */
  label: string;
  /** 항목 수 */
  count: number;
  /** 우선순위 힌트 문자열 */
  priorityHint: string;
  /** 현재 활성(선택) 상태 */
  isActive: boolean;
  /** 필터 적용 링크 */
  filterHref: string;
}

// ---------------------------------------------------------------------------
// 3. OperatorInboxItem ViewModel
// ---------------------------------------------------------------------------

/** Operator Inbox 항목의 UI 표시용 ViewModel */
export interface OperatorInboxItemViewModel {
  /** 항목 ID */
  id: string;
  /** 항목 유형 코드 */
  itemType: string;
  /** 항목 유형 라벨 (한국어) */
  itemTypeLabel: string;
  /** 항목 제목 */
  title: string;
  /** 상태 라벨 */
  stateLabel: string;
  /** 우선순위 */
  priority: OperatorPriority;
  /** 우선순위 라벨 (한국어) */
  priorityLabel: string;
  /** 우선순위 시각 톤 (CSS class 등에 활용) */
  priorityTone: string;
  /** 담당자 라벨 */
  ownerLabel?: string;
  /** 소유권 상태 라벨 (한국어) */
  ownershipStateLabel: string;
  /** 출처 컨텍스트 라벨 */
  sourceContextLabel?: string;
  /** 출처 컨텍스트 링크 */
  sourceContextHref?: string;
  /** 영향도 라벨 (한국어) */
  impactLabel?: string;
  /** 경과 시간 라벨 (한국어, 예: "26시간 경과") */
  elapsedTimeLabel: string;
  /** 기한 라벨 */
  dueLabel?: string;
  /** SLA 라벨 */
  slaLabel?: string;
  /** SLA 초과 여부 */
  isOverdue: boolean;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단 사유 라벨 */
  blockedReasonLabel?: string;
  /** 주요 액션 라벨 */
  primaryActionLabel?: string;
  /** 보조 액션 라벨 목록 */
  secondaryActionLabels?: string[];
  /** 연결된 컨텍스트 라벨 목록 */
  linkedContextLabels?: { label: string; href: string }[];
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 4. Quick Preview ViewModel
// ---------------------------------------------------------------------------

/** 항목 선택 시 사이드 패널에 표시되는 빠른 미리보기 */
export interface OperatorQuickPreviewViewModel {
  /** 항목 ID */
  itemId: string;
  /** 항목 제목 */
  title: string;
  /** 상태 요약 (한국어) */
  statusSummary: string;
  /** 차단 사유 */
  blockedReason?: string;
  /** 예산 경고 메시지 */
  budgetWarning?: string;
  /** 문서 경고 메시지 */
  documentWarning?: string;
  /** 연동 경고 메시지 */
  integrationWarning?: string;
  /** 담당자 라벨 */
  ownerLabel?: string;
  /** 출처 컨텍스트 라벨 */
  sourceContextLabel?: string;
  /** 실행 가능한 빠른 동작 목록 */
  quickActions: { label: string; actionKey: string; isDestructive: boolean }[];
}

// ---------------------------------------------------------------------------
// 5. 최근 처리 결과 Feed ViewModel
// ---------------------------------------------------------------------------

/** 최근 처리 완료 항목의 Feed 아이템 */
export interface OutcomeFeedItemViewModel {
  /** 항목 ID */
  id: string;
  /** 수행 동작 (한국어, 예: "견적 요청 4건 triage 완료") */
  action: string;
  /** 수행자 이름 */
  actor: string;
  /** 시간 라벨 (예: "3분 전") */
  timeLabel: string;
  /** 결과 유형 */
  resultType: "completed" | "recovered" | "reassigned" | "escalated";
}

// ---------------------------------------------------------------------------
// 6. 페이지 최상위 ViewModel
// ---------------------------------------------------------------------------

/** Operator Console 전체 페이지 ViewModel */
export interface OperatorConsolePageViewModel {
  /** 헤더 정보 */
  header: {
    title: string;
    purposeDescription: string;
    scopeLabel: string;
    primaryActionLabel: string;
    primaryActionHref: string;
  };
  /** 오늘 우선순위 요약 */
  todaySummary: TodayPrioritySummaryViewModel;
  /** Intake 세그먼트 목록 */
  segments: IntakeSegmentViewModel[];
  /** 현재 표시 중인 항목 목록 */
  items: OperatorInboxItemViewModel[];
  /** 선택된 항목의 빠른 미리보기 */
  selectedPreview?: OperatorQuickPreviewViewModel;
  /** 예외 항목 (사이드 큐) */
  exceptionItems: OperatorInboxItemViewModel[];
  /** 최근 처리 결과 피드 */
  recentOutcome: OutcomeFeedItemViewModel[];
  /** 현재 보기 모드 */
  currentView: "my_tasks" | "team" | "all";
  /** 운영 메트릭 요약 */
  metrics?: {
    processedToday: number;
    avgTriageTimeLabel: string;
    unassignedAgingLabel: string;
  };
  /** 페이지 상태 플래그 */
  pageState: {
    isEmpty: boolean;
    isFilterEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 7. 정렬 헬퍼
// ---------------------------------------------------------------------------

/** 우선순위 숫자 매핑 */
const PRIORITY_ORDER: Record<OperatorPriority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
};

/**
 * Operator Inbox 항목을 운영 우선순위 기준으로 정렬한다.
 *
 * 정렬 규칙:
 *   1. p0(긴급) 우선
 *   2. 같은 우선순위 내에서 overdue 우선
 *   3. 같은 우선순위 내에서 blocked + unassigned 우선
 *   4. 나머지는 p1 → p2 → p3 순서
 *   5. 동일 조건 내에서 오래된 항목(경과 시간 긴 순) 우선
 *
 * @param items 정렬 대상 항목 배열
 * @returns 정렬된 새 배열 (원본 불변)
 */
export function sortOperatorInboxItems(
  items: OperatorInboxItem[],
): OperatorInboxItem[] {
  return [...items].sort((a, b) => {
    // 우선순위 비교
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;

    // 같은 우선순위: overdue 우선
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;

    // 같은 우선순위: blocked + unassigned 우선
    const aBlockedUnassigned =
      a.isBlocked && a.ownershipState === "unassigned" ? 1 : 0;
    const bBlockedUnassigned =
      b.isBlocked && b.ownershipState === "unassigned" ? 1 : 0;
    if (aBlockedUnassigned !== bBlockedUnassigned)
      return bBlockedUnassigned - aBlockedUnassigned;

    // 동일 조건: 오래된 항목 우선 (경과 시간 내림차순)
    return b.elapsedHours - a.elapsedHours;
  });
}

// ---------------------------------------------------------------------------
// 8. 우선순위 라벨 변환
// ---------------------------------------------------------------------------

/**
 * 우선순위 코드를 한국어 라벨로 변환한다.
 *
 * @param priority 우선순위 코드
 * @returns 한국어 라벨 (예: "긴급", "오늘 처리", "일반", "참고")
 */
export function resolveOperatorPriorityLabel(
  priority: OperatorPriority,
): string {
  const labels: Record<OperatorPriority, string> = {
    p0: "긴급",
    p1: "오늘 처리",
    p2: "일반",
    p3: "참고",
  };
  return labels[priority];
}

// ---------------------------------------------------------------------------
// 9. 소유권 상태 라벨 변환
// ---------------------------------------------------------------------------

/**
 * 소유권 상태를 한국어 라벨로 변환한다.
 *
 * @param state 소유권 상태 코드
 * @returns 한국어 라벨 (예: "내 작업", "팀 배정", "미할당", "차단됨")
 */
export function resolveOwnershipStateLabel(
  state: OperatorOwnershipState,
): string {
  const labels: Record<OperatorOwnershipState, string> = {
    assigned_to_me: "내 작업",
    assigned_to_team: "팀 배정",
    unassigned: "팀 미할당",
    blocked: "차단됨",
  };
  return labels[state];
}

// ---------------------------------------------------------------------------
// 10. 경과 시간 포맷
// ---------------------------------------------------------------------------

/**
 * 경과 시간(시간 단위)을 한국어 문자열로 변환한다.
 *
 * @param hours 경과 시간 (소수점 허용)
 * @returns 한국어 경과 시간 문자열 (예: "2시간", "1일 2시간", "3일")
 */
export function formatElapsedTime(hours: number): string {
  if (hours < 0) return "0시간";

  const totalHours = Math.floor(hours);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  if (days === 0) {
    return `${totalHours}시간`;
  }
  if (remainingHours === 0) {
    return `${days}일`;
  }
  return `${days}일 ${remainingHours}시간`;
}

// ---------------------------------------------------------------------------
// 11. 요약 톤 결정
// ---------------------------------------------------------------------------

/**
 * 긴급/초과/차단 항목 수를 기반으로 요약 톤을 결정한다.
 *
 * - critical: 긴급 1건 이상 또는 초과+차단 합계 3건 이상
 * - attention: 초과 또는 차단이 1건 이상
 * - calm: 그 외
 *
 * @param urgentCount 긴급(p0) 항목 수
 * @param overdueCount SLA 초과 항목 수
 * @param blockedCount 차단 항목 수
 * @returns 요약 톤
 */
export function resolveSummaryTone(
  urgentCount: number,
  overdueCount: number,
  blockedCount: number,
): "calm" | "attention" | "critical" {
  if (urgentCount > 0 || overdueCount + blockedCount >= 3) {
    return "critical";
  }
  if (overdueCount > 0 || blockedCount > 0) {
    return "attention";
  }
  return "calm";
}

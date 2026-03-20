/**
 * Procurement Inbox / Operator Console ViewModel 정의
 *
 * UI 렌더링에 필요한 표시 전용 타입과 헬퍼 함수를 제공한다.
 * 도메인 모델은 procurement-inbox-contract.ts 에서 가져온다.
 */

import type {
  InboxItem,
  InboxItemSource,
  InboxPriority,
  OperatorWorkQueueFilter,
  QuickActionType,
  TodayPrioritySummary,
} from "./procurement-inbox-contract";

import {
  INBOX_SOURCE_DESCRIPTIONS,
  PRIORITY_SORT_ORDER,
} from "./procurement-inbox-contract";

// ---------------------------------------------------------------------------
// 1. TodayPrioritySummaryViewModel
// ---------------------------------------------------------------------------

/** 오늘의 우선순위 요약 — 상단 KPI 카드용 ViewModel */
export interface TodayPrioritySummaryViewModel {
  /** 긴급 건수 라벨 (e.g. "긴급 3건") */
  urgentCountLabel: string;
  /** 오늘 처리 대상 건수 라벨 */
  todayCountLabel: string;
  /** 차단 건수 라벨 */
  blockedCountLabel: string;
  /** 미배정 건수 라벨 */
  unassignedCountLabel: string;
  /** SLA 초과 건수 라벨 */
  slaOverdueLabel: string;
  /** 오늘 처리 완료 건수 라벨 */
  resolvedTodayLabel: string;
  /** 전체 건강 상태 톤 */
  healthTone: "healthy" | "warning" | "danger";
  /** 건강 상태 라벨 (한국어) */
  healthLabel: string;
  /** 최우선 항목 표시 정보 (상위 3건) */
  topPriorityLabels: {
    /** 항목 제목 */
    title: string;
    /** 소스 배지 라벨 */
    sourceBadge: string;
    /** 경과 시간 라벨 */
    elapsedLabel: string;
    /** 상세 링크 */
    href: string;
  }[];
}

// ---------------------------------------------------------------------------
// 2. IntakeSegmentViewModel
// ---------------------------------------------------------------------------

/** 소스별 접수 세그먼트 — 탭/카드 UI용 ViewModel */
export interface IntakeSegmentViewModel {
  /** 세그먼트 ID */
  id: string;
  /** 세그먼트 라벨 (한국어) */
  label: string;
  /** 총 항목 수 라벨 (e.g. "12건") */
  countLabel: string;
  /** 긴급 배지 (e.g. "긴급 2") */
  urgentBadge?: string;
  /** 차단 배지 (e.g. "차단 1") */
  blockedBadge?: string;
  /** 미배정 배지 (e.g. "미배정 3") */
  unassignedBadge?: string;
  /** 톤 */
  tone: "neutral" | "warning" | "danger";
  /** 현재 활성 탭 여부 */
  isActive: boolean;
  /** 세그먼트 필터 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 3. InboxItemViewModel
// ---------------------------------------------------------------------------

/** Inbox 개별 항목 — 작업 큐 행(row) UI용 ViewModel */
export interface InboxItemViewModel {
  /** 항목 ID */
  id: string;
  /** 제목 */
  title: string;
  /** 요약 */
  summary: string;
  /** 소스 라벨 (한국어) */
  sourceLabel: string;
  /** 소스 톤 */
  sourceTone: string;
  /** 우선순위 라벨 (한국어) */
  priorityLabel: string;
  /** 우선순위 톤 */
  priorityTone: "urgent" | "today" | "normal" | "reference";
  /** 상태 라벨 (한국어) */
  statusLabel: string;
  /** 담당자 라벨 (미배정이면 "미배정") */
  ownerLabel: string;
  /** 경과 시간 라벨 (한국어, e.g. "2시간 30분 경과") */
  elapsedLabel: string;
  /** 마감 라벨 (한국어) */
  dueLabel?: string;
  /** SLA 라벨 (한국어) */
  slaLabel?: string;
  /** SLA 톤 */
  slaTone?: "within" | "warning" | "exceeded";
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단 사유 라벨 */
  blockedReasonLabel?: string;
  /** 에스컬레이션 여부 */
  isEscalated: boolean;
  /** 사용 가능한 빠른 액션 목록 */
  quickActions: {
    /** 액션 유형 */
    type: QuickActionType;
    /** 액션 라벨 */
    label: string;
    /** 액션 톤 */
    tone: string;
    /** 활성화 여부 */
    isEnabled: boolean;
  }[];
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 4. PipelineBottleneckViewModel
// ---------------------------------------------------------------------------

/** 파이프라인 병목 현황 — 시각화 UI용 ViewModel */
export interface PipelineBottleneckViewModel {
  /** 단계별 병목 정보 */
  stages: {
    /** 단계 라벨 (한국어) */
    label: string;
    /** 차단 항목 수 */
    blockedCount: number;
    /** 지연 항목 수 */
    delayedCount: number;
    /** 톤 */
    tone: "healthy" | "warning" | "danger";
    /** 최대 병목 원인 (한국어) */
    topBlockerLabel: string;
    /** 드릴다운 링크 */
    href: string;
  }[];
  /** 가장 심각한 단계 라벨 (한국어) */
  worstStageLabel: string;
}

// ---------------------------------------------------------------------------
// 5. OutcomeEntryViewModel
// ---------------------------------------------------------------------------

/** 최근 처리 결과 — 하단 피드 UI용 ViewModel */
export interface OutcomeEntryViewModel {
  /** 액션 라벨 (한국어) */
  actionLabel: string;
  /** 대상 항목 라벨 */
  targetLabel: string;
  /** 수행자 라벨 */
  actorLabel: string;
  /** 시간 라벨 (한국어, e.g. "5분 전") */
  timeLabel: string;
  /** 결과 라벨 */
  resultLabel: string;
  /** 실행 취소 가능 여부 */
  canUndo: boolean;
}

// ---------------------------------------------------------------------------
// 6. OperatorConsolePageViewModel (최상위)
// ---------------------------------------------------------------------------

/** 운영 콘솔 페이지 전체 ViewModel */
export interface OperatorConsolePageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 목적 설명 */
    purposeDescription: string;
    /** 워크스페이스 라벨 */
    workspaceLabel: string;
  };
  /** 오늘의 우선순위 요약 */
  todaySummary: TodayPrioritySummaryViewModel;
  /** 접수 세그먼트 목록 */
  intakeSegments: IntakeSegmentViewModel[];
  /** 작업 큐 항목 목록 */
  workQueue: InboxItemViewModel[];
  /** 파이프라인 병목 현황 */
  pipeline: PipelineBottleneckViewModel;
  /** 예외 사이드 큐 (에스컬레이션/차단 항목만) */
  exceptionSideQueue: InboxItemViewModel[];
  /** 최근 처리 결과 */
  recentOutcomes: OutcomeEntryViewModel[];
  /** 현재 필터 상태 */
  filters: OperatorWorkQueueFilter;
  /** 페이지 상태 */
  pageState: {
    /** 비어있음 여부 */
    isEmpty: boolean;
    /** 오류 여부 */
    hasError: boolean;
    /** 접근 불가 여부 */
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 7. 헬퍼: resolveInboxPriority
// ---------------------------------------------------------------------------

/**
 * 항목 속성을 기반으로 우선순위를 판정한다.
 * PRIORITY_RULES 로직을 적용하여 가장 높은 우선순위를 반환한다.
 */
export function resolveInboxPriority(item: {
  slaDeadline?: string;
  severity?: string;
  ownerId?: string;
  elapsedMinutes: number;
  source: InboxItemSource;
}): InboxPriority {
  const now = Date.now();

  // urgent: SLA 초과 또는 1시간 이내 임박
  if (item.slaDeadline) {
    const slaTime = new Date(item.slaDeadline).getTime();
    const remainingMinutes = (slaTime - now) / 60_000;
    if (remainingMinutes <= 60) {
      return "urgent";
    }
  }

  // urgent: critical/high severity
  if (item.severity === "critical" || item.severity === "high") {
    return "urgent";
  }

  // urgent: 미배정 + 2시간 이상 경과
  if (!item.ownerId && item.elapsedMinutes >= 120) {
    return "urgent";
  }

  // today/normal/reference: 소스별 기본 우선순위 적용
  const sourceDefault =
    INBOX_SOURCE_DESCRIPTIONS[item.source]?.defaultPriority ?? "normal";

  return sourceDefault;
}

// ---------------------------------------------------------------------------
// 8. 헬퍼: sortInboxItems
// ---------------------------------------------------------------------------

/**
 * Inbox 항목을 우선순위 기반으로 정렬한다.
 * 1차 정렬: 우선순위 (urgent → reference)
 * 2차 정렬: sortBy 파라미터에 따른 보조 정렬
 */
export function sortInboxItems(
  items: InboxItemViewModel[],
  sortBy: OperatorWorkQueueFilter["sortBy"],
): InboxItemViewModel[] {
  return [...items].sort((a, b) => {
    // 1차: 우선순위
    const pa = PRIORITY_SORT_ORDER[a.priorityTone] ?? 99;
    const pb = PRIORITY_SORT_ORDER[b.priorityTone] ?? 99;
    if (pa !== pb) return pa - pb;

    // 2차: sortBy
    switch (sortBy) {
      case "priority":
        return 0; // 이미 우선순위로 정렬됨
      case "created":
        return a.id.localeCompare(b.id); // id 기반 안정 정렬
      case "due":
        if (!a.dueLabel && !b.dueLabel) return 0;
        if (!a.dueLabel) return 1;
        if (!b.dueLabel) return -1;
        return a.dueLabel.localeCompare(b.dueLabel);
      case "elapsed":
        return a.elapsedLabel.localeCompare(b.elapsedLabel);
      case "source":
        return a.sourceLabel.localeCompare(b.sourceLabel);
      default:
        return 0;
    }
  });
}

// ---------------------------------------------------------------------------
// 9. 헬퍼: buildIntakeSegments
// ---------------------------------------------------------------------------

/**
 * InboxItem 목록을 소스별로 그룹화하여 IntakeSegmentViewModel 목록을 생성한다.
 * 각 세그먼트의 urgent/blocked/unassigned 수를 계산하고 톤을 결정한다.
 */
export function buildIntakeSegments(
  items: InboxItem[],
): IntakeSegmentViewModel[] {
  const grouped: Record<
    string,
    {
      source: InboxItemSource;
      count: number;
      urgentCount: number;
      blockedCount: number;
      unassignedCount: number;
    }
  > = {};

  for (const item of items) {
    const key = item.source;
    if (!grouped[key]) {
      grouped[key] = {
        source: key,
        count: 0,
        urgentCount: 0,
        blockedCount: 0,
        unassignedCount: 0,
      };
    }
    const entry = grouped[key]!;
    entry.count++;
    if (item.priority === "urgent") entry.urgentCount++;
    if (item.isBlocked) entry.blockedCount++;
    if (!item.ownerId) entry.unassignedCount++;
  }

  const segments: IntakeSegmentViewModel[] = [];

  for (const key of Object.keys(grouped)) {
    const counts = grouped[key]!;
    const source = counts.source;
    const desc = INBOX_SOURCE_DESCRIPTIONS[source];
    const tone: "neutral" | "warning" | "danger" =
      counts.urgentCount > 0
        ? "danger"
        : counts.blockedCount > 0 || counts.unassignedCount > 0
          ? "warning"
          : "neutral";

    segments.push({
      id: source,
      label: desc?.label ?? source,
      countLabel: `${counts.count}건`,
      urgentBadge: counts.urgentCount > 0 ? `긴급 ${counts.urgentCount}` : undefined,
      blockedBadge: counts.blockedCount > 0 ? `차단 ${counts.blockedCount}` : undefined,
      unassignedBadge:
        counts.unassignedCount > 0
          ? `미배정 ${counts.unassignedCount}`
          : undefined,
      tone,
      isActive: false,
      href: `/dashboard/inbox?source=${source}`,
    });
  }

  // danger 톤 먼저, 그다음 warning, neutral 순
  const toneOrder = { danger: 0, warning: 1, neutral: 2 };
  segments.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);

  return segments;
}

// ---------------------------------------------------------------------------
// 10. 헬퍼: resolveConsoleTone
// ---------------------------------------------------------------------------

/**
 * 오늘의 요약 데이터로 콘솔 전체 건강 상태 톤을 결정한다.
 * - danger: urgent > 2 또는 slaOverdue > 0
 * - warning: urgent > 0 또는 blocked > 2 또는 unassigned > 3
 * - healthy: 그 외
 */
export function resolveConsoleTone(
  summary: TodayPrioritySummary,
): "healthy" | "warning" | "danger" {
  if (summary.urgentCount > 2 || summary.slaOverdueCount > 0) {
    return "danger";
  }
  if (
    summary.urgentCount > 0 ||
    summary.blockedCount > 2 ||
    summary.unassignedCount > 3
  ) {
    return "warning";
  }
  return "healthy";
}

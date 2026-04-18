/**
 * Integration / Sync UI용 ViewModel 타입 및 헬퍼
 *
 * 계약 파일(integration-sync-contract.ts)의 타입을 기반으로
 * 화면에 직접 바인딩할 수 있는 ViewModel을 정의한다.
 */

import type {
  IntegrationConnectionStatus,
  SyncStatus,
  SyncFailureReason,
  RecoveryActionType,
  SyncEventType,
  IssueSeverity,
} from "./integration-sync-contract";

import { INTEGRATION_HEALTH_THRESHOLDS } from "./integration-sync-contract";

// ---------------------------------------------------------------------------
// 1. 건강 요약 ViewModel
// ---------------------------------------------------------------------------

/** 연동 전체 건강 요약 — 페이지 상단 대시보드 카드용 */
export interface IntegrationHealthSummaryViewModel {
  /** 전체 연동 수 */
  totalCount: number;
  /** 정상 연동 수 */
  healthyCount: number;
  /** 경고 상태 연동 수 */
  warningCount: number;
  /** 위험 상태 연동 수 */
  criticalCount: number;
  /** 연결 해제된 연동 수 */
  disconnectedCount: number;
  /** 가장 중요한 문제 한 줄 요약 (없으면 undefined) */
  primaryIssueLabel?: string;
}

// ---------------------------------------------------------------------------
// 2. 우선순위 이슈 ViewModel
// ---------------------------------------------------------------------------

/** 우선순위 이슈 카드용 ViewModel */
export interface IntegrationPriorityIssueViewModel {
  /** 이슈 고유 식별자 */
  id: string;
  /** 해당 연동 이름 */
  integrationName: string;
  /** 이슈 제목 */
  title: string;
  /** 이슈 상세 설명 */
  description: string;
  /** 심각도 */
  severity: IssueSeverity;
  /** 복구 조치 라벨 */
  recoveryLabel: string;
  /** 복구 조치 링크 */
  recoveryHref?: string;
  /** 복구 조치 유형 */
  recoveryActionType: RecoveryActionType;
  /** 영향받는 기능 요약 라벨 */
  affectedFeaturesLabel: string;
  /** 감지 시점 표시 라벨 (예: "2시간 전") */
  detectedTimeLabel: string;
}

// ---------------------------------------------------------------------------
// 3. 연동 카드 ViewModel
// ---------------------------------------------------------------------------

/** 연동 목록의 개별 카드 ViewModel */
export interface IntegrationCardViewModel {
  /** 연동 고유 식별자 */
  id: string;
  /** 연동 이름 */
  name: string;
  /** 공급업체 표시 라벨 */
  providerLabel: string;
  /** 카테고리 표시 라벨 */
  categoryLabel: string;
  /** 연결 상태 */
  connectionStatus: IntegrationConnectionStatus;
  /** 연결 상태 표시 라벨 (한국어) */
  connectionStatusLabel: string;
  /** 동기화 상태 */
  syncStatus: SyncStatus;
  /** 동기화 상태 표시 라벨 (한국어) */
  syncStatusLabel: string;
  /** 마지막 성공 동기화 시점 표시 (예: "30분 전") */
  lastSuccessLabel?: string;
  /** 마지막 실패 시점 표시 */
  lastFailureLabel?: string;
  /** 다음 동기화 예정 시점 표시 */
  nextSyncLabel?: string;
  /** 대기 중인 항목 수 */
  pendingItemCount?: number;
  /** 카드 시각적 톤 */
  tone: "healthy" | "warning" | "danger" | "inactive";
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 4. 연동 상세 ViewModel
// ---------------------------------------------------------------------------

/** 연동 상세 페이지 ViewModel */
export interface IntegrationDetailViewModel {
  /** 연동 고유 식별자 */
  id: string;
  /** 연동 이름 */
  name: string;
  /** 공급업체 표시 라벨 */
  providerLabel: string;
  /** 카테고리 표시 라벨 */
  categoryLabel: string;
  /** 연동 설명 */
  description: string;
  /** 연결 상태 */
  connectionStatus: IntegrationConnectionStatus;
  /** 연결 상태 표시 라벨 */
  connectionStatusLabel: string;
  /** 동기화 상태 */
  syncStatus: SyncStatus;
  /** 동기화 상태 표시 라벨 */
  syncStatusLabel: string;
  /** 인증 정보 */
  authInfo: {
    /** 연결된 계정 표시 라벨 */
    accountLabel: string;
    /** 부여된 권한(scope) 라벨 목록 */
    scopeLabels: string[];
    /** 인증 만료 시점 표시 */
    expiresLabel?: string;
  };
  /** 동기화 스케줄 정보 */
  syncSchedule: {
    /** 동기화 주기 라벨 (예: "매시간") */
    intervalLabel: string;
    /** 자동 재시도 설정 라벨 */
    autoRetryLabel: string;
    /** 다음 예정 동기화 시점 */
    nextScheduledLabel?: string;
  };
  /** 마지막 성공 동기화 정보 */
  lastSuccess: {
    /** 시점 라벨 */
    timeLabel: string;
    /** 동기화된 항목 수 */
    itemCount?: number;
    /** 소요 시간 라벨 */
    durationLabel?: string;
  };
  /** 마지막 실패 정보 (없으면 undefined) */
  lastFailure?: {
    /** 실패 시점 라벨 */
    timeLabel: string;
    /** 실패 원인 라벨 */
    reasonLabel: string;
    /** 실패 원인 유형 */
    reasonType: SyncFailureReason;
  };
  /** 의존 기능 목록 및 영향 수준 */
  dependentFeatures: {
    /** 기능 이름 */
    label: string;
    /** 영향 수준 */
    impactLevel: "blocked" | "degraded" | "unaffected";
  }[];
  /** 의존 데이터 목록 및 최신성 */
  dependentData: {
    /** 데이터 유형 이름 */
    label: string;
    /** 데이터 최신성 라벨 (예: "3시간 전 기준") */
    stalenessLabel?: string;
  }[];
  /** 복구 조치 목록 */
  recoveryActions: {
    label: string;
    actionType: RecoveryActionType;
    href?: string;
  }[];
  /** 최근 동기화 이벤트 타임라인 */
  recentSyncEvents: SyncTimelineItemViewModel[];
  /** 감사 로그 항목 */
  auditEntries: {
    /** 행위자 */
    actor: string;
    /** 수행 행위 */
    action: string;
    /** 시점 라벨 */
    timeLabel: string;
  }[];
}

// ---------------------------------------------------------------------------
// 5. 동기화 타임라인 항목 ViewModel
// ---------------------------------------------------------------------------

/** 동기화 타임라인의 개별 이벤트 ViewModel */
export interface SyncTimelineItemViewModel {
  /** 이벤트 고유 식별자 */
  id: string;
  /** 이벤트 유형 */
  eventType: SyncEventType;
  /** 이벤트 표시 라벨 (한국어) */
  eventLabel: string;
  /** 시점 표시 라벨 */
  timeLabel: string;
  /** 추가 상세 정보 */
  detail?: string;
  /** 시각적 톤 */
  tone: "success" | "warning" | "danger" | "neutral";
}

// ---------------------------------------------------------------------------
// 6. 페이지 최상위 ViewModel
// ---------------------------------------------------------------------------

/** 연동 상태 페이지 전체 ViewModel */
export interface IntegrationPageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 페이지 목적 설명 */
    purposeDescription: string;
    /** 주요 액션 라벨 */
    primaryActionLabel?: string;
    /** 주요 액션 링크 */
    primaryActionHref?: string;
  };
  /** 건강 요약 */
  healthSummary: IntegrationHealthSummaryViewModel;
  /** 우선순위 이슈 목록 */
  priorityIssues: IntegrationPriorityIssueViewModel[];
  /** 연동 카드 목록 */
  integrations: IntegrationCardViewModel[];
  /** 선택된 연동 상세 (없으면 undefined) */
  selectedDetail?: IntegrationDetailViewModel;
  /** 페이지 상태 */
  pageState: {
    /** 연동이 하나도 없는 상태 */
    isEmpty: boolean;
    /** 데이터 로드 에러 상태 */
    hasError: boolean;
    /** 권한 부족 등으로 사용 불가 상태 */
    isUnavailable: boolean;
    /** 사용 불가 사유 */
    unavailableReason?: string;
  };
}

// ---------------------------------------------------------------------------
// 7. 헬퍼: 연동 톤 결정
// ---------------------------------------------------------------------------

/**
 * 연결 상태와 동기화 상태를 조합하여 시각적 톤을 결정한다.
 *
 * - inactive: 연결 해제 또는 동기화 비활성
 * - danger: 인증 만료, 정지, 전체 실패
 * - warning: 권한 부족, rate limit, 부분 실패, stale, 동기화 중
 * - healthy: 연결됨 + 정상 동기화
 */
export function resolveIntegrationTone(
  connectionStatus: IntegrationConnectionStatus,
  syncStatus: SyncStatus,
): "healthy" | "warning" | "danger" | "inactive" {
  // 연결 해제 또는 동기화 비활성 → inactive
  if (connectionStatus === "disconnected" || syncStatus === "disabled") {
    return "inactive";
  }

  // 인증 만료, 정지 → danger
  if (
    connectionStatus === "auth_expired" ||
    connectionStatus === "suspended"
  ) {
    return "danger";
  }

  // 전체 실패 → danger
  if (syncStatus === "full_failure") {
    return "danger";
  }

  // 권한 부족, rate limit → warning
  if (
    connectionStatus === "scope_insufficient" ||
    connectionStatus === "rate_limited"
  ) {
    return "warning";
  }

  // 부분 실패, stale, 동기화 진행 중, 대기 → warning
  if (
    syncStatus === "partial_failure" ||
    syncStatus === "stale" ||
    syncStatus === "syncing" ||
    syncStatus === "pending"
  ) {
    return "warning";
  }

  return "healthy";
}

// ---------------------------------------------------------------------------
// 8. 헬퍼: 동기화 최신성 판단
// ---------------------------------------------------------------------------

/**
 * 마지막 성공 동기화 시점으로부터 경과 시간을 기준으로 최신성을 판단한다.
 *
 * @param lastSuccessAt - 마지막 성공 동기화 시점 (null이면 stale 반환)
 * @param thresholds - 경고/위험 임계값 (분 단위)
 * @returns "fresh" | "warning" | "stale"
 */
export function resolveSyncStaleness(
  lastSuccessAt: Date | null,
  thresholds: typeof INTEGRATION_HEALTH_THRESHOLDS.syncStalenessMinutes = INTEGRATION_HEALTH_THRESHOLDS.syncStalenessMinutes,
): "fresh" | "warning" | "stale" {
  if (!lastSuccessAt) {
    return "stale";
  }

  const elapsedMinutes =
    (Date.now() - lastSuccessAt.getTime()) / (1000 * 60);

  if (elapsedMinutes >= thresholds.danger) {
    return "stale";
  }

  if (elapsedMinutes >= thresholds.warning) {
    return "warning";
  }

  return "fresh";
}

// ---------------------------------------------------------------------------
// 9. 헬퍼: 영향 요약 문장 생성
// ---------------------------------------------------------------------------

/**
 * 의존 기능 목록과 동기화 상태를 바탕으로
 * 영향 요약 문장을 한국어로 생성한다.
 *
 * @param dependentFeatures - 영향받는 기능 이름 목록
 * @param syncStatus - 현재 동기화 상태
 * @returns 한국어 영향 요약 문장
 *
 * @example
 * formatImpactSummary(["카탈로그 검색", "가격 비교"], "partial_failure")
 * // → "카탈로그 검색, 가격 비교 기능이 영향받고 있습니다"
 *
 * formatImpactSummary(["카탈로그 검색"], "healthy")
 * // → "모든 기능이 정상 작동 중입니다"
 */
export function formatImpactSummary(
  dependentFeatures: string[],
  syncStatus: SyncStatus,
): string {
  // 정상이거나 기능 목록이 비어있으면 정상 메시지
  if (
    syncStatus === "healthy" ||
    syncStatus === "disabled" ||
    dependentFeatures.length === 0
  ) {
    return "모든 기능이 정상 작동 중입니다";
  }

  const featureList = dependentFeatures.join(", ");

  switch (syncStatus) {
    case "full_failure":
      return `${featureList} 기능이 중단되었습니다`;
    case "partial_failure":
      return `${featureList} 기능이 부분적으로 영향받고 있습니다`;
    case "stale":
      return `${featureList} 기능의 데이터가 최신이 아닐 수 있습니다`;
    case "syncing":
    case "pending":
      return `${featureList} 기능이 동기화 대기 중입니다`;
    default:
      return `${featureList} 기능이 영향받고 있습니다`;
  }
}

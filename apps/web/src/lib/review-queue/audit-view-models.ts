/**
 * audit-view-models.ts
 *
 * 감사(Audit) UI용 ViewModel 타입 정의.
 * 프레젠터(Presenter)는 이 파일의 타입만 수신한다.
 * 도메인 모델이나 API 응답 타입에 직접 의존하지 않는다.
 */

import type {
  AuditActorType,
  AuditEventCategory,
  AuditRiskLevel,
  AuditReviewState,
  AuditScopeLevel,
  PermissionChangeDiff,
} from "./audit-permission-contract";

// ---------------------------------------------------------------------------
// 1. AuditScopeRiskSummaryViewModel — 범위·위험도 요약 카드
// ---------------------------------------------------------------------------

/** 감사 페이지 상단 범위·위험도 요약 정보 */
export interface AuditScopeRiskSummaryViewModel {
  /** 조회 기간 라벨 (예: "2026-03-01 ~ 2026-03-20") */
  periodLabel: string;
  /** 기간 내 전체 변경 건수 */
  totalChangeCount: number;
  /** 관리자 권한 변경 건수 */
  adminPermissionChangeCount: number;
  /** 정책 변경 건수 */
  policyChangeCount: number;
  /** 보안 설정 변경 건수 */
  securityChangeCount: number;
  /** 미검토 이벤트 건수 */
  unreviewedCount: number;
  /** 고위험(critical + high) 이벤트 건수 */
  highRiskCount: number;
  /** 비정상 활동 감지 건수 */
  unusualActivityCount: number;
}

// ---------------------------------------------------------------------------
// 2. AuditPriorityReviewItemViewModel — 우선 검토 항목
// ---------------------------------------------------------------------------

/** 우선 검토 큐에 노출되는 개별 항목 */
export interface AuditPriorityReviewItemViewModel {
  /** 이벤트 고유 ID */
  id: string;
  /** 요약 제목 */
  title: string;
  /** 상세 설명 */
  description: string;
  /** 위험도 */
  riskLevel: AuditRiskLevel;
  /** 이벤트 범주 */
  eventCategory: AuditEventCategory;
  /** CTA 버튼 라벨 (예: "검토하기") */
  ctaLabel: string;
  /** 상세 페이지 경로 */
  href: string;
  /** 현재 검토 상태 */
  reviewState: AuditReviewState;
}

// ---------------------------------------------------------------------------
// 3. AuditEventRowViewModel — 이벤트 목록 행
// ---------------------------------------------------------------------------

/** 감사 이벤트 목록의 단일 행 */
export interface AuditEventRowViewModel {
  /** 이벤트 고유 ID */
  id: string;
  /** 요약 문장 (예: "홍길동(관리자)이 워크스페이스의 김철수 역할을 변경했습니다") */
  summaryLine: string;
  /** 이벤트 범주 */
  eventCategory: AuditEventCategory;
  /** 위험도 */
  riskLevel: AuditRiskLevel;
  /** 검토 상태 */
  reviewState: AuditReviewState;
  /** 행위자 이름 */
  actorName: string;
  /** 행위자 유형 */
  actorType: AuditActorType;
  /** 대상 라벨 */
  targetLabel: string;
  /** 범위 라벨 */
  scopeLabel: string;
  /** 절대 시간 (예: "2026-03-20 14:30:22") */
  absoluteTime: string;
  /** 상대 시간 (예: "2시간 전") */
  relativeTime: string;
  /** 업무 외 시간(22:00~06:00) 발생 여부 */
  isOffHours: boolean;
  /** 권한 변경 diff 존재 여부 */
  hasPermissionDiff: boolean;
}

// ---------------------------------------------------------------------------
// 4. AuditEventDetailViewModel — 이벤트 상세
// ---------------------------------------------------------------------------

/** 감사 이벤트 상세 뷰 */
export interface AuditEventDetailViewModel {
  /** 이벤트 고유 ID */
  id: string;
  /** 요약 문장 */
  summaryLine: string;
  /** 행위자 정보 */
  actor: {
    name: string;
    type: AuditActorType;
    /** 추가 상세 (예: IP 일부, 연동 서비스명) */
    detail?: string;
  };
  /** 대상 정보 */
  target: {
    label: string;
    type: string;
  };
  /** 범위 정보 */
  scope: {
    label: string;
    level: AuditScopeLevel;
  };
  /** 시간 정보 */
  time: {
    absolute: string;
    relative: string;
    isOffHours: boolean;
  };
  /** 권한 변경 전/후 비교 목록 */
  permissionDiffs: PermissionChangeDiff[];
  /** 변경의 운영 영향 설명 (한국어) */
  impactDescription: string;
  /** 위험도 */
  riskLevel: AuditRiskLevel;
  /** 검토 상태 */
  reviewState: AuditReviewState;
  /** 검토 메모 이력 */
  reviewNotes: {
    reviewer: string;
    note: string;
    timestamp: string;
  }[];
  /** 관련 후속 액션 */
  relatedActions: {
    label: string;
    href: string;
    actionType: string;
  }[];
  /** 관련 감사 이벤트 체인 (연속 변경 추적용) */
  relatedAuditChain?: {
    id: string;
    summaryLine: string;
    time: string;
  }[];
}

// ---------------------------------------------------------------------------
// 5. AuditUnusualActivityViewModel — 비정상 활동 카드
// ---------------------------------------------------------------------------

/** 비정상 활동 감지 카드 */
export interface AuditUnusualActivityViewModel {
  /** 고유 ID */
  id: string;
  /** 패턴 라벨 */
  patternLabel: string;
  /** 패턴 설명 */
  description: string;
  /** 관련 이벤트 건수 */
  relatedEventCount: number;
  /** 상세 경로 */
  href: string;
  /** CTA 버튼 라벨 */
  ctaLabel: string;
}

// ---------------------------------------------------------------------------
// 6. AuditPageViewModel — 페이지 최상위 ViewModel
// ---------------------------------------------------------------------------

/** 감사 페이지 전체 구조를 담는 최상위 ViewModel */
export interface AuditPageViewModel {
  /** 페이지 헤더 */
  header: {
    title: string;
    purposeDescription: string;
    primaryActionLabel?: string;
    primaryActionHref?: string;
  };
  /** 범위·위험도 요약 */
  scopeRiskSummary: AuditScopeRiskSummaryViewModel;
  /** 우선 검토 항목 목록 */
  priorityReviewItems: AuditPriorityReviewItemViewModel[];
  /** 비정상 활동 목록 */
  unusualActivities: AuditUnusualActivityViewModel[];
  /** 감사 이벤트 행 목록 */
  events: AuditEventRowViewModel[];
  /** 현재 적용된 필터 요약 */
  appliedFilters: { label: string };
  /** 데이터 신선도 및 보관 정책 */
  freshness: {
    /** 마지막 갱신 시각 */
    lastUpdated: string;
    /** 보관 기간(일) */
    retentionDays: number;
  };
  /** 페이지 상태 (빈 상태, 오류, 사용 불가) */
  pageState: {
    isEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
    unavailableReason?: string;
  };
}

// ---------------------------------------------------------------------------
// 7. resolveAuditRiskLevel — 위험도 산정 헬퍼
// ---------------------------------------------------------------------------

/**
 * 감사 이벤트의 위험도를 산정한다.
 *
 * 산정 기준:
 * - 보안·감사 설정 + 조직 범위 + 권한 상승 → critical
 * - 승인 정책 + 워크스페이스 이상 범위 → high
 * - 권한 상승이 포함되면 최소 high
 * - 나머지는 범주·범위 조합으로 medium/low 결정
 *
 * @param category - 이벤트 범주
 * @param scopeLevel - 영향 범위 수준
 * @param isEscalation - 권한 상승 여부
 * @returns 산정된 위험도
 */
export function resolveAuditRiskLevel(
  category: AuditEventCategory,
  scopeLevel: AuditScopeLevel,
  isEscalation: boolean,
): AuditRiskLevel {
  const criticalCategories: AuditEventCategory[] = [
    "security_policy",
    "system_audit_setting",
    "plan_retention",
  ];
  const highCategories: AuditEventCategory[] = [
    "role_permission",
    "approval_policy",
    "integration_setting",
  ];
  const broadScopes: AuditScopeLevel[] = [
    "workspace",
    "organization",
  ];

  // 보안/감사 범주 + 조직 범위 + 상승 → critical
  if (
    criticalCategories.includes(category) &&
    scopeLevel === "organization"
  ) {
    return "critical";
  }

  // 보안/감사 범주 + 권한 상승 → critical
  if (criticalCategories.includes(category) && isEscalation) {
    return "critical";
  }

  // 고위험 범주 + 넓은 범위 → high
  if (
    highCategories.includes(category) &&
    broadScopes.includes(scopeLevel)
  ) {
    return isEscalation ? "critical" : "high";
  }

  // 권한 상승이면 최소 high
  if (isEscalation) {
    return "high";
  }

  // 고위험 범주이지만 좁은 범위
  if (highCategories.includes(category)) {
    return "medium";
  }

  // 보안/감사 범주이지만 좁은 범위 & 비상승
  if (criticalCategories.includes(category)) {
    return "medium";
  }

  return "low";
}

// ---------------------------------------------------------------------------
// 8. formatAuditSummaryLine — 요약 문장 생성 헬퍼
// ---------------------------------------------------------------------------

/** 행위자 유형 한국어 라벨 매핑 */
const ACTOR_TYPE_LABELS: Record<AuditActorType, string> = {
  user: "사용자",
  admin: "관리자",
  system: "시스템",
  integration: "연동",
  api_token: "API 토큰",
};

/**
 * 감사 이벤트 요약 문장을 생성한다.
 *
 * 형식: "{actorName}({actorTypeLabel})이(가) {scopeLabel}의 {targetLabel}을(를) {action}"
 *
 * @param actorName - 행위자 이름
 * @param actorType - 행위자 유형
 * @param action - 수행 행위 (예: "역할을 변경했습니다")
 * @param targetLabel - 대상 라벨
 * @param scopeLabel - 범위 라벨
 * @returns 조합된 요약 문장
 */
export function formatAuditSummaryLine(
  actorName: string,
  actorType: AuditActorType,
  action: string,
  targetLabel: string,
  scopeLabel: string,
): string {
  const typeLabel = ACTOR_TYPE_LABELS[actorType] ?? actorType;
  return `${actorName}(${typeLabel})이(가) ${scopeLabel}의 ${targetLabel}을(를) ${action}`;
}

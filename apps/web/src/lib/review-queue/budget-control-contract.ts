/**
 * budget-control-contract.ts
 *
 * 예산 / 통제 규칙 운영 페이지 중앙 계약.
 *
 * 핵심 원칙: 예산은 보고용 지표가 아니라 구매/승인/발주 흐름을 지배하는
 * 운영 통제 규칙이다. 통제 규칙은 경고·제한·승인·차단 임계치를 명확히 분리해야 한다.
 */

// ---------------------------------------------------------------------------
// 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** 예산 통제 페이지의 섹션 순서를 정의한다. */
export const BUDGET_PAGE_SECTIONS = [
  "header",
  "healthSummary",
  "priorityRisks",
  "scopeNavigation",
  "currentRuleSection",
  "usageThresholdDetail",
  "relatedQueuesApprovals",
  "auditHistory",
] as const;

// ---------------------------------------------------------------------------
// 기본 타입
// ---------------------------------------------------------------------------

/** 예산 규칙이 적용되는 범위 수준 */
export type BudgetScopeLevel =
  | "organization"
  | "team"
  | "project"
  | "category"
  | "vendor";

/** 예산 기간 유형 */
export type BudgetPeriod = "monthly" | "quarterly" | "annual" | "custom";

/** 통제 규칙 유형 */
export type ControlRuleType =
  | "warning"
  | "soft_limit"
  | "hard_stop"
  | "approval_required"
  | "auto_approve_exception_block"
  | "high_risk_routing";

// ---------------------------------------------------------------------------
// 예산 규칙 정의
// ---------------------------------------------------------------------------

/** 예산 통제 규칙의 전체 정의 */
export interface BudgetRuleDefinition {
  /** 규칙 고유 식별자 */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 규칙 설명 (한국어) */
  description: string;
  /** 규칙이 적용되는 범위 수준 */
  scopeLevel: BudgetScopeLevel;
  /** 범위 대상 (팀명, 프로젝트명, 카테고리명 등) */
  scopeTarget: string;
  /** 예산 기간 */
  period: BudgetPeriod;
  /** 예산 금액 */
  budgetAmount: number;
  /** 통화 코드 (예: "KRW", "USD") */
  currency: string;
  /** 임계치 설정 (퍼센트) */
  thresholds: {
    /** 경고 임계치 (예: 70) */
    warningPercent: number;
    /** 소프트 리밋 임계치 (예: 90) */
    softLimitPercent: number;
    /** 하드 스톱 임계치 (예: 100) */
    hardStopPercent: number;
  };
  /** 적용할 통제 규칙 목록 */
  controlRules: ControlRuleType[];
  /** 승인 에스컬레이션 역할 (예: "APPROVER", "ADMIN") */
  approvalEscalationRole?: string;
  /** 예외 정책 */
  exceptionPolicy?: {
    /** 예외 승인(override)을 허용하는지 여부 */
    allowOverride: boolean;
    /** 예외 승인 권한자 */
    requireApprovalFrom: string;
    /** 최대 초과 허용 퍼센트 */
    maxOverridePercent: number;
  };
  /** 규칙 활성화 여부 */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// 예산 사용 스냅샷
// ---------------------------------------------------------------------------

/** 특정 규칙의 예산 사용 현황 스냅샷 */
export interface BudgetUsageSnapshot {
  /** 규칙 식별자 */
  ruleId: string;
  /** 현재 사용 금액 */
  currentUsage: number;
  /** 예산 총액 */
  budgetAmount: number;
  /** 사용 퍼센트 */
  usagePercent: number;
  /** 잔여 금액 */
  remainingAmount: number;
  /** 기간 라벨 (예: "2026년 3월") */
  periodLabel: string;
  /** 마지막 집계 시각 (ISO 문자열) */
  lastAggregatedAt: string;
  /** 미배정 비용 */
  pendingUnallocated: number;
  /** 최근 급증 감지 여부 */
  recentSurgeDetected: boolean;
}

// ---------------------------------------------------------------------------
// 건강 임계치
// ---------------------------------------------------------------------------

/** 예산 건강 상태 판단을 위한 임계치 */
export const BUDGET_HEALTH_THRESHOLDS = {
  /** 사용률 임계치 (퍼센트) */
  usagePercent: { normal: 70, warning: 85, danger: 95 },
  /** 기간 종료까지 남은 일수 임계치 */
  daysUntilPeriodEnd: { warning: 7, danger: 3 },
  /** 미배정 비용 비율 임계치 (퍼센트) */
  pendingUnallocatedPercent: { warning: 10, danger: 20 },
} as const;

// ---------------------------------------------------------------------------
// 위험 항목
// ---------------------------------------------------------------------------

/** 예산 위험 항목 */
export interface BudgetRiskItem {
  /** 위험 항목 식별자 */
  id: string;
  /** 관련 규칙 식별자 */
  ruleId: string;
  /** 위험 제목 (한국어) */
  title: string;
  /** 위험 설명 (한국어) */
  description: string;
  /** 위험 유형 */
  riskType:
    | "near_limit"
    | "exceeded_soft"
    | "exceeded_hard"
    | "surge_detected"
    | "unallocated_high"
    | "rule_conflict"
    | "rule_missing"
    | "aggregation_stale";
  /** 심각도 */
  severity: "critical" | "high" | "medium";
  /** 액션 라벨 (한국어) */
  actionLabel: string;
  /** 액션 링크 */
  actionHref: string;
  /** 영향 범위 (한국어) */
  affectedScope: string;
}

// ---------------------------------------------------------------------------
// 통제 규칙 설명
// ---------------------------------------------------------------------------

/** 통제 규칙 유형별 설명 (한국어) */
export const BUDGET_CONTROL_RULE_DESCRIPTIONS: Record<
  ControlRuleType,
  { label: string; description: string; impact: string }
> = {
  warning: {
    label: "경고 표시",
    description: "설정된 임계치에 도달하면 경고를 표시합니다.",
    impact: "경고 표시, 진행 가능",
  },
  soft_limit: {
    label: "소프트 리밋",
    description:
      "임계치를 초과하면 경고와 함께 추가 승인이 필요합니다.",
    impact: "경고 + 추가 승인 필요",
  },
  hard_stop: {
    label: "하드 스톱",
    description:
      "임계치를 초과하면 진행이 차단되며 예외 승인이 필요합니다.",
    impact: "진행 차단, 예외 승인 필요",
  },
  approval_required: {
    label: "승인 필수",
    description:
      "금액 또는 조건에 따라 지정된 승인자의 승인이 필수입니다.",
    impact: "금액/조건 기반 승인 필수",
  },
  auto_approve_exception_block: {
    label: "자동 승인 제외",
    description:
      "자동 승인 대상에서 제외하여 수동 검토를 강제합니다.",
    impact: "자동 승인 대상에서 제외",
  },
  high_risk_routing: {
    label: "고위험 우선 배정",
    description:
      "예산 위험이 감지되면 예산 책임자에게 우선 배정합니다.",
    impact: "예산 책임자에게 우선 배정",
  },
} as const;

// ---------------------------------------------------------------------------
// 영향 평가
// ---------------------------------------------------------------------------

/** 규칙 변경 시 영향 평가 */
export interface BudgetImpactAssessment {
  /** 적용 대상 범위 */
  appliesTo:
    | "new_requests_only"
    | "all_including_pending"
    | "specific_categories";
  /** 영향을 받는 팀 목록 */
  affectedTeams: string[];
  /** 영향을 받는 카테고리 목록 */
  affectedCategories: string[];
  /** 영향을 받는 추정 요청 건수 */
  estimatedRequestsAffected: number;
  /** 영향 설명 (한국어) */
  impactDescription: string;
}

// ---------------------------------------------------------------------------
// Empty / Error / Unavailable 복사본
// ---------------------------------------------------------------------------

/** 예산 규칙이 없을 때 표시할 문구 */
export const BUDGET_EMPTY_COPY = {
  title: "예산 규칙이 아직 설정되지 않았습니다",
  description:
    "팀, 프로젝트, 카테고리별 예산과 통제 규칙을 설정하면 구매 흐름에 자동으로 적용됩니다",
  actionLabel: "예산 규칙 만들기",
  actionHref: "/dashboard/settings/budget/new",
} as const;

/** 예산 통제 정보를 불러오지 못했을 때 표시할 문구 */
export const BUDGET_ERROR_COPY = {
  title: "예산 통제 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
  actionHref: undefined,
} as const;

/** 권한 부족으로 접근할 수 없을 때 표시할 문구 */
export const BUDGET_UNAVAILABLE_COPY = {
  title: "현재 권한으로 예산 통제 설정에 접근할 수 없습니다",
  description: "관리자 또는 예산 책임자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support",
} as const;

// ---------------------------------------------------------------------------
// 안티패턴 목록
// ---------------------------------------------------------------------------

/** 예산 통제 구현 시 피해야 할 안티패턴 (한국어) */
export const BUDGET_ANTI_PATTERNS: string[] = [
  "예산은 있는데 실제 구매 통제와 연결되지 않음",
  "warning/soft limit/hard stop 구분 없이 단일 임계치만 존재",
  "팀/프로젝트/카테고리 규칙 우선순위가 불명확",
  "예산 초과 위험이 queue/action으로 연결되지 않음",
  "승인 정책과 예산 정책이 독립적으로 작동",
  "규칙 변경이 기존 요청에 미치는 영향 미표시",
  "규칙 충돌/누락이 숨어 있음",
  "집계 기간/방식이 불명확",
];

// ---------------------------------------------------------------------------
// 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 예산 통제 관련 코드 리뷰 시 확인 사항 (한국어) */
export const budgetCodeReviewChecklist: string[] = [
  "예산 규칙이 실제 구매/승인 흐름에 연결되는가",
  "warning/soft limit/hard stop이 분리되어 작동하는가",
  "현재 사용률과 잔여 예산이 함께 보이는가",
  "임계치 초과 시 queue/approval/action으로 이어지는가",
  "팀/프로젝트/카테고리 규칙 우선순위가 명확한가",
  "예외 승인(override) 경로와 감사 추적이 있는가",
  "규칙 변경 시 영향 범위가 설명되는가",
  "규칙 충돌/누락 감지(guardrail)가 있는가",
  "집계 기간과 데이터 freshness가 표시되는가",
  "모바일에서도 health summary + risk + action 흐름이 유지되는가",
];

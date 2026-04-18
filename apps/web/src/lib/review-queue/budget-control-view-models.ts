/**
 * budget-control-view-models.ts
 *
 * 예산 / 통제 규칙 UI용 ViewModel 타입 및 헬퍼.
 * contract 파일의 도메인 타입을 UI 렌더링에 적합한 형태로 변환한다.
 */

import type {
  BudgetRiskItem,
  BudgetRuleDefinition,
  BudgetUsageSnapshot,
  ControlRuleType,
} from "./budget-control-contract";
import { BUDGET_HEALTH_THRESHOLDS } from "./budget-control-contract";

// ---------------------------------------------------------------------------
// 건강 요약 ViewModel
// ---------------------------------------------------------------------------

/** 예산 전체 건강 상태 요약 ViewModel */
export interface BudgetHealthSummaryViewModel {
  /** 전체 규칙 수 */
  totalRulesCount: number;
  /** 활성 규칙 수 */
  activeRulesCount: number;
  /** 예산 초과 규칙 수 */
  overBudgetCount: number;
  /** 임계치 근접 규칙 수 */
  nearLimitCount: number;
  /** 정상 상태 규칙 수 */
  healthyCount: number;
  /** 전체 예산 라벨 (예: "KRW 50,000,000") */
  totalBudgetLabel: string;
  /** 전체 사용 라벨 (예: "KRW 35,000,000") */
  totalUsageLabel: string;
  /** 전체 사용률 (퍼센트) */
  overallUsagePercent: number;
  /** 기간 라벨 (예: "2026년 3월") */
  periodLabel: string;
  /** 집계 데이터 최신성 라벨 (예: "5분 전 갱신") */
  aggregationFreshnessLabel: string;
  /** 가장 중요한 위험 한 줄 요약 */
  primaryRiskLabel?: string;
}

// ---------------------------------------------------------------------------
// 우선순위 위험 ViewModel
// ---------------------------------------------------------------------------

/** 우선순위 위험 항목 ViewModel */
export interface BudgetPriorityRiskViewModel {
  /** 위험 항목 식별자 */
  id: string;
  /** 관련 규칙 식별자 */
  ruleId: string;
  /** 위험 제목 */
  title: string;
  /** 위험 설명 */
  description: string;
  /** 위험 유형 */
  riskType: BudgetRiskItem["riskType"];
  /** 심각도 */
  severity: "critical" | "high" | "medium";
  /** 범위 라벨 (예: "분자생물학팀 · 항체 카테고리") */
  scopeLabel: string;
  /** 사용률 라벨 (예: "92%") */
  usagePercentLabel?: string;
  /** 액션 라벨 */
  actionLabel: string;
  /** 액션 링크 */
  actionHref: string;
}

// ---------------------------------------------------------------------------
// 규칙 카드 ViewModel
// ---------------------------------------------------------------------------

/** 규칙 카드 목록용 ViewModel */
export interface BudgetRuleCardViewModel {
  /** 규칙 식별자 */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 범위 라벨 (예: "팀: 분자생물학팀") */
  scopeLabel: string;
  /** 기간 라벨 (예: "월간 · 2026년 3월") */
  periodLabel: string;
  /** 예산 금액 라벨 (예: "KRW 5,000,000") */
  budgetAmountLabel: string;
  /** 사용 금액 라벨 (예: "KRW 3,500,000") */
  usageAmountLabel: string;
  /** 잔여 금액 라벨 (예: "KRW 1,500,000") */
  remainingLabel: string;
  /** 사용률 (퍼센트) */
  usagePercent: number;
  /** UI 톤 */
  tone: "healthy" | "warning" | "danger" | "exceeded";
  /** 활성 통제 규칙 목록 */
  activeControlRules: { type: ControlRuleType; label: string }[];
  /** 예외 정책 존재 여부 */
  hasException: boolean;
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 규칙 상세 ViewModel
// ---------------------------------------------------------------------------

/** 규칙 상세 페이지용 ViewModel */
export interface BudgetRuleDetailViewModel {
  /** 규칙 식별자 */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 규칙 설명 (한국어) */
  description: string;
  /** 범위 라벨 */
  scopeLabel: string;
  /** 기간 라벨 */
  periodLabel: string;
  /** 예산 금액 라벨 */
  budgetAmountLabel: string;
  /** 사용 금액 라벨 */
  usageAmountLabel: string;
  /** 잔여 금액 라벨 */
  remainingLabel: string;
  /** 사용률 (퍼센트) */
  usagePercent: number;
  /** UI 톤 */
  tone: "healthy" | "warning" | "danger" | "exceeded";
  /** 임계치 라벨 */
  thresholds: {
    /** 경고 임계치 라벨 (예: "70%") */
    warningLabel: string;
    /** 소프트 리밋 라벨 (예: "90%") */
    softLimitLabel: string;
    /** 하드 스톱 라벨 (예: "100%") */
    hardStopLabel: string;
  };
  /** 통제 규칙 목록 (설명 포함) */
  controlRules: {
    type: ControlRuleType;
    label: string;
    description: string;
    impact: string;
    isActive: boolean;
  }[];
  /** 예외 정책 */
  exceptionPolicy?: {
    allowOverride: boolean;
    approverLabel: string;
    maxOverrideLabel: string;
  };
  /** 영향 평가 */
  impactAssessment?: {
    appliesTo: string;
    affectedScopeLabel: string;
    estimatedAffected: string;
  };
  /** 최근 사용 내역 분류 */
  recentUsageBreakdown: {
    label: string;
    amount: string;
    percent: number;
  }[];
  /** 관련 큐/승인 링크 */
  relatedQueues: {
    label: string;
    href: string;
    count?: number;
  }[];
  /** 감사 로그 항목 */
  auditEntries: {
    actor: string;
    action: string;
    timeLabel: string;
  }[];
  /** 데이터 최신성 정보 */
  freshness: {
    /** 마지막 집계 시각 라벨 */
    lastAggregatedLabel: string;
    /** 미배정 비용 라벨 */
    pendingUnallocatedLabel?: string;
    /** 급증 경고 메시지 */
    surgeWarning?: string;
  };
}

// ---------------------------------------------------------------------------
// 페이지 최상위 ViewModel
// ---------------------------------------------------------------------------

/** 예산 통제 페이지 전체 ViewModel */
export interface BudgetPageViewModel {
  /** 헤더 정보 */
  header: {
    title: string;
    purposeDescription: string;
    primaryActionLabel?: string;
    primaryActionHref?: string;
  };
  /** 건강 요약 */
  healthSummary: BudgetHealthSummaryViewModel;
  /** 우선순위 위험 목록 */
  priorityRisks: BudgetPriorityRiskViewModel[];
  /** 규칙 카드 목록 */
  rules: BudgetRuleCardViewModel[];
  /** 선택된 규칙 상세 */
  selectedDetail?: BudgetRuleDetailViewModel;
  /** 페이지 상태 */
  pageState: {
    isEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
    unavailableReason?: string;
  };
}

// ---------------------------------------------------------------------------
// 헬퍼 함수
// ---------------------------------------------------------------------------

/**
 * 사용률에 따른 UI 톤을 결정한다.
 *
 * @param usagePercent - 현재 사용률 (퍼센트)
 * @param thresholds - 임계치 (기본값: BUDGET_HEALTH_THRESHOLDS.usagePercent)
 * @returns "healthy" | "warning" | "danger" | "exceeded"
 */
export function resolveBudgetTone(
  usagePercent: number,
  thresholds: { normal: number; warning: number; danger: number } = BUDGET_HEALTH_THRESHOLDS.usagePercent,
): "healthy" | "warning" | "danger" | "exceeded" {
  if (usagePercent >= 100) return "exceeded";
  if (usagePercent >= thresholds.danger) return "danger";
  if (usagePercent >= thresholds.warning) return "warning";
  return "healthy";
}

/**
 * 규칙 목록에서 범위/카테고리가 겹치면서 임계치가 다른 규칙 충돌을 감지한다.
 *
 * @param rules - 검사할 예산 규칙 목록
 * @returns 충돌 쌍 배열 (ruleA id, ruleB id, 충돌 설명)
 */
export function detectBudgetRuleConflicts(
  rules: BudgetRuleDefinition[],
): { ruleA: string; ruleB: string; conflictDescription: string }[] {
  const conflicts: {
    ruleA: string;
    ruleB: string;
    conflictDescription: string;
  }[] = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];

      // 같은 범위 수준·대상·기간에서 임계치가 다르면 충돌
      const scopeOverlap =
        a.scopeLevel === b.scopeLevel &&
        a.scopeTarget === b.scopeTarget &&
        a.period === b.period;

      if (!scopeOverlap) continue;

      const thresholdsDiffer =
        a.thresholds.warningPercent !== b.thresholds.warningPercent ||
        a.thresholds.softLimitPercent !== b.thresholds.softLimitPercent ||
        a.thresholds.hardStopPercent !== b.thresholds.hardStopPercent;

      if (thresholdsDiffer) {
        conflicts.push({
          ruleA: a.id,
          ruleB: b.id,
          conflictDescription:
            `규칙 "${a.name}"과(와) "${b.name}"이(가) 동일 범위(${a.scopeLevel}: ${a.scopeTarget}, ${a.period})에 ` +
            `서로 다른 임계치를 설정하고 있습니다. 우선순위를 명확히 하거나 규칙을 통합하세요.`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * 예산 사용 스냅샷을 한국어 요약 문자열로 변환한다.
 *
 * @param usage - 예산 사용 스냅샷
 * @returns 예: "KRW 3,500,000 / 5,000,000 (70%) · 잔여 1,500,000"
 */
export function formatBudgetUsageSummary(usage: BudgetUsageSnapshot): string {
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return (
    `KRW ${fmt(usage.currentUsage)} / ${fmt(usage.budgetAmount)} ` +
    `(${usage.usagePercent}%) · 잔여 ${fmt(usage.remainingAmount)}`
  );
}

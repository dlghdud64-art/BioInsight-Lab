/**
 * category-spending-types.ts
 *
 * 카테고리별 지출 통제 — Prisma 비의존 타입 계층.
 * DB adapter와 비즈니스 로직이 이 타입만 참조하도록 한다.
 * Prisma generate 없이도 서비스/검증/집계 로직을 작성/테스트할 수 있다.
 */

// ── SpendingCategory (DB entity shape) ──

export interface SpendingCategoryRecord {
  id: string;
  organizationId: string;
  name: string;
  displayName: string;
  description: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  archivedAt: Date | null;
}

// ── CategoryBudget (DB entity shape) ──

export interface CategoryBudgetRecord {
  id: string;
  organizationId: string;
  categoryId: string;
  yearMonth: string;
  amount: number;
  currency: string;
  warningPercent: number;
  softLimitPercent: number;
  hardStopPercent: number;
  controlRules: string[] | null;
  isActive: boolean;
}

// ── 집계 결과 ──

export type CategoryBudgetStatus =
  | "normal"       // 정상 (warning 미만)
  | "warning"      // 주의 (warning ~ softLimit)
  | "soft_limit"   // 소프트 리밋 초과 (softLimit ~ hardStop)
  | "over_budget"  // 예산 초과 (hardStop 초과)
  | "no_budget";   // 예산 미설정

export interface CategorySpendingItem {
  categoryId: string | null;
  categoryName: string;
  displayName: string;
  color: string;
  icon: string | null;
  /** 이번 달 확정 구매액 (committed spend) */
  committedSpend: number;
  /** 카테고리 예산 한도 (null이면 미설정) */
  budgetAmount: number | null;
  /** 사용률 % (예산 미설정이면 null) */
  usagePercent: number | null;
  /** 전월 대비 변화율 % (전월 0이면 null) */
  momChangePercent: number | null;
  /** 예산 상태 */
  status: CategoryBudgetStatus;
  /** 잔여 예산 */
  remaining: number | null;
  /** 임계치 정보 */
  thresholds: {
    warningPercent: number;
    softLimitPercent: number;
    hardStopPercent: number;
  } | null;
}

export interface CategorySpendingSummary {
  organizationId: string;
  yearMonth: string;
  categories: CategorySpendingItem[];
  /** 전체 카테고리 확정 구매액 합계 */
  totalCommittedSpend: number;
  /** 예산 초과 위험 카테고리 수 */
  overBudgetRiskCount: number;
  /** 미분류 품목 건수 */
  unclassifiedCount: number;
  /** 집계 시각 */
  aggregatedAt: string;
}

// ── 예산 검증 결과 ──

export interface BudgetValidationItem {
  categoryDisplayName: string;
  categoryName: string;
  requestedAmount: number;
  currentCommitted: number;
  projectedCommitted: number;
  budgetAmount: number;
  projectedUsagePercent: number;
  level: "ok" | "warning" | "soft_limit" | "hard_stop";
}

export interface BudgetValidationResult {
  /** 전체 승인 가능 여부 (hard_stop 위반이 하나라도 있으면 false) */
  allowed: boolean;
  blockers: BudgetValidationItem[];
  warnings: BudgetValidationItem[];
  details: BudgetValidationItem[];
}

// ── Repository interface (Prisma 비의존) ──

export interface CategorySpendingRepository {
  /** 조직의 활성 카테고리 + 해당 월 예산 조회 */
  findCategoriesWithBudgets(
    organizationId: string,
    yearMonth: string,
  ): Promise<(SpendingCategoryRecord & { budget: CategoryBudgetRecord | null })[]>;

  /**
   * normalizedCategoryId 기준 월간 확정 구매액 집계.
   * normalizedCategoryId가 null인 레코드 수도 반환.
   */
  aggregateCommittedByCategory(
    organizationId: string,
    yearMonth: string,
  ): Promise<{
    byCategory: Map<string, number>; // categoryId → sum(amount)
    unclassifiedAmount: number;
    unclassifiedCount: number;
  }>;

  /** 전월 동일 구조 집계 (MOM% 계산용) */
  aggregateCommittedByCategoryPrevMonth(
    organizationId: string,
    yearMonth: string,
  ): Promise<Map<string, number>>; // categoryId → sum(amount)
}

// ── Budget Gate (중앙 승인 서비스) interface ──

export interface CategoryBudgetGate {
  /**
   * 구매 승인 전 카테고리 예산 검증.
   * 반드시 승인 커밋과 같은 트랜잭션 안에서 호출해야 한다.
   *
   * @param organizationId 조직
   * @param items 승인 대상 아이템 (normalizedCategoryId + amount)
   * @param yearMonth 대상 월
   */
  validateBeforeApproval(
    organizationId: string,
    items: { normalizedCategoryId: string | null; amount: number }[],
    yearMonth?: string,
  ): Promise<BudgetValidationResult>;
}

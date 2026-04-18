/**
 * category-budget-validator.ts
 *
 * @deprecated 이 파일은 category-budget-gate.ts로 대체되었습니다.
 *
 * 이 파일의 validateCategoryBudget()은 fuzzy 문자열 매핑 기반이며,
 * 트랜잭션 밖에서 검증하므로 race condition에 취약합니다.
 *
 * 새로운 승인 검증은 반드시 category-budget-gate.ts의
 * validateCategoryBudgetInTransaction()을 사용하세요.
 * - normalizedCategoryId 기반 (고정 FK)
 * - 트랜잭션 안에서 검증 (race condition 방지)
 * - 중앙 서비스 한 곳에서만 호출
 */

import { db } from "@/lib/db";
import { suggestCategoryMapping } from "./spending-category-schema";

// ── 타입 ──

export interface BudgetValidationItem {
  /** 카테고리 표시명 */
  categoryDisplayName: string;
  /** 카테고리 내부명 */
  categoryName: string;
  /** 요청 금액 */
  requestedAmount: number;
  /** 현재 지출 */
  currentSpent: number;
  /** 승인 후 예상 지출 */
  projectedSpent: number;
  /** 예산 한도 */
  budgetAmount: number;
  /** 예상 사용률 % */
  projectedUsagePercent: number;
  /** 위반 수준 */
  level: "ok" | "warning" | "soft_limit" | "hard_stop";
}

export interface BudgetValidationResult {
  /** 전체 승인 가능 여부 (hard_stop 위반이 하나라도 있으면 false) */
  allowed: boolean;
  /** 차단 사유 (hard_stop 위반 목록) */
  blockers: BudgetValidationItem[];
  /** 경고 목록 (warning + soft_limit) */
  warnings: BudgetValidationItem[];
  /** 전체 상세 */
  details: BudgetValidationItem[];
}

// ── 아이템에서 카테고리별 금액 추출 ──

interface PurchaseItem {
  category?: string | null;
  productCategory?: string | null;
  amount?: number;
  lineTotal?: number;
  unitPrice?: number;
  quantity?: number;
}

/**
 * 구매 아이템 배열에서 카테고리별 금액을 추출.
 * 카테고리 소스: item.category > item.productCategory > "other"
 */
function extractCategoryAmounts(items: PurchaseItem[]): Map<string, number> {
  const amounts = new Map<string, number>();

  for (const item of items) {
    const rawCategory = item.category || item.productCategory || null;
    const categoryName = suggestCategoryMapping(rawCategory);
    const amount =
      item.amount ??
      item.lineTotal ??
      (item.unitPrice && item.quantity ? item.unitPrice * item.quantity : 0);

    amounts.set(categoryName, (amounts.get(categoryName) ?? 0) + amount);
  }

  return amounts;
}

// ── 메인 검증 함수 ──

/**
 * 구매 요청의 카테고리별 예산을 검증한다.
 *
 * @param organizationId - 조직 ID
 * @param items - 구매 아이템 배열 (category, amount 포함)
 * @param yearMonth - 대상 월 (기본: 이번 달)
 * @returns 검증 결과 (allowed, blockers, warnings, details)
 */
export async function validateCategoryBudget(
  organizationId: string,
  items: PurchaseItem[],
  yearMonth?: string,
): Promise<BudgetValidationResult> {
  const targetYearMonth =
    yearMonth ?? new Date().toISOString().slice(0, 7);

  // 1. 아이템에서 카테고리별 요청 금액 추출
  const categoryAmounts = extractCategoryAmounts(items);

  if (categoryAmounts.size === 0) {
    return { allowed: true, blockers: [], warnings: [], details: [] };
  }

  // 2. 해당 조직의 활성 카테고리 + 예산 조회
  const categories = await db.spendingCategory.findMany({
    where: { organizationId, isActive: true },
    include: {
      budgets: {
        where: { yearMonth: targetYearMonth, isActive: true },
        take: 1,
      },
    },
  });

  // 카테고리 이름 → DB 레코드 맵
  const categoryMap = new Map<string, any>(categories.map((c: any) => [c.name, c]));

  // 3. 이번 달 카테고리별 현재 지출 조회
  const [yearNum, monthNum] = targetYearMonth.split("-").map(Number);
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 1);

  const currentSpending = await db.purchaseRecord.groupBy({
    by: ["category"],
    where: {
      scopeKey: organizationId,
      purchasedAt: { gte: monthStart, lt: monthEnd },
    },
    _sum: { amount: true },
  });

  // raw category → SpendingCategory.name 매핑 + 합산
  const currentByCategory = new Map<string, number>();
  for (const row of currentSpending) {
    const name = suggestCategoryMapping(row.category);
    currentByCategory.set(name, (currentByCategory.get(name) ?? 0) + (row._sum.amount ?? 0));
  }

  // 4. 각 카테고리 검증
  const details: BudgetValidationItem[] = [];
  const blockers: BudgetValidationItem[] = [];
  const warnings: BudgetValidationItem[] = [];

  for (const [categoryName, requestedAmount] of categoryAmounts.entries()) {
    const cat = categoryMap.get(categoryName);

    // 카테고리 또는 예산 미설정 → 통과 (opt-in)
    if (!cat || !cat.budgets[0]) continue;

    const budget = cat.budgets[0];
    const currentSpent = currentByCategory.get(categoryName) ?? 0;
    const projectedSpent = currentSpent + requestedAmount;
    const projectedUsagePercent =
      budget.amount > 0
        ? Math.round((projectedSpent / budget.amount) * 100 * 10) / 10
        : 0;

    let level: BudgetValidationItem["level"] = "ok";
    if (projectedUsagePercent >= budget.hardStopPercent) {
      level = "hard_stop";
    } else if (projectedUsagePercent >= budget.softLimitPercent) {
      level = "soft_limit";
    } else if (projectedUsagePercent >= budget.warningPercent) {
      level = "warning";
    }

    const item: BudgetValidationItem = {
      categoryDisplayName: cat.displayName,
      categoryName,
      requestedAmount,
      currentSpent,
      projectedSpent,
      budgetAmount: budget.amount,
      projectedUsagePercent,
      level,
    };

    details.push(item);

    if (level === "hard_stop") {
      blockers.push(item);
    } else if (level === "soft_limit" || level === "warning") {
      warnings.push(item);
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    details,
  };
}

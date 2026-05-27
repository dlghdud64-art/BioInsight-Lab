/**
 * category-spending-engine.ts
 *
 * 카테고리별 지출 집계 엔진.
 *
 * ⚠️ 핵심 원칙:
 * - 집계는 반드시 `normalizedCategoryId` (고정 FK) 기반으로 수행.
 * - fuzzy 문자열 매핑은 backfill/proposal only. 집계 truth에 사용 금지.
 * - "미분류"(normalizedCategoryId = null)는 운영 보정 대상으로 노출.
 * - 라벨은 "확정 구매액"(committed spend). 회계상 "지출"과 구분.
 */

import { db } from "@/lib/db";
import type {
  CategoryBudgetStatus,
  CategorySpendingItem,
  CategorySpendingSummary,
  CategorySpendingRepository,
} from "./category-spending-types";

// ── Prisma 기반 Repository 구현 ──

export const prismaCategorySpendingRepository: CategorySpendingRepository = {
  async findCategoriesWithBudgets(organizationId, yearMonth) {
    const categories = await db.spendingCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        budgets: {
          where: { yearMonth, isActive: true },
          take: 1,
        },
      },
    });

    return categories.map((cat: any) => ({
      id: cat.id,
      organizationId: cat.organizationId,
      name: cat.name,
      displayName: cat.displayName,
      description: cat.description,
      color: cat.color,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      isDefault: cat.isDefault,
      archivedAt: cat.archivedAt,
      budget: cat.budgets[0]
        ? {
            id: cat.budgets[0].id,
            organizationId: cat.budgets[0].organizationId,
            categoryId: cat.budgets[0].categoryId,
            yearMonth: cat.budgets[0].yearMonth,
            amount: cat.budgets[0].amount,
            currency: cat.budgets[0].currency,
            warningPercent: cat.budgets[0].warningPercent,
            softLimitPercent: cat.budgets[0].softLimitPercent,
            hardStopPercent: cat.budgets[0].hardStopPercent,
            controlRules: cat.budgets[0].controlRules,
            isActive: cat.budgets[0].isActive,
          }
        : null,
    }));
  },

  async aggregateCommittedByCategory(organizationId, yearMonth) {
    const [year, month] = yearMonth.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // normalizedCategoryId 기준 GROUP BY (canonical truth)
    const rows = await db.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: {
        scopeKey: organizationId,
        purchasedAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
      _count: true,
    });

    const byCategory = new Map<string, number>();
    let unclassifiedAmount = 0;
    let unclassifiedCount = 0;

    for (const row of rows as any[]) {
      if (row.normalizedCategoryId) {
        byCategory.set(
          row.normalizedCategoryId,
          (byCategory.get(row.normalizedCategoryId) ?? 0) + (row._sum.amount ?? 0),
        );
      } else {
        unclassifiedAmount += row._sum.amount ?? 0;
        unclassifiedCount += row._count ?? 0;
      }
    }

    return { byCategory, unclassifiedAmount, unclassifiedCount };
  },

  async aggregateCommittedByCategoryPrevMonth(organizationId, yearMonth) {
    const [year, month] = yearMonth.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = new Date(prevYear, prevMonth - 1, 1);
    const prevEnd = new Date(prevYear, prevMonth, 1);

    const rows = await db.purchaseRecord.groupBy({
      by: ["normalizedCategoryId"],
      where: {
        scopeKey: organizationId,
        purchasedAt: { gte: prevStart, lt: prevEnd },
      },
      _sum: { amount: true },
    });

    const result = new Map<string, number>();
    for (const row of rows as any[]) {
      if (row.normalizedCategoryId) {
        result.set(
          row.normalizedCategoryId,
          (result.get(row.normalizedCategoryId) ?? 0) + (row._sum.amount ?? 0),
        );
      }
    }
    return result;
  },
};

// ── 순수 비즈니스 로직 (Repository 주입) ──

/**
 * 사용률과 예산 임계치로 상태를 판정.
 */
export function evaluateStatus(
  usagePercent: number | null,
  budget: {
    warningPercent: number;
    softLimitPercent: number;
    hardStopPercent: number;
  } | null,
): CategoryBudgetStatus {
  if (!budget || usagePercent === null) return "no_budget";

  if (usagePercent >= budget.hardStopPercent) return "over_budget";
  if (usagePercent >= budget.softLimitPercent) return "soft_limit";
  if (usagePercent >= budget.warningPercent) return "warning";
  return "normal";
}

/**
 * 카테고리별 월간 확정 구매액 현황 집계.
 *
 * normalizedCategoryId 기준으로 집계하므로,
 * 과거 레코드의 카테고리가 변경되어도 숫자가 흔들리지 않는다.
 */
export async function aggregateCategorySpending(
  organizationId: string,
  yearMonth: string,
  repo: CategorySpendingRepository = prismaCategorySpendingRepository,
): Promise<CategorySpendingSummary> {
  // 1. 카테고리 + 예산 한도
  const categoriesWithBudgets = await repo.findCategoriesWithBudgets(
    organizationId,
    yearMonth,
  );

  // 2. 이번 달 + 전월 normalizedCategoryId 기준 집계
  const current = await repo.aggregateCommittedByCategory(
    organizationId,
    yearMonth,
  );
  const prev = await repo.aggregateCommittedByCategoryPrevMonth(
    organizationId,
    yearMonth,
  );

  // 3. 각 카테고리별 결과 계산
  const items: CategorySpendingItem[] = categoriesWithBudgets.map((cat) => {
    const committed = current.byCategory.get(cat.id) ?? 0;
    const prevCommitted = prev.get(cat.id) ?? 0;
    const budget = cat.budget;

    const usagePercent =
      budget && budget.amount > 0
        ? Math.round((committed / budget.amount) * 100 * 10) / 10
        : null;

    const momChangePercent =
      prevCommitted > 0
        ? Math.round(((committed - prevCommitted) / prevCommitted) * 100 * 10) / 10
        : null;

    const status = evaluateStatus(usagePercent, budget);
    const remaining = budget ? Math.max(budget.amount - committed, 0) : null;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      displayName: cat.displayName,
      color: cat.color,
      icon: cat.icon,
      committedSpend: committed,
      budgetAmount: budget?.amount ?? null,
      usagePercent,
      momChangePercent,
      status,
      remaining,
      thresholds: budget
        ? {
            warningPercent: budget.warningPercent,
            softLimitPercent: budget.softLimitPercent,
            hardStopPercent: budget.hardStopPercent,
          }
        : null,
    };
  });

  // 4. 미분류 (normalizedCategoryId = null) 항목
  if (current.unclassifiedAmount > 0 || current.unclassifiedCount > 0) {
    items.push({
      categoryId: null,
      categoryName: "unclassified",
      displayName: "미분류",
      color: "#94a3b8", // slate-400
      icon: "HelpCircle",
      committedSpend: current.unclassifiedAmount,
      budgetAmount: null,
      usagePercent: null,
      momChangePercent: null,
      status: "no_budget",
      remaining: null,
      thresholds: null,
    });
  }

  const totalCommittedSpend = items.reduce(
    (sum, item) => sum + item.committedSpend,
    0,
  );
  const overBudgetRiskCount = items.filter(
    (item) => item.status === "over_budget" || item.status === "soft_limit",
  ).length;

  return {
    organizationId,
    yearMonth,
    categories: items,
    totalCommittedSpend,
    overBudgetRiskCount,
    unclassifiedCount: current.unclassifiedCount,
    aggregatedAt: new Date().toISOString(),
  };
}

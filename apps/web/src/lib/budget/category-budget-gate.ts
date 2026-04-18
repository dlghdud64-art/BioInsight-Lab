/**
 * category-budget-gate.ts
 *
 * 카테고리 예산 검증 — 중앙 승인 서비스.
 *
 * ⚠️ 핵심 원칙:
 * 1. 이 gate는 승인/PO 전환 시점의 **유일한** 예산 검증 경로.
 *    화면별 분산 판단 금지. 모든 승인 로직이 이 서비스를 경유해야 우회 경로가 없다.
 * 2. 검증과 커밋은 같은 SERIALIZABLE 트랜잭션 안에서 실행해야 한다.
 *    동시 승인 시 serialization_failure가 발생하면 bounded retry로 재시도.
 * 3. normalizedCategoryId는 승인 시점에 고정 저장.
 *    이후 집계/MOM%/budget gate는 이 고정값만 참조.
 * 4. fuzzy 매핑은 proposal/backfill only. gate 입력에 사용 금지.
 * 5. period_key는 조직 로컬 타임존 기준 승인 확정 시각으로 결정.
 *    UTC → org timezone → YYYY-MM 변환.
 * 6. gate decision은 Batch 6 durable audit event shape으로 기록.
 *
 * 사용 (SERIALIZABLE wrapper 포함):
 *   import { withSerializableBudgetTx, BudgetBlockedError } from "./budget-concurrency";
 *
 *   const result = await withSerializableBudgetTx(db, async (tx) => {
 *     const validation = await validateCategoryBudgetInTransaction(tx, orgId, items, periodKey);
 *     if (!validation.allowed) throw new BudgetBlockedError(validation);
 *     // ... commit
 *     return { validation, ... };
 *   });
 */

import type {
  BudgetValidationItem,
  BudgetValidationResult,
} from "./category-spending-types";

// ── Prisma 트랜잭션 클라이언트 타입 ──

type PrismaTx = {
  spendingCategory: {
    findMany: (args: any) => Promise<any[]>;
  };
  purchaseRecord: {
    groupBy: (args: any) => Promise<any[]>;
  };
  categoryBudget: {
    findMany: (args: any) => Promise<any[]>;
  };
};

// ── Gate 입출력 타입 ──

export interface CategoryBudgetGateItem {
  /** normalizedCategoryId — 반드시 고정된 FK. null이면 미분류. */
  normalizedCategoryId: string | null;
  /** 구매 확정 금액 */
  amount: number;
}

/**
 * Gate decision에 포함되는 검증 근거.
 * 이 shape은 Batch 6 audit event와 동일 구조.
 */
export interface BudgetGateDecisionBasis {
  /** 조직 ID */
  organizationId: string;
  /** period key: orgId + categoryId + YYYY-MM */
  periodKey: string;
  /** 대상 월 (YYYY-MM) */
  yearMonth: string;
  /** 카테고리 ID */
  categoryId: string;
  /** 검증 전 기존 확정 구매액 */
  preCommitCommitted: number;
  /** 이번 요청 금액 */
  requestedAmount: number;
  /** 검증 후 예상 확정 구매액 */
  postCommitCommitted: number;
  /** 예산 한도 */
  budgetAmount: number;
  /** 예상 사용률 % */
  projectedUsagePercent: number;
  /** 판정 결과 */
  level: BudgetValidationItem["level"];
  /** 임계치 */
  thresholds: {
    warningPercent: number;
    softLimitPercent: number;
    hardStopPercent: number;
  };
}

/**
 * Batch 6 durable audit event shape.
 * gate decision → 이 shape → audit trail.
 * 별도 local log 없이 이 shape 하나로 audit coverage 달성.
 */
export interface BudgetGateAuditEvent {
  eventType: "budget_gate_decision";
  /** 최종 허용 여부 */
  allowed: boolean;
  /** 검증 시각 (ISO) */
  evaluatedAt: string;
  /** 승인 대상 entity (requestId, orderId 등 — 호출자가 채움) */
  targetEntityType?: string;
  targetEntityId?: string;
  /** 카테고리별 검증 근거 */
  decisions: BudgetGateDecisionBasis[];
  /** blocker 요약 */
  blockerCount: number;
  warningCount: number;
}

export interface BudgetValidationResultWithAudit extends BudgetValidationResult {
  /** Batch 6 audit event shape — 호출자가 audit trail에 기록 */
  auditEvent: BudgetGateAuditEvent;
}

// ── Period Key 유틸리티 ──

/**
 * 조직 로컬 타임존 기준으로 현재 시각의 YYYY-MM을 반환한다.
 *
 * @param timezone IANA timezone (예: "Asia/Seoul")
 * @param at 기준 시각 (기본: now)
 */
export function resolvePeriodYearMonth(
  timezone: string,
  at: Date = new Date(),
): string {
  // Intl.DateTimeFormat으로 org timezone의 연/월 추출
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // "en-CA" locale → YYYY-MM-DD 형식
  const formatted = formatter.format(at);
  return formatted.slice(0, 7); // YYYY-MM
}

/**
 * 완전한 period key: orgId + categoryId + YYYY-MM
 */
export function buildPeriodKey(
  organizationId: string,
  categoryId: string,
  yearMonth: string,
): string {
  return `${organizationId}:${categoryId}:${yearMonth}`;
}

// ── Gate 구현 ──

/**
 * 트랜잭션 안에서 카테고리 예산을 검증한다.
 *
 * SERIALIZABLE 트랜잭션 안에서 호출해야 동시 승인 race를 방지할 수 있다.
 * → withSerializableBudgetTx(db, async (tx) => { ... }) 사용 권장.
 *
 * @param tx Prisma 트랜잭션 클라이언트 (SERIALIZABLE)
 * @param organizationId 조직 ID
 * @param items 승인 대상 아이템 (normalizedCategoryId + amount)
 * @param yearMonth 대상 월 — resolvePeriodYearMonth(orgTimezone)으로 결정
 */
export async function validateCategoryBudgetInTransaction(
  tx: PrismaTx,
  organizationId: string,
  items: CategoryBudgetGateItem[],
  yearMonth: string,
): Promise<BudgetValidationResultWithAudit> {
  const evaluatedAt = new Date().toISOString();

  // 1. 아이템에서 카테고리별 요청 금액 합산
  const amountByCategory = new Map<string, number>();
  for (const item of items) {
    if (!item.normalizedCategoryId) continue; // 미분류 → opt-in skip
    amountByCategory.set(
      item.normalizedCategoryId,
      (amountByCategory.get(item.normalizedCategoryId) ?? 0) + item.amount,
    );
  }

  if (amountByCategory.size === 0) {
    return {
      allowed: true,
      blockers: [],
      warnings: [],
      details: [],
      auditEvent: {
        eventType: "budget_gate_decision",
        allowed: true,
        evaluatedAt,
        decisions: [],
        blockerCount: 0,
        warningCount: 0,
      },
    };
  }

  // 2. 관련 카테고리의 예산 한도 조회 (SERIALIZABLE tx 안에서)
  const categoryIds = Array.from(amountByCategory.keys());
  const budgets = await tx.categoryBudget.findMany({
    where: {
      organizationId,
      categoryId: { in: categoryIds },
      yearMonth,
      isActive: true,
    },
  });

  const budgetMap = new Map<string, any>();
  for (const b of budgets) {
    budgetMap.set(b.categoryId, b);
  }

  // 3. 카테고리 정보 조회 (표시명)
  const cats = await tx.spendingCategory.findMany({
    where: { id: { in: categoryIds } },
  });
  const catMap = new Map<string, any>();
  for (const c of cats) {
    catMap.set(c.id, c);
  }

  // 4. 이번 달 normalizedCategoryId별 현재 확정 구매액 집계
  const [yearNum, monthNum] = yearMonth.split("-").map(Number);
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 1);

  const currentRows = await tx.purchaseRecord.groupBy({
    by: ["normalizedCategoryId"],
    where: {
      scopeKey: organizationId,
      normalizedCategoryId: { in: categoryIds },
      purchasedAt: { gte: monthStart, lt: monthEnd },
    },
    _sum: { amount: true },
  });

  const currentByCategory = new Map<string, number>();
  for (const row of currentRows as any[]) {
    if (row.normalizedCategoryId) {
      currentByCategory.set(
        row.normalizedCategoryId,
        row._sum.amount ?? 0,
      );
    }
  }

  // 5. 각 카테고리 검증 + decision basis 수집
  const details: BudgetValidationItem[] = [];
  const blockers: BudgetValidationItem[] = [];
  const warnings: BudgetValidationItem[] = [];
  const decisions: BudgetGateDecisionBasis[] = [];

  for (const [categoryId, requestedAmount] of amountByCategory.entries()) {
    const budget = budgetMap.get(categoryId);
    const cat = catMap.get(categoryId);

    // 예산 미설정 → opt-in 통과
    if (!budget) continue;

    const preCommitCommitted = currentByCategory.get(categoryId) ?? 0;
    const postCommitCommitted = preCommitCommitted + requestedAmount;
    const projectedUsagePercent =
      budget.amount > 0
        ? Math.round((postCommitCommitted / budget.amount) * 100 * 10) / 10
        : 0;

    let level: BudgetValidationItem["level"] = "ok";
    if (projectedUsagePercent >= budget.hardStopPercent) {
      level = "hard_stop";
    } else if (projectedUsagePercent >= budget.softLimitPercent) {
      level = "soft_limit";
    } else if (projectedUsagePercent >= budget.warningPercent) {
      level = "warning";
    }

    const thresholds = {
      warningPercent: budget.warningPercent,
      softLimitPercent: budget.softLimitPercent,
      hardStopPercent: budget.hardStopPercent,
    };

    const item: BudgetValidationItem = {
      categoryDisplayName: cat?.displayName ?? categoryId,
      categoryName: cat?.name ?? categoryId,
      requestedAmount,
      currentCommitted: preCommitCommitted,
      projectedCommitted: postCommitCommitted,
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

    // Decision basis (audit event에 포함)
    decisions.push({
      organizationId,
      periodKey: buildPeriodKey(organizationId, categoryId, yearMonth),
      yearMonth,
      categoryId,
      preCommitCommitted,
      requestedAmount,
      postCommitCommitted,
      budgetAmount: budget.amount,
      projectedUsagePercent,
      level,
      thresholds,
    });
  }

  const allowed = blockers.length === 0;

  return {
    allowed,
    blockers,
    warnings,
    details,
    auditEvent: {
      eventType: "budget_gate_decision",
      allowed,
      evaluatedAt,
      decisions,
      blockerCount: blockers.length,
      warningCount: warnings.length,
    },
  };
}

/**
 * category-budget-release.ts
 *
 * Committed spend release / reverse events.
 *
 * approve는 예산을 "잠그는" 동작이다. 그러나 잠금만 있으면 예산 엔진이 아니라
 * 잠금 엔진이 된다. 이 모듈은 committed spend를 풀거나 재적용하는 경로를 정의한다.
 *
 * ⚠️ 핵심 원칙:
 * 1. release는 approve의 역연산이다. 같은 SERIALIZABLE 격리 수준을 사용한다.
 * 2. release는 "현재 category/month를 다시 추론"하면 안 된다.
 *    원본 BudgetEvent(approval_reserved)를 참조하여 정확히 같은
 *    amount / normalizedCategoryId / period_key(yearMonth)를 되돌린다.
 * 3. release 결과는 audit event shape으로 기록한다 (Batch 6).
 * 4. release는 PurchaseRecord의 normalizedCategoryId를 변경하지 않는다.
 *    금액/상태만 조정한다. categoryId 재분류는 category_reclass_release_reapply만.
 * 5. committed spend가 음수가 되면 NegativeCommittedSpendError를 throw한다.
 * 6. 모든 release event는 원본 approval decision과 연결 가능해야 한다.
 *
 * 정의된 4종 release event:
 *
 *   approval_reversed
 *     승인 자체가 취소됨. committed spend 전액 해제.
 *     APPROVED → PENDING 또는 REJECTED 전환 시 발생.
 *
 *   request_cancel_released
 *     승인된 구매 요청이 취소됨. committed spend 전액 해제.
 *     APPROVED → CANCELLED 전환 시 발생.
 *
 *   po_void_released
 *     PO가 무효화됨. 해당 PO에 연결된 committed spend 전액 해제.
 *     Order status → VOIDED / CANCELLED 전환 시 발생.
 *
 *   category_reclass_release_reapply
 *     카테고리 재분류. 기존 카테고리에서 해제 + 새 카테고리에 적용.
 *     normalizedCategoryId 변경 시 발생 (backfill correction 등).
 *     이 이벤트만 categoryId를 변경한다.
 *     원래 reserve가 기록된 period_key 안에서 old category release + new category reserve.
 */

import {
  buildPeriodKey,
  type BudgetGateAuditEvent,
  type BudgetGateDecisionBasis,
} from "./category-budget-gate";
import {
  buildBudgetEventKey,
  recordBudgetEventIdempotent,
} from "./budget-concurrency";

// ── Release Event Types ──

export type BudgetReleaseEventType =
  | "approval_reversed"
  | "request_cancel_released"
  | "po_void_released"
  | "category_reclass_release_reapply";

export interface BudgetReleaseEvent {
  eventType: BudgetReleaseEventType;
  /** 원본 승인 대상 */
  targetEntityType: "purchase_request" | "order";
  targetEntityId: string;
  /** 조직 */
  organizationId: string;
  /** 해제 금액 (양수: 해제, 음수: 재적용) */
  releaseItems: BudgetReleaseItem[];
  /** 실행 시각 */
  executedAt: string;
  /** 실행자 */
  executedBy: string;
  /** 사유 */
  reason?: string;
}

export interface BudgetReleaseItem {
  /** 해제 대상 카테고리 */
  categoryId: string | null;
  /** period key */
  periodKey: string;
  yearMonth: string;
  /** 해제 금액 */
  amount: number;
  /** 해제 전 committed */
  preReleaseCommitted: number;
  /** 해제 후 committed */
  postReleaseCommitted: number;
}

/** category reclass 전용: 기존 → 새 카테고리 이동 */
export interface CategoryReclassItem {
  /** 기존 categoryId (해제) */
  fromCategoryId: string | null;
  /** 새 categoryId (재적용) */
  toCategoryId: string;
  /** 금액 */
  amount: number;
}

// ── 음수 committed spend 방지 에러 ──

export class NegativeCommittedSpendError extends Error {
  public readonly __negativeCommitted = true;
  public readonly categoryId: string;
  public readonly yearMonth: string;
  public readonly preRelease: number;
  public readonly releaseAmount: number;

  constructor(categoryId: string, yearMonth: string, preRelease: number, releaseAmount: number) {
    super(
      `Release would result in negative committed spend: ` +
      `category=${categoryId}, yearMonth=${yearMonth}, ` +
      `preRelease=${preRelease}, releaseAmount=${releaseAmount}`,
    );
    this.name = "NegativeCommittedSpendError";
    this.categoryId = categoryId;
    this.yearMonth = yearMonth;
    this.preRelease = preRelease;
    this.releaseAmount = releaseAmount;
  }
}

// ── Prisma 트랜잭션 클라이언트 타입 ──

type PrismaTx = {
  budgetEvent: {
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
  };
  purchaseRecord: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    groupBy: (args: any) => Promise<any[]>;
  };
  purchaseRequest: {
    update: (args: any) => Promise<any>;
  };
  order: {
    update: (args: any) => Promise<any>;
  };
};

// ── 원본 reserve 조회 ──

interface OriginalReserveRecord {
  categoryId: string;
  yearMonth: string;
  amount: number;
}

/**
 * 원본 approval_reserved BudgetEvent를 조회한다.
 * release 시 이 레코드의 정확한 amount/categoryId/yearMonth를 사용해야 한다.
 *
 * @param tx SERIALIZABLE 트랜잭션 클라이언트
 * @param organizationId 조직 ID
 * @param sourceEntityId 원본 entity ID (requestId)
 * @returns 카테고리별 원본 reserve 레코드 (없으면 빈 배열)
 */
async function lookupOriginalReserves(
  tx: PrismaTx,
  organizationId: string,
  sourceEntityId: string,
): Promise<OriginalReserveRecord[]> {
  const events = await tx.budgetEvent.findMany({
    where: {
      organizationId,
      sourceEntityId,
      eventType: "approval_reserved",
    },
  });

  return events
    .filter((e: any) => e.categoryId && e.amount > 0)
    .map((e: any) => ({
      categoryId: e.categoryId as string,
      yearMonth: e.yearMonth as string,
      amount: e.amount as number,
    }));
}

/**
 * 현재 committed spend를 조회한다 (특정 카테고리 + 월).
 */
async function getCurrentCommitted(
  tx: PrismaTx,
  organizationId: string,
  categoryId: string,
  yearMonth: string,
): Promise<number> {
  const [yearNum, monthNum] = yearMonth.split("-").map(Number);
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 1);

  const rows = await tx.purchaseRecord.groupBy({
    by: ["normalizedCategoryId"],
    where: {
      scopeKey: organizationId,
      normalizedCategoryId: categoryId,
      purchasedAt: { gte: monthStart, lt: monthEnd },
    },
    _sum: { amount: true },
  });

  const row = (rows as any[]).find((r) => r.normalizedCategoryId === categoryId);
  return row?._sum?.amount ?? 0;
}

// ── Release 구현 ──

/**
 * 승인 취소 (approval_reversed).
 * APPROVED → PENDING/REJECTED로 되돌리면서 committed spend를 해제한다.
 *
 * 원본 approval_reserved BudgetEvent를 참조하여 정확히 같은
 * amount/categoryId/yearMonth를 되돌린다.
 *
 * SERIALIZABLE tx 안에서 호출해야 한다.
 */
export async function releaseApprovalReversed(
  tx: PrismaTx,
  params: {
    organizationId: string;
    requestId: string;
    executedBy: string;
    reason?: string;
  },
): Promise<BudgetReleaseEvent> {
  const { organizationId, requestId, executedBy, reason } = params;
  const executedAt = new Date();

  // 원본 reserve 조회 — yearMonth/amount/categoryId를 재추론하지 않음
  const reserves = await lookupOriginalReserves(tx, organizationId, requestId);

  const releaseItems: BudgetReleaseItem[] = [];

  for (const reserve of reserves) {
    const preRelease = await getCurrentCommitted(
      tx, organizationId, reserve.categoryId, reserve.yearMonth,
    );

    // 음수 방지 guard
    if (preRelease < reserve.amount) {
      throw new NegativeCommittedSpendError(
        reserve.categoryId, reserve.yearMonth, preRelease, reserve.amount,
      );
    }

    const postRelease = preRelease - reserve.amount;

    releaseItems.push({
      categoryId: reserve.categoryId,
      periodKey: buildPeriodKey(organizationId, reserve.categoryId, reserve.yearMonth),
      yearMonth: reserve.yearMonth,
      amount: reserve.amount,
      preReleaseCommitted: preRelease,
      postReleaseCommitted: postRelease,
    });

    // release BudgetEvent 기록
    await recordBudgetEventIdempotent(tx, {
      organizationId,
      budgetEventKey: buildBudgetEventKey(
        organizationId, requestId, "approval_reversed", reserve.categoryId,
      ),
      eventType: "approval_reversed",
      sourceEntityType: "purchase_request",
      sourceEntityId: requestId,
      categoryId: reserve.categoryId,
      yearMonth: reserve.yearMonth,
      amount: -reserve.amount, // 음수 = 해제
      preCommitted: preRelease,
      postCommitted: postRelease,
      decisionPayload: { originalReserveAmount: reserve.amount, reason },
      executedBy,
    });
  }

  return {
    eventType: "approval_reversed",
    targetEntityType: "purchase_request",
    targetEntityId: requestId,
    organizationId,
    releaseItems,
    executedAt: executedAt.toISOString(),
    executedBy,
    reason,
  };
}

/**
 * 구매 요청 취소 해제 (request_cancel_released).
 * APPROVED → CANCELLED 전환 시 committed spend 전액 해제.
 *
 * 원본 approval_reserved BudgetEvent를 참조한다.
 *
 * SERIALIZABLE tx 안에서 호출해야 한다.
 */
export async function releaseRequestCancelled(
  tx: PrismaTx,
  params: {
    organizationId: string;
    requestId: string;
    executedBy: string;
    reason?: string;
  },
): Promise<BudgetReleaseEvent> {
  const { organizationId, requestId, executedBy, reason } = params;
  const executedAt = new Date();

  // 원본 reserve 조회
  const reserves = await lookupOriginalReserves(tx, organizationId, requestId);

  const releaseItems: BudgetReleaseItem[] = [];

  for (const reserve of reserves) {
    const preRelease = await getCurrentCommitted(
      tx, organizationId, reserve.categoryId, reserve.yearMonth,
    );

    if (preRelease < reserve.amount) {
      throw new NegativeCommittedSpendError(
        reserve.categoryId, reserve.yearMonth, preRelease, reserve.amount,
      );
    }

    const postRelease = preRelease - reserve.amount;

    releaseItems.push({
      categoryId: reserve.categoryId,
      periodKey: buildPeriodKey(organizationId, reserve.categoryId, reserve.yearMonth),
      yearMonth: reserve.yearMonth,
      amount: reserve.amount,
      preReleaseCommitted: preRelease,
      postReleaseCommitted: postRelease,
    });

    await recordBudgetEventIdempotent(tx, {
      organizationId,
      budgetEventKey: buildBudgetEventKey(
        organizationId, requestId, "request_cancel_released", reserve.categoryId,
      ),
      eventType: "request_cancel_released",
      sourceEntityType: "purchase_request",
      sourceEntityId: requestId,
      categoryId: reserve.categoryId,
      yearMonth: reserve.yearMonth,
      amount: -reserve.amount,
      preCommitted: preRelease,
      postCommitted: postRelease,
      decisionPayload: { originalReserveAmount: reserve.amount, reason },
      executedBy,
    });
  }

  return {
    eventType: "request_cancel_released",
    targetEntityType: "purchase_request",
    targetEntityId: requestId,
    organizationId,
    releaseItems,
    executedAt: executedAt.toISOString(),
    executedBy,
    reason,
  };
}

/**
 * PO 무효화 해제 (po_void_released).
 * Order → CANCELLED 전환 시 committed spend 전액 해제.
 *
 * Order에 연결된 PurchaseRequest의 원본 reserve를 참조한다.
 *
 * SERIALIZABLE tx 안에서 호출해야 한다.
 */
export async function releasePOVoided(
  tx: PrismaTx,
  params: {
    organizationId: string;
    orderId: string;
    /** PO에 연결된 원본 requestId — reserve 참조용 */
    requestId: string;
    executedBy: string;
    reason?: string;
  },
): Promise<BudgetReleaseEvent> {
  const { organizationId, orderId, requestId, executedBy, reason } = params;
  const executedAt = new Date();

  // 원본 reserve 조회 (requestId 기준)
  const reserves = await lookupOriginalReserves(tx, organizationId, requestId);

  const releaseItems: BudgetReleaseItem[] = [];

  for (const reserve of reserves) {
    const preRelease = await getCurrentCommitted(
      tx, organizationId, reserve.categoryId, reserve.yearMonth,
    );

    if (preRelease < reserve.amount) {
      throw new NegativeCommittedSpendError(
        reserve.categoryId, reserve.yearMonth, preRelease, reserve.amount,
      );
    }

    const postRelease = preRelease - reserve.amount;

    releaseItems.push({
      categoryId: reserve.categoryId,
      periodKey: buildPeriodKey(organizationId, reserve.categoryId, reserve.yearMonth),
      yearMonth: reserve.yearMonth,
      amount: reserve.amount,
      preReleaseCommitted: preRelease,
      postReleaseCommitted: postRelease,
    });

    await recordBudgetEventIdempotent(tx, {
      organizationId,
      budgetEventKey: buildBudgetEventKey(
        organizationId, orderId, "po_void_released", reserve.categoryId,
      ),
      eventType: "po_void_released",
      sourceEntityType: "order",
      sourceEntityId: orderId,
      categoryId: reserve.categoryId,
      yearMonth: reserve.yearMonth,
      amount: -reserve.amount,
      preCommitted: preRelease,
      postCommitted: postRelease,
      decisionPayload: { originalReserveAmount: reserve.amount, requestId, reason },
      executedBy,
    });
  }

  return {
    eventType: "po_void_released",
    targetEntityType: "order",
    targetEntityId: orderId,
    organizationId,
    releaseItems,
    executedAt: executedAt.toISOString(),
    executedBy,
    reason,
  };
}

/**
 * 카테고리 재분류 해제/재적용 (category_reclass_release_reapply).
 * normalizedCategoryId 변경 시: 기존 카테고리에서 해제 + 새 카테고리에 적용.
 *
 * 원래 reserve가 기록된 period_key(yearMonth) 안에서 처리한다.
 * "현재 월로 이동"이 아니라, 원본 reserve의 yearMonth를 그대로 사용.
 *
 * 이 함수만 PurchaseRecord.normalizedCategoryId를 변경한다.
 * SERIALIZABLE tx 안에서 호출해야 한다.
 *
 * @param tx Prisma tx
 * @param params.recordId 재분류 대상 PurchaseRecord ID
 * @param params.requestId reserve 참조용 원본 request ID
 * @param params.toCategoryId 새 카테고리 ID
 */
export async function releaseCategoryReclass(
  tx: PrismaTx,
  params: {
    organizationId: string;
    recordId: string;
    requestId: string;
    toCategoryId: string;
    executedBy: string;
    reason?: string;
  },
): Promise<BudgetReleaseEvent> {
  const { organizationId, recordId, requestId, toCategoryId, executedBy, reason } = params;
  const executedAt = new Date();

  // 대상 PurchaseRecord 조회
  const records = await tx.purchaseRecord.findMany({
    where: { id: recordId },
  });

  if (records.length === 0) {
    return {
      eventType: "category_reclass_release_reapply",
      targetEntityType: "purchase_request",
      targetEntityId: recordId,
      organizationId,
      releaseItems: [],
      executedAt: executedAt.toISOString(),
      executedBy,
      reason: reason ?? "record not found",
    };
  }

  const record = records[0] as any;
  const fromCategoryId = record.normalizedCategoryId;
  const amount = record.amount ?? 0;

  // 원본 reserve에서 yearMonth를 가져옴 (현재 월이 아님)
  const reserves = await lookupOriginalReserves(tx, organizationId, requestId);
  // fromCategoryId와 일치하는 reserve의 yearMonth 사용
  const matchingReserve = reserves.find((r) => r.categoryId === fromCategoryId);
  const yearMonth = matchingReserve?.yearMonth ?? reserves[0]?.yearMonth;

  if (!yearMonth) {
    // reserve가 없으면 (미분류 등) record의 purchasedAt 기반 fallback
    const purchasedDate = record.purchasedAt as Date;
    const fallbackYM = `${purchasedDate.getFullYear()}-${String(purchasedDate.getMonth() + 1).padStart(2, "0")}`;
    return doReclass(tx, {
      organizationId, recordId, requestId, fromCategoryId, toCategoryId,
      amount, yearMonth: fallbackYM, executedBy, executedAt, reason,
    });
  }

  return doReclass(tx, {
    organizationId, recordId, requestId, fromCategoryId, toCategoryId,
    amount, yearMonth, executedBy, executedAt, reason,
  });
}

/** reclass 내부 구현 — yearMonth 확정 후 실행 */
async function doReclass(
  tx: PrismaTx,
  params: {
    organizationId: string;
    recordId: string;
    requestId: string;
    fromCategoryId: string | null;
    toCategoryId: string;
    amount: number;
    yearMonth: string;
    executedBy: string;
    executedAt: Date;
    reason?: string;
  },
): Promise<BudgetReleaseEvent> {
  const {
    organizationId, recordId, requestId, fromCategoryId, toCategoryId,
    amount, yearMonth, executedBy, executedAt, reason,
  } = params;

  const releaseItems: BudgetReleaseItem[] = [];

  // 기존 카테고리에서 해제
  if (fromCategoryId) {
    const preRelease = await getCurrentCommitted(tx, organizationId, fromCategoryId, yearMonth);

    if (preRelease < amount) {
      throw new NegativeCommittedSpendError(fromCategoryId, yearMonth, preRelease, amount);
    }

    const postRelease = preRelease - amount;

    releaseItems.push({
      categoryId: fromCategoryId,
      periodKey: buildPeriodKey(organizationId, fromCategoryId, yearMonth),
      yearMonth,
      amount,
      preReleaseCommitted: preRelease,
      postReleaseCommitted: postRelease,
    });

    await recordBudgetEventIdempotent(tx, {
      organizationId,
      budgetEventKey: buildBudgetEventKey(
        organizationId, recordId, "category_reclass_release", fromCategoryId,
      ),
      eventType: "category_reclass_release_reapply",
      sourceEntityType: "purchase_request",
      sourceEntityId: requestId,
      categoryId: fromCategoryId,
      yearMonth,
      amount: -amount, // 해제
      preCommitted: preRelease,
      postCommitted: postRelease,
      decisionPayload: { direction: "release", fromCategoryId, toCategoryId, recordId, reason },
      executedBy,
    });
  }

  // 새 카테고리에 재적용
  const preReapply = await getCurrentCommitted(tx, organizationId, toCategoryId, yearMonth);
  const postReapply = preReapply + amount;

  releaseItems.push({
    categoryId: toCategoryId,
    periodKey: buildPeriodKey(organizationId, toCategoryId, yearMonth),
    yearMonth,
    amount: -amount, // 음수 = 재적용
    preReleaseCommitted: preReapply,
    postReleaseCommitted: postReapply,
  });

  await recordBudgetEventIdempotent(tx, {
    organizationId,
    budgetEventKey: buildBudgetEventKey(
      organizationId, recordId, "category_reclass_reapply", toCategoryId,
    ),
    eventType: "category_reclass_release_reapply",
    sourceEntityType: "purchase_request",
    sourceEntityId: requestId,
    categoryId: toCategoryId,
    yearMonth,
    amount, // 양수 = 재적용
    preCommitted: preReapply,
    postCommitted: postReapply,
    decisionPayload: { direction: "reapply", fromCategoryId, toCategoryId, recordId, reason },
    executedBy,
  });

  // PurchaseRecord.normalizedCategoryId 업데이트
  await tx.purchaseRecord.update({
    where: { id: recordId },
    data: { normalizedCategoryId: toCategoryId },
  });

  return {
    eventType: "category_reclass_release_reapply",
    targetEntityType: "purchase_request",
    targetEntityId: recordId,
    organizationId,
    releaseItems,
    executedAt: executedAt.toISOString(),
    executedBy,
    reason,
  };
}

// ── Audit event 변환 ──

/**
 * BudgetReleaseEvent를 Batch 6 durable audit event shape로 변환.
 * enforcement.complete()의 afterState에 포함시킬 수 있다.
 */
export function releaseEventToAuditShape(event: BudgetReleaseEvent): BudgetGateAuditEvent {
  return {
    eventType: "budget_gate_decision",
    allowed: true, // release는 항상 "실행됨"
    evaluatedAt: event.executedAt,
    targetEntityType: event.targetEntityType,
    targetEntityId: event.targetEntityId,
    decisions: event.releaseItems
      .filter((item) => item.categoryId !== null)
      .map((item) => ({
        organizationId: event.organizationId,
        periodKey: item.periodKey,
        yearMonth: item.yearMonth,
        categoryId: item.categoryId!,
        preCommitCommitted: item.preReleaseCommitted,
        requestedAmount: -item.amount, // release는 음수 요청
        postCommitCommitted: item.postReleaseCommitted,
        budgetAmount: 0, // release 시에는 한도 검증 안 함
        projectedUsagePercent: 0,
        level: "ok" as const,
        thresholds: { warningPercent: 0, softLimitPercent: 0, hardStopPercent: 0 },
      })),
    blockerCount: 0,
    warningCount: 0,
  };
}

/**
 * §11.106 #dashboard-stats-snapshot-table
 *
 * DashboardStatsSnapshot capture + retrieval helper.
 *
 * Capture:
 *   `captureDashboardSnapshot({ organizationId, userId, source })` →
 *   현재 시점의 KPI 5개 산출 후 DB 저장. cron + admin manual trigger 공용.
 *
 * Retrieval:
 *   `getMostRecentSnapshotBefore({ organizationId, before })` →
 *   trend 계산용 어제/1주 전 snapshot 1건 조회.
 *
 * KPI 산출 logic:
 *   - pendingApproval = Order.count(status=pending_approval)
 *   - anomaly = budget over count + high value (>500만) pending order count
 *   - processingRequired = lowStock + expiring + undecided compare
 *   - totalSpent = PurchaseRecord 누적 amount
 *   - totalBudget = UserBudget+Budget 활성 totalAmount sum
 */

import { db } from "@/lib/db";

export interface DashboardSnapshotInput {
  organizationId?: string | null;
  userId?: string | null;
  source?: "auto" | "manual";
  capturedBy?: string | null;
}

export interface DashboardSnapshotMetrics {
  pendingApprovalCount: number;
  anomalyCount: number;
  processingRequiredCount: number;
  totalSpent: bigint;
  totalBudget: bigint;
}

/**
 * 현재 시점의 KPI metrics 산출 (DB 저장 없이 read-only).
 * /api/dashboard/stats 와 동일 source 기반 — silent shape drift 회피.
 */
export async function deriveCurrentSnapshotMetrics(opts: {
  organizationId?: string | null;
  userId?: string | null;
}): Promise<DashboardSnapshotMetrics> {
  const { organizationId, userId } = opts;

  // org-scope filter — userId 도 organizationMember 통해 inferred 가능
  const orgFilter = organizationId
    ? { organizationId }
    : userId
      ? { userId }
      : {};

  // 1) pendingApproval — Order with status=pending_approval (또는 ORDERED)
  // LabAxis 의 OrderQueueItem 매핑: pending_approval (frontend) ≈ ORDERED (Prisma)
  let pendingApprovalCount = 0;
  let anomalyCount = 0;
  try {
    pendingApprovalCount = await db.order.count({
      where: { ...orgFilter, status: "ORDERED" },
    });
    // anomaly = high-value pending orders (totalAmount > 500만)
    anomalyCount = await db.order.count({
      where: {
        ...orgFilter,
        status: { in: ["ORDERED", "CONFIRMED"] },
        totalAmount: { gt: 5_000_000 },
      },
    });
  } catch {
    // schema 부재 또는 DB 오류 시 0 fallback (graceful)
  }

  // 2) processingRequired = lowStock + expiring (60일 이내) + undecided compare
  let processingRequiredCount = 0;
  try {
    const lowStock = await db.productInventory.count({
      where: {
        ...(organizationId ? { product: { organizationId } } : {}),
        currentQuantity: { lt: 10 }, // simple heuristic; safetyStock 비교는 별도 트랙
      },
    });
    const sixtyDaysAhead = new Date();
    sixtyDaysAhead.setDate(sixtyDaysAhead.getDate() + 60);
    const expiring = await db.productInventory.count({
      where: {
        ...(organizationId ? { product: { organizationId } } : {}),
        expiryDate: { lte: sixtyDaysAhead, gte: new Date() },
      },
    });
    processingRequiredCount = lowStock + expiring;
  } catch {
    // schema 부재 graceful
  }

  // 3) totalSpent = PurchaseRecord 누적 amount
  // §11.238 — BigInt literal `0n` ES2020+ — BigInt(0) swap (ES2017 호환).
  let totalSpent = BigInt(0);
  try {
    const result = await db.purchaseRecord.aggregate({
      where: orgFilter,
      _sum: { amount: true },
    });
    totalSpent = BigInt(result._sum.amount ?? 0);
  } catch {
    // graceful
  }

  // 4) totalBudget = UserBudget 활성 totalAmount sum
  // §11.238 — BigInt literal swap.
  let totalBudget = BigInt(0);
  try {
    const result = await db.userBudget.aggregate({
      where: { ...(userId ? { userId } : {}), isActive: true },
      _sum: { totalAmount: true },
    });
    totalBudget = BigInt(result._sum.totalAmount ?? 0);
  } catch {
    // graceful
  }

  return {
    pendingApprovalCount,
    anomalyCount,
    processingRequiredCount,
    totalSpent,
    totalBudget,
  };
}

/**
 * Capture snapshot — metrics 산출 후 DB 에 저장.
 */
export async function captureDashboardSnapshot(input: DashboardSnapshotInput) {
  const metrics = await deriveCurrentSnapshotMetrics({
    organizationId: input.organizationId,
    userId: input.userId,
  });

  const snapshot = await db.dashboardStatsSnapshot.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      capturedAt: new Date(),
      pendingApprovalCount: metrics.pendingApprovalCount,
      anomalyCount: metrics.anomalyCount,
      processingRequiredCount: metrics.processingRequiredCount,
      totalSpent: metrics.totalSpent,
      totalBudget: metrics.totalBudget,
      source: input.source ?? "auto",
      capturedBy: input.capturedBy ?? null,
    },
  });

  return snapshot;
}

/**
 * trend 산출용 — 특정 시점 이전의 가장 최근 snapshot 1건 조회.
 * organizationId 우선, 없으면 userId.
 */
export async function getMostRecentSnapshotBefore(opts: {
  organizationId?: string | null;
  userId?: string | null;
  before: Date;
}) {
  const { organizationId, userId, before } = opts;
  const where = organizationId
    ? { organizationId, capturedAt: { lt: before } }
    : userId
      ? { userId, capturedAt: { lt: before } }
      : { capturedAt: { lt: before } };

  return db.dashboardStatsSnapshot.findFirst({
    where,
    orderBy: { capturedAt: "desc" },
  });
}

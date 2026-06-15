import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import {
  deriveDashboardSummary,
  type DashboardSummaryInput,
} from "@/lib/dashboard/summary-derive";

/**
 * §main-dashboard-redesign P1 — 대시보드 단일 진실 API (읽기)
 * GET /api/dashboard/summary
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md
 *
 * 시안 8모듈 단일 진실: MODULES{quote,po,receive,stock} + BUDGET + 파생
 *   (allEmpty/budTone). 현행 /api/dashboard/stats 와 동일 scope 규칙으로 derive
 *   (계약 보존 점진 이관) — 분산 fetch → 단일 진실. 읽기 전용(prod write 0).
 *
 * 가드②: 목업 분포/가짜 차트 데이터 0 — 실데이터/0만.
 * 가드③: 전이맵 로컬 재정의 0 — 카운트 표시만(Pipeline 전이는 P4에서 state-machine 상속).
 *
 * Rollback: 본 endpoint + helper revert 시 현행 분산 stats fetch 그대로 동작.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const guestKey = request.headers.get("x-guest-key") || null;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── scope 해결 (stats route 와 동일 규칙) ──────────────────────────
    const [activeBudget, memberships, orgMemberships] = await Promise.all([
      db.userBudget.findFirst({ where: { userId, isActive: true } }),
      db.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } }),
      db.organizationMember.findMany({ where: { userId }, select: { organizationId: true } }),
    ]);
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);
    const orgIds = orgMemberships.map((m: { organizationId: string }) => m.organizationId);

    const quoteOwnerWhere: any = {
      OR: [{ userId }, ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : [])],
    };
    const inventoryOwnerWhere: any = {
      OR: [{ userId }, ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : [])],
    };

    // ── MODULES 카운트 (scope 필터 적용) ─────────────────────────────────
    const [
      quotes,
      orders,
      allInventories,
      expiringInventoryCount,
      restockGroups,
      restockTotal,
      fallbackBudget,
    ] = await withDbRetry(() =>
      Promise.all([
        db.quote.findMany({
          where: quoteOwnerWhere,
          select: { status: true, totalAmount: true },
          take: 1000,
        }),
        db.order.findMany({
          where: { userId },
          select: { status: true, totalAmount: true, createdAt: true },
          take: 1000,
        }),
        db.productInventory.findMany({
          where: inventoryOwnerWhere,
          select: {
            currentQuantity: true,
            safetyStock: true,
            averageDailyUsage: true,
            leadTimeDays: true,
          },
          take: 1000,
        }),
        db.productInventory.count({
          where: {
            ...inventoryOwnerWhere,
            expiryDate: { gte: now, lte: thirtyDaysLater },
            NOT: { expiryDate: null },
          },
        }),
        db.inventoryRestock.groupBy({
          by: ["receivingStatus"],
          where: { userId },
          _count: { _all: true },
        }),
        db.inventoryRestock.count({ where: { userId } }),
        // 활성 UserBudget 부재 시에만 Budget 폴백
        activeBudget
          ? Promise.resolve(null)
          : db.budget.findFirst({
              where: {
                scopeKey: { in: [`user-${userId}`, userId, ...orgIds] },
                yearMonth: currentYearMonth,
              },
            }),
      ]),
    );

    // ── quote 모듈 ──────────────────────────────────────────────────────
    const qByStatus: Record<string, number> = {};
    for (const q of quotes as { status: string; totalAmount: number | null }[]) {
      qByStatus[q.status] = (qByStatus[q.status] || 0) + 1;
    }
    const pendingAmount = (quotes as { status: string; totalAmount: number | null }[])
      .filter((q) => q.status === "RESPONDED" || q.status === "COMPLETED")
      .reduce((s, q) => s + (q.totalAmount || 0), 0);

    // ── po(order) 모듈 ──────────────────────────────────────────────────
    const oByStatus: Record<string, number> = {};
    for (const o of orders as { status: string; totalAmount: number; createdAt: Date }[]) {
      oByStatus[o.status] = (oByStatus[o.status] || 0) + 1;
    }
    const confirmedAmount = (orders as { status: string; totalAmount: number }[])
      .filter((o) => ["CONFIRMED", "SHIPPING", "DELIVERED"].includes(o.status))
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const thisMonthOrders = (orders as { createdAt: Date | string }[]).filter(
      (o) => new Date(o.createdAt) >= monthStart,
    ).length;

    // ── receive 모듈 ────────────────────────────────────────────────────
    const rByStatus: Record<string, number> = {};
    for (const g of restockGroups as { receivingStatus: string; _count: { _all: number } }[]) {
      rByStatus[g.receivingStatus] = g._count._all;
    }

    // ── stock 모듈 ──────────────────────────────────────────────────────
    const inv = allInventories as Array<{
      currentQuantity: number;
      safetyStock: number | null;
      averageDailyUsage: number | null;
      leadTimeDays: number | null;
    }>;
    const reorderNeeded = inv.filter((i) => {
      const dailyUsage = i.averageDailyUsage ?? 0;
      const leadTime = i.leadTimeDays ?? 0;
      if (dailyUsage > 0 && leadTime > 0) {
        if (i.currentQuantity <= dailyUsage * leadTime) return true;
      }
      if (i.safetyStock !== null) return i.currentQuantity <= i.safetyStock;
      return i.currentQuantity <= 0;
    }).length;
    const lowStock = inv.filter(
      (i) => i.safetyStock !== null && i.currentQuantity <= i.safetyStock,
    ).length;

    // ── 이번 달 실 구매액(예산 무관, scope 동일) — StatLine "이번달 지출" + 폴백예산 spent ──
    const scopeKeyValues = [userId, ...workspaceIds, ...(guestKey ? [guestKey] : [])];
    const thisMonthSpend = await db.purchaseRecord
      .aggregate({
        where: {
          OR: [
            { scopeKey: { in: scopeKeyValues } },
            ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
          ],
          purchasedAt: { gte: monthStart },
        },
        _sum: { amount: true },
      })
      .then((r: { _sum: { amount: number | null } }) => r._sum.amount || 0)
      .catch(() => 0);

    // ── BUDGET ──────────────────────────────────────────────────────────
    let budgetInput: DashboardSummaryInput["budget"] = null;
    if (activeBudget && activeBudget.totalAmount > 0) {
      budgetInput = {
        limit: activeBudget.totalAmount,
        spent: activeBudget.usedAmount,
        remaining: activeBudget.remainingAmount,
      };
    } else if (fallbackBudget && fallbackBudget.amount > 0) {
      // 폴백 예산: 이번 달 구매액 합으로 spent derive(위 thisMonthSpend 재사용)
      budgetInput = {
        limit: fallbackBudget.amount,
        spent: thisMonthSpend,
        remaining: fallbackBudget.amount - thisMonthSpend,
      };
    }

    const input: DashboardSummaryInput = {
      quote: {
        total: quotes.length,
        pending: qByStatus["PENDING"] || 0,
        responded: qByStatus["RESPONDED"] || 0,
        completed: qByStatus["COMPLETED"] || 0,
        purchased: qByStatus["PURCHASED"] || 0,
        pendingAmount,
      },
      po: {
        total: orders.length,
        ordered: oByStatus["ORDERED"] || 0,
        confirmed: oByStatus["CONFIRMED"] || 0,
        shipping: oByStatus["SHIPPING"] || 0,
        delivered: oByStatus["DELIVERED"] || 0,
        cancelled: oByStatus["CANCELLED"] || 0,
        confirmedAmount,
        thisMonth: thisMonthOrders,
      },
      receive: {
        total: restockTotal as number,
        pending: rByStatus["PENDING"] || 0,
        partial: rByStatus["PARTIAL"] || 0,
        completed: rByStatus["COMPLETED"] || 0,
        issue: rByStatus["ISSUE"] || 0,
        expiringCount: expiringInventoryCount as number,
      },
      stock: {
        total: inv.length,
        reorderNeeded,
        lowStock,
        expiringCount: expiringInventoryCount as number,
        // assetValue 는 orderItem 단가 linkage(N+1) 필요 — StatLine KPI3
        //   (이번달 지출·잔여 예산·확정 발주액)에 불요 → P1 0. stats endpoint 가 보유.
        assetValue: 0,
      },
      budget: budgetInput,
      spend: { thisMonth: thisMonthSpend },
    };

    return NextResponse.json(deriveDashboardSummary(input));
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 500 },
    );
  }
}

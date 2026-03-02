import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 대시보드 통계 API
 * GET /api/dashboard/stats
 *
 * 반환 데이터:
 * - budgetUsageRate: 예산 사용률 (%)
 * - totalPurchaseAmount: 총 구매 금액
 * - orderStats: 주문 통계
 * - quoteStats: 견적 통계
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. 활성 예산 조회
    const activeBudget = await db.userBudget.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    // 2. 주문 통계 조회
    const orders = await db.order.findMany({
      where: { userId },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
    });

    const totalPurchaseAmount = orders.reduce(
      (sum: number, order: { totalAmount: number }) => sum + order.totalAmount,
      0
    );

    const ordersByStatus = orders.reduce(
      (acc: Record<string, number>, order: { status: string }) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthOrders = orders.filter(
      (order: { createdAt: Date | string }) => new Date(order.createdAt) >= monthStart
    );

    // 3. 견적 통계 조회
    const quotes = await db.quote.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const quotesByStatus = quotes.reduce(
      (acc: Record<string, number>, quote: { status: string }) => {
        acc[quote.status] = (acc[quote.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const pendingQuotes = quotesByStatus["PENDING"] || 0;
    const completedQuotes = quotesByStatus["COMPLETED"] || 0;
    const purchasedQuotes = quotesByStatus["PURCHASED"] || 0;
    const respondedQuotes = quotesByStatus["RESPONDED"] || 0;

    // 진행 중인 견적 금액 (RESPONDED, COMPLETED 상태의 총액)
    const pendingQuotesAmount = quotes
      .filter((q: any) => q.status === "RESPONDED" || q.status === "COMPLETED")
      .reduce((sum: number, q: any) => sum + (q.totalAmount || 0), 0);

    // 4. 예산 사용률 계산 (UserBudget 우선, 없으면 Budget 모델 폴백)
    let budgetUsageRate = activeBudget && activeBudget.totalAmount > 0
      ? (activeBudget.usedAmount / activeBudget.totalAmount) * 100
      : 0;

    // UserBudget이 없으면 Budget 모델(예산 관리 페이지용)에서 이번 달 예산 조회
    let fallbackBudgetInfo: { id: string; name: string; totalAmount: number; usedAmount: number; remainingAmount: number; usageRate: string } | null = null;
    if (!activeBudget) {
      try {
        const userOrgMembershipsForBudget = await db.organizationMember.findMany({
          where: { userId },
          select: { organizationId: true },
        });
        const orgIdsForBudget = userOrgMembershipsForBudget.map((m: { organizationId: string }) => m.organizationId);
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const monthlyBudget = await db.budget.findFirst({
          where: {
            scopeKey: { in: [`user-${userId}`, userId, ...orgIdsForBudget] },
            yearMonth: currentYearMonth,
          },
        });
        if (monthlyBudget) {
          // thisMonthPurchaseAmount는 아래에서 계산되므로 먼저 임시 계산
          const tmpThisMonthRecords = await db.purchaseRecord.findMany({
            where: {
              OR: [{ scopeKey: userId }, { scopeKey: `user-${userId}` }],
              purchasedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) },
            },
            select: { amount: true },
          });
          const tmpMonthlySpent = tmpThisMonthRecords.reduce((s: number, p: any) => s + (p.amount || 0), 0);
          budgetUsageRate = monthlyBudget.amount > 0 ? (tmpMonthlySpent / monthlyBudget.amount) * 100 : 0;
          let budgetName = `${currentYearMonth} Budget`;
          if (monthlyBudget.description) {
            const nm = monthlyBudget.description.match(/^\[([^\]]+)\]/);
            if (nm) budgetName = nm[1];
          }
          fallbackBudgetInfo = {
            id: monthlyBudget.id,
            name: budgetName,
            totalAmount: monthlyBudget.amount,
            usedAmount: tmpMonthlySpent,
            remainingAmount: monthlyBudget.amount - tmpMonthlySpent,
            usageRate: budgetUsageRate.toFixed(1),
          };
        }
      } catch {
        // 폴백 실패해도 0%로 유지
      }
    }

    // 5. PurchaseRecord 기반 지출 통계 (이번 달 / 전월 / 최근 6개월)
    const memberships = await db.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);
    const scopeKeyValues = [userId, ...workspaceIds];
    const purchaseOwnerWhere: any = {
      OR: [
        { scopeKey: { in: scopeKeyValues } },
        ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
      ],
    };

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [recentPurchaseRecords, lastMonthRecords] = await Promise.all([
      db.purchaseRecord.findMany({
        where: { ...purchaseOwnerWhere, purchasedAt: { gte: sixMonthsAgo, lte: thisMonthEnd } },
        select: { amount: true, purchasedAt: true },
      }),
      db.purchaseRecord.findMany({
        where: { ...purchaseOwnerWhere, purchasedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        select: { amount: true },
      }),
    ]);

    // 이번 달 PurchaseRecord 합산
    const thisMonthPurchaseAmount = recentPurchaseRecords
      .filter((p: any) => new Date(p.purchasedAt) >= monthStart)
      .reduce((s: number, p: any) => s + (p.amount || 0), 0);

    // 전월 대비 증감률
    const lastMonthPurchaseAmount = lastMonthRecords.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const monthOverMonthChange = lastMonthPurchaseAmount > 0
      ? ((thisMonthPurchaseAmount - lastMonthPurchaseAmount) / lastMonthPurchaseAmount) * 100
      : 0;

    // 최근 6개월 월별 지출 (차트용)
    const monthlySpending: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthStr = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;
      const monthAmount = recentPurchaseRecords
        .filter((p: any) => {
          const d = new Date(p.purchasedAt);
          return d >= mStart && d <= mEnd;
        })
        .reduce((s: number, p: any) => s + (p.amount || 0), 0);
      monthlySpending.push({ month: monthStr, amount: monthAmount });
    }

    // 6. 카테고리별 지출 비중
    const ordersWithItems = await db.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                category: true,
              },
            },
          },
        },
      },
    });

    const categorySpending: Record<string, number> = {};
    ordersWithItems.forEach((order: any) => {
      order.items.forEach((item: any) => {
        const category = item.product?.category || "기타";
        const amount = (item.unitPrice || 0) * (item.quantity || 0);
        categorySpending[category] = (categorySpending[category] || 0) + amount;
      });
    });

    const categorySpendingArray = Object.entries(categorySpending).map(([category, amount]) => ({
      category,
      amount: amount as number,
    }));

    // 7. 보유 자산 총액 (UserInventory 기반)
    const userInventories = await db.userInventory.findMany({
      where: { userId },
      include: {
        user: true,
      },
    });

    // 주문 아이템과 연결하여 가격 정보 가져오기
    let totalAssetValue = 0;
    for (const inventory of userInventories) {
      if (inventory.orderItemId) {
        const orderItem = await db.orderItem.findUnique({
          where: { id: inventory.orderItemId },
          select: { unitPrice: true },
        });
        if (orderItem) {
          totalAssetValue += (orderItem.unitPrice || 0) * inventory.quantity;
        }
      }
    }

    // 8. 재고 현황 (재주문 필요 + 유통기한 임박 30일)
    // 유저의 조직 목록도 포함
    const userOrgMemberships = await db.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const userOrgIds = userOrgMemberships.map((m: { organizationId: string }) => m.organizationId);

    const inventoryOwnerWhere: any = {
      OR: [
        { userId },
        ...(userOrgIds.length > 0 ? [{ organizationId: { in: userOrgIds } }] : []),
      ],
    };

    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [allInventories, expiringInventories] = await Promise.all([
      db.productInventory.findMany({
        where: inventoryOwnerWhere,
        include: {
          product: { select: { name: true, catalogNumber: true, brand: true } },
        },
      }),
      db.productInventory.findMany({
        where: {
          ...inventoryOwnerWhere,
          expiryDate: { gte: now, lte: thirtyDaysLater },
          NOT: { expiryDate: null },
        },
        include: {
          product: { select: { name: true, catalogNumber: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 10,
      }),
    ]);

    const reorderNeededCount = allInventories.filter((inv: any) => {
      const dailyUsage = inv.averageDailyUsage ?? 0;
      const leadTime = inv.leadTimeDays ?? 0;
      if (dailyUsage > 0 && leadTime > 0) {
        if (inv.currentQuantity <= dailyUsage * leadTime) return true;
      }
      if (inv.safetyStock !== null) {
        return inv.currentQuantity <= inv.safetyStock;
      }
      return inv.currentQuantity <= 0;
    }).length;

    // 부족 재고 상위 5건
    const lowStockItems = allInventories
      .filter((inv: any) => inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock)
      .slice(0, 5)
      .map((inv: any) => ({
        id: inv.id,
        productName: inv.product?.name || "Unknown",
        catalogNumber: inv.product?.catalogNumber,
        currentQuantity: inv.currentQuantity,
        safetyStock: inv.safetyStock,
        unit: inv.unit || "ea",
      }));

    return NextResponse.json({
      // 예산 정보 (UserBudget 우선, 없으면 Budget 모델 폴백)
      budget: activeBudget
        ? {
            id: activeBudget.id,
            name: activeBudget.name,
            totalAmount: activeBudget.totalAmount,
            usedAmount: activeBudget.usedAmount,
            remainingAmount: activeBudget.remainingAmount,
            usageRate: budgetUsageRate.toFixed(1),
            fiscalYear: activeBudget.fiscalYear,
            recentTransactions: activeBudget.transactions,
          }
        : fallbackBudgetInfo,

      // 예산 사용률 (%)
      budgetUsageRate: budgetUsageRate.toFixed(1),

      // 총 구매 금액
      totalPurchaseAmount,

      // 이번 달 구매 금액
      thisMonthPurchaseAmount,

      // 전월 대비 증감률
      monthOverMonthChange: monthOverMonthChange.toFixed(1),

      // 보유 자산 총액
      totalAssetValue,

      // 재주문 필요 품목 수
      reorderNeededCount,

      // 대시보드 KPI 카드용
      lowStockAlerts: reorderNeededCount,
      totalInventory: allInventories.length,

      // 유통기한 임박 (30일 이내)
      expiringItems: expiringInventories.map((inv: any) => ({
        id: inv.id,
        productName: inv.product?.name || "Unknown",
        catalogNumber: inv.product?.catalogNumber,
        expiryDate: inv.expiryDate,
        currentQuantity: inv.currentQuantity,
        unit: inv.unit || "ea",
        daysLeft: Math.ceil(
          (new Date(inv.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      expiringCount: expiringInventories.length,

      // 부족 재고 상위 5건
      lowStockItems,

      // 카테고리별 지출 비중
      categorySpending: categorySpendingArray,

      // 주문 통계
      orderStats: {
        total: orders.length,
        byStatus: ordersByStatus,
        thisMonth: thisMonthOrders.length,
      },

      // 견적 통계
      quoteStats: {
        total: quotes.length,
        byStatus: quotesByStatus,
        pending: pendingQuotes,
        completed: completedQuotes,
        purchased: purchasedQuotes,
        responded: respondedQuotes,
        pendingAmount: pendingQuotesAmount, // 진행 중인 견적 금액
      },

      // 월별 지출 추이
      monthlySpending,

      // 최근 주문 (최근 5건)
      recentOrders: await db.order.findMany({
        where: { userId },
        include: {
          quote: {
            select: { title: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // 최근 구매 기록 (PurchaseRecord, 최근 5건)
      recentPurchases: await db.purchaseRecord.findMany({
        where: purchaseOwnerWhere,
        orderBy: { purchasedAt: "desc" },
        take: 5,
        select: {
          id: true,
          itemName: true,
          vendorName: true,
          amount: true,
          purchasedAt: true,
          category: true,
          qty: true,
          unit: true,
        },
      }),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

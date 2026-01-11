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

    // 이번 달 주문
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthOrders = orders.filter(
      (order: { createdAt: Date | string }) => new Date(order.createdAt) >= monthStart
    );
    const thisMonthPurchaseAmount = thisMonthOrders.reduce(
      (sum: number, order: { totalAmount: number }) => sum + order.totalAmount,
      0
    );

    // 전월 주문 (증감률 계산용)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthOrders = orders.filter((order: { createdAt: Date | string }) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    });
    const lastMonthPurchaseAmount = lastMonthOrders.reduce(
      (sum: number, order: { totalAmount: number }) => sum + order.totalAmount,
      0
    );
    const monthOverMonthChange = lastMonthPurchaseAmount > 0
      ? ((thisMonthPurchaseAmount - lastMonthPurchaseAmount) / lastMonthPurchaseAmount) * 100
      : 0;

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

    // 4. 예산 사용률 계산
    const budgetUsageRate = activeBudget && activeBudget.totalAmount > 0
      ? (activeBudget.usedAmount / activeBudget.totalAmount) * 100
      : 0;

    // 5. 월별 지출 추이 (최근 6개월)
    const monthlySpending: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const monthOrders = orders.filter((order: { createdAt: Date | string }) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate <= monthEnd;
      });

      const monthAmount = monthOrders.reduce(
        (sum: number, order: { totalAmount: number }) => sum + order.totalAmount,
        0
      );

      monthlySpending.push({
        month: monthStr,
        amount: monthAmount,
      });
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

    // 8. 재주문 필요 품목 수
    const allInventories = await db.productInventory.findMany({
      where: {
        OR: [{ userId }, { organizationId: { in: [] } }],
      },
    });
    const reorderNeededCount = allInventories.filter((inv: any) => {
      if (inv.safetyStock !== null) {
        return inv.currentQuantity <= inv.safetyStock;
      }
      return inv.currentQuantity <= 0;
    }).length;

    return NextResponse.json({
      // 예산 정보
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
        : null,

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
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

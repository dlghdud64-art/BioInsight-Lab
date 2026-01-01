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
      (sum, order) => sum + order.totalAmount,
      0
    );

    const ordersByStatus = orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // 이번 달 주문
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthOrders = orders.filter(
      (order) => new Date(order.createdAt) >= monthStart
    );
    const thisMonthPurchaseAmount = thisMonthOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
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
      (acc, quote) => {
        acc[quote.status] = (acc[quote.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const pendingQuotes = quotesByStatus["PENDING"] || 0;
    const completedQuotes = quotesByStatus["COMPLETED"] || 0;
    const purchasedQuotes = quotesByStatus["PURCHASED"] || 0;

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

      const monthOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate <= monthEnd;
      });

      const monthAmount = monthOrders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      );

      monthlySpending.push({
        month: monthStr,
        amount: monthAmount,
      });
    }

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

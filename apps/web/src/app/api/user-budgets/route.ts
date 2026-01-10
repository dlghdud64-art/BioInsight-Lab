import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/user-budgets
 * 사용자의 활성 예산 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const budgets = await db.userBudget.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 유효기간 계산 (endDate가 있으면 D-day 계산)
    const now = new Date();
    const budgetsWithDays = budgets.map((budget) => {
      let daysRemaining: number | null = null;
      if (budget.endDate) {
        const endDate = new Date(budget.endDate);
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays;
      }

      return {
        ...budget,
        daysRemaining,
      };
    });

    return NextResponse.json({ budgets: budgetsWithDays });
  } catch (error) {
    console.error("[UserBudget API] Error fetching budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets", budgets: [] },
      { status: 500 }
    );
  }
}



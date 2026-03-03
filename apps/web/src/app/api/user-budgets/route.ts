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

    // 소속 조직 ID 목록 조회 (멀티 테넌트 격리: 본인 + 소속 조직 예산만 반환)
    const orgMemberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const orgIds = orgMemberships.map((m: { organizationId: string }) => m.organizationId);

    const budgets = await db.userBudget.findMany({
      where: {
        isActive: true,
        OR: [
          { userId: session.user.id },
          ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 유효기간 계산 (endDate가 있으면 D-day 계산)
    const now = new Date();
    const budgetsWithDays = budgets.map((budget: any) => {
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



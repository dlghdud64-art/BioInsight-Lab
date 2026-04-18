import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/user-budgets
 * 사용자의 활성 예산 목록 조회
 * - UserBudget 테이블 (연구비 계좌 형식)
 * - Budget 테이블 (예산 관리 페이지에서 등록한 예산) 통합 반환
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 소속 조직 ID 목록 조회 (멀티 테넌트 격리)
    const orgMemberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const orgIds = orgMemberships.map((m: { organizationId: string }) => m.organizationId);

    // ── 1. UserBudget 테이블 조회 ─────────────────────────────────────────────
    const userBudgets = await db.userBudget.findMany({
      where: {
        isActive: true,
        OR: [
          { userId: session.user.id },
          ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const userBudgetsFormatted = userBudgets.map((budget: any) => {
      let daysRemaining: number | null = null;
      if (budget.endDate) {
        const diffDays = Math.ceil(
          (new Date(budget.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        daysRemaining = diffDays;
      }
      return {
        ...budget,
        remainingAmount: budget.remainingAmount ?? budget.totalAmount - (budget.usedAmount ?? 0),
        daysRemaining,
        _source: "user-budget" as const,
      };
    });

    // ── 2. Budget 테이블 조회 (예산 관리 페이지에서 생성한 예산) ─────────────
    const scopeKeys = [`user-${session.user.id}`, ...orgIds];

    const budgets = await db.budget.findMany({
      where: {
        OR: [
          ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
          { scopeKey: { in: scopeKeys }, organizationId: null },
        ],
      },
      orderBy: { yearMonth: "desc" },
    });

    // Budget → UserBudget 호환 형식으로 변환
    const budgetsFormatted = await Promise.all(
      budgets.map(async (budget: any) => {
        // description에서 name, projectName, 기간 추출
        let name = `${budget.yearMonth} 예산`;
        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        if (budget.description) {
          const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
          if (nameMatch) name = nameMatch[1];
          const periodMatch = budget.description.match(
            /period:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/
          );
          if (periodMatch) {
            periodStart = new Date(periodMatch[1]);
            periodEnd = new Date(periodMatch[2] + "T23:59:59");
          }
        }
        if (!periodStart) {
          const [year, month] = budget.yearMonth.split("-").map(Number);
          periodStart = new Date(year, month - 1, 1);
          periodEnd = new Date(year, month, 0, 23, 59, 59);
        }

        // 해당 기간의 구매 기록으로 사용액 계산
        const purchaseScopeKey = budget.scopeKey.startsWith("user-")
          ? budget.scopeKey.slice("user-".length)
          : budget.scopeKey;
        const purchaseRecords = await db.purchaseRecord.findMany({
          where: {
            OR: [{ scopeKey: purchaseScopeKey }, { scopeKey: budget.scopeKey }],
            purchasedAt: { gte: periodStart, lte: periodEnd! },
          },
          select: { amount: true },
        });
        const usedAmount = purchaseRecords.reduce(
          (sum: number, r: any) => sum + (r.amount || 0),
          0
        );
        const remainingAmount = budget.amount - usedAmount;

        return {
          id: budget.id,
          name,
          totalAmount: budget.amount,
          usedAmount,
          remainingAmount,
          currency: budget.currency,
          startDate: periodStart?.toISOString() ?? null,
          endDate: periodEnd?.toISOString() ?? null,
          isActive: true,
          createdAt: budget.createdAt,
          updatedAt: budget.updatedAt,
          daysRemaining: null,
          _source: "budget" as const,
          // Budget 전용 필드 (하위 호환)
          yearMonth: budget.yearMonth,
          scopeKey: budget.scopeKey,
          organizationId: budget.organizationId,
        };
      })
    );

    // ── 3. 합산 + 중복 제거 (같은 id는 budget 우선) ───────────────────────────
    const allBudgets = [...budgetsFormatted, ...userBudgetsFormatted];

    return NextResponse.json({ budgets: allBudgets });
  } catch (error) {
    console.error("[UserBudget API] Error fetching budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets", budgets: [] },
      { status: 500 }
    );
  }
}

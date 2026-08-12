import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 사용자 소속 조직 파악
    let scopeKey: string;
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      scopeKey = organizationId;
    } else {
      const userOrg = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
      });
      scopeKey = userOrg ? userOrg.organizationId : `user-${session.user.id}`;
    }

    // 현재 활성 예산 조회 (가장 최근 yearMonth)
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const activeBudget = await db.budget.findFirst({
      where: { scopeKey },
      orderBy: { yearMonth: "desc" },
    });

    if (!activeBudget) {
      return NextResponse.json({
        hasBudget: false,
        message: "등록된 예산이 없습니다.",
      });
    }

    // 최근 3개월 구매 기록 조회
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const purchaseRecords = await db.purchaseRecord.findMany({
      where: {
        scopeKey,
        purchasedAt: { gte: threeMonthsAgo },
      },
      orderBy: { purchasedAt: "asc" },
    });

    // 월별 소진액 집계
    const monthlySpend: Record<string, number> = {};
    for (const r of purchaseRecords) {
      const ym = `${r.purchasedAt.getFullYear()}-${String(r.purchasedAt.getMonth() + 1).padStart(2, "0")}`;
      monthlySpend[ym] = (monthlySpend[ym] || 0) + (r.amount || 0);
    }

    const monthKeys = Object.keys(monthlySpend).sort();
    const monthlyAmounts = monthKeys.map((k) => monthlySpend[k]);
    const totalSpent3M = monthlyAmounts.reduce((s, v) => s + v, 0);
    const avgMonthlyBurnRate = monthKeys.length > 0 ? totalSpent3M / monthKeys.length : 0;
    const dailyBurnRate = avgMonthlyBurnRate / 30;

    // 이번 달 소진액
    const thisMonthSpend = monthlySpend[currentYearMonth] || 0;
    // 지난달 소진액
    const lastMonthDate = new Date(now);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthSpend = monthlySpend[lastYearMonth] || 0;

    // 현재 사용액 계산 (scopeKey 기반 전체)
    const totalSpentAll = purchaseRecords.reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const remaining = Math.max(activeBudget.amount - totalSpentAll, 0);

    // 고갈일 예측 (runwayDays)
    let runwayDays: number | null = null;
    let exhaustDate: string | null = null;
    if (dailyBurnRate > 0 && remaining > 0) {
      runwayDays = Math.floor(remaining / dailyBurnRate);
      const exhaustAt = new Date(now);
      exhaustAt.setDate(exhaustAt.getDate() + runwayDays);
      exhaustDate = exhaustAt.toISOString().slice(0, 10);
    } else if (remaining <= 0) {
      runwayDays = 0;
      exhaustDate = currentYearMonth + "-01";
    }

    // 이상치 감지: 이번 달이 전월 대비 20% 초과 증가
    const hasWarning =
      lastMonthSpend > 0 && thisMonthSpend > lastMonthSpend * 1.2;
    const warningMessage = hasWarning
      ? `이번 달 지출이 전월 대비 ${Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100)}% 증가했습니다. 예산이 예상보다 일찍 소진될 수 있습니다.`
      : null;

    // Sparkline 데이터 (최근 4개월 월별 소진액)
    const sparklineMonths = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (3 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const sparkline = sparklineMonths.map((ym) => ({
      month: ym.slice(5) + "월",
      amount: monthlySpend[ym] || 0,
    }));

    return NextResponse.json({
      hasBudget: true,
      budgetName: activeBudget.description?.match(/^\[([^\]]+)\]/)?.[1] ?? currentYearMonth + " 예산",
      totalBudget: activeBudget.amount,
      totalSpent: totalSpentAll,
      remaining,
      avgMonthlyBurnRate: Math.round(avgMonthlyBurnRate),
      dailyBurnRate: Math.round(dailyBurnRate),
      runwayDays,
      exhaustDate,
      sparkline,
      hasWarning,
      warningMessage,
    });
  } catch (error: any) {
    console.error("[Budget Predict API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate prediction" },
      { status: 500 }
    );
  }
}

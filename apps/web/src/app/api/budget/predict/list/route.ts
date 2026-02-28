import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

type PredictItem = {
  scopeKey: string;
  organizationId: string | null;
  hasBudget: boolean;
  budgetName: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  avgMonthlyBurnRate: number;
  runwayDays: number | null;
  exhaustDate: string | null;
  sparkline: { month: string; amount: number }[];
  hasWarning: boolean;
  warningMessage: string | null;
};

async function computePredictForScope(
  scopeKey: string,
  now: Date
): Promise<PredictItem | null> {
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeBudget = await db.budget.findFirst({
    where: { scopeKey },
    orderBy: { yearMonth: "desc" },
  });

  if (!activeBudget) return null;

  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const purchaseRecords = await db.purchaseRecord.findMany({
    where: {
      scopeKey,
      purchasedAt: { gte: threeMonthsAgo },
    },
    orderBy: { purchasedAt: "asc" },
  });

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

  const thisMonthSpend = monthlySpend[currentYearMonth] || 0;
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthSpend = monthlySpend[lastYearMonth] || 0;

  const totalSpentAll = purchaseRecords.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const remaining = Math.max(activeBudget.amount - totalSpentAll, 0);

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

  const hasWarning =
    lastMonthSpend > 0 && thisMonthSpend > lastMonthSpend * 1.2;
  const warningMessage = hasWarning
    ? `이번 달 지출이 전월 대비 ${Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100)}% 증가했습니다. 예산이 예상보다 일찍 소진될 수 있습니다.`
    : null;

  const sparklineMonths = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (3 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const sparkline = sparklineMonths.map((ym) => ({
    month: ym.slice(5) + "월",
    amount: monthlySpend[ym] || 0,
  }));

  const budgetName =
    activeBudget.description?.match(/^\[([^\]]+)\]/)?.[1] ?? currentYearMonth + " 예산";
  const organizationId = scopeKey.startsWith("user-") ? null : scopeKey;

  return {
    scopeKey,
    organizationId,
    hasBudget: true,
    budgetName,
    totalBudget: activeBudget.amount,
    totalSpent: totalSpentAll,
    remaining,
    avgMonthlyBurnRate: Math.round(avgMonthlyBurnRate),
    runwayDays,
    exhaustDate,
    sparkline,
    hasWarning,
    warningMessage,
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userOrganizations = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const userOrgIds = userOrganizations.map((m: { organizationId: string }) => m.organizationId);

    const scopeKeys = [`user-${session.user.id}`, ...userOrgIds];

    const results = await Promise.all(
      scopeKeys.map((scopeKey) => computePredictForScope(scopeKey, new Date()))
    );

    const budgets = results.filter((r): r is PredictItem => r !== null);

    // 위급 순 정렬: runwayDays 오름차순 (null은 맨 뒤)
    budgets.sort((a, b) => {
      const aVal = a.runwayDays ?? 999999;
      const bVal = b.runwayDays ?? 999999;
      return aVal - bVal;
    });

    return NextResponse.json({ budgets });
  } catch (error: any) {
    console.error("[Budget Predict List API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch budget list" },
      { status: 500 }
    );
  }
}

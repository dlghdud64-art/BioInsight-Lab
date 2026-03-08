import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { ko } from "date-fns/locale";

const CATEGORY_COLORS: Record<string, string> = {
  시약: "#3b82f6",
  장비: "#10b981",
  소모품: "#f59e0b",
  기타: "#8b5cf6",
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#94a3b8";
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 워크스페이스 멤버십 조회
    const memberships = await db.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);

    // PurchaseRecord scopeKey
    const purchaseScopeKeys = [userId, ...workspaceIds];
    const purchaseWhere = {
      OR: [
        { scopeKey: { in: purchaseScopeKeys } },
        ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
      ],
    };

    // Budget scopeKey (조직 우선, 없으면 user-{id})
    let budgetScopeKey: string;
    const userOrg = await db.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    if (userOrg) {
      budgetScopeKey = userOrg.organizationId;
    } else {
      budgetScopeKey = `user-${userId}`;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    const sixMonthsAgo = startOfMonth(subMonths(now, 5));
    const monthEnd = endOfMonth(now);

    // 병렬 DB 조회
    const [yearBudgets, yearPurchases, recentPurchases, top5Purchases] = await Promise.all([
      // 올해 예산 합산
      db.budget.findMany({
        where: {
          scopeKey: budgetScopeKey,
          yearMonth: { startsWith: `${currentYear}-` },
        },
        select: { amount: true },
      }),
      // 올해 구매 전체 (예산 소진 + 카테고리 집계)
      db.purchaseRecord.findMany({
        where: { ...purchaseWhere, purchasedAt: { gte: yearStart, lte: yearEnd } },
        select: { amount: true, category: true },
      }),
      // 최근 6개월 (월별 추이)
      db.purchaseRecord.findMany({
        where: { ...purchaseWhere, purchasedAt: { gte: sixMonthsAgo, lte: monthEnd } },
        select: { amount: true, purchasedAt: true },
        orderBy: { purchasedAt: "asc" },
      }),
      // Top 5 큰 지출
      db.purchaseRecord.findMany({
        where: purchaseWhere,
        select: {
          id: true,
          itemName: true,
          vendorName: true,
          category: true,
          amount: true,
          purchasedAt: true,
        },
        orderBy: { amount: "desc" },
        take: 5,
      }),
    ]);

    // ── 예산 요약 ──────────────────────────────────────────
    const totalBudget = yearBudgets.reduce((s: number, b: { amount: number }) => s + b.amount, 0);
    const usedAmount = yearPurchases.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0);
    const remainingAmount = Math.max(0, totalBudget - usedAmount);
    const usageRate = totalBudget > 0 ? Math.min(100, Math.round((usedAmount / totalBudget) * 100)) : 0;

    // ── 월별 지출 추이 (최근 6개월) ────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const key = format(subMonths(now, i), "yyyy-MM");
      monthlyMap[key] = 0;
    }
    for (const p of recentPurchases) {
      const key = format(new Date(p.purchasedAt), "yyyy-MM");
      if (key in monthlyMap) monthlyMap[key] += p.amount || 0;
    }
    const monthlySpending = Object.entries(monthlyMap).map(([ym, amount]) => ({
      month: format(new Date(ym + "-01"), "M월", { locale: ko }),
      amount,
    }));

    // ── 카테고리별 비중 ────────────────────────────────────
    const categoryMap: Record<string, number> = {};
    for (const p of yearPurchases) {
      const cat = p.category || "기타";
      categoryMap[cat] = (categoryMap[cat] || 0) + (p.amount || 0);
    }
    const totalCatAmount = Object.values(categoryMap).reduce((s, v) => s + v, 0);
    const categorySpending = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name,
        value: totalCatAmount > 0 ? Math.round((amount / totalCatAmount) * 100) : 0,
        amount,
        color: getCategoryColor(name),
      }));

    // ── Top 5 지출 ─────────────────────────────────────────
    const topSpending = top5Purchases.map((p: {
      id: string; itemName: string; vendorName: string;
      category: string | null; amount: number; purchasedAt: Date;
    }) => ({
      id: p.id,
      item: p.itemName,
      vendor: p.vendorName,
      category: p.category || "기타",
      amount: p.amount,
      date: new Date(p.purchasedAt).toISOString().split("T")[0],
    }));

    return NextResponse.json({
      budget: { total: totalBudget, used: usedAmount, remaining: remainingAmount, usageRate },
      monthlySpending,
      categorySpending,
      topSpending,
    });
  } catch (error) {
    return handleApiError(error, "analytics/dashboard");
  }
}

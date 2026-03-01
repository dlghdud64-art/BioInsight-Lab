import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { auth } from "@/auth";

const logger = createLogger("purchases/summary");

export async function GET(request: NextRequest) {
  try {
    // 인증된 유저: session 기반, guestKey는 하위 호환용
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guestKey = request.headers.get("x-guest-key");

    // 유저의 워크스페이스 목록 조회
    const memberships = await db.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);

    // scopeKey 목록
    const scopeKeyValues: string[] = [
      session.user.id,
      ...workspaceIds,
      ...(guestKey ? [guestKey] : []),
    ];

    const ownerWhere: any = {
      OR: [
        { scopeKey: { in: scopeKeyValues } },
        ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
      ],
    };

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const now = new Date();
    const from = fromStr ? new Date(fromStr) : startOfMonth(now);
    const to = toStr ? new Date(toStr) : endOfMonth(now);

    // 이번 달 고정 범위 (통계 카드용)
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    // 올해 고정 범위 (연간 누적용)
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    logger.debug("Fetching purchase summary", { userId: session.user.id, from, to });

    // 3개 범위 병렬 조회: 선택 범위(랭킹용), 이번 달, 올해
    const [rangePurchases, monthPurchases, yearPurchases] = await Promise.all([
      db.purchaseRecord.findMany({
        where: { ...ownerWhere, purchasedAt: { gte: from, lte: to } },
        orderBy: { purchasedAt: "desc" },
      }),
      db.purchaseRecord.findMany({
        where: { ...ownerWhere, purchasedAt: { gte: monthStart, lte: monthEnd } },
        select: { amount: true },
      }),
      db.purchaseRecord.findMany({
        where: { ...ownerWhere, purchasedAt: { gte: yearStart, lte: yearEnd } },
        select: { amount: true },
      }),
    ]);

    // 이번 달 통계
    const currentMonthSpending = monthPurchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const currentMonthCount = monthPurchases.length;

    // 연간 누적
    const yearToDate = yearPurchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // 선택 범위 내 Top Vendors (count + totalAmount 포함)
    const vendorMap: Record<string, { vendorName: string; totalAmount: number; count: number }> = {};
    for (const p of rangePurchases) {
      const key = p.vendorName || "Unknown";
      if (!vendorMap[key]) vendorMap[key] = { vendorName: key, totalAmount: 0, count: 0 };
      vendorMap[key].totalAmount += p.amount || 0;
      vendorMap[key].count += 1;
    }
    const topVendors = Object.values(vendorMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // 선택 범위 내 Top Categories (count + totalAmount 포함)
    const categoryMap: Record<string, { category: string; totalAmount: number; count: number }> = {};
    for (const p of rangePurchases) {
      const key = p.category || "Uncategorized";
      if (!categoryMap[key]) categoryMap[key] = { category: key, totalAmount: 0, count: 0 };
      categoryMap[key].totalAmount += p.amount || 0;
      categoryMap[key].count += 1;
    }
    const topCategories = Object.values(categoryMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // byMonth (선택 범위 내 월별 합산)
    const byMonthMap: Record<string, { yearMonth: string; amount: number }> = {};
    for (const p of rangePurchases) {
      const yearMonth = (p.purchasedAt as Date).toISOString().substring(0, 7);
      if (!byMonthMap[yearMonth]) byMonthMap[yearMonth] = { yearMonth, amount: 0 };
      byMonthMap[yearMonth].amount += p.amount || 0;
    }
    const byMonth = Object.values(byMonthMap).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    logger.info(`Summary: month=${currentMonthSpending}, year=${yearToDate}, range=${rangePurchases.length} purchases`);

    return NextResponse.json({
      // 통계 카드용 (프론트엔드 summary.summary.* 접근)
      summary: {
        currentMonthSpending,
        currentMonthCount,
        yearToDate,
        rangeTotal: rangePurchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      },
      // 하위 호환 (totalAmount)
      totalAmount: currentMonthSpending,
      byMonth,
      topVendors,
      topCategories,
    });
  } catch (error) {
    return handleApiError(error, "purchases/summary");
  }
}

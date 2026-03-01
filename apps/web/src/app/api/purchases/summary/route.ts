import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
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

    const from = fromStr ? new Date(fromStr) : startOfMonth(new Date());
    const to = toStr ? new Date(toStr) : endOfMonth(new Date());

    logger.debug("Fetching purchase summary", { userId: session.user.id, from, to });

    const purchases = await db.purchaseRecord.findMany({
      where: {
        ...ownerWhere,
        purchasedAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: {
        purchasedAt: "desc",
      },
    });

    const totalAmount = purchases.reduce((sum: number, p: any) => sum + p.amount, 0);

    const byMonth = purchases.reduce((acc: any, p: any) => {
      const yearMonth = p.purchasedAt.toISOString().substring(0, 7);
      if (!acc[yearMonth]) {
        acc[yearMonth] = { yearMonth, amount: 0 };
      }
      acc[yearMonth].amount += p.amount;
      return acc;
    }, {} as Record<string, { yearMonth: string; amount: number }>);

    const topVendors = (Object.values(
      purchases.reduce((acc: any, p: any) => {
        if (!acc[p.vendorName]) {
          acc[p.vendorName] = { vendorName: p.vendorName, amount: 0 };
        }
        acc[p.vendorName].amount += p.amount;
        return acc;
      }, {} as Record<string, { vendorName: string; amount: number }>)
    ) as { vendorName: string; amount: number }[])
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 10);

    const topCategories = (Object.values(
      purchases.reduce((acc: any, p: any) => {
        const cat = p.category || "Uncategorized";
        if (!acc[cat]) {
          acc[cat] = { category: cat, amount: 0 };
        }
        acc[cat].amount += p.amount;
        return acc;
      }, {} as Record<string, { category: string; amount: number }>)
    ) as { category: string; amount: number }[])
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 10);

    logger.info(`Summary: total ${totalAmount}, ${purchases.length} purchases`);

    return NextResponse.json({
      totalAmount,
      byMonth: (Object.values(byMonth) as { yearMonth: string; amount: number }[]).sort((a: any, b: any) => a.yearMonth.localeCompare(b.yearMonth)),
      topVendors,
      topCategories,
    });
  } catch (error) {
    return handleApiError(error, "purchases/summary");
  }
}

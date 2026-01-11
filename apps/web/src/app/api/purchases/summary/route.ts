import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth } from "date-fns";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";

const logger = createLogger("purchases/summary");

export async function GET(request: NextRequest) {
  try {
    const scopeKey = request.headers.get("x-guest-key");
    if (!scopeKey) {
      logger.warn("Missing x-guest-key header");
      throw new Error("x-guest-key header is required");
    }

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const from = fromStr ? new Date(fromStr) : startOfMonth(new Date());
    const to = toStr ? new Date(toStr) : endOfMonth(new Date());

    logger.debug("Fetching purchase summary", { scopeKey, from, to });

    const purchases = await db.purchaseRecord.findMany({
      where: {
        scopeKey,
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

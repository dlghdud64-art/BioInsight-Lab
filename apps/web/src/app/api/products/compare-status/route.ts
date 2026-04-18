/**
 * GET /api/products/compare-status?productIds=id1,id2,...
 *
 * Returns how many active (UNDECIDED/null) compare sessions each product is involved in.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ statuses: {} });
    }

    const url = new URL(request.url);
    const rawIds = url.searchParams.get("productIds") || "";
    const productIds = rawIds.split(",").map((s) => s.trim()).filter(Boolean);

    if (productIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Fetch recent sessions where decision is pending
    const sessions = await db.compareSession.findMany({
      where: {
        userId,
        OR: [
          { decisionState: null },
          { decisionState: "UNDECIDED" },
        ],
      },
      select: { productIds: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // Count how many sessions contain each requested productId
    const statuses: Record<string, { activeCount: number }> = {};
    for (const pid of productIds) {
      let count = 0;
      for (const s of sessions) {
        const sIds = Array.isArray(s.productIds) ? s.productIds : [];
        if ((sIds as string[]).includes(pid)) count++;
      }
      if (count > 0) {
        statuses[pid] = { activeCount: count };
      }
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    return handleApiError(error, "GET /api/products/compare-status");
  }
}

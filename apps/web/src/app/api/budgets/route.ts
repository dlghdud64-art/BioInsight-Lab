import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ìì° ëª©ë¡ ì¡°í
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // ìì° ì¡°í (ì¡°ì§ë³ ëë ì¬ì©ìê° ìí ì¡°ì§)
    const userOrganizations = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const userOrgIds = userOrganizations.map((m) => m.organizationId);

    const budgets = await db.budget.findMany({
      where: {
        OR: [
          ...(organizationId ? [{ organizationId }] : []),
          ...(userOrgIds.length > 0 ? [{ organizationId: { in: userOrgIds } }] : []),
        ],
      },
      orderBy: {
        periodStart: "desc",
      },
    });

    // ê° ìì°ì ì¬ì©ë¥  ê³ì°
    const budgetsWithUsage = await Promise.all(
      budgets.map(async (budget) => {
        // ìì° ê¸°ê° ë´ êµ¬ë§¤ë´ì­ ì¡°í
        const purchaseRecords = await db.purchaseRecord.findMany({
          where: {
            purchaseDate: {
              gte: budget.periodStart,
              lte: budget.periodEnd,
            },
            ...(budget.organizationId
              ? { organizationId: budget.organizationId }
              : {}),
            ...(budget.projectName
              ? { projectName: budget.projectName }
              : {}),
          },
        });

        // ì´ ì¬ì© ê¸ì¡ ê³ì°
        const totalSpent = purchaseRecords.reduce(
          (sum, record) => sum + (record.amount || 0),
          0
        );

        // ì¬ì©ë¥  ê³ì°
        const usageRate = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
        const remaining = budget.amount - totalSpent;

        return {
          ...budget,
          usage: {
            totalSpent,
            usageRate,
            remaining,
          },
        };
      })
    );

    return NextResponse.json({ budgets: budgetsWithUsage });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 500 }
    );
  }
}

// ìì° ìì±
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

    const userOrganizations = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const userOrgIds = userOrganizations.map((m: { organizationId: string }) => m.organizationId);

    const budgets = await db.budget.findMany({
      where: {
        OR: [
          ...(organizationId ? [{ organizationId }] : []),
          ...(userOrgIds.length > 0 ? [{ organizationId: { in: userOrgIds } }] : []),
        ],
      },
      orderBy: {
        yearMonth: "desc",
      },
    });

    const budgetsWithUsage = await Promise.all(
      budgets.map(async (budget: any) => {
        const [year, month] = budget.yearMonth.split("-").map(Number);
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0, 23, 59, 59);

        const purchaseRecords = await db.purchaseRecord.findMany({
          where: {
            organizationId: budget.organizationId,
            purchasedAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        });

        const totalSpent = purchaseRecords.reduce(
          (sum: number, record: any) => sum + (record.amount || 0),
          0
        );

        const usageRate = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
        const remaining = budget.amount - totalSpent;

        return {
          ...budget,
          name: `${budget.yearMonth} Budget`,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, yearMonth, amount, currency, description } = body;

    if (!organizationId || !yearMonth || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: organizationId, yearMonth, amount" },
        { status: 400 }
      );
    }

    const yearMonthRegex = /^\d{4}-\d{2}$/;
    if (!yearMonthRegex.test(yearMonth)) {
      return NextResponse.json(
        { error: "Invalid yearMonth format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    const userOrg = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        role: { in: ["ADMIN", "APPROVER"] },
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        { error: "You must be an admin or approver in this organization" },
        { status: 403 }
      );
    }

    const budget = await db.budget.upsert({
      where: {
        organizationId_yearMonth: {
          organizationId,
          yearMonth,
        },
      },
      create: {
        organizationId,
        yearMonth,
        amount,
        currency: currency || "KRW",
        description,
      },
      update: {
        amount,
        currency: currency || "KRW",
        description,
      },
    });

    return NextResponse.json({ budget });
  } catch (error) {
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 예산 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 예산 조회 (조직별 또는 사용자가 속한 조직)
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

    // 각 예산의 사용률 계산
    const budgetsWithUsage = await Promise.all(
      budgets.map(async (budget) => {
        // 예산 기간 내 구매내역 조회
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

        // 총 사용 금액 계산
        const totalSpent = purchaseRecords.reduce(
          (sum, record) => sum + (record.amount || 0),
          0
        );

        // 사용률 계산
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

// 예산 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      amount,
      currency = "KRW",
      periodStart,
      periodEnd,
      organizationId,
      projectName,
      description,
    } = body;

    if (!name || !amount || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    const budget = await db.budget.create({
      data: {
        name,
        amount: parseFloat(amount),
        currency,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        organizationId: organizationId || null,
        projectName: projectName || null,
        description: description || null,
      },
    });

    return NextResponse.json({ budget });
  } catch (error: any) {
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create budget" },
      { status: 500 }
    );
  }
}

import { db } from "@/lib/db";

// 예산 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 예산 조회 (조직별 또는 사용자가 속한 조직)
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

    // 각 예산의 사용률 계산
    const budgetsWithUsage = await Promise.all(
      budgets.map(async (budget) => {
        // 예산 기간 내 구매내역 조회
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

        // 총 사용 금액 계산
        const totalSpent = purchaseRecords.reduce(
          (sum, record) => sum + (record.amount || 0),
          0
        );

        // 사용률 계산
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

// 예산 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      amount,
      currency = "KRW",
      periodStart,
      periodEnd,
      organizationId,
      projectName,
      description,
    } = body;

    if (!name || !amount || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    const budget = await db.budget.create({
      data: {
        name,
        amount: parseFloat(amount),
        currency,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        organizationId: organizationId || null,
        projectName: projectName || null,
        description: description || null,
      },
    });

    return NextResponse.json({ budget });
  } catch (error: any) {
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create budget" },
      { status: 500 }
    );
  }
}

import { db } from "@/lib/db";

// 예산 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 예산 조회 (조직별 또는 사용자가 속한 조직)
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

    // 각 예산의 사용률 계산
    const budgetsWithUsage = await Promise.all(
      budgets.map(async (budget) => {
        // 예산 기간 내 구매내역 조회
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

        // 총 사용 금액 계산
        const totalSpent = purchaseRecords.reduce(
          (sum, record) => sum + (record.amount || 0),
          0
        );

        // 사용률 계산
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

// 예산 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      amount,
      currency = "KRW",
      periodStart,
      periodEnd,
      organizationId,
      projectName,
      description,
    } = body;

    if (!name || !amount || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    const budget = await db.budget.create({
      data: {
        name,
        amount: parseFloat(amount),
        currency,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        organizationId: organizationId || null,
        projectName: projectName || null,
        description: description || null,
      },
    });

    return NextResponse.json({ budget });
  } catch (error: any) {
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create budget" },
      { status: 500 }
    );
  }
}

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

    // 사용자의 조직 ID 목록 조회
    const userOrganizations = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const userOrgIds = userOrganizations.map((m: { organizationId: string }) => m.organizationId);

    // scopeKey 목록 구성 (사용자 ID 기반 + 조직 ID들)
    const scopeKeys = [
      `user-${session.user.id}`,
      ...userOrgIds,
    ];

    if (organizationId && !scopeKeys.includes(organizationId)) {
      scopeKeys.push(organizationId);
    }

    const budgets = await db.budget.findMany({
      where: {
        scopeKey: { in: scopeKeys },
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

        // scopeKey가 조직 ID인 경우 해당 조직의 구매 기록 조회
        let totalSpent = 0;
        if (!budget.scopeKey.startsWith('user-')) {
          const purchaseRecords = await db.purchaseRecord.findMany({
            where: {
              organizationId: budget.scopeKey,
              purchasedAt: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          });

          totalSpent = purchaseRecords.reduce(
            (sum: number, record: any) => sum + (record.amount || 0),
            0
          );
        }

        const usageRate = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
        const remaining = budget.amount - totalSpent;

        // description에서 name과 projectName 추출
        let name = `${budget.yearMonth} Budget`;
        let projectName = null;
        if (budget.description) {
          const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
          if (nameMatch) {
            name = nameMatch[1];
          }
          const projectMatch = budget.description.match(/프로젝트: ([^|]+)/);
          if (projectMatch) {
            projectName = projectMatch[1].trim();
          }
        }

        return {
          ...budget,
          name,
          projectName,
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
    console.error("[Budget API] Error fetching budgets:", error);
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
    const {
      name,
      amount,
      currency,
      periodStart,
      periodEnd,
      projectName,
      description,
      // Legacy fields (for backward compatibility)
      organizationId,
      yearMonth,
    } = body;

    // 필수 필드 검증 (신규 형식 우선, 레거시 형식도 지원)
    if (!amount) {
      return NextResponse.json(
        { error: "Missing required field: amount" },
        { status: 400 }
      );
    }

    // periodStart에서 yearMonth 추출 또는 직접 yearMonth 사용
    let finalYearMonth: string;
    if (periodStart) {
      // periodStart가 있으면 YYYY-MM 형식으로 변환
      const startDate = new Date(periodStart);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid periodStart date format" },
          { status: 400 }
        );
      }
      finalYearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    } else if (yearMonth) {
      finalYearMonth = yearMonth;
    } else {
      // 둘 다 없으면 현재 월 사용
      const now = new Date();
      finalYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // yearMonth 형식 검증
    const yearMonthRegex = /^\d{4}-\d{2}$/;
    if (!yearMonthRegex.test(finalYearMonth)) {
      return NextResponse.json(
        { error: "Invalid yearMonth format. Use YYYY-MM" },
        { status: 400 }
      );
    }

    // scopeKey 결정: organizationId가 있으면 사용, 없으면 사용자 ID 기반
    let scopeKey = organizationId;

    if (!scopeKey) {
      // 사용자의 조직이 있는지 확인
      const userOrg = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });

      if (userOrg) {
        scopeKey = userOrg.organizationId;
      } else {
        // 조직이 없으면 사용자 ID를 scopeKey로 사용
        scopeKey = `user-${session.user.id}`;
      }
    }

    // 금액을 정수로 변환 (Prisma 스키마에서 Int로 정의됨)
    const amountInt = Math.round(Number(amount));
    if (isNaN(amountInt) || amountInt <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a positive number" },
        { status: 400 }
      );
    }

    // 설명 필드 구성 (name, projectName, description 통합)
    const descriptionParts: string[] = [];
    if (name) descriptionParts.push(`[${name}]`);
    if (projectName) descriptionParts.push(`프로젝트: ${projectName}`);
    if (description) descriptionParts.push(description);
    const finalDescription = descriptionParts.length > 0 ? descriptionParts.join(' | ') : null;

    console.log("[Budget API] Creating budget:", {
      scopeKey,
      yearMonth: finalYearMonth,
      amount: amountInt,
      currency: currency || "KRW",
      description: finalDescription,
    });

    const budget = await db.budget.upsert({
      where: {
        scopeKey_yearMonth: {
          scopeKey,
          yearMonth: finalYearMonth,
        },
      },
      create: {
        scopeKey,
        yearMonth: finalYearMonth,
        amount: amountInt,
        currency: currency || "KRW",
        description: finalDescription,
      },
      update: {
        amount: amountInt,
        currency: currency || "KRW",
        description: finalDescription,
      },
    });

    // 프론트엔드가 기대하는 형식으로 응답 변환
    const [year, month] = finalYearMonth.split("-").map(Number);
    const responseBudget = {
      ...budget,
      name: name || `${finalYearMonth} Budget`,
      periodStart: new Date(year, month - 1, 1).toISOString(),
      periodEnd: new Date(year, month, 0, 23, 59, 59).toISOString(),
      projectName: projectName || null,
    };

    return NextResponse.json({ budget: responseBudget });
  } catch (error) {
    console.error("[Budget API] Error creating budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

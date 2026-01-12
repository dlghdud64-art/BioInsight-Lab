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

    // budgets가 배열이 아닐 경우 빈 배열로 처리
    const budgetsArray = Array.isArray(budgets) ? budgets : [];
    const budgetsWithUsage = await Promise.all(
      budgetsArray.map(async (budget: any) => {
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

    return NextResponse.json({ budgets: Array.isArray(budgetsWithUsage) ? budgetsWithUsage : [] });
  } catch (error) {
    console.error("[Budget API] Error fetching budgets:", error);
    // 에러 발생 시에도 빈 배열 반환하여 프론트엔드 크래시 방지
    return NextResponse.json(
      { budgets: [], error: "Failed to fetch budgets" },
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
      amount: rawAmount,
      currency,
      periodStart,
      periodEnd,
      projectName,
      description,
      // Legacy fields (for backward compatibility)
      organizationId: requestedOrgId,
      yearMonth,
    } = body;

    // 1. 필수 필드 검증 (신규 형식 우선, 레거시 형식도 지원)
    if (!rawAmount && rawAmount !== 0) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다: 금액" },
        { status: 400 }
      );
    }

    // 2. 숫자 포맷팅 처리 (쉼표 제거)
    const cleanAmount = typeof rawAmount === 'string'
      ? rawAmount.replace(/,/g, '')
      : String(rawAmount);

    const numericAmount = Number(cleanAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "금액 형식이 잘못되었습니다. 양수 숫자를 입력해주세요." },
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
        { error: "연월 형식이 잘못되었습니다. YYYY-MM 형식을 사용해주세요." },
        { status: 400 }
      );
    }

    // 3. Team ID 세션에서 주입 (요청 바디를 믿지 않음)
    // scopeKey 결정: 세션에서 사용자의 조직 ID를 가져와 강제 주입
    let scopeKey: string;

    // 사용자의 조직이 있는지 확인
    const userOrg = await db.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (userOrg) {
      // 조직이 있으면 해당 조직 ID 사용 (요청의 organizationId는 무시)
      scopeKey = userOrg.organizationId;
    } else {
      // 조직이 없으면 사용자 ID를 scopeKey로 사용
      scopeKey = `user-${session.user.id}`;
    }

    // 금액을 정수로 변환 (Prisma 스키마에서 Int로 정의됨)
    const amountInt = Math.round(numericAmount);

    // 4. 선택 필드(Optional) 처리
    // description이나 projectName이 빈 문자열("")로 오면 null로 변환
    const sanitizedProjectName = projectName && projectName.trim() !== '' ? projectName.trim() : null;
    const sanitizedDescription = description && description.trim() !== '' ? description.trim() : null;
    const sanitizedName = name && name.trim() !== '' ? name.trim() : null;

    // 설명 필드 구성 (name, projectName, description 통합)
    const descriptionParts: string[] = [];
    if (sanitizedName) descriptionParts.push(`[${sanitizedName}]`);
    if (sanitizedProjectName) descriptionParts.push(`프로젝트: ${sanitizedProjectName}`);
    if (sanitizedDescription) descriptionParts.push(sanitizedDescription);
    const finalDescription = descriptionParts.length > 0 ? descriptionParts.join(' | ') : null;

    if (process.env.NODE_ENV === "development") {
      console.log("[Budget API] Creating budget:", {
        scopeKey,
        yearMonth: finalYearMonth,
        amount: amountInt,
        currency: currency || "KRW",
        description: finalDescription,
      });
    }

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
      name: sanitizedName || `${finalYearMonth} Budget`,
      periodStart: new Date(year, month - 1, 1).toISOString(),
      periodEnd: new Date(year, month, 0, 23, 59, 59).toISOString(),
      projectName: sanitizedProjectName,
    };

    return NextResponse.json({ budget: responseBudget });
  } catch (error) {
    // 5. 상세 에러 메시지 반환
    console.error("[Budget API] Error creating budget:", error);

    // Prisma 에러 처리
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: any };

      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: "이미 해당 기간에 예산이 존재합니다. 기존 예산을 수정하거나 삭제 후 다시 시도해주세요." },
          { status: 409 }
        );
      }

      if (prismaError.code === 'P2003') {
        return NextResponse.json(
          { error: "연결된 데이터를 찾을 수 없습니다. 조직 또는 팀 정보를 확인해주세요." },
          { status: 400 }
        );
      }
    }

    // 일반 에러 처리
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";

    return NextResponse.json(
      {
        error: "예산 저장에 실패했습니다.",
        details: errorMessage,
        hint: "입력한 데이터를 확인하고 다시 시도해주세요. 문제가 계속되면 관리자에게 문의하세요."
      },
      { status: 500 }
    );
  }
}

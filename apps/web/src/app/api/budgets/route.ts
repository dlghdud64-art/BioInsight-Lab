import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterOrgId = searchParams.get("organizationId");

    // ── 1. 사용자가 속한 조직 ID 목록 확보 (서버 세션 기반, 위변조 불가) ──────
    let userOrgIds: string[] = [];
    try {
      const memberships = await db.organizationMember.findMany({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      userOrgIds = memberships.map((m: { organizationId: string }) => m.organizationId);
    } catch (orgErr: any) {
      console.warn("[Budget API] organizationMember lookup failed:", orgErr?.message);
    }

    // ── 2. 쿼리 필터: organizationId 1순위(데이터 격리) + 레거시 scopeKey 병행 ──
    // 쿼리 파라미터로 특정 조직 필터링 시, 본인이 속한 조직인지 서버에서 검증
    let allowedOrgIds = userOrgIds;
    if (filterOrgId) {
      if (!userOrgIds.includes(filterOrgId)) {
        return NextResponse.json({ budgets: [] }); // 소속 조직이 아니면 빈 배열 반환
      }
      allowedOrgIds = [filterOrgId];
    }

    // 레거시 scopeKey 목록 (개인 예산 + 조직 예산)
    const scopeKeys = [
      `user-${session.user.id}`,
      ...userOrgIds,
    ];

    // ── 3. 데이터 격리: organizationId가 있으면 organizationId 기반, 없으면 scopeKey 기반 ──
    const budgets = await db.budget.findMany({
      where: {
        OR: [
          // 신규: organizationId 컬럼 기반 필터 (정확한 데이터 격리)
          ...(allowedOrgIds.length > 0 ? [{ organizationId: { in: allowedOrgIds } }] : []),
          // 레거시: scopeKey 기반 (개인 예산 + 아직 organizationId 없는 구버전 레코드)
          { scopeKey: { in: scopeKeys }, organizationId: null },
        ],
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
        // 기본 기간: yearMonth 기반 월 경계
        let periodStart = new Date(year, month - 1, 1);
        let periodEnd = new Date(year, month, 0, 23, 59, 59);

        // description에서 name, projectName, 정확한 period 날짜 추출
        let name = `${budget.yearMonth} Budget`;
        let projectName = null;
        if (budget.description) {
          const nameMatch = budget.description.match(/^\[([^\]]+)\]/);
          if (nameMatch) name = nameMatch[1];
          const projectMatch = budget.description.match(/프로젝트: ([^|]+)/);
          if (projectMatch) projectName = projectMatch[1].trim().replace(/\|.*$/, "").trim();
          // 저장된 정확한 날짜가 있으면 우선 사용
          const periodMatch = budget.description.match(/period:(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/);
          if (periodMatch) {
            periodStart = new Date(periodMatch[1]);
            periodEnd = new Date(periodMatch[2] + "T23:59:59");
          }
        }

        // 모든 예산 유형(개인/조직)에 대해 PurchaseRecord 사용액 계산
        // user-{userId} 형식이면 userId 추출, 아니면 scopeKey 그대로 사용
        const purchaseScopeKey = budget.scopeKey.startsWith("user-")
          ? budget.scopeKey.slice("user-".length)
          : budget.scopeKey;

        const purchaseRecords = await db.purchaseRecord.findMany({
          where: {
            OR: [
              { scopeKey: purchaseScopeKey },
              { scopeKey: budget.scopeKey },
            ],
            purchasedAt: { gte: periodStart, lte: periodEnd },
          },
          select: { amount: true },
        });

        const totalSpent = purchaseRecords.reduce(
          (sum: number, record: any) => sum + (record.amount || 0),
          0
        );
        const usageRate = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
        const remaining = budget.amount - totalSpent;

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

    // 1. Request Body 로깅 (디버깅용)
    console.log("[Budget API] POST Request Body:", JSON.stringify(body, null, 2));
    console.log("[Budget API] Session User ID:", session.user.id);

    const {
      name,
      amount: rawAmount,
      currency,
      periodStart,
      periodEnd,
      projectName,
      description,
      teamId,
      // organizationId를 body에서 받더라도 서버 세션으로 덮어씌움 (위변조 방지)
      yearMonth,
    } = body;

    // ── [RBAC] organizationId는 body에서 받지 않고 서버 세션에서 추출 ──────────
    // 예산안 생성은 VIEWER를 제외한 모든 역할이 가능 (create ≠ approve)
    // 활성화/승인/종료는 OWNER/ADMIN만 가능 (별도 API)
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
      orderBy: { createdAt: "asc" }, // 가장 먼저 가입한 조직 우선
    });

    const isPersonalBudget = !membership; // 조직 소속 없음 → 개인 예산

    if (membership) {
      // VIEWER만 생성 불가, 나머지(REQUESTER/APPROVER/ADMIN/OWNER)는 생성 가능
      if (membership.role === OrganizationRole.VIEWER) {
        return NextResponse.json(
          { error: "예산안을 생성하려면 REQUESTER 이상의 역할이 필요합니다." },
          { status: 403 }
        );
      }
    }

    // 서버에서 결정된 organizationId (body의 값 무시 — 위변조 방지)
    const resolvedOrganizationId: string | null = membership?.organizationId ?? null;

    // 1. 필수 필드 검증 (신규 형식 우선, 레거시 형식도 지원)
    if (!rawAmount && rawAmount !== 0) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다: 금액" },
        { status: 400 }
      );
    }

    // 2. 숫자 포맷팅 처리 (쉼표 제거 및 안전한 변환)
    console.log("[Budget API] Raw Amount Type:", typeof rawAmount, "Value:", rawAmount);

    let numericAmount: number;
    if (typeof rawAmount === 'number') {
      numericAmount = rawAmount;
    } else if (typeof rawAmount === 'string') {
      const cleanAmount = rawAmount.replace(/,/g, '');
      numericAmount = Number(cleanAmount);
    } else {
      numericAmount = Number(String(rawAmount).replace(/,/g, ''));
    }

    // 한 번 더 Number()로 감싸서 안전하게 처리
    numericAmount = Number(numericAmount);

    console.log("[Budget API] Parsed Amount:", numericAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error("[Budget API] Invalid amount:", { rawAmount, numericAmount });
      return NextResponse.json(
        { error: "금액 형식이 잘못되었습니다. 양수 숫자를 입력해주세요.", receivedAmount: rawAmount },
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

    // 3. scopeKey 결정: 서버 세션 기반 organizationId → body의 값은 무시 (위변조 방지)
    const scopeKey: string = resolvedOrganizationId ?? `user-${session.user.id}`;
    console.log("[Budget API] Server-resolved scopeKey:", scopeKey, "organizationId:", resolvedOrganizationId);

    // teamId 검증: 해당 팀이 실제로 이 조직에 속하는지 확인
    let resolvedTeamId: string | null = null;
    if (teamId && resolvedOrganizationId) {
      const team = await db.team.findFirst({
        where: { id: teamId, organizationId: resolvedOrganizationId },
        select: { id: true },
      });
      resolvedTeamId = team?.id ?? null;
    }

    // 금액을 정수로 변환 (Prisma 스키마에서 Int로 정의됨)
    const amountInt = Math.round(numericAmount);

    // 4. 선택 필드(Optional) 처리
    // description이나 projectName이 빈 문자열("")로 오면 null로 변환
    const sanitizedProjectName = projectName && projectName.trim() !== '' ? projectName.trim() : null;
    const sanitizedDescription = description && description.trim() !== '' ? description.trim() : null;
    const sanitizedName = name && name.trim() !== '' ? name.trim() : null;

    // 설명 필드 구성 (name, projectName, 정확한 기간, description 통합)
    const descriptionParts: string[] = [];
    if (sanitizedName) descriptionParts.push(`[${sanitizedName}]`);
    if (sanitizedProjectName) descriptionParts.push(`프로젝트: ${sanitizedProjectName}`);
    // 정확한 기간 날짜 저장 (periodStart~periodEnd)
    if (periodStart || periodEnd) {
      const ps = periodStart ?? `${finalYearMonth}-01`;
      const [pyear, pmonth] = finalYearMonth.split('-').map(Number);
      const lastDayNum = new Date(pyear, pmonth, 0).getDate();
      const defaultEnd = `${finalYearMonth}-${String(lastDayNum).padStart(2, '0')}`;
      const pe = periodEnd ?? defaultEnd;
      descriptionParts.push(`period:${ps}~${pe}`);
    }
    if (sanitizedDescription) descriptionParts.push(sanitizedDescription);
    const finalDescription = descriptionParts.length > 0 ? descriptionParts.join(' | ') : null;

    console.log("[Budget API] Creating budget with data:", {
      scopeKey,
      yearMonth: finalYearMonth,
      amount: amountInt,
      currency: currency || "KRW",
      description: finalDescription,
      name: sanitizedName,
      projectName: sanitizedProjectName,
    });

    // upsert 대신 findFirst + create/update 방식 사용 (복합 유니크 키 의존성 제거)
    const existing = await db.budget.findFirst({
      where: { scopeKey, yearMonth: finalYearMonth },
    });

    let budget;
    if (existing) {
      budget = await db.budget.update({
        where: { id: existing.id },
        data: {
          organizationId: resolvedOrganizationId,
          teamId: resolvedTeamId,
          amount: amountInt,
          currency: currency || "KRW",
          description: finalDescription,
        },
      });
    } else {
      budget = await db.budget.create({
        data: {
          organizationId: resolvedOrganizationId,  // 서버 세션에서 주입 (위변조 방지)
          teamId: resolvedTeamId,
          scopeKey,
          yearMonth: finalYearMonth,
          amount: amountInt,
          currency: currency || "KRW",
          description: finalDescription,
        },
      });
    }

    // 프론트엔드가 기대하는 형식으로 응답 변환
    const [year, month] = finalYearMonth.split("-").map(Number);
    const responsePeriodStart = periodStart
      ? new Date(periodStart).toISOString()
      : new Date(year, month - 1, 1).toISOString();
    const responsePeriodEnd = periodEnd
      ? new Date(periodEnd + "T23:59:59").toISOString()
      : new Date(year, month, 0, 23, 59, 59).toISOString();
    const responseBudget = {
      ...budget,
      name: sanitizedName || `${finalYearMonth} Budget`,
      periodStart: responsePeriodStart,
      periodEnd: responsePeriodEnd,
      projectName: sanitizedProjectName,
    };

    return NextResponse.json({ budget: responseBudget });
  } catch (error) {
    // 5. 상세 에러 메시지 반환
    console.error("[Budget API] ========== ERROR START ==========");
    console.error("[Budget API] Error Type:", typeof error);
    console.error("[Budget API] Error Object:", error);
    if (error instanceof Error) {
      console.error("[Budget API] Error Message:", error.message);
      console.error("[Budget API] Error Stack:", error.stack);
    }
    console.error("[Budget API] ========== ERROR END ==========");

    // Prisma 에러 처리
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: any };

      console.error("[Budget API] Prisma Error Code:", prismaError.code);
      console.error("[Budget API] Prisma Error Meta:", prismaError.meta);

      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          {
            error: "이미 해당 기간에 예산이 존재합니다. 기존 예산을 수정하거나 삭제 후 다시 시도해주세요.",
            code: prismaError.code
          },
          { status: 409 }
        );
      }

      if (prismaError.code === 'P2003') {
        return NextResponse.json(
          {
            error: "연결된 데이터를 찾을 수 없습니다. 조직 또는 팀 정보를 확인해주세요.",
            code: prismaError.code,
            meta: prismaError.meta
          },
          { status: 400 }
        );
      }

      // 기타 Prisma 에러
      return NextResponse.json(
        {
          error: "데이터베이스 작업 중 오류가 발생했습니다.",
          details: prismaError.code,
          meta: prismaError.meta
        },
        { status: 500 }
      );
    }

    // 일반 에러 처리
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: "예산 저장에 실패했습니다.",
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        hint: "입력한 데이터를 확인하고 다시 시도해주세요. 문제가 계속되면 관리자에게 문의하세요."
      },
      { status: 500 }
    );
  }
}

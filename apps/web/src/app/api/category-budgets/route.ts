/**
 * /api/category-budgets
 *
 * 카테고리별 예산 한도 CRUD (목록 조회 + 생성)
 * - GET: 조직의 카테고리별 예산 한도 목록
 * - POST: 카테고리별 예산 한도 설정 (ADMIN/OWNER)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { createCategoryBudgetSchema } from "@/lib/budget/spending-category-schema";

// ── GET: 카테고리별 예산 한도 목록 ──
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const yearMonth = searchParams.get("yearMonth");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId는 필수입니다." },
        { status: 400 },
      );
    }

    // 조직 멤버 확인
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId },
    });
    if (!membership) {
      return NextResponse.json({ error: "조직 멤버가 아닙니다." }, { status: 403 });
    }

    const where: any = {
      organizationId,
      isActive: true,
    };
    if (yearMonth) {
      where.yearMonth = yearMonth;
    }

    const budgets = await db.categoryBudget.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            displayName: true,
            color: true,
            icon: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ yearMonth: "desc" }, { category: { sortOrder: "asc" } }],
    });

    return NextResponse.json({ budgets });
  } catch (error) {
    console.error("Error fetching category budgets:", error);
    return NextResponse.json(
      { error: "카테고리 예산을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

// ── POST: 카테고리별 예산 한도 설정 ──
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, ...budgetData } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId는 필수입니다." },
        { status: 400 },
      );
    }

    const parsed = createCategoryBudgetSchema.safeParse(budgetData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // 임계치 순서 검증: warning < softLimit < hardStop
    if (
      parsed.data.warningPercent >= parsed.data.softLimitPercent ||
      parsed.data.softLimitPercent > parsed.data.hardStopPercent
    ) {
      return NextResponse.json(
        { error: "임계치 순서가 올바르지 않습니다: 경고 < 소프트 리밋 ≤ 하드 스톱" },
        { status: 400 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "budget_create",
      targetEntityType: "budget",
      targetEntityId: `${parsed.data.categoryId}-${parsed.data.yearMonth}`,
      sourceSurface: "category-budget-api",
      routePath: "/api/category-budgets",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // ADMIN 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId },
    });
    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      enforcement.fail();
      return NextResponse.json(
        { error: "예산 관리는 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    // 카테고리 존재 확인
    const category = await db.spendingCategory.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!category || category.organizationId !== organizationId) {
      enforcement.fail();
      return NextResponse.json(
        { error: "해당 카테고리를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // upsert: 동일 org + category + yearMonth가 있으면 update
    const budget = await db.categoryBudget.upsert({
      where: {
        organizationId_categoryId_yearMonth: {
          organizationId,
          categoryId: parsed.data.categoryId,
          yearMonth: parsed.data.yearMonth,
        },
      },
      create: {
        organizationId,
        categoryId: parsed.data.categoryId,
        yearMonth: parsed.data.yearMonth,
        amount: parsed.data.amount,
        currency: parsed.data.currency ?? "KRW",
        warningPercent: parsed.data.warningPercent,
        softLimitPercent: parsed.data.softLimitPercent,
        hardStopPercent: parsed.data.hardStopPercent,
        controlRules: parsed.data.controlRules ?? ["warning", "soft_limit", "hard_stop"],
        isActive: true,
      },
      update: {
        amount: parsed.data.amount,
        warningPercent: parsed.data.warningPercent,
        softLimitPercent: parsed.data.softLimitPercent,
        hardStopPercent: parsed.data.hardStopPercent,
        controlRules: parsed.data.controlRules ?? undefined,
        isActive: true,
      },
      include: {
        category: {
          select: { id: true, name: true, displayName: true, color: true },
        },
      },
    });

    enforcement.complete({
      afterState: {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        yearMonth: budget.yearMonth,
        amount: budget.amount,
      },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating category budget:", error);
    return NextResponse.json(
      { error: "카테고리 예산 설정에 실패했습니다." },
      { status: 500 },
    );
  }
}

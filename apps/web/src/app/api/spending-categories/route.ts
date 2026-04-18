/**
 * /api/spending-categories
 *
 * 지출 카테고리 CRUD (목록 조회 + 생성)
 * - GET: 조직의 활성 카테고리 목록
 * - POST: 새 카테고리 생성 (ADMIN/OWNER만)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import {
  createSpendingCategorySchema,
  DEFAULT_SPENDING_CATEGORIES,
} from "@/lib/budget/spending-category-schema";

// ── GET: 카테고리 목록 조회 ──
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const includeInactive = searchParams.get("includeInactive") === "true";

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

    const categories = await db.spendingCategory.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        budgets: {
          where: { isActive: true },
          orderBy: { yearMonth: "desc" },
          take: 1, // 최신 예산만
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching spending categories:", error);
    return NextResponse.json(
      { error: "카테고리 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

// ── POST: 카테고리 생성 ──
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, ...categoryData } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId는 필수입니다." },
        { status: 400 },
      );
    }

    // 입력 검증
    const parsed = createSpendingCategorySchema.safeParse(categoryData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // 보안 enforcement
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "budget_create",
      targetEntityType: "budget",
      targetEntityId: "new-spending-category",
      sourceSurface: "spending-category-api",
      routePath: "/api/spending-categories",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 조직 멤버 + ADMIN 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId },
    });
    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      enforcement.fail();
      return NextResponse.json(
        { error: "카테고리 관리는 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    // 중복 확인
    const existing = await db.spendingCategory.findUnique({
      where: { organizationId_name: { organizationId, name: parsed.data.name } },
    });
    if (existing) {
      enforcement.fail();
      return NextResponse.json(
        { error: `"${parsed.data.name}" 카테고리가 이미 존재합니다.` },
        { status: 409 },
      );
    }

    const category = await db.spendingCategory.create({
      data: {
        organizationId,
        ...parsed.data,
        color: parsed.data.color ?? "#6366f1",
      },
    });

    enforcement.complete({
      afterState: { categoryId: category.id, name: category.name },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating spending category:", error);
    return NextResponse.json(
      { error: "카테고리 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}

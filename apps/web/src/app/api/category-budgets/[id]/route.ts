/**
 * /api/category-budgets/[id]
 *
 * 개별 카테고리 예산 수정/삭제
 * - PATCH: 예산 한도 수정 (ADMIN/OWNER)
 * - DELETE: 예산 비활성화 (ADMIN/OWNER)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { updateCategoryBudgetSchema } from "@/lib/budget/spending-category-schema";

// ── PATCH: 예산 수정 ──
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id: budgetId } = await params;
    const body = await request.json();

    const parsed = updateCategoryBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "budget_update",
      targetEntityType: "budget",
      targetEntityId: budgetId,
      sourceSurface: "category-budget-api",
      routePath: "/api/category-budgets/[id]",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const budget = await db.categoryBudget.findUnique({
      where: { id: budgetId },
    });
    if (!budget) {
      enforcement.fail();
      return NextResponse.json({ error: "예산을 찾을 수 없습니다." }, { status: 404 });
    }

    // ADMIN 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: budget.organizationId },
    });
    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      enforcement.fail();
      return NextResponse.json(
        { error: "예산 관리는 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    // 임계치 순서 검증 (변경된 값 + 기존 값 결합)
    const w = parsed.data.warningPercent ?? budget.warningPercent;
    const s = parsed.data.softLimitPercent ?? budget.softLimitPercent;
    const h = parsed.data.hardStopPercent ?? budget.hardStopPercent;
    if (w >= s || s > h) {
      enforcement.fail();
      return NextResponse.json(
        { error: "임계치 순서가 올바르지 않습니다: 경고 < 소프트 리밋 ≤ 하드 스톱" },
        { status: 400 },
      );
    }

    const beforeState = {
      amount: budget.amount,
      warningPercent: budget.warningPercent,
      softLimitPercent: budget.softLimitPercent,
      hardStopPercent: budget.hardStopPercent,
    };

    const updated = await db.categoryBudget.update({
      where: { id: budgetId },
      data: parsed.data,
      include: {
        category: {
          select: { id: true, name: true, displayName: true, color: true },
        },
      },
    });

    enforcement.complete({
      beforeState,
      afterState: {
        amount: updated.amount,
        warningPercent: updated.warningPercent,
        softLimitPercent: updated.softLimitPercent,
        hardStopPercent: updated.hardStopPercent,
      },
    });

    return NextResponse.json({ budget: updated });
  } catch (error) {
    enforcement?.fail();
    console.error("Error updating category budget:", error);
    return NextResponse.json(
      { error: "예산 수정에 실패했습니다." },
      { status: 500 },
    );
  }
}

// ── DELETE: 예산 비활성화 ──
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id: budgetId } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "budget_delete",
      targetEntityType: "budget",
      targetEntityId: budgetId,
      sourceSurface: "category-budget-api",
      routePath: "/api/category-budgets/[id]",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const budget = await db.categoryBudget.findUnique({
      where: { id: budgetId },
    });
    if (!budget) {
      enforcement.fail();
      return NextResponse.json({ error: "예산을 찾을 수 없습니다." }, { status: 404 });
    }

    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: budget.organizationId },
    });
    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      enforcement.fail();
      return NextResponse.json(
        { error: "예산 관리는 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    const deactivated = await db.categoryBudget.update({
      where: { id: budgetId },
      data: { isActive: false },
    });

    enforcement.complete({
      beforeState: { isActive: true },
      afterState: { isActive: false },
    });

    return NextResponse.json({ budget: deactivated });
  } catch (error) {
    enforcement?.fail();
    console.error("Error deleting category budget:", error);
    return NextResponse.json(
      { error: "예산 삭제에 실패했습니다." },
      { status: 500 },
    );
  }
}

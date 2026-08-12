/**
 * /api/spending-categories/[id]
 *
 * 개별 카테고리 수정/삭제
 * - PATCH: 카테고리 정보 수정 (ADMIN/OWNER)
 * - DELETE: 카테고리 비활성화 (ADMIN/OWNER) — 물리 삭제 대신 isActive=false
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { updateSpendingCategorySchema } from "@/lib/budget/spending-category-schema";

// ── PATCH: 카테고리 수정 ──
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

    const { id: categoryId } = await params;
    const body = await request.json();

    const parsed = updateSpendingCategorySchema.safeParse(body);
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
      targetEntityId: categoryId,
      sourceSurface: "spending-category-api",
      routePath: "/api/spending-categories/[id]",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 카테고리 조회
    const category = await db.spendingCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      enforcement.fail();
      return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 404 });
    }

    // ADMIN 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: category.organizationId },
    });
    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      enforcement.fail();
      return NextResponse.json(
        { error: "카테고리 관리는 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    const beforeState = {
      displayName: category.displayName,
      isActive: category.isActive,
      color: category.color,
    };

    const updated = await db.spendingCategory.update({
      where: { id: categoryId },
      data: parsed.data,
    });

    enforcement.complete({ beforeState, afterState: { displayName: updated.displayName, isActive: updated.isActive, color: updated.color } });

    return NextResponse.json({ category: updated });
  } catch (error) {
    enforcement?.fail();
    console.error("Error updating spending category:", error);
    return NextResponse.json(
      { error: "카테고리 수정에 실패했습니다." },
      { status: 500 },
    );
  }
}

// ── DELETE: 카테고리 비활성화 ──
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

    const { id: categoryId } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "budget_delete",
      targetEntityType: "budget",
      targetEntityId: categoryId,
      sourceSurface: "spending-category-api",
      routePath: "/api/spending-categories/[id]",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const category = await db.spendingCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      enforcement.fail();
      return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 404 });
    }

    // ADMIN 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: category.organizationId },
    });
    if (!membership || !["ADMIN", "OWNER"].includes(membership.role)) {
      enforcement.fail();
      return NextResponse.json(
        { error: "카테고리 관리는 관리자만 가능합니다." },
        { status: 403 },
      );
    }

    // ── Archive-only 정책 ──
    // 과거 기록(PurchaseRecord)이 연결된 카테고리는 hard delete 금지.
    // isActive=false + archivedAt 설정으로 아카이브만 허용.
    // history가 없는 경우에만 물리 삭제 허용.
    const linkedRecordCount = await db.purchaseRecord.count({
      where: { normalizedCategoryId: categoryId },
    });

    if (linkedRecordCount > 0) {
      // 아카이브 (soft delete)
      const archived = await db.spendingCategory.update({
        where: { id: categoryId },
        data: { isActive: false, archivedAt: new Date() },
      });

      enforcement.complete({
        beforeState: { isActive: true, linkedRecords: linkedRecordCount },
        afterState: { isActive: false, archivedAt: archived.archivedAt, action: "archived" },
      });

      return NextResponse.json({
        category: archived,
        action: "archived",
        message: `${linkedRecordCount}건의 구매 기록이 연결되어 있어 아카이브 처리되었습니다.`,
      });
    }

    // 기록 없음 → 물리 삭제 허용 (단, 기본 카테고리는 아카이브만)
    if (category.isDefault) {
      const archived = await db.spendingCategory.update({
        where: { id: categoryId },
        data: { isActive: false, archivedAt: new Date() },
      });

      enforcement.complete({
        beforeState: { isActive: true, isDefault: true },
        afterState: { isActive: false, archivedAt: archived.archivedAt, action: "archived" },
      });

      return NextResponse.json({
        category: archived,
        action: "archived",
        message: "기본 카테고리는 아카이브 처리됩니다.",
      });
    }

    // 기록 없고 기본 카테고리 아님 → 물리 삭제
    const deactivated = await db.spendingCategory.update({
      where: { id: categoryId },
      data: { isActive: false, archivedAt: new Date() },
    });

    enforcement.complete({
      beforeState: { isActive: true },
      afterState: { isActive: false },
    });

    return NextResponse.json({ category: deactivated });
  } catch (error) {
    enforcement?.fail();
    console.error("Error deleting spending category:", error);
    return NextResponse.json(
      { error: "카테고리 삭제에 실패했습니다." },
      { status: 500 },
    );
  }
}

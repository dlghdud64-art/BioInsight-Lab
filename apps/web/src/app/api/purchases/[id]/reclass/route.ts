import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { withSerializableBudgetTx } from "@/lib/budget/budget-concurrency";
import {
  releaseCategoryReclass,
  releaseEventToAuditShape,
  NegativeCommittedSpendError,
} from "@/lib/budget/category-budget-release";

/**
 * POST /api/purchases/[id]/reclass
 *
 * PurchaseRecord 카테고리 재분류.
 *
 * 기존 카테고리에서 예산 해제 + 새 카테고리에 예산 적용.
 * 원래 reserve가 기록된 period_key(yearMonth) 안에서 처리한다.
 * "현재 월로 이동"이 아니라 원본 reserve의 yearMonth를 그대로 사용.
 *
 * - SERIALIZABLE tx로 정합성 보장
 * - PurchaseRecord.normalizedCategoryId 업데이트
 * - budgetEventKey로 idempotent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id: recordId } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "purchase_record_reclass",
      targetEntityType: "purchase_record",
      targetEntityId: recordId,
      sourceSurface: "purchase-reclass-api",
      routePath: "/api/purchases/[id]/reclass",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await req.json();
    const { toCategoryId, reason } = body as {
      toCategoryId?: string;
      reason?: string;
    };

    if (!toCategoryId) {
      enforcement.fail();
      return NextResponse.json(
        { error: "toCategoryId는 필수입니다." },
        { status: 400 },
      );
    }

    // ── Pre-tx 조회 ──
    const record = await db.purchaseRecord.findUnique({
      where: { id: recordId },
      include: {
        workspace: {
          select: { organizationId: true },
        },
        quote: {
          select: {
            purchaseRequest: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!record) {
      enforcement.fail();
      return NextResponse.json({ error: "구매 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    // 같은 카테고리로 재분류 시 무시
    if (record.normalizedCategoryId === toCategoryId) {
      return NextResponse.json({
        success: true,
        message: "이미 같은 카테고리입니다. 변경 사항이 없습니다.",
        recordId,
        categoryId: toCategoryId,
      });
    }

    // 새 카테고리 존재 확인
    const targetCategory = await db.spendingCategory.findUnique({
      where: { id: toCategoryId },
    });

    if (!targetCategory) {
      enforcement.fail();
      return NextResponse.json({ error: "대상 카테고리를 찾을 수 없습니다." }, { status: 404 });
    }

    const orgId = record.workspaceId
      ? (record.workspace as any)?.organizationId
      : record.scopeKey;

    // requestId 확인 — reserve 참조용
    const requestId =
      (record.quote as any)?.purchaseRequest?.id ?? recordId;

    if (!orgId) {
      enforcement.fail();
      return NextResponse.json({ error: "조직 정보를 확인할 수 없습니다." }, { status: 400 });
    }

    // ── SERIALIZABLE tx: 재분류 + 예산 이동 ──
    const result = await withSerializableBudgetTx(db, async (tx: any) => {
      const releaseEvent = await releaseCategoryReclass(tx, {
        organizationId: orgId,
        recordId,
        requestId,
        toCategoryId,
        executedBy: session.user.id,
        reason: reason ?? `Category reclass to ${targetCategory.displayName ?? toCategoryId}`,
      });

      return { releaseEvent };
    }, { label: "category_reclass" });

    // ── Audit ──
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const actorRole = await getActorRole(session.user.id, orgId);
    await createActivityLog({
      activityType: "PURCHASE_RECORD_RECLASSIFIED",
      entityType: "PURCHASE_RECORD",
      entityId: recordId,
      beforeStatus: record.normalizedCategoryId ?? "uncategorized",
      afterStatus: toCategoryId,
      userId: session.user.id,
      organizationId: orgId,
      actorRole,
      metadata: {
        fromCategoryId: record.normalizedCategoryId,
        toCategoryId,
        amount: record.amount,
        reason: reason ?? null,
      },
      ipAddress,
      userAgent,
    });

    enforcement.complete({
      beforeState: {
        recordId,
        categoryId: record.normalizedCategoryId,
      },
      afterState: {
        recordId,
        categoryId: toCategoryId,
        ...(result.releaseEvent && {
          budgetReclass: releaseEventToAuditShape(result.releaseEvent),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `카테고리가 ${targetCategory.displayName ?? toCategoryId}(으)로 재분류되었습니다.`,
      recordId,
      fromCategoryId: record.normalizedCategoryId,
      toCategoryId,
      budgetMoved: result.releaseEvent
        ? result.releaseEvent.releaseItems.map((item: any) => ({
            categoryId: item.categoryId,
            yearMonth: item.yearMonth,
            amount: item.amount,
          }))
        : [],
    });
  } catch (error) {
    enforcement?.fail();

    if (error instanceof NegativeCommittedSpendError) {
      console.error("[Reclass] Negative committed spend:", error.message);
      return NextResponse.json(
        { error: "예산 이동 중 정합성 오류가 발생했습니다.", detail: error.message },
        { status: 409 },
      );
    }

    console.error("[Reclass] Error:", error);
    return NextResponse.json(
      { error: "카테고리 재분류 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

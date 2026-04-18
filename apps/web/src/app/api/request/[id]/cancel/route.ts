import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { withSerializableBudgetTx } from "@/lib/budget/budget-concurrency";
import {
  releaseRequestCancelled,
  releaseEventToAuditShape,
  NegativeCommittedSpendError,
} from "@/lib/budget/category-budget-release";
import {
  recordMutationAudit,
  buildAuditEventKey,
} from "@/lib/audit/durable-mutation-audit";

/**
 * POST /api/request/[id]/cancel
 *
 * 승인된 구매 요청 취소 (APPROVED → CANCELLED).
 *
 * - SERIALIZABLE tx로 예산 release 실행
 * - 원본 reserve BudgetEvent를 참조하여 정확히 같은 amount/categoryId/yearMonth 해제
 * - budgetEventKey로 idempotent — 동일 취소 요청이 두 번 들어와도 금액이 두 번 풀리지 않음
 * - 관련 Order도 CANCELLED로 전환
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

    const { id: requestId } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "purchase_request_cancel",
      targetEntityType: "approval",
      targetEntityId: requestId,
      sourceSurface: "request-cancel-api",
      routePath: "/api/request/[id]/cancel",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await req.json().catch(() => ({}));
    const reason = (body as any)?.reason as string | undefined;

    // ── Pre-tx 조회 ──
    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        team: {
          include: {
            organization: { select: { id: true, timezone: true } },
          },
        },
        order: { select: { id: true, status: true } },
      },
    });

    if (!purchaseRequest) {
      enforcement.fail();
      return NextResponse.json({ error: "구매 요청을 찾을 수 없습니다." }, { status: 404 });
    }

    // APPROVED 상태만 취소 가능 (PENDING은 reject로 처리)
    if (purchaseRequest.status !== PurchaseRequestStatus.APPROVED) {
      enforcement.fail();
      return NextResponse.json(
        { error: `현재 상태(${purchaseRequest.status})에서는 취소할 수 없습니다. APPROVED 상태만 취소 가능합니다.` },
        { status: 400 },
      );
    }

    // 권한 확인: ADMIN만
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: purchaseRequest.teamId || "",
        },
      },
    });

    if (!teamMember || teamMember.role !== TeamRole.ADMIN) {
      enforcement.fail();
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const orgId = purchaseRequest.team?.organizationId;

    // ── SERIALIZABLE tx: 취소 + 예산 release ──
    const result = await withSerializableBudgetTx(db, async (tx: any) => {
      // 1. PurchaseRequest → CANCELLED
      const cancelled = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: PurchaseRequestStatus.CANCELLED,
        },
      });

      // 2. 연결된 Order → CANCELLED (있으면)
      if (purchaseRequest.orderId) {
        await tx.order.update({
          where: { id: purchaseRequest.orderId },
          data: { status: "CANCELLED" },
        });
      }

      // 3. 예산 release — 원본 reserve 참조
      let releaseEvent = undefined;
      if (orgId) {
        releaseEvent = await releaseRequestCancelled(tx, {
          organizationId: orgId,
          requestId,
          executedBy: session.user.id,
          reason: reason ?? "Request cancelled after approval",
        });
      }

      // 4. Durable audit event — 같은 SERIALIZABLE tx 안에서 기록
      await recordMutationAudit(tx, {
        auditEventKey: buildAuditEventKey(
          orgId || 'no-org', requestId, 'purchase_request_cancel',
        ),
        orgId: orgId || 'no-org',
        actorId: session.user.id,
        route: '/api/request/[id]/cancel',
        action: 'purchase_request_cancel',
        entityType: 'purchase_request',
        entityId: requestId,
        result: 'success',
        correlationId: enforcement!.correlationId,
        requestId,
        orderId: purchaseRequest.orderId ?? undefined,
        amount: releaseEvent?.releaseItems?.[0]?.amount,
        normalizedCategoryId: releaseEvent?.releaseItems?.[0]?.categoryId ?? undefined,
        periodKey: releaseEvent?.releaseItems?.[0]?.periodKey,
        decisionBasis: releaseEvent ? { releaseItems: releaseEvent.releaseItems } : undefined,
      });

      return { cancelled, releaseEvent };
    }, { label: "request_cancel_release" });

    // ── Audit ──
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const actorRole = await getActorRole(session.user.id, orgId);
    await createActivityLog({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activityType: "PURCHASE_REQUEST_CANCELLED" as any, // schema 추가됨, prisma generate 대기
      entityType: "PURCHASE_REQUEST",
      entityId: requestId,
      beforeStatus: "APPROVED",
      afterStatus: "CANCELLED",
      userId: session.user.id,
      organizationId: orgId,
      actorRole,
      metadata: {
        reason: reason ?? null,
        orderId: purchaseRequest.orderId ?? null,
        budgetRelease: result.releaseEvent
          ? { itemCount: result.releaseEvent.releaseItems.length }
          : null,
      },
      ipAddress,
      userAgent,
    });

    enforcement.complete({
      beforeState: { status: "APPROVED", requestId },
      afterState: {
        status: "CANCELLED",
        requestId,
        ...(result.releaseEvent && {
          budgetRelease: releaseEventToAuditShape(result.releaseEvent),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "구매 요청이 취소되었습니다. 예약된 예산이 해제되었습니다.",
      purchaseRequest: result.cancelled,
      budgetReleased: result.releaseEvent
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
      console.error("[Request Cancel] Negative committed spend:", error.message);
      return NextResponse.json(
        { error: "예산 해제 중 정합성 오류가 발생했습니다.", detail: error.message },
        { status: 409 },
      );
    }

    console.error("[Request Cancel] Error:", error);
    return NextResponse.json(
      { error: "구매 요청 취소 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

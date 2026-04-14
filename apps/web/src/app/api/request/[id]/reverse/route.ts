import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { withSerializableBudgetTx } from "@/lib/budget/budget-concurrency";
import {
  releaseApprovalReversed,
  releaseEventToAuditShape,
  NegativeCommittedSpendError,
} from "@/lib/budget/category-budget-release";
import {
  recordMutationAudit,
  buildAuditEventKey,
} from "@/lib/audit/durable-mutation-audit";

/**
 * POST /api/request/[id]/reverse
 *
 * 승인 취소 (APPROVED → PENDING).
 * cancel과 다른 점: 요청을 재심사할 수 있도록 PENDING으로 되돌린다.
 * cancel은 영구 종료(CANCELLED), reverse는 재심사 가능(PENDING).
 *
 * - SERIALIZABLE tx로 예산 release 실행
 * - 원본 reserve BudgetEvent를 참조하여 정확히 같은 amount/categoryId/yearMonth 해제
 * - 관련 Order 삭제 (아직 ORDERED 상태인 경우만)
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
      action: "purchase_request_reverse",
      targetEntityType: "approval",
      targetEntityId: requestId,
      sourceSurface: "request-reverse-api",
      routePath: "/api/request/[id]/reverse",
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

    if (purchaseRequest.status !== PurchaseRequestStatus.APPROVED) {
      enforcement.fail();
      return NextResponse.json(
        { error: `현재 상태(${purchaseRequest.status})에서는 승인 취소할 수 없습니다.` },
        { status: 400 },
      );
    }

    // 관련 Order가 이미 진행 중이면 reverse 불가
    if (purchaseRequest.order && purchaseRequest.order.status !== "ORDERED") {
      enforcement.fail();
      return NextResponse.json(
        {
          error: `연결된 주문이 이미 ${purchaseRequest.order.status} 상태입니다. 주문 취소를 먼저 진행하세요.`,
        },
        { status: 400 },
      );
    }

    // 권한: ADMIN만
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

    // ── SERIALIZABLE tx: 승인 취소 + 예산 release ──
    const result = await withSerializableBudgetTx(db, async (tx: any) => {
      // 1. 관련 Order 삭제 (ORDERED 상태만)
      if (purchaseRequest.orderId) {
        // Order items 먼저 삭제
        await tx.orderItem.deleteMany({
          where: { orderId: purchaseRequest.orderId },
        });
        await tx.order.delete({
          where: { id: purchaseRequest.orderId },
        });
      }

      // 2. PurchaseRequest → PENDING (재심사 가능)
      const reversed = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: PurchaseRequestStatus.PENDING,
          approverId: null,
          approvedAt: null,
          orderId: null,
        },
      });

      // 3. 예산 release
      let releaseEvent = undefined;
      if (orgId) {
        releaseEvent = await releaseApprovalReversed(tx, {
          organizationId: orgId,
          requestId,
          executedBy: session.user.id,
          reason: reason ?? "Approval reversed",
        });
      }

      // 4. Durable audit event — 같은 SERIALIZABLE tx 안에서 기록
      await recordMutationAudit(tx, {
        auditEventKey: buildAuditEventKey(
          orgId || 'no-org', requestId, 'purchase_request_reverse',
        ),
        orgId: orgId || 'no-org',
        actorId: session.user.id,
        route: '/api/request/[id]/reverse',
        action: 'purchase_request_reverse',
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
        compensatingForEventId: buildAuditEventKey(
          orgId || 'no-org', requestId, 'purchase_request_approve',
        ),
      });

      return { reversed, releaseEvent };
    }, { label: "approval_reverse_release" });

    // ── Audit ──
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const actorRole = await getActorRole(session.user.id, orgId);
    await createActivityLog({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activityType: "PURCHASE_REQUEST_REVERSED" as any, // schema 추가됨, prisma generate 대기
      entityType: "PURCHASE_REQUEST",
      entityId: requestId,
      beforeStatus: "APPROVED",
      afterStatus: "PENDING",
      userId: session.user.id,
      organizationId: orgId,
      actorRole,
      metadata: {
        reason: reason ?? null,
        deletedOrderId: purchaseRequest.orderId ?? null,
        budgetRelease: result.releaseEvent
          ? { itemCount: result.releaseEvent.releaseItems.length }
          : null,
      },
      ipAddress,
      userAgent,
    });

    enforcement.complete({
      beforeState: { status: "APPROVED", requestId, orderId: purchaseRequest.orderId },
      afterState: {
        status: "PENDING",
        requestId,
        ...(result.releaseEvent && {
          budgetRelease: releaseEventToAuditShape(result.releaseEvent),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "승인이 취소되었습니다. 요청이 재심사 대기 상태로 돌아갔습니다.",
      purchaseRequest: result.reversed,
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
      console.error("[Approval Reverse] Negative committed spend:", error.message);
      return NextResponse.json(
        { error: "예산 해제 중 정합성 오류가 발생했습니다.", detail: error.message },
        { status: 409 },
      );
    }

    console.error("[Approval Reverse] Error:", error);
    return NextResponse.json(
      { error: "승인 취소 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

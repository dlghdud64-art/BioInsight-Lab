import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
// §11.209d-notification — requester 에게 결재 반려 email (best effort).
import { sendEmail } from "@/lib/email/sender";
import { generatePurchaseRejectedEmail } from "@/lib/email/templates";
// §11.209d-notification-inapp-server-wiring — requester 에게 in-app 알림
// (best effort). NotificationEvent + IN_APP NotificationAction 자동 생성.
import { dispatchNotificationEvent } from "@/lib/notifications";

/**
 * 구매 요청 거절 (ADMIN/OWNER만 가능)
 *
 * Security: enforceAction (purchase_request_reject)
 * - server-authoritative role check
 * - concurrency lock
 * - audit envelope 기록
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const { reason } = body;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'purchase_request_reject',
      targetEntityType: 'approval',
      targetEntityId: requestId,
      sourceSurface: 'request-rejection-api',
      routePath: '/api/request/[id]/reject',
      rationale: reason,
    });

    if (!enforcement.allowed) {
      return enforcement.deny();
    }

    // 구매 요청 조회
    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        team: true,
      },
    });

    if (!purchaseRequest) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 }
      );
    }

    if (purchaseRequest.status !== PurchaseRequestStatus.PENDING) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Purchase request is not pending" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 거절 가능
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: purchaseRequest.teamId || "",
        },
      },
    });

    if (!teamMember || teamMember.role !== TeamRole.ADMIN) {
      enforcement?.fail();
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN can reject requests" },
        { status: 403 }
      );
    }

    // 구매 요청 거절
    const rejectedRequest = await db.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: PurchaseRequestStatus.REJECTED,
        approverId: session.user.id,
        rejectedAt: new Date(),
        rejectedReason: reason || null,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    enforcement.complete({
      beforeState: { status: 'PENDING', requestId },
      afterState: { status: 'REJECTED', requestId, reason: reason || null },
    });

    // §11.209d-notification — requester 에게 결재 반려 email + reason
    // (best effort). mutation 성공 후 호출 — email fail 시 mutation 결과 영향 0.
    if (rejectedRequest.requester?.email) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const quoteId = rejectedRequest.quoteId;
        const quoteUrl = quoteId
          ? `${appUrl}/dashboard/quotes?focus=${encodeURIComponent(quoteId)}`
          : `${appUrl}/dashboard/quotes`;
        const template = generatePurchaseRejectedEmail({
          requesterName: rejectedRequest.requester.name ?? rejectedRequest.requester.email,
          approverName: rejectedRequest.approver?.name ?? session.user.name ?? "결재자",
          quoteTitle: rejectedRequest.title,
          totalAmount: rejectedRequest.totalAmount,
          currency: "KRW",
          rejectionReason: reason || "사유가 명시되지 않았습니다.",
          quoteUrl,
        });
        await sendEmail({
          to: rejectedRequest.requester.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (emailErr) {
        // graceful — mutation 성공 유지
        console.error("[request/reject] requester email 발송 실패 (mutation 정합 유지):", emailErr);
      }
    }

    // §11.209d-notification-inapp-server-wiring — requester 에게 in-app 알림.
    // mutation 성공 후 호출 — fail 시 mutation 결과 영향 0. metadata 에
    // rejectionReason 포함 (UI bell 이 요약 노출 가능).
    if (rejectedRequest.requesterId) {
      try {
        await dispatchNotificationEvent({
          eventType: "PURCHASE_REJECTED",
          entityType: "PURCHASE_REQUEST",
          entityId: requestId,
          triggeredBy: session.user.id,
          recipients: [
            {
              userId: rejectedRequest.requesterId,
              email: rejectedRequest.requester?.email ?? undefined,
            },
          ],
          metadata: {
            quoteId: rejectedRequest.quoteId,
            quoteTitle: rejectedRequest.title,
            totalAmount: rejectedRequest.totalAmount,
            approverId: session.user.id,
            rejectionReason: reason || null,
          },
        });
      } catch (notifErr) {
        // graceful — mutation 정합 유지
        console.error("[request/reject] in-app notification 발송 실패 (mutation 정합 유지):", notifErr);
      }
    }

    return NextResponse.json({ purchaseRequest: rejectedRequest });
  } catch (error) {
    enforcement?.fail();
    console.error("Error rejecting purchase request:", error);
    return NextResponse.json(
      { error: "Failed to reject purchase request" },
      { status: 500 }
    );
  }
}



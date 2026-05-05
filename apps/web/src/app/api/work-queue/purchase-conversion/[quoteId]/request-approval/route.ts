/**
 * §11.209d-pr-auto-create Phase 1 — Quote → PurchaseRequest 결재 요청 mutation
 *
 * /api/work-queue/purchase-conversion/[quoteId]/request-approval POST
 *
 * Behavior:
 *   - workspace.plan + stripePriceId → resolveApprovalPolicyForPlan
 *   - in_app_approval policy 만 허용 (Lab Team / Starter → 400)
 *   - approver 자동 매핑: workspace 첫 ADMIN/OWNER member
 *   - PR INSERT (PENDING + quoteId + totalAmount + items)
 *   - enforceAction (purchase_request_create) — server-authoritative lock
 *
 * canonical truth:
 *   - PurchaseRequest model (PENDING/APPROVED/REJECTED/CANCELLED)
 *   - workspace.stripePriceId (Stripe webhook canonical)
 *   - PLAN_DESCRIPTOR.approvalPolicy (§11.201 + §11.209c)
 *
 * dead button 0:
 *   - Lab Team / Starter → 400 + 운영자 친화 메시지
 *   - approver 미설정 (ADMIN 0개) → 400 + 결재자 미설정 메시지
 *   - 이미 PENDING PR 존재 → 400 + 중복 요청 차단
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus } from "@prisma/client";
import {
  enforceAction,
  type InlineEnforcementHandle,
} from "@/lib/security/server-enforcement-middleware";
import { resolveApprovalPolicyForPlan } from "@/lib/billing/plan-descriptor";
// §11.209d-approver-routing — 결재자 자동 매핑 매트릭스 (금액 임계치).
//   < 1,000만원 → workspace ADMIN, >= 1,000만원 → org OWNER escalation.
import { selectApproverByAmount } from "@/lib/billing/approver-routing";
// §11.209d-notification — approver 에게 결재 요청 email 발송 (best effort).
import { sendEmail } from "@/lib/email/sender";
import { generatePurchaseApprovalRequestEmail } from "@/lib/email/templates";
// §11.209d-notification-inapp-server-wiring — approver 에게 in-app 알림
// (best effort). NotificationEvent + IN_APP NotificationAction 자동 생성.
import { dispatchNotificationEvent } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ quoteId: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { quoteId } = await context.params;
    if (!quoteId) {
      return NextResponse.json(
        { error: "INVALID_INPUT", message: "견적 ID 가 누락되었습니다." },
        { status: 400 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "purchase_request_create",
      targetEntityType: "approval",
      targetEntityId: quoteId,
      sourceSurface: "purchase-conversion-request-approval",
      routePath: "/api/work-queue/purchase-conversion/[quoteId]/request-approval",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // Quote 존재 + 소유 검증
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        userId: true,
        title: true,
        totalAmount: true,
        items: { select: { id: true, name: true, quantity: true } },
      },
    });
    if (!quote) {
      enforcement.fail();
      return NextResponse.json(
        { error: "QUOTE_NOT_FOUND", message: "견적을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (quote.userId !== session.user.id) {
      enforcement.fail();
      return NextResponse.json(
        { error: "FORBIDDEN", message: "본인이 생성한 견적만 결재 요청 가능합니다." },
        { status: 403 },
      );
    }

    // 이미 PENDING PR 존재 → 중복 차단
    const existingPending = await db.purchaseRequest.findFirst({
      where: {
        quoteId,
        status: PurchaseRequestStatus.PENDING,
      },
      select: { id: true },
    });
    if (existingPending) {
      enforcement.fail();
      return NextResponse.json(
        {
          error: "DUPLICATE_PENDING_REQUEST",
          message: "이미 결재 대기 중인 요청이 있습니다.",
        },
        { status: 400 },
      );
    }

    // workspace.plan + stripePriceId → approvalPolicy 매핑.
    // §11.209d-approver-routing — organizationId 추가 select (helper 인자).
    // §11.209d-approver-routing-threshold — approvalThresholdKrw 추가 select
    //   (workspace 별 임계치 admin override, default 10000000 fallback).
    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: {
        workspace: {
          select: {
            id: true,
            plan: true,
            stripePriceId: true,
            organizationId: true,
            approvalThresholdKrw: true,
          },
        },
      },
    });
    const approvalPolicy = resolveApprovalPolicyForPlan(
      member?.workspace?.plan ?? null,
      member?.workspace?.stripePriceId ?? null,
    );

    // in_app_approval 외 → 400 (Lab Team / Starter 의 dead promise 차단)
    if (approvalPolicy !== "in_app_approval") {
      enforcement.fail();
      return NextResponse.json(
        {
          error: "APPROVAL_POLICY_NOT_ENABLED",
          message:
            "결재 정책이 활성화되지 않은 플랜입니다. R&D Operations 또는 Enterprise 플랜으로 업그레이드 후 사용 가능합니다.",
        },
        { status: 400 },
      );
    }

    // §11.209d-approver-routing — 결재자 자동 매핑 매트릭스 helper 호출.
    // 금액 < 1,000만원 → workspace ADMIN (본인 외) → self_admin fallback.
    // 금액 >= 1,000만원 → org OWNER → org ADMIN → workspace ADMIN fallback.
    const workspaceId = member?.workspace?.id;
    const orgId = member?.workspace?.organizationId;
    if (!workspaceId || !orgId) {
      enforcement.fail();
      return NextResponse.json(
        { error: "WORKSPACE_NOT_FOUND", message: "워크스페이스 정보를 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    const candidate = await selectApproverByAmount({
      workspaceId,
      organizationId: orgId,
      totalAmount: quote.totalAmount ?? 0,
      requesterId: session.user.id,
      // §11.209d-approver-routing-threshold — workspace 별 임계치 (default 10M fallback)
      threshold: member?.workspace?.approvalThresholdKrw ?? undefined,
    });
    const approverId = candidate?.userId ?? null;
    const approverEmail = candidate?.email ?? null;
    const approverName = candidate?.name ?? "관리자";

    if (!approverId) {
      enforcement.fail();
      return NextResponse.json(
        {
          error: "APPROVER_NOT_FOUND",
          message:
            "결재자가 미설정 상태입니다. 워크스페이스에 ADMIN 권한 사용자를 추가해 주세요.",
        },
        { status: 400 },
      );
    }

    // PR INSERT
    const purchaseRequest = await db.purchaseRequest.create({
      data: {
        requesterId: session.user.id,
        approverId,
        title: quote.title,
        message: `견적 ${quote.title} 결재 요청 (자동 생성)`,
        items: (quote.items ?? []) as object,
        totalAmount: quote.totalAmount ?? null,
        quoteId,
        status: PurchaseRequestStatus.PENDING,
      },
      select: {
        id: true,
        status: true,
        approverId: true,
        createdAt: true,
      },
    });

    enforcement.complete({
      beforeState: { quoteId },
      afterState: {
        purchaseRequestId: purchaseRequest.id,
        status: purchaseRequest.status,
      },
    });

    // §11.209d-notification — approver 에게 결재 요청 email (best effort).
    // mutation 성공 후 호출 — email fail 시 mutation 결과 영향 0.
    if (approverEmail) {
      try {
        const requesterName = session.user.name ?? session.user.email ?? "요청자";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const template = generatePurchaseApprovalRequestEmail({
          approverName,
          requesterName,
          quoteTitle: quote.title,
          totalAmount: quote.totalAmount,
          currency: "KRW",
          quoteUrl: `${appUrl}/dashboard/quotes?focus=${encodeURIComponent(quote.id)}`,
        });
        await sendEmail({
          to: approverEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      } catch (emailErr) {
        // graceful — mutation 성공 유지, audit log 만
        console.error("[request-approval] approver email 발송 실패 (mutation 정합 유지):", emailErr);
      }
    }

    // §11.209d-notification-inapp-server-wiring — approver 에게 in-app 알림.
    // dispatchNotificationEvent 가 NotificationEvent + IN_APP/QUEUE_ITEM
    // NotificationAction 을 transaction 으로 자동 생성. mutation 성공 후
    // 호출 — fail 시 mutation 결과 영향 0.
    try {
      await dispatchNotificationEvent({
        eventType: "PURCHASE_APPROVAL_REQUESTED",
        entityType: "PURCHASE_REQUEST",
        entityId: purchaseRequest.id,
        triggeredBy: session.user.id,
        recipients: [{ userId: approverId, email: approverEmail ?? undefined }],
        metadata: {
          quoteId,
          quoteTitle: quote.title,
          totalAmount: quote.totalAmount,
          requesterId: session.user.id,
        },
      });
    } catch (notifErr) {
      // graceful — mutation 정합 유지
      console.error("[request-approval] in-app notification 발송 실패 (mutation 정합 유지):", notifErr);
    }

    return NextResponse.json(
      { success: true, purchaseRequest },
      { status: 201 },
    );
  } catch (err) {
    console.error("[request-approval] error:", err);
    enforcement?.fail();
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "결재 요청 생성 실패" },
      { status: 500 },
    );
  }
}

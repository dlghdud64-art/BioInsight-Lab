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

    // workspace.plan + stripePriceId → approvalPolicy 매핑
    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: { select: { id: true, plan: true, stripePriceId: true } } },
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

    // approver 자동 매핑: workspace 의 첫 ADMIN/OWNER member
    const workspaceId = member?.workspace?.id;
    if (!workspaceId) {
      enforcement.fail();
      return NextResponse.json(
        { error: "WORKSPACE_NOT_FOUND", message: "워크스페이스 정보를 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    const adminMember = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        role: "ADMIN",
        userId: { not: session.user.id }, // 본인 외 ADMIN
      },
      select: { userId: true },
    });
    // workspace 에 본인 외 ADMIN 가 없으면 본인 ADMIN 도 가능 (single-admin workspace 호환)
    const fallbackAdmin = adminMember
      ? null
      : await db.workspaceMember.findFirst({
          where: { workspaceId, role: "ADMIN" },
          select: { userId: true },
        });
    const approverId = adminMember?.userId ?? fallbackAdmin?.userId ?? null;

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

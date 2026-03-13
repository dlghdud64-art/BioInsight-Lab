import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

/**
 * POST /api/ai-actions/[id]/approve — 승인 → 도메인 액션 실행
 *
 * Human-in-the-Loop: 사용자가 AI 초안을 검토한 뒤 승인하면
 * 기존 비즈니스 로직(견적 생성, 이메일 발송 등)을 실행합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await db.aiActionItem.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (item.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot approve action with status: ${item.status}` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const modifiedPayload = body.payload || item.payload;

    const { ipAddress, userAgent } = extractRequestMeta(request);
    const actorRole = await getActorRole(session.user.id, item.organizationId);

    // 상태를 EXECUTING으로 전환
    await db.aiActionItem.update({
      where: { id: params.id },
      data: { status: "EXECUTING" },
    });

    // 활동 로그: 검토 완료 (승인 결정)
    await createActivityLog({
      activityType: "QUOTE_DRAFT_REVIEWED",
      entityType: "AI_ACTION",
      entityId: params.id,
      taskType: item.type,
      beforeStatus: "PENDING",
      afterStatus: "EXECUTING",
      userId: session.user.id,
      organizationId: item.organizationId,
      actorRole,
      metadata: { decision: "APPROVE", title: item.title },
      ipAddress,
      userAgent,
    });

    try {
      let result: Record<string, unknown> = {};

      switch (item.type) {
        case "QUOTE_DRAFT":
          result = await executeQuoteDraft(session.user.id, modifiedPayload as Record<string, unknown>);
          break;

        case "VENDOR_EMAIL_DRAFT":
          result = await executeVendorEmailDraft(modifiedPayload as Record<string, unknown>);
          break;

        case "REORDER_SUGGESTION":
          result = { message: "재발주 기능은 P1에서 구현 예정입니다." };
          break;

        default:
          result = { message: `${item.type} 실행 로직은 아직 구현되지 않았습니다.` };
      }

      // 성공: APPROVED로 전환
      const updated = await db.aiActionItem.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          result: result as Prisma.JsonObject,
          payload: modifiedPayload as Prisma.JsonObject,
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
        },
      });

      // 감사 로그
      await createAuditLog({
        userId: session.user.id,
        organizationId: item.organizationId,
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.AI_ACTION,
        entityId: params.id,
        previousData: { status: "PENDING" },
        newData: { status: "APPROVED", result },
        ipAddress,
        userAgent,
      });

      // 활동 로그: AI 작업 완료
      await createActivityLog({
        activityType: "AI_TASK_COMPLETED",
        entityType: "AI_ACTION",
        entityId: params.id,
        taskType: item.type,
        beforeStatus: "EXECUTING",
        afterStatus: "APPROVED",
        userId: session.user.id,
        organizationId: item.organizationId,
        actorRole,
        metadata: { result, title: item.title },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ item: updated, result });
    } catch (execError) {
      // 실행 실패: FAILED로 전환
      await db.aiActionItem.update({
        where: { id: params.id },
        data: {
          status: "FAILED",
          result: { error: String(execError) } as Prisma.JsonObject,
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
        },
      });

      // 활동 로그: AI 작업 실패
      await createActivityLog({
        activityType: "AI_TASK_FAILED",
        entityType: "AI_ACTION",
        entityId: params.id,
        taskType: item.type,
        beforeStatus: "EXECUTING",
        afterStatus: "FAILED",
        userId: session.user.id,
        organizationId: item.organizationId,
        actorRole,
        metadata: { error: String(execError), title: item.title },
        ipAddress,
        userAgent,
      });

      console.error("AI action execution failed:", execError);
      return NextResponse.json(
        { error: "Action execution failed", details: String(execError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error approving AI action:", error);
    return NextResponse.json(
      { error: "Failed to approve AI action" },
      { status: 500 }
    );
  }
}

/**
 * 견적 초안 승인 → Quote + QuoteListItem 생성
 */
async function executeQuoteDraft(
  userId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const items = (payload.items || []) as Array<{
    productName: string;
    catalogNumber?: string;
    brand?: string;
    quantity: number;
    unit?: string;
  }>;

  const emailSubject = (payload.emailSubject as string) || "";
  const emailBody = (payload.emailBody as string) || "";

  // Quote 생성 (기존 견적 시스템 활용)
  const quote = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.quote.create({
      data: {
        userId,
        title: emailSubject,
        description: emailBody,
        status: "PENDING",
        currency: "KRW",
        totalAmount: 0,
        items: {
          create: items.map((item, index) => ({
            name: item.productName,
            catalogNumber: item.catalogNumber || null,
            brand: item.brand || null,
            quantity: item.quantity,
            unit: item.unit || "ea",
            unitPrice: 0,
            lineTotal: 0,
            sortOrder: index,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return created;
  });

  return {
    quoteId: quote.id,
    itemCount: items.length,
    title: emailSubject,
  };
}

/**
 * 벤더 이메일 초안 승인 → 이메일 발송 준비 (실제 발송은 기존 RFQ 플로우 사용)
 */
async function executeVendorEmailDraft(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // 벤더 이메일 초안은 견적 요청 플로우로 연결
  // 실제 이메일 발송은 /api/quotes/request 또는 /api/quotes/[id]/vendor-requests를 통해 수행
  return {
    vendorName: payload.vendorName || "",
    emailSubject: payload.emailSubject || "",
    emailPrepared: true,
    message: "이메일 초안이 승인되었습니다. 견적 요청 화면에서 발송할 수 있습니다.",
  };
}

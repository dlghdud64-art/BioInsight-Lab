import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma, TeamRole } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { createActivityLog, getActorRole } from "@/lib/activity-log";

/**
 * POST /api/ai-actions/[id]/approve — 승인 → 도메인 액션 실행
 *
 * Human-in-the-Loop: 사용자가 AI 초안을 검토한 뒤 승인하면
 * 기존 비즈니스 로직(견적 생성, 이메일 발송 등)을 실행합니다.
 *
 * RBAC:
 *   - FOLLOWUP_DRAFT / STATUS_CHANGE_SUGGEST: APPROVER 이상만 승인 가능
 *   - 나머지: 본인 소유만 가능 (기존 동작)
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

    // 권한 체크: 본인 소유 확인
    if (item.userId !== session.user.id) {
      // 같은 조직이면 역할 기반 체크
      if (item.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { organizationId: item.organizationId, userId: session.user.id },
          select: { role: true },
        });
        if (!membership) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // RBAC: FOLLOWUP_DRAFT, STATUS_CHANGE_SUGGEST 는 MEMBER 역할 승인 불가
    const requiresApproverRole = ["FOLLOWUP_DRAFT", "STATUS_CHANGE_SUGGEST"];
    if (requiresApproverRole.includes(item.type)) {
      const teamMember = await db.teamMember.findFirst({
        where: { userId: session.user.id },
        select: { role: true },
      });
      if (teamMember?.role === TeamRole.MEMBER) {
        return NextResponse.json(
          {
            error: "MEMBER_ROLE_RESTRICTION",
            message: "일반 멤버는 Follow-up 발송 또는 상태 변경을 승인할 수 없습니다.",
          },
          { status: 403 }
        );
      }
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

    // 활동 로그: 검토 완료 (승인 결정) — 타입에 따라 이벤트 분기
    const reviewActivityType = item.type === "FOLLOWUP_DRAFT"
      ? "ORDER_FOLLOWUP_REVIEWED" as const
      : "QUOTE_DRAFT_REVIEWED" as const;

    await createActivityLog({
      activityType: reviewActivityType,
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

        case "FOLLOWUP_DRAFT":
          result = await executeFollowupDraft(
            session.user.id,
            modifiedPayload as Record<string, unknown>,
            item.relatedEntityId
          );
          // 활동 로그: Follow-up 발송 완료
          await createActivityLog({
            activityType: "ORDER_FOLLOWUP_SENT",
            entityType: "ORDER",
            entityId: item.relatedEntityId || params.id,
            taskType: "FOLLOWUP_DRAFT",
            beforeStatus: "EXECUTING",
            afterStatus: "APPROVED",
            userId: session.user.id,
            organizationId: item.organizationId,
            actorRole,
            metadata: {
              actionItemId: params.id,
              vendorName: (modifiedPayload as Record<string, unknown>).vendorName,
              emailSubject: (modifiedPayload as Record<string, unknown>).emailSubject,
            },
            ipAddress,
            userAgent,
          });
          break;

        case "STATUS_CHANGE_SUGGEST":
          result = await executeStatusChangeSuggest(
            session.user.id,
            modifiedPayload as Record<string, unknown>,
            item.relatedEntityId
          );
          // 활동 로그: 상태 변경 승인
          await createActivityLog({
            activityType: "ORDER_STATUS_CHANGE_APPROVED",
            entityType: "ORDER",
            entityId: item.relatedEntityId || params.id,
            taskType: "STATUS_CHANGE_SUGGEST",
            beforeStatus: (modifiedPayload as Record<string, unknown>).currentStatus as string,
            afterStatus: (modifiedPayload as Record<string, unknown>).proposedStatus as string,
            userId: session.user.id,
            organizationId: item.organizationId,
            actorRole,
            metadata: {
              actionItemId: params.id,
              orderId: item.relatedEntityId,
            },
            ipAddress,
            userAgent,
          });
          break;

        case "REORDER_SUGGESTION":
          result = await executeReorderSuggestion(
            session.user.id,
            modifiedPayload as Record<string, unknown>,
            item.relatedEntityId
          );
          // 활동 로그: 재발주 검토 완료
          await createActivityLog({
            activityType: "INVENTORY_RESTOCK_REVIEWED",
            entityType: "INVENTORY",
            entityId: item.relatedEntityId || params.id,
            taskType: "REORDER_SUGGESTION",
            beforeStatus: "PENDING",
            afterStatus: "APPROVED",
            userId: session.user.id,
            organizationId: item.organizationId,
            actorRole,
            metadata: {
              actionItemId: params.id,
              decision: "APPROVED",
              productName: (modifiedPayload as Record<string, unknown>).productName,
              recommendedQty: (modifiedPayload as Record<string, unknown>).recommendedOrderQty,
            },
            ipAddress,
            userAgent,
          });
          break;

        case "EXPIRY_ALERT":
          result = await executeExpiryAlert(
            modifiedPayload as Record<string, unknown>,
            item.relatedEntityId
          );
          // 활동 로그: Lot 조치 검토
          await createActivityLog({
            activityType: "INVENTORY_RESTOCK_REVIEWED",
            entityType: "INVENTORY",
            entityId: item.relatedEntityId || params.id,
            taskType: "EXPIRY_ALERT",
            beforeStatus: "PENDING",
            afterStatus: "APPROVED",
            userId: session.user.id,
            organizationId: item.organizationId,
            actorRole,
            metadata: {
              actionItemId: params.id,
              decision: "ACKNOWLEDGED",
              productName: (modifiedPayload as Record<string, unknown>).productName,
              suggestedAction: (modifiedPayload as Record<string, unknown>).suggestedAction,
            },
            ipAddress,
            userAgent,
          });
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
  return {
    vendorName: payload.vendorName || "",
    emailSubject: payload.emailSubject || "",
    emailPrepared: true,
    message: "이메일 초안이 승인되었습니다. 견적 요청 화면에서 발송할 수 있습니다.",
  };
}

/**
 * Follow-up 초안 승인 → 이메일 발송 준비
 *
 * 실제 이메일 발송은 하지 않음 (Human-in-the-Loop 원칙).
 * 승인 = "발송 가능" 상태로 전환. 실제 발송은 기존 이메일 플로우를 통해 수행.
 */
async function executeFollowupDraft(
  userId: string,
  payload: Record<string, unknown>,
  orderId: string | null
): Promise<Record<string, unknown>> {
  // 주문 상태 확인 (발송 가능한 상태인지)
  if (orderId) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, orderNumber: true },
    });
    if (!order) throw new Error("주문을 찾을 수 없습니다");
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      throw new Error(`이미 ${order.status === "DELIVERED" ? "배송 완료" : "취소"}된 주문입니다`);
    }
  }

  return {
    orderId,
    vendorName: payload.vendorName || "",
    emailSubject: payload.emailSubject || "",
    emailPrepared: true,
    message: "Follow-up 이메일이 승인되었습니다. 벤더에게 발송할 준비가 완료되었습니다.",
  };
}

/**
 * 상태 변경 제안 승인 → 주문 상태 변경 실행
 */
async function executeStatusChangeSuggest(
  userId: string,
  payload: Record<string, unknown>,
  orderId: string | null
): Promise<Record<string, unknown>> {
  if (!orderId) throw new Error("주문 ID가 없습니다");

  const proposedStatus = payload.proposedStatus as string;
  if (!proposedStatus) throw new Error("제안된 상태가 없습니다");

  const STATUS_TRANSITIONS: Record<string, string[]> = {
    ORDERED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPING", "CANCELLED"],
    SHIPPING: ["DELIVERED", "CANCELLED"],
  };

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true, orderNumber: true },
  });

  if (!order) throw new Error("주문을 찾을 수 없습니다");

  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(proposedStatus)) {
    throw new Error(
      `현재 상태(${order.status})에서 ${proposedStatus}로 변경할 수 없습니다`
    );
  }

  // 상태 변경 실행
  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status: proposedStatus as any,
      ...(proposedStatus === "DELIVERED" ? { actualDelivery: new Date() } : {}),
    },
    select: { id: true, orderNumber: true, status: true },
  });

  // ORDER_STATUS_CHANGED 활동 로그 (실제 상태 변경)
  const actorRole = await getActorRole(userId, null);
  await createActivityLog({
    activityType: "ORDER_STATUS_CHANGED",
    entityType: "ORDER",
    entityId: orderId,
    beforeStatus: order.status,
    afterStatus: proposedStatus,
    userId,
    actorRole,
    metadata: {
      orderNumber: order.orderNumber,
      trigger: "ai_status_change_approved",
    },
  });

  return {
    orderId,
    orderNumber: updated.orderNumber,
    previousStatus: order.status,
    newStatus: updated.status,
    message: `주문 상태가 ${order.status} → ${updated.status}로 변경되었습니다.`,
  };
}

/**
 * 재발주 제안 승인 → 자동 재주문 트리거 (기존 auto-reorder 로직 활용)
 */
async function executeReorderSuggestion(
  userId: string,
  payload: Record<string, unknown>,
  inventoryId: string | null
): Promise<Record<string, unknown>> {
  if (!inventoryId) throw new Error("재고 ID가 없습니다");

  const inventory = await db.productInventory.findUnique({
    where: { id: inventoryId },
    select: {
      id: true,
      currentQuantity: true,
      safetyStock: true,
      product: { select: { id: true, name: true, catalogNumber: true, brand: true } },
    },
  });

  if (!inventory) throw new Error("재고 정보를 찾을 수 없습니다");

  const recommendedQty = (payload.recommendedOrderQty as number) || 0;
  if (recommendedQty <= 0) throw new Error("추천 발주 수량이 유효하지 않습니다");

  // 재입고 이력 생성 (InventoryRestock)
  const restock = await db.inventoryRestock.create({
    data: {
      inventoryId: inventory.id,
      quantity: recommendedQty,
      reason: (payload.reason as string) || "AI 재발주 제안 승인",
      orderedBy: userId,
      status: "ORDERED",
    },
  });

  return {
    inventoryId: inventory.id,
    productName: inventory.product?.name || "",
    recommendedQty,
    restockId: restock.id,
    message: `${inventory.product?.name || "품목"} ${recommendedQty}개 재발주가 요청되었습니다.`,
  };
}

/**
 * 유효기한 임박 알림 승인 → 확인(Acknowledge) 처리
 *
 * 실제 폐기/사용 처리는 하지 않음 — 사용자가 "확인했음"을 기록하는 것이 목적.
 */
async function executeExpiryAlert(
  payload: Record<string, unknown>,
  inventoryId: string | null
): Promise<Record<string, unknown>> {
  if (!inventoryId) throw new Error("재고 ID가 없습니다");

  const inventory = await db.productInventory.findUnique({
    where: { id: inventoryId },
    select: {
      id: true,
      lotNumber: true,
      expiryDate: true,
      currentQuantity: true,
      product: { select: { name: true } },
    },
  });

  if (!inventory) throw new Error("재고 정보를 찾을 수 없습니다");

  const suggestedAction = (payload.suggestedAction as string) || "확인 완료";

  return {
    inventoryId: inventory.id,
    productName: inventory.product?.name || "",
    lotNumber: inventory.lotNumber || "",
    expiryDate: inventory.expiryDate?.toISOString() || null,
    currentQuantity: inventory.currentQuantity,
    suggestedAction,
    acknowledged: true,
    message: `${inventory.product?.name || "품목"} Lot(${inventory.lotNumber || "N/A"}) 유효기한 알림이 확인 처리되었습니다.`,
  };
}

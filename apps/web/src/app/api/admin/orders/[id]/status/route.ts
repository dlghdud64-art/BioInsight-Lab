import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendOrderDeliveredEmail } from "@/lib/email";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { withSerializableBudgetTx } from "@/lib/budget/budget-concurrency";
import {
  releasePOVoided,
  releaseEventToAuditShape,
  NegativeCommittedSpendError,
  type BudgetReleaseEvent,
} from "@/lib/budget/category-budget-release";

// 주문 상태 전이 규칙
const STATUS_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "CANCELLED"],
  DELIVERED: [], // 최종 상태
  CANCELLED: [], // 최종 상태
};

/**
 * PATCH /api/admin/orders/[id]/status
 * 관리자 주문 상태 변경 API
 * - DELIVERED 상태로 변경 시 자동으로 인벤토리에 품목 등록
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    // 인증 체크
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    // 관리자 권한 체크
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'order_status_change',
      targetEntityType: 'order',
      targetEntityId: orderId,
      sourceSurface: 'admin-order-status-api',
      routePath: '/api/admin/orders/[id]/status',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await req.json();
    const { status: newStatus, notes } = body;

    // 상태값 유효성 검사
    const validStatuses = ["ORDERED", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "유효하지 않은 상태값입니다.", validStatuses },
        { status: 400 }
      );
    }

    // 주문 조회 (예산 release를 위해 purchaseRequest + organization 포함)
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        items: true,
        purchaseRequest: {
          select: { id: true, teamId: true },
        },
        organization: {
          select: { id: true, timezone: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 상태 전이 가능 여부 확인
    const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `현재 상태(${order.status})에서 ${newStatus}로 변경할 수 없습니다.`,
          currentStatus: order.status,
          allowedTransitions,
        },
        { status: 400 }
      );
    }

    // 트랜잭션으로 주문 상태 변경 및 인벤토리 등록
    // CANCELLED 전환 시 SERIALIZABLE tx로 예산 release 포함
    let budgetReleaseEvent: BudgetReleaseEvent | undefined;

    const runTransaction = async (tx: any) => {
      // 1. 주문 상태 업데이트
      const updateData: {
        status: typeof newStatus;
        notes?: string;
        actualDelivery?: Date;
      } = {
        status: newStatus,
      };

      if (notes) {
        updateData.notes = notes;
      }

      // 배송 완료 시 실제 배송일 기록
      if (newStatus === "DELIVERED") {
        updateData.actualDelivery = new Date();
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          items: true,
        },
      });

      // 2. DELIVERED 상태로 변경 시 인벤토리 자동 등록
      let inventoryItems: Array<{
        id: string;
        productName: string;
        quantity: number;
      }> = [];

      if (newStatus === "DELIVERED" && order.items.length > 0) {
        const inventoryData = order.items.map((item: any) => ({
          userId: order.userId,
          orderId: order.id,
          orderItemId: item.id,
          productName: item.name,
          brand: item.brand,
          catalogNumber: item.catalogNumber,
          quantity: item.quantity,
          unit: "ea",
          location: "미지정",
          status: "IN_STOCK",
          receivedAt: new Date(),
        }));

        await tx.userInventory.createMany({
          data: inventoryData,
        });

        const createdInventory = await tx.userInventory.findMany({
          where: { orderId: order.id },
          select: {
            id: true,
            productName: true,
            quantity: true,
          },
        });

        inventoryItems = createdInventory;
      }

      // 3. CANCELLED 전환 시 예산 release — 원본 reserve 참조
      if (newStatus === "CANCELLED" && order.organizationId && order.purchaseRequest?.id) {
        budgetReleaseEvent = await releasePOVoided(tx, {
          organizationId: order.organizationId,
          orderId,
          requestId: order.purchaseRequest.id,
          executedBy: session.user.id,
          reason: notes ?? "Order cancelled by admin",
        });
      }

      return { updatedOrder, inventoryItems };
    };

    // CANCELLED → SERIALIZABLE tx (예산 정합성), 그 외 → 일반 tx
    const result = newStatus === "CANCELLED" && order.organizationId && order.purchaseRequest?.id
      ? await withSerializableBudgetTx(db, runTransaction, { label: "order_cancel_release" })
      : await db.$transaction(runTransaction);

    // 3. DELIVERED 상태 변경 시 이메일 발송 (트랜잭션 외부에서)
    if (newStatus === "DELIVERED" && order.user.email) {
      await sendOrderDeliveredEmail({
        to: order.user.email,
        customerName: order.user.name || "고객",
        orderNumber: order.orderNumber,
        deliveredDate: new Date().toLocaleDateString("ko-KR"),
        itemCount: order.items.length,
        items: order.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          brand: item.brand || undefined,
        })),
      });
    }

    // 활동 로그: 주문 상태 변경
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const actorRole = await getActorRole(session.user.id, order.organizationId);
    await createActivityLog({
      activityType: "ORDER_STATUS_CHANGED",
      entityType: "ORDER",
      entityId: orderId,
      beforeStatus: order.status,
      afterStatus: newStatus,
      userId: session.user.id,
      organizationId: order.organizationId,
      actorRole,
      metadata: {
        orderNumber: order.orderNumber,
        notes: notes || null,
        inventoryItemsCreated: result.inventoryItems.length,
        emailSent: newStatus === "DELIVERED" && !!order.user.email,
      },
      ipAddress,
      userAgent,
    });

    enforcement.complete({
      beforeState: { status: order.status, orderId },
      afterState: {
        status: newStatus,
        orderId,
        inventoryCreated: result.inventoryItems.length,
        ...(budgetReleaseEvent && {
          budgetRelease: releaseEventToAuditShape(budgetReleaseEvent),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: newStatus === "DELIVERED"
        ? "배송 완료 처리되었습니다. 인벤토리에 품목이 자동 등록되었습니다."
        : `주문 상태가 ${newStatus}로 변경되었습니다.`,
      order: {
        id: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        status: result.updatedOrder.status,
        previousStatus: order.status,
        actualDelivery: result.updatedOrder.actualDelivery,
      },
      ...(result.inventoryItems.length > 0 && {
        inventory: {
          itemsCreated: result.inventoryItems.length,
          items: result.inventoryItems,
        },
      }),
    });

  } catch (error) {
    enforcement?.fail();

    if (error instanceof NegativeCommittedSpendError) {
      console.error("[Admin Order Status] Negative committed spend:", error.message);
      return NextResponse.json(
        {
          error: "예산 해제 중 정합성 오류가 발생했습니다. 관리자에게 문의하세요.",
          detail: error.message,
        },
        { status: 409 },
      );
    }

    console.error("[Admin Order Status] Error:", error);
    return NextResponse.json(
      { error: "주문 상태 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/orders/[id]/status
 * 주문 상태 정보 및 허용 전이 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id: orderId } = await params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        actualDelivery: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        allowedTransitions,
        createdAt: order.createdAt,
        actualDelivery: order.actualDelivery,
      },
      statusInfo: {
        ORDERED: { label: "주문 완료", description: "주문이 접수되었습니다." },
        CONFIRMED: { label: "확인됨", description: "주문이 확인되었습니다." },
        SHIPPING: { label: "배송 중", description: "상품이 배송 중입니다." },
        DELIVERED: { label: "배송 완료", description: "배송이 완료되었습니다. 인벤토리에 자동 등록됩니다." },
        CANCELLED: { label: "취소됨", description: "주문이 취소되었습니다." },
      },
    });

  } catch (error) {
    console.error("[Admin Order Status] Error:", error);
    return NextResponse.json(
      { error: "주문 상태 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

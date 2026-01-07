import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendOrderDeliveredEmail } from "@/lib/email";

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

    // 주문 조회
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
    const result = await db.$transaction(async (tx) => {
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
        // 각 주문 품목을 인벤토리에 등록
        const inventoryData = order.items.map((item) => ({
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

        // 인벤토리 일괄 생성
        await tx.userInventory.createMany({
          data: inventoryData,
        });

        // 생성된 인벤토리 조회
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

      return { updatedOrder, inventoryItems };
    });

    // 3. DELIVERED 상태 변경 시 이메일 발송 (트랜잭션 외부에서)
    if (newStatus === "DELIVERED" && order.user.email) {
      await sendOrderDeliveredEmail({
        to: order.user.email,
        customerName: order.user.name || "고객",
        orderNumber: order.orderNumber,
        deliveredDate: new Date().toLocaleDateString("ko-KR"),
        itemCount: order.items.length,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          brand: item.brand || undefined,
        })),
      });
    }

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

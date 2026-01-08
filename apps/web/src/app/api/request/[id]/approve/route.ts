import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole, OrderStatus } from "@prisma/client";

/**
 * 구매 요청 승인 (ADMIN/OWNER만 가능)
 * 승인 시 Order로 변환
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requestId } = await params;

    // 구매 요청 조회
    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        team: true,
        requester: true,
        quote: true,
      },
    });

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 }
      );
    }

    if (purchaseRequest.status !== PurchaseRequestStatus.PENDING) {
      return NextResponse.json(
        { error: "Purchase request is not pending" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 승인 가능
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: purchaseRequest.teamId || "",
        },
      },
    });

    if (!teamMember || (teamMember.role !== TeamRole.ADMIN || teamMember.role !== TeamRole.ADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Only OWNER or ADMIN can approve requests" },
        { status: 403 }
      );
    }

    // 트랜잭션으로 승인 및 Order 생성
    const result = await db.$transaction(async (tx: any) => {
      // 1. 구매 요청 승인
      const approvedRequest = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: PurchaseRequestStatus.APPROVED,
          approverId: session.user.id,
          approvedAt: new Date(),
        },
      });

      // 2. Order 생성 (견적이 있는 경우)
      let order = null;
      if (purchaseRequest.quoteId) {
        const quote = await tx.quote.findUnique({
          where: { id: purchaseRequest.quoteId },
          include: {
            items: true,
          },
        });

        if (quote) {
          // 주문번호 생성
          const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

          // Order 생성
          order = await tx.order.create({
            data: {
              userId: purchaseRequest.requesterId,
              quoteId: purchaseRequest.quoteId,
              orderNumber,
              totalAmount: purchaseRequest.totalAmount || quote.totalAmount || 0,
              status: OrderStatus.ORDERED,
              notes: purchaseRequest.message || null,
              items: {
                create: quote.items.map((item: any) => ({
                  productId: item.productId,
                  name: item.name || "Unknown Product",
                  brand: item.brand,
                  catalogNumber: item.catalogNumber,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice || 0,
                  lineTotal: item.lineTotal || 0,
                  notes: item.notes,
                })),
              },
            },
            include: {
              items: true,
            },
          });

          // PurchaseRequest에 orderId 연결
          await tx.purchaseRequest.update({
            where: { id: requestId },
            data: {
              orderId: order.id,
            },
          });
        }
      }

      return { purchaseRequest: approvedRequest, order };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error approving purchase request:", error);
    return NextResponse.json(
      { error: "Failed to approve purchase request" },
      { status: 500 }
    );
  }
}



import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuoteStatus, OrderStatus, ActivityType, Prisma } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";

// 주문번호 생성 함수
function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

/**
 * 주문 생성 API
 * POST /api/orders
 *
 * Body: { quoteId, shippingAddress?, notes? }
 *
 * 트랜잭션 흐름:
 * 1. 견적 검증 (본인 소유, COMPLETED 상태)
 * 2. 예산 체크 (잔액 >= 주문금액)
 * 3. 주문 생성
 * 4. 예산 차감
 * 5. 견적 상태 변경 (PURCHASED)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quoteId, shippingAddress, notes } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId is required" },
        { status: 400 }
      );
    }

    // 트랜잭션으로 모든 작업 처리
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. 견적 검증
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: {
          listItems: true,
          items: true,
          order: true,
        },
      });

      if (!quote) {
        throw new Error("QUOTE_NOT_FOUND");
      }

      // 본인 소유 확인
      if (quote.userId !== session.user.id) {
        throw new Error("NOT_YOUR_QUOTE");
      }

      // 상태 확인 (COMPLETED 상태만 주문 가능)
      if (quote.status !== QuoteStatus.COMPLETED) {
        throw new Error("QUOTE_NOT_COMPLETED");
      }

      // 이미 주문된 견적인지 확인
      if (quote.order) {
        throw new Error("ALREADY_ORDERED");
      }

      // 주문 금액 계산
      const totalAmount = quote.totalAmount ||
        quote.listItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

      if (totalAmount <= 0) {
        throw new Error("INVALID_AMOUNT");
      }

      // 2. 예산 체크
      const budget = await tx.userBudget.findFirst({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!budget) {
        throw new Error("NO_BUDGET");
      }

      if (budget.remainingAmount < totalAmount) {
        throw new Error("INSUFFICIENT_BUDGET");
      }

      // 3. 주문 생성
      const orderNumber = generateOrderNumber();
      const order = await tx.order.create({
        data: {
          userId: session.user.id,
          quoteId: quote.id,
          organizationId: quote.organizationId,
          orderNumber,
          totalAmount,
          status: OrderStatus.ORDERED,
          shippingAddress,
          notes,
          items: {
            create: quote.listItems.map((item) => ({
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

      // 4. 예산 차감
      const balanceBefore = budget.remainingAmount;
      const balanceAfter = balanceBefore - totalAmount;

      await tx.userBudget.update({
        where: { id: budget.id },
        data: {
          usedAmount: budget.usedAmount + totalAmount,
          remainingAmount: balanceAfter,
        },
      });

      // 예산 거래 내역 기록
      await tx.userBudgetTransaction.create({
        data: {
          budgetId: budget.id,
          orderId: order.id,
          type: "DEBIT",
          amount: totalAmount,
          description: `주문 ${orderNumber} - ${quote.title}`,
          balanceBefore,
          balanceAfter,
        },
      });

      // 5. 견적 상태 변경
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.PURCHASED,
        },
      });

      return {
        order,
        budget: {
          id: budget.id,
          name: budget.name,
          totalAmount: budget.totalAmount,
          usedAmount: budget.usedAmount + totalAmount,
          remainingAmount: balanceAfter,
        },
      };
    });

    // 액티비티 로그 기록 (비동기)
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_UPDATED,
      entityType: "order",
      entityId: result.order.id,
      userId: session.user.id,
      metadata: {
        action: "order_created",
        orderNumber: result.order.orderNumber,
        quoteId,
        totalAmount: result.order.totalAmount,
        budgetRemaining: result.budget.remainingAmount,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    return NextResponse.json({
      success: true,
      message: "주문이 성공적으로 생성되었습니다.",
      order: result.order,
      budget: result.budget,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);

    // 에러 메시지 매핑
    const errorMessages: Record<string, { message: string; status: number }> = {
      QUOTE_NOT_FOUND: { message: "견적을 찾을 수 없습니다.", status: 404 },
      NOT_YOUR_QUOTE: { message: "본인의 견적만 주문할 수 있습니다.", status: 403 },
      QUOTE_NOT_COMPLETED: {
        message: "확정된 견적만 주문할 수 있습니다. (COMPLETED 상태 필요)",
        status: 400,
      },
      ALREADY_ORDERED: {
        message: "이미 주문된 견적입니다.",
        status: 400,
      },
      INVALID_AMOUNT: {
        message: "유효하지 않은 주문 금액입니다.",
        status: 400,
      },
      NO_BUDGET: {
        message: "등록된 예산이 없습니다. 먼저 예산을 설정해주세요.",
        status: 400,
      },
      INSUFFICIENT_BUDGET: {
        message: "예산이 부족합니다. 잔액을 확인해주세요.",
        status: 400,
      },
    };

    const errorInfo = errorMessages[error.message];
    if (errorInfo) {
      return NextResponse.json(
        { error: errorInfo.message },
        { status: errorInfo.status }
      );
    }

    return NextResponse.json(
      { error: "주문 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 주문 목록 조회 API
 * GET /api/orders
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");

    const skip = (page - 1) * limit;

    const where: any = {
      userId: session.user.id,
    };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          quote: {
            select: {
              id: true,
              title: true,
            },
          },
          items: true,
          budgetTransaction: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

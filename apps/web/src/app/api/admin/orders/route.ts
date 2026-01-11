import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuoteStatus, OrderStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

/**
 * 관리자용 주문 생성 API
 * POST /api/admin/orders
 * 
 * Body: { quoteId, shippingAddress?, notes? }
 * 
 * 관리자는 다른 사용자의 견적도 주문으로 전환할 수 있음
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: 실제 환경에서는 관리자 권한 확인 필요
    // if (session.user.role !== "ADMIN") {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

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
          items: true,
          order: true,
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!quote) {
        throw new Error("QUOTE_NOT_FOUND");
      }

      // userId 확인
      if (!quote.userId) {
        throw new Error("QUOTE_USER_MISSING");
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
        quote.items.reduce((sum: number, item: { lineTotal: number | null }) => sum + (item.lineTotal || 0), 0);

      if (totalAmount <= 0) {
        throw new Error("INVALID_AMOUNT");
      }

      // 2. 예산 체크 (견적 소유자의 예산)
      const budget = await tx.userBudget.findFirst({
        where: {
          userId: quote.userId,
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

      // 3. 주문 생성 (견적 소유자에게 주문 생성)
      const orderNumber = generateOrderNumber();
      const order = await tx.order.create({
        data: {
          userId: quote.userId, // 견적 소유자
          quoteId: quote.id,
          orderNumber,
          totalAmount,
          status: OrderStatus.ORDERED,
          shippingAddress,
          notes,
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

      // 4. 예산 차감 (견적 소유자의 예산)
      const updatedBudget = await tx.userBudget.update({
        where: { id: budget.id },
        data: {
          remainingAmount: {
            decrement: totalAmount,
          },
        },
      });

      // 5. 예산 거래 내역 기록
      await tx.userBudgetTransaction.create({
        data: {
          budgetId: budget.id,
          orderId: order.id,
          amount: -totalAmount,
          type: "ORDER",
          description: `주문 생성: ${orderNumber}`,
          balanceBefore: budget.remainingAmount,
          balanceAfter: updatedBudget.remainingAmount,
        },
      });

      // 6. 견적 상태 변경 (PURCHASED)
      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: QuoteStatus.PURCHASED,
        },
      });

      return { order, budget: updatedBudget, quote: updatedQuote };
    });

    return NextResponse.json({
      success: true,
      order: result.order,
    });
  } catch (error: any) {
    console.error("Error creating admin order:", error);
    
    const errorMessages: Record<string, string> = {
      QUOTE_NOT_FOUND: "견적을 찾을 수 없습니다.",
      QUOTE_NOT_COMPLETED: "완료된 견적만 주문으로 전환할 수 있습니다.",
      ALREADY_ORDERED: "이미 주문된 견적입니다.",
      INVALID_AMOUNT: "유효하지 않은 금액입니다.",
      NO_BUDGET: "예산이 설정되지 않았습니다.",
      INSUFFICIENT_BUDGET: "예산이 부족합니다.",
    };

    return NextResponse.json(
      {
        error: errorMessages[error.message] || "주문 생성에 실패했습니다.",
      },
      { status: 400 }
    );
  }
}



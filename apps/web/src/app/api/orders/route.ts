import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuoteStatus, OrderStatus, ActivityType, Prisma, TeamRole } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { logStateTransition } from "@/lib/operations/state-transition-logger";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

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
/**
 * Security: enforceAction (order_create)
 * - server-authoritative role check (buyer/approver/ops_admin)
 * - concurrency lock (동일 견적 중복 주문 차단)
 * - audit envelope 기록
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quoteId, shippingAddress, notes, expectedDelivery, budgetId } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId is required" },
        { status: 400 }
      );
    }

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'order_create',
      targetEntityType: 'order',
      targetEntityId: quoteId, // 견적 기반 주문이므로 quoteId를 entity로 사용
      sourceSurface: 'order-create-api',
      routePath: '/api/orders',
    });

    if (!enforcement.allowed) {
      return enforcement.deny();
    }

    // 권한 체크: MEMBER는 직접 주문 불가, 구매 요청만 가능
    const userTeams = await db.teamMember.findMany({
      where: { userId: session.user.id },
    });

    const isMemberOnly = userTeams.every(
      (tm: any) => tm.role === TeamRole.MEMBER
    ) && userTeams.length > 0;

    if (isMemberOnly) {
      return NextResponse.json(
        {
          error: "MEMBER_ROLE_RESTRICTION",
          message: "일반 멤버는 직접 주문할 수 없습니다. 구매 요청을 보내주세요.",
        },
        { status: 403 }
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
        quote.items.reduce((sum: number, item: { lineTotal: number | null }) => sum + (item.lineTotal || 0), 0);

      if (totalAmount <= 0) {
        throw new Error("INVALID_AMOUNT");
      }

      // 2. 예산 체크
      const budget = budgetId
        ? await tx.userBudget.findUnique({
            where: { id: budgetId },
          })
        : await tx.userBudget.findFirst({
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
          expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
          items: {
            create: quote.items.map((item: { productId: string | null; name: string | null; brand: string | null; catalogNumber: string | null; quantity: number; unitPrice: number | null; lineTotal: number | null; notes: string | null }) => ({
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

      // 4. 예산 차감 (SELECT FOR UPDATE + 원자적 연산)
      await tx.$executeRaw`SELECT id FROM "UserBudget" WHERE id = ${budget.id} FOR UPDATE`;

      const updatedBudget = await tx.userBudget.update({
        where: { id: budget.id },
        data: {
          usedAmount:      { increment: totalAmount },
          remainingAmount: { decrement: totalAmount },
        },
      });

      // 동시 요청으로 음수가 됐을 경우 즉시 롤백
      if (updatedBudget.remainingAmount < 0) {
        throw new Error("INSUFFICIENT_BUDGET");
      }

      const balanceBefore = budget.remainingAmount;
      const balanceAfter  = updatedBudget.remainingAmount;

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
          id: updatedBudget.id,
          name: updatedBudget.name,
          totalAmount: updatedBudget.totalAmount,
          usedAmount: updatedBudget.usedAmount,
          remainingAmount: updatedBudget.remainingAmount,
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

    // P7-1: 중앙화된 상태 전이 로그
    logStateTransition({
      domain: "ORDER",
      entityId: result.order.id,
      fromStatus: "CREATED",
      toStatus: "ORDERED",
      actorId: session.user.id,
      organizationId: result.order.organizationId,
      metadata: { orderNumber: result.order.orderNumber, quoteId },
    }).catch((error) => {
      console.error("Failed to log state transition:", error);
    });

    // Closed-loop 활동 로그: 주문 상태 전이
    const { ipAddress: ip2, userAgent: ua2 } = extractRequestMeta(request);
    const actorRole = await getActorRole(session.user.id, result.order.organizationId);
    await createActivityLog({
      activityType: "ORDER_STATUS_CHANGED",
      entityType: "ORDER",
      entityId: result.order.id,
      afterStatus: "ORDERED",
      userId: session.user.id,
      organizationId: result.order.organizationId,
      actorRole,
      metadata: {
        orderNumber: result.order.orderNumber,
        quoteId,
        totalAmount: result.order.totalAmount,
        trigger: "order_created",
      },
      ipAddress: ip2,
      userAgent: ua2,
    });

    enforcement.complete({
      beforeState: { quoteId, status: 'COMPLETED' },
      afterState: { orderId: result.order.id, orderNumber: result.order.orderNumber, status: 'ORDERED' },
    });

    return NextResponse.json({
      success: true,
      message: "주문이 성공적으로 생성되었습니다.",
      order: result.order,
      budget: result.budget,
    });
  } catch (error: any) {
    enforcement?.fail();
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
    const organizationId = searchParams.get("organizationId");

    const skip = (page - 1) * limit;

    // organizationId가 주어진 경우 조직 멤버 권한 확인
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { organizationId, userId: session.user.id },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "해당 조직에 접근 권한이 없습니다." },
          { status: 403 }
        );
      }
    }

    // organizationId 있으면 조직 주문, 없으면 개인 주문
    const where: any = organizationId
      ? { organizationId }
      : { userId: session.user.id };

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

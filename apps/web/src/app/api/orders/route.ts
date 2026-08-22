import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuoteStatus, OrderStatus, ActivityType, Prisma, TeamRole } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { logStateTransition } from "@/lib/operations/state-transition-logger";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
// #post-approval-purchase-order-flow Phase 1.3-wiring-K — vendor-aware
// service. POCandidate ≥ 1 → vendor 별 N Order, 0개 시 legacy quote.items
// 기반 1 NULL-vendor Order fallback (backward compat).
import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";
import { buildOrderDispatchReadiness } from "@/lib/orders/dispatch-readiness";
// 알림 고도화 #notif-order-placed — 발주 생성 성공 후 ORDER_PLACED 알림(best-effort).
// caller 0 갭(ORDER_CREATED_FROM_POCANDIDATE 는 audit eventType, 알림 아님).
import { dispatchNotificationEvent, resolveOrgRecipients } from "@/lib/notifications";
import {
  validateReservation,
  buildReservationEvent,
  activeReservedAmount,
  ORDER_RESERVED,
  ORDER_RELEASED,
  ORDER_CONFIRMED,
} from "@/lib/budget/order-reservation";
import { resolveBudgetPeriod } from "@/lib/budget/budget-period";
import { resolveBudgetPurchaseScopeKeys } from "@/lib/budget/purchase-scope-keys";

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
 * 2. 예산 확인 (canonical Budget · 잔액 = amount − 확정지출 − 활성예약)
 * 3. 주문 생성
 * 4. 예산 예약 (BudgetEvent ORDER_RESERVED — 차감 아님, ⑪ P3)
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

    // §pricing-redesign (호영님 2026-06-27) — PO 월 한도 폐기 → orders enforce 제거.
    const body = await request.json();
    const { quoteId, shippingAddress, notes, expectedDelivery, budgetId, vendorRequestId } = body;

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
      // §11.234 — Quote.order (1:1) → Quote.orders (1:N) §11.211 정합.
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: {
          items: true,
          orders: true,
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

      // §11.234 — 이미 주문된 견적인지 확인 (1:N, orders[].length > 0).
      if (quote.orders && quote.orders.length > 0) {
        throw new Error("ALREADY_ORDERED");
      }

      // 주문 금액 계산
      //
      // §order-amount-from-reply (프로덕션 실측 2026-08-18) — 공급사 회신 단가는
      //   QuoteVendorResponseItem 에만 있고 QuoteListItem.unitPrice/lineTotal 은 0 이라
      //   여기서 항상 0 이 나와 INVALID_AMOUNT(400) 로 발주가 막혀 있었다.
      //   회신 선택 축은 이미 존재한다(구매 처리 경로가 vendorRequestId 로 소비 중) —
      //   정의를 새로 만들지 않고 **같은 축을 주문 경로에 잇는다**.
      //   scope 검증: 다른 견적의 회신 id 주입을 막는다(타 견적 가격으로 발주 금지).
      //   0원 창작 금지: 회신에 단가가 없으면 종전과 동일하게 INVALID_AMOUNT.
      const replyPriceByItemId = new Map<string, number>();
      if (vendorRequestId) {
        const replyItems = await tx.quoteVendorResponseItem.findMany({
          where: { vendorRequestId, vendorRequest: { quoteId: quote.id } },
          select: { quoteItemId: true, unitPrice: true },
        });
        for (const ri of replyItems) {
          const unit = Math.round(Number(ri.unitPrice ?? 0));
          if (unit > 0) replyPriceByItemId.set(ri.quoteItemId, unit);
        }
      }
      const replyTotal = quote.items.reduce(
        (sum: number, item: { id: string; quantity: number }) =>
          sum + (replyPriceByItemId.get(item.id) ?? 0) * (item.quantity || 1),
        0,
      );

      const totalAmount = replyTotal > 0
        ? replyTotal
        : (quote.totalAmount ||
          quote.items.reduce((sum: number, item: { lineTotal: number | null }) => sum + (item.lineTotal || 0), 0));

      if (totalAmount <= 0) {
        throw new Error("INVALID_AMOUNT");
      }

      // 2. 예산 확인 — canonical Budget (⑪ 판정 2026-08-22 · PLAN_order-budget-reservation P3)
      //    UserBudget 조회/차감 경로 소거: 발주 예산의 canonical truth 는 Budget 이고,
      //    차감이 아니라 BudgetEvent 예약(ORDER_RESERVED)으로 기록한다.
      //    지출 확정은 PurchaseRecord 소관 — 예약과 확정을 겹쳐 세지 않는다.
      const budget = budgetId
        ? await tx.budget.findUnique({ where: { id: budgetId } })
        : await tx.budget.findFirst({
            where: { organizationId: quote.organizationId },
            orderBy: { yearMonth: "desc" },
          });

      if (!budget) {
        throw new Error("NO_BUDGET");
      }

      // 동시 예약 직렬화 — 잔액 계산~예약 기록 구간 (구 UserBudget FOR UPDATE 패턴 승계)
      await tx.$executeRaw`SELECT id FROM "Budget" WHERE id = ${budget.id} FOR UPDATE`;

      // 잔액식: amount − 확정지출(PurchaseRecord · ⑤ resolveBudgetPeriod 창) − 활성예약(BudgetEvent)
      const { periodStart, periodEnd } = resolveBudgetPeriod(budget);
      const purchaseScopeKeys = await resolveBudgetPurchaseScopeKeys(budget);
      const spentAgg = await tx.purchaseRecord.aggregate({
        _sum: { amount: true },
        where: {
          scopeKey: { in: purchaseScopeKeys },
          purchasedAt: { gte: periodStart, lte: periodEnd },
        },
      });
      const confirmedSpent = spentAgg._sum.amount ?? 0;
      const orderEvents = await tx.budgetEvent.findMany({
        where: {
          budgetId: budget.id,
          eventType: { in: [ORDER_RESERVED, ORDER_RELEASED, ORDER_CONFIRMED] },
        },
        select: { eventType: true, amount: true, sourceEntityId: true },
      });
      const activeReserved = activeReservedAmount(orderEvents);
      // BudgetEvent.organizationId 는 required — 개인 예산(organizationId null)은
      // scopeKey("user-…")를 조직 세그먼트로 쓴다 (budgetEventKey 문법 유지).
      const eventOrgId = budget.organizationId ?? quote.organizationId ?? budget.scopeKey;
      const reservationBudget = {
        id: budget.id,
        organizationId: eventOrgId,
        amount: budget.amount,
      };
      const verdict = validateReservation({
        budget: reservationBudget,
        confirmedSpent,
        activeReserved,
        requested: totalAmount,
      });
      if (!verdict.ok) {
        throw new Error(
          verdict.reason === "INVALID_AMOUNT" ? "INVALID_AMOUNT" : "INSUFFICIENT_BUDGET",
        );
      }

      // 3. 주문 생성
      //
      // #post-approval-purchase-order-flow Phase 1.3-wiring-K — vendor-aware.
      // 결재 통과한 POCandidate (vendor 별 1개씩) 가 있으면 service 호출 →
      // vendor 별 N Order. 없으면 legacy quote.items 기반 1 NULL-vendor Order
      // (backward compat). `order` 변수는 첫 Order 또는 legacy 단일 Order
      // (후속 budget 차감 / state transition log 정합).
      const candidates = await tx.pOCandidate.findMany({
        where: {
          userId: session.user.id,
          organizationId: quote.organizationId,
        },
        include: { items: true },
      });

      let order: any = null;
      if (candidates.length > 0) {
        const result = await convertPOCandidatesToOrders(
          {
            quoteId: quote.id,
            userId: session.user.id,
            organizationId: quote.organizationId,
            candidates,
          },
          { client: tx },
        );
        if (result.created.length > 0) {
          const firstOrderId = result.created[0].orderId;
          order = await tx.order.findUnique({
            where: { id: firstOrderId },
            include: { items: true, vendor: true },
          });
        }
      }

      // legacy fallback — POCandidate 0개 또는 service 가 0 Order 생성 시.
      // §11.234 — orderNumber hoist (line 247 description 참조).
      let orderNumber: string | null = null;
      if (!order) {
        orderNumber = generateOrderNumber();
        order = await tx.order.create({
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
              create: quote.items.map((item: { id: string; productId: string | null; name: string | null; brand: string | null; catalogNumber: string | null; quantity: number; unitPrice: number | null; lineTotal: number | null; notes: string | null }) => ({
                productId: item.productId,
                name: item.name || "Unknown Product",
                brand: item.brand,
                catalogNumber: item.catalogNumber,
                quantity: item.quantity,
                // §order-amount-from-reply — 회신 단가가 있으면 라인에도 그 값을 쓴다
                //   (헤더 총액과 라인 합계가 갈리면 발주서가 자기모순이 된다).
                unitPrice: replyPriceByItemId.get(item.id) ?? item.unitPrice ?? 0,
                lineTotal: replyPriceByItemId.has(item.id)
                  ? replyPriceByItemId.get(item.id)! * (item.quantity || 1)
                  : item.lineTotal || 0,
                notes: item.notes,
              })),
            },
          },
          include: {
            items: true,
            vendor: true,
          },
        });
      }

      // 4. 예약 기록 (P3) — 차감이 아니다. BudgetEvent 원장에 ORDER_RESERVED 를 남기고
      //    잔액은 amount − PurchaseRecord − 활성예약으로 파생한다 (canonical truth 보호).
      //    budgetEventKey unique 가 같은 주문의 중복 예약을 막는다 (idempotency 문법 승계).
      const reserveEvent = buildReservationEvent({
        budget: reservationBudget,
        orderId: order.id,
        amount: totalAmount,
        sequence: 1,
      });
      await tx.budgetEvent.create({
        data: {
          organizationId: eventOrgId,
          budgetEventKey: reserveEvent.budgetEventKey,
          eventType: reserveEvent.eventType,
          sourceEntityType: reserveEvent.sourceEntityType,
          sourceEntityId: reserveEvent.sourceEntityId,
          budgetId: budget.id,
          yearMonth: budget.yearMonth,
          amount: totalAmount,
          preCommitted: activeReserved,
          postCommitted: activeReserved + totalAmount,
          executedBy: session.user.id,
        },
      });

      // 5. 견적 상태 변경
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.PURCHASED,
        },
      });

      const budgetNameMatch = budget.description?.match(/^\[([^\]]+)\]/);
      return {
        order,
        budget: {
          id: budget.id,
          name: budgetNameMatch?.[1] ?? `${budget.yearMonth} 예산`,
          totalAmount: budget.amount,
          usedAmount: confirmedSpent,
          reservedAmount: activeReserved + totalAmount,
          remainingAmount: verdict.remainingAfter ?? 0,
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

    // 알림 고도화 — 발주 생성 완료 → ORDER_PLACED (best-effort, mutation 비차단).
    // vendor-split(POCandidate) 시 result.order = 대표(첫) Order — activity/state
    // transition 로그 granularity 와 정합(나머지 vendor Order 알림은 후속 백로그).
    try {
      const recipients = await resolveOrgRecipients(
        result.order.userId,
        result.order.organizationId,
      );
      if (recipients.length > 0) {
        await dispatchNotificationEvent({
          eventType: "ORDER_PLACED",
          entityType: "ORDER",
          entityId: result.order.id,
          triggeredBy: session.user.id,
          recipients,
          metadata: {
            orderNumber: result.order.orderNumber,
            quoteId,
            totalAmount: result.order.totalAmount,
          },
        });
      }
    } catch (notifyErr) {
      console.error("[orders POST] ORDER_PLACED dispatch 실패 (무시):", notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: "주문이 성공적으로 생성되었습니다.",
      order: result.order,
      budget: result.budget,
      dispatchReadiness: buildOrderDispatchReadiness(result.order),
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
      // §order-no-budget-message — P3 재배선 후: 발주 예산의 canonical truth 는
      // 예산 관리 화면의 Budget 이다. 문구는 그 사실을 가리킨다 (⑫ 사실화 2차).
      NO_BUDGET: {
        message:
          "발주에 사용할 예산이 없습니다 · 발주는 예산 관리 화면의 예산을 사용합니다. 예산 관리에서 예산을 만들어 주세요.",
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
    // §pricing-refresh P4b — 아카이브분(archivedAt 세팅) 조회 숨김. env 미설정 시 전부 null=영향 0.
    where.archivedAt = null;

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

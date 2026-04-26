/**
 * apps/web/src/app/api/work-queue/purchase-conversion/bulk-po/route.ts
 *
 * α-D session B (ADR-002 §11.22). Atomic bulk PO conversion: takes a
 * list of quoteIds the operator has marked ready_for_po (selectedReplyId
 * set, in replies, no existing Order) and creates the corresponding
 * Order rows in a single Prisma transaction. All-or-nothing — if any
 * single quote fails the pre-check, NO Order is written and the
 * caller gets back the first failing reason.
 *
 * Request:
 *   POST /api/work-queue/purchase-conversion/bulk-po
 *   body: { quoteIds: string[] }   (1-50 items)
 *
 * Response (200):
 *   { success: true, data: { results: Array<{ quoteId, orderId, orderNumber }> } }
 *
 * Failure codes:
 *   401 UNAUTHORIZED       — no session
 *   400 INVALID_JSON       — body parse failed
 *   400 INVALID_INPUT      — schema parse failed (no quoteIds, > 50, etc.)
 *   404 QUOTE_MISSING      — at least one quoteId not found / not owned
 *   409 ORDER_EXISTS       — at least one quote already has an Order
 *   409 NO_SELECTED_REPLY  — at least one quote missing a valid selectedReplyId
 *   500 INTERNAL_ERROR     — transaction rolled back
 *
 * Lock-release discipline (§11.21 lesson):
 *   Every 4xx return below the enforceAction line calls
 *   enforcement.fail(). Catch block also calls fail(). Test mock
 *   spies on complete/fail so the regression is reproducible at unit
 *   level.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateOrderNumber } from "@/lib/api/order-number";
import {
  enforceAction,
  type InlineEnforcementHandle,
} from "@/lib/security/server-enforcement-middleware";

const bodySchema = z.object({
  quoteIds: z.array(z.string()).min(1).max(50),
});

interface BulkPoResultEntry {
  readonly quoteId: string;
  readonly orderId: string;
  readonly orderNumber: string;
}

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    // ── Security enforcement (lock acquired from here on; release on every 4xx) ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "po_conversion_finalize",
      targetEntityType: "po",
      // Bulk action — concurrency lock keyed on the user, not a single
      // entity, since the entity set is the whole batch. Using userId
      // here means two parallel bulk-PO calls from the same user serialize
      // (correct: prevents double-create races on the same quotes).
      targetEntityId: `bulk-po:${session.user.id}`,
      sourceSurface: "purchase-conversion-bulk",
      routePath: "/api/work-queue/purchase-conversion/bulk-po",
    });
    if (!enforcement.allowed) return enforcement.deny();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      enforcement.fail();
      return NextResponse.json(
        { success: false, error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 },
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      enforcement.fail();
      return NextResponse.json(
        {
          success: false,
          error: "잘못된 요청 형식입니다.",
          code: "INVALID_INPUT",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Dedupe — same quoteId requested twice maps to one Order.
    const quoteIds = Array.from(new Set(parsed.data.quoteIds));

    // Single fetch with ownership filter. If any id is missing here,
    // it's either non-existent or owned by another user — same 404.
    const quotes = await db.quote.findMany({
      where: { id: { in: quoteIds }, userId: session.user.id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        title: true,
        currency: true,
        totalAmount: true,
        selectedReplyId: true,
        replies: { select: { id: true } },
        items: {
          select: {
            productId: true,
            name: true,
            brand: true,
            catalogNumber: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            notes: true,
          },
        },
        order: { select: { id: true } },
      },
    });

    if (quotes.length !== quoteIds.length) {
      enforcement.fail();
      return NextResponse.json(
        {
          success: false,
          error: "일부 견적을 찾을 수 없거나 권한이 없습니다.",
          code: "QUOTE_MISSING",
        },
        { status: 404 },
      );
    }

    // Pre-validation: existing Order? selectedReplyId valid?
    for (const q of quotes) {
      if (q.order !== null) {
        enforcement.fail();
        return NextResponse.json(
          {
            success: false,
            error: `이미 발주된 견적이 포함되어 있습니다 (${q.id}).`,
            code: "ORDER_EXISTS",
          },
          { status: 409 },
        );
      }
      if (
        !q.selectedReplyId ||
        !q.replies.some((r: { id: string }) => r.id === q.selectedReplyId)
      ) {
        enforcement.fail();
        return NextResponse.json(
          {
            success: false,
            error: `선택된 회신이 없거나 유효하지 않은 견적이 포함되어 있습니다 (${q.id}).`,
            code: "NO_SELECTED_REPLY",
          },
          { status: 409 },
        );
      }
    }

    // Atomic transaction — all Orders created or none. Timeout headroom
    // matches pilot-seed's pattern (§11.7 cold-pooler grace).
    const results: BulkPoResultEntry[] = await db.$transaction(
      async (tx: any) => {
        const created: BulkPoResultEntry[] = [];
        for (const q of quotes) {
          // Total amount priority: explicit Quote.totalAmount, else sum
          // of item.lineTotal (skipping null lines).
          const itemTotal = q.items.reduce(
            (sum: number, it: any) => sum + (it.lineTotal ?? 0),
            0,
          );
          const totalAmount = q.totalAmount ?? itemTotal;

          // Order create — orderNumber is set in a follow-up update so
          // the cuid that drives the suffix already exists.
          const newOrder = await tx.order.create({
            data: {
              userId: q.userId!,
              quoteId: q.id,
              organizationId: q.organizationId,
              orderNumber: `ORD-PENDING-${q.id.slice(-6)}`, // overwritten below
              totalAmount,
              status: "ORDERED",
            },
          });
          const orderNumber = generateOrderNumber(newOrder.id);
          const updatedOrder = await tx.order.update({
            where: { id: newOrder.id },
            data: { orderNumber },
            select: { id: true, orderNumber: true },
          });

          if (q.items.length > 0) {
            await tx.orderItem.createMany({
              data: q.items.map((it: any) => ({
                orderId: newOrder.id,
                productId: it.productId,
                name: it.name ?? "(이름 없음)", // OrderItem.name is NOT NULL
                brand: it.brand,
                catalogNumber: it.catalogNumber,
                quantity: it.quantity,
                unitPrice: it.unitPrice ?? 0, // OrderItem.unitPrice is NOT NULL
                lineTotal: it.lineTotal ?? 0, // OrderItem.lineTotal is NOT NULL
                notes: it.notes,
              })),
            });
          }

          created.push({
            quoteId: q.id,
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
          });
        }
        return created;
      },
      {
        timeout: 30_000,
        maxWait: 10_000,
      },
    );

    enforcement.complete({
      beforeState: { quoteIds, orderCount: 0 },
      afterState: {
        quoteIds,
        orderCount: results.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: { results },
    });
  } catch (error: any) {
    if (enforcement) enforcement.fail();
    console.error(
      "[POST /api/work-queue/purchase-conversion/bulk-po] error:",
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: "일괄 발주 전환 중 오류가 발생했습니다.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

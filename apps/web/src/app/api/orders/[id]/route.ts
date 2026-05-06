/**
 * #post-approval-purchase-order-flow Phase 4.1 server —
 * /api/orders/[id] GET + PATCH
 *
 * GET: order detail (auth + ownership 검증)
 * PATCH: status / shippingAddress / expectedDelivery / actualDelivery 변경
 *   - zod + auth + ownership
 *   - audit log (SETTINGS_CHANGED + entityType ORDER) try/catch graceful
 *   - partial update 호환 (모든 field optional)
 *
 * Lock:
 *   - owner (Order.userId) 또는 organization member 만 PATCH
 *   - mutation atomic 보호 (audit fail 시 mutation 결과 영향 0)
 *   - status 변경 시 before/after capture
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog } from "@/lib/audit/audit-logger";

const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  shippingAddress: z.string().max(500).optional().nullable(),
  expectedDelivery: z.string().datetime().optional().nullable(),
  actualDelivery: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/orders/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // #post-approval-purchase-order-flow Phase 4.2-A1 — vendor include
    // 추가 (Phase 1.2 의 Order.vendor relation 활용). UI 가 vendor name +
    // email 표시하고 PDF/email button 의 disabled state 분기에 사용.
    const order = await db.order.findUnique({
      where: { id },
      include: { items: true, vendor: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ownership 검증 — owner 또는 organization member
    const isOwner = order.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && order.organizationId) {
      const member = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: order.organizationId },
      });
      isOrgMember = !!member;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleApiError(error, "orders/[id]/GET");
  }
}

/**
 * PATCH /api/orders/[id]
 * status / 배송 정보 / notes 변경.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    // ownership 검증 + before snapshot
    const before = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        status: true,
        shippingAddress: true,
        expectedDelivery: true,
        actualDelivery: true,
        notes: true,
      },
    });
    if (!before) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const isOwner = before.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && before.organizationId) {
      const member = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: before.organizationId },
      });
      isOrgMember = !!member;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // partial update — 명시된 field 만
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.shippingAddress !== undefined)
      updateData.shippingAddress = data.shippingAddress;
    if (data.expectedDelivery !== undefined)
      updateData.expectedDelivery =
        data.expectedDelivery == null ? null : new Date(data.expectedDelivery);
    if (data.actualDelivery !== undefined)
      updateData.actualDelivery =
        data.actualDelivery == null ? null : new Date(data.actualDelivery);
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "At least one field must be provided" },
        { status: 400 },
      );
    }

    const updated = await db.order.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    // audit log (best effort — try/catch graceful)
    try {
      await createAuditLog({
        organizationId: before.organizationId ?? undefined,
        userId: session.user.id,
        eventType: "SETTINGS_CHANGED" as never,
        entityType: "ORDER",
        entityId: id,
        action: "order_update",
        changes: {
          before: {
            status: before.status,
            shippingAddress: before.shippingAddress,
            expectedDelivery: before.expectedDelivery,
            actualDelivery: before.actualDelivery,
            notes: before.notes,
          },
          after: {
            status: updateData.status ?? before.status,
            shippingAddress: updateData.shippingAddress ?? before.shippingAddress,
            expectedDelivery: updateData.expectedDelivery ?? before.expectedDelivery,
            actualDelivery: updateData.actualDelivery ?? before.actualDelivery,
            notes: updateData.notes ?? before.notes,
          },
        },
        metadata: {
          orderNumber: updated.orderNumber,
        },
      });
    } catch (auditErr) {
      console.error(
        "[orders/PATCH] audit log 실패 (mutation 정합 유지):",
        auditErr,
      );
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    return handleApiError(error, "orders/[id]/PATCH");
  }
}

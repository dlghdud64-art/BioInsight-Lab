/**
 * #post-approval-purchase-order-flow Phase 2.2 — POST /api/orders/[id]/generate-pdf
 *
 * vendor 별 Order 의 발주서 PDF 생성 + stream 반환. storage upload + Order
 * .poDocumentUrl 매핑은 Phase 2.3 mini-batch (별도). 본 route 는 즉시
 * stream 반환 (사용자 다운로드).
 *
 * canonical truth = Order (DB). PDF 는 derived projection (snapshot).
 *
 * Lock:
 *   - auth (인증된 사용자만)
 *   - ownership (Order.userId 또는 organizationMember)
 *   - audit log (eventType: SETTINGS_CHANGED, action: pdf_generate)
 *   - Content-Type: application/pdf + Content-Disposition: attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { generatePoPdf } from "@/lib/orders/po-pdf-generator";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Order fetch — vendor / items 포함
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        vendor: true,
        user: { select: { name: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ownership 검증
    const userId = session.user.id;
    const isOwner = order.userId === userId;
    let isOrgMember = false;
    if (!isOwner && order.organizationId) {
      const member = await db.organizationMember.findFirst({
        where: { userId, organizationId: order.organizationId },
      });
      isOrgMember = !!member;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // PDF 생성 — synchronous (Phase 2.2 MVP, async queue 분리 0).
    const pdfBuffer = await generatePoPdf({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        notes: order.notes,
        expectedDelivery: order.expectedDelivery,
        createdAt: order.createdAt,
        vendor: order.vendor
          ? {
              id: order.vendor.id,
              name: order.vendor.name,
              nameEn: order.vendor.nameEn ?? null,
              email: order.vendor.email ?? null,
              phone: order.vendor.phone ?? null,
            }
          : null,
        items: order.items.map((it) => ({
          name: it.name,
          brand: it.brand,
          catalogNumber: it.catalogNumber,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
        })),
      },
      requesterName: order.user?.name ?? undefined,
    });

    // audit log — try/catch graceful (mutation 영향 0).
    // #audit-event-type-order — dedicated enum `PO_PDF_GENERATED` 사용
    // (직전 SETTINGS_CHANGED 재사용 → cleanup 정합).
    await createAuditLog({
      userId,
      organizationId: order.organizationId ?? undefined,
      eventType: "PO_PDF_GENERATED",
      entityType: "ORDER",
      entityId: order.id,
      action: "pdf_generate",
      metadata: {
        kind: "po_pdf_generated",
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor?.name ?? null,
        byteSize: pdfBuffer.length,
      },
    }).catch(() => {
      // audit log 실패는 PDF 응답 영향 0
    });

    // PDF stream 반환 — application/pdf + attachment.
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${order.orderNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "orders/[id]/generate-pdf/POST");
  }
}

/**
 * #post-approval-purchase-order-flow Phase 3.2 — POST /api/orders/[id]/send-email
 *
 * vendor 에게 PO email 송부. 한글 본문 + 발주 detail (품목 표 + 총액 +
 * 예상 배송일 + 발주자). PDF 첨부는 별도 mini-batch (Phase 3.x-attach).
 *
 * canonical truth = Order (DB). Email = derived projection. Order.emailSentAt
 * schema 추가는 별도 mini-batch — 본 batch 는 audit log 로 송부 이력 추적.
 *
 * Lock:
 *   - auth + ownership (Order.userId 또는 organizationMember)
 *   - vendor.email 미설정 시 422 (dead button 차단)
 *   - sendEmail mock fallback (host config 후 SendGrid/Resend 정합)
 *   - audit log (eventType: SETTINGS_CHANGED, action: vendor_email_sent)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { sendEmail } from "@/lib/email/sender";
import { generatePoVendorEmail } from "@/lib/email/po-vendor-template";

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

    // Order fetch — vendor / items / requester user 포함
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        vendor: true,
        user: { select: { name: true, email: true } },
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

    // vendor.email 미설정 시 422 (dead button 차단 — UI 가 button disable
    // 하지만 server-side defense in depth).
    if (!order.vendor || !order.vendor.email) {
      return NextResponse.json(
        {
          error: "공급사 이메일이 설정되지 않아 발송할 수 없습니다.",
          code: "VENDOR_EMAIL_MISSING",
        },
        { status: 422 },
      );
    }

    // template 합산
    const template = generatePoVendorEmail({
      vendorName: order.vendor.name,
      vendorNameEn: order.vendor.nameEn,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      requesterName: order.user?.name ?? null,
      requesterEmail: order.user?.email ?? null,
      expectedDelivery: order.expectedDelivery,
      notes: order.notes,
      items: order.items.map((it) => ({
        name: it.name,
        brand: it.brand,
        catalogNumber: it.catalogNumber,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
    });

    // sendEmail 호출 — 현재 mock (host config 후 실제 송부).
    // 실패 시 catch 에서 500 반환 (mutation atomic 외라 audit 도 fail).
    await sendEmail({
      to: order.vendor.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    // audit log — try/catch graceful (이미 송부 완료, audit 실패가 응답 영향 0).
    // eventType SETTINGS_CHANGED 재사용 (Phase 1.3 / 2.2 패턴 정합), action: vendor_email_sent.
    await createAuditLog({
      userId,
      organizationId: order.organizationId ?? undefined,
      eventType: "SETTINGS_CHANGED",
      entityType: "ORDER",
      entityId: order.id,
      action: "vendor_email_sent",
      metadata: {
        kind: "po_vendor_email_sent",
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        vendorEmail: order.vendor.email,
        subject: template.subject,
      },
    }).catch(() => {
      // audit log 실패는 응답 영향 0
    });

    return NextResponse.json({
      success: true,
      to: order.vendor.email,
      subject: template.subject,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "orders/[id]/send-email/POST");
  }
}

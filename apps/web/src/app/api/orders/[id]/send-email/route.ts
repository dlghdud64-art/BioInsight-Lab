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
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
import { sendEmail } from "@/lib/email/sender";
import { generatePoVendorEmail } from "@/lib/email/po-vendor-template";
// #post-approval-purchase-order-flow Phase 3.x-attach — vendor email 의 PDF
// 첨부. 직전 Phase 3.2 본문만 → PDF binary 첨부 추가. host mailer (Resend
// /SendGrid) 가 attachments field 를 정합 송부, mock 은 metadata logging.
import { generatePoPdf } from "@/lib/orders/po-pdf-generator";
// §11.348-A-1 — 발주 후 입고 회신 링크용 토큰(견적 vendor-request 패턴 재사용).
import { generateVendorRequestToken } from "@/lib/api/vendor-request-token";

export async function POST(
  request: NextRequest,
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

    // §11.348-A-1 — 입고 회신 폐루프 입구: ReceivingDraft(AWAITING_REPLY)
    // get-or-create. 재발송 시 기존 미회신 draft 의 token 재사용(중복 링크 방지).
    // 실패해도 발주 메일 자체는 본문/PDF 로 송부(graceful) — 링크만 생략.
    let receivingReplyUrl: string | undefined;
    try {
      const existingDraft = await db.receivingDraft.findFirst({
        where: {
          orderId: order.id,
          status: { in: ["AWAITING_REPLY", "PENDING_REVIEW"] },
        },
        select: { token: true },
      });
      let token = existingDraft?.token;
      if (!token) {
        token = generateVendorRequestToken();
        await db.receivingDraft.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            organizationId: order.organizationId ?? null,
            vendorId: order.vendorId ?? null,
            token,
            status: "AWAITING_REPLY",
            // 14일 만료 — 견적 vendor-request 와 동일 기본값.
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            // 발송 시점 PO 스냅샷(회신 폼 freeze 기준 — A-2).
            snapshot: {
              orderNumber: order.orderNumber,
              items: order.items.map((it: typeof order.items[number]) => ({
                orderItemId: it.id,
                productId: it.productId,
                name: it.name,
                quantity: it.quantity,
              })),
            },
          },
        });
      }
      receivingReplyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/receiving/${token}`;
    } catch {
      receivingReplyUrl = undefined;
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
      // §11.348-A-1 — 입고 회신 CTA 링크.
      receivingReplyUrl,
      items: order.items.map((it: typeof order.items[number]) => ({
        name: it.name,
        brand: it.brand,
        catalogNumber: it.catalogNumber,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
    });

    // #post-approval-purchase-order-flow Phase 3.x-attach — PDF 첨부.
    // generatePoPdf 호출 후 attachments field 로 전달. PDF 생성 실패 시
    // 본문만 송부 (graceful degradation).
    let pdfAttachment:
      | { filename: string; content: Buffer; contentType: string }
      | undefined;
    try {
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
          items: order.items.map((it: typeof order.items[number]) => ({
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
      pdfAttachment = {
        filename: `${order.orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      };
    } catch {
      // PDF 생성 실패 = graceful degradation, 본문만 송부.
      pdfAttachment = undefined;
    }

    // sendEmail 호출 — 현재 mock (host config 후 실제 송부).
    // 실패 시 catch 에서 500 반환 (mutation atomic 외라 audit 도 fail).
    await sendEmail({
      to: order.vendor.email,
      // §11.348-A-1 — 공급사 답장이 발주자(연구소)에게 가도록 reply-to(SEND-A 동형).
      replyTo: order.user?.email ?? undefined,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });

    // audit log — try/catch graceful (이미 송부 완료, audit 실패가 응답 영향 0).
    // #audit-event-type-order — dedicated enum `VENDOR_EMAIL_SENT` 사용
    // (직전 SETTINGS_CHANGED 재사용 → cleanup 정합).
    await createAuditLog({
      userId,
      organizationId: order.organizationId ?? undefined,
      eventType: "VENDOR_EMAIL_SENT",
      entityType: "ORDER",
      entityId: order.id,
      action: "vendor_email_sent",
      ...auditRequestMeta(request), // §11.345-B2 — IP/UA 캡처
      metadata: {
        kind: "po_vendor_email_sent",
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        vendorEmail: order.vendor.email,
        subject: template.subject,
        // Phase 3.x-attach — PDF 첨부 byte size (실패 시 0).
        attachmentByteSize: pdfAttachment?.content.length ?? 0,
        hasAttachment: !!pdfAttachment,
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

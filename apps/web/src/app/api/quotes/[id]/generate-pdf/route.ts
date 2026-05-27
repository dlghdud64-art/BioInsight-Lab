/**
 * §11.314-b #quote-generate-pdf — POST/GET /api/quotes/[id]/generate-pdf
 *
 * 호영님 §11.308 확인요청 → 옵션 C (PDF 생성 + mailto MVP):
 *   견적 요청서 PDF 를 생성해 stream 반환. 사용자가 다운로드 후 공급사에
 *   메일 첨부 전송 (클라이언트 mailto). 실제 SMTP 자동 발송은 Phase 2 후속.
 *
 * §11.314-b 패턴: app/api/orders/[id]/generate-pdf/route.ts 복제 정합.
 *   canonical truth = Quote (DB). PDF 는 derived projection (snapshot) —
 *   Quote data 변경 0. GET/POST 둘 다 (mobile expo-file-system 호환).
 *
 * Lock:
 *   - auth (인증된 사용자만)
 *   - ownership (Quote.userId / organizationMember / guestKey 3-source)
 *   - audit log (best-effort, graceful)
 *   - Content-Type: application/pdf + Content-Disposition: attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { generateQuoteRequestPdf } from "@/lib/quotes/quote-request-pdf-generator";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return POST(request, context);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    const headerGuestKey = request.headers.get("X-Guest-Key");

    // Quote fetch — items 포함 (product 상세는 별도 조회)
    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        items: { orderBy: { lineNumber: "asc" } },
      },
    });
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // ownership 검증 (3-source: owner / org member / guestKey) — vendor-requests 정합
    let isOrgMember = false;
    if (session?.user?.id && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: quote.organizationId },
        select: { id: true },
      });
      isOrgMember = !!membership;
    }
    const hasAccess =
      (session?.user?.id && quote.userId === session.user.id) ||
      isOrgMember ||
      (quote.guestKey &&
        (quote.guestKey === headerGuestKey ||
          quote.guestKey === (await getOrCreateGuestKey())));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // QuoteItem.productId → Product 상세 조회 (품목명/브랜드/카탈로그/규격/grade)
    const productIds = quote.items
      .map((it: typeof quote.items[number]) => it.productId)
      .filter((id: string | null | undefined): id is string => Boolean(id));
    const products = productIds.length
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            brand: true,
            catalogNumber: true,
            specification: true,
            grade: true,
          },
        })
      : ([] as Awaited<ReturnType<typeof db.product.findMany>>);
    const productMap = new Map(products.map((p: { id: string; name: string; brand: string | null; catalogNumber: string | null; specification: string | null; grade: string | null }) => [p.id, p] as const));

    // 요청자 이름 (best-effort)
    const requesterName = session?.user?.name ?? undefined;

    // PDF 생성 — synchronous (MVP, async queue 분리 0).
    const pdfBuffer = await generateQuoteRequestPdf({
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        description: quote.description,
        validUntil: quote.validUntil,
        createdAt: quote.createdAt,
        items: quote.items.map((it: typeof quote.items[number]) => {
          const p = productMap.get(it.productId);
          return {
            productName: p?.name ?? "(품목 미상)",
            brand: p?.brand ?? null,
            catalogNumber: p?.catalogNumber ?? null,
            specification: p?.specification ?? null,
            grade: p?.grade ?? null,
            quantity: it.quantity,
            notes: it.notes,
          };
        }),
      },
      requesterName,
      vendorName: quote.vendor ?? undefined,
    });

    // audit log — best-effort (graceful, PDF 응답 영향 0).
    await createAuditLog({
      userId: session?.user?.id ?? undefined,
      organizationId: quote.organizationId ?? undefined,
      eventType: "SETTINGS_CHANGED",
      entityType: "QUOTE",
      entityId: quote.id,
      action: "quote_pdf_generate",
      metadata: {
        kind: "quote_request_pdf_generated",
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        itemCount: quote.items.length,
        byteSize: pdfBuffer.length,
      },
    }).catch(() => {
      // audit log 실패는 PDF 응답 영향 0
    });

    const filename = `${quote.quoteNumber ?? `quote-${quote.id.slice(0, 8)}`}.pdf`;

    // PDF stream 반환 — application/pdf + attachment.
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "quotes/[id]/generate-pdf/POST");
  }
}

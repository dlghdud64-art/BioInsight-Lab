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

/** §11.314-b-1 — Product select row type (noImplicitAny strict) */
interface ProductSelectRow {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  specification: string | null;
  grade: string | null;
}
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { handleApiError } from "@/lib/api-error-handler";
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";
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
    const products: ProductSelectRow[] = productIds.length
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
      : [];
    const productMap = new Map<string, ProductSelectRow>(products.map((p) => [p.id, p]));

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

    // §11.314-c — PDF 생성(견적 요청서 발행) = 발송 행위 → status
    //   PENDING/PARSED → SENT 전환. 호영님 §11.308b 완료기준 #4
    //   "견적 상태 draft → sent" 충족.
    //   - POST(발송) 일 때만 전환. GET (mobile read-only download) 은 0
    //     (request.method 로 구분 — GET handler 가 POST 호출 시 method="GET").
    //   - enforceAction 없이 ownership 검증만 (quote_status_change 는
    //     buyer/approver/ops_admin 전용이라 requester 403 → §11.314-a 와
    //     동일 문제. 발송은 requester 허용해야 하므로 status route 우회).
    //   - best-effort (status 전환 실패해도 PDF 응답 영향 0).
    let statusTransitioned = false;
    if (
      request.method === "POST" &&
      (quote.status === "PENDING" || quote.status === "PARSED")
    ) {
      await db.quote
        .update({
          where: { id },
          data: { status: "SENT", updatedAt: new Date() },
        })
        .then(() => {
          statusTransitioned = true;
        })
        .catch(() => {
          // status 전환 실패는 PDF 응답 영향 0
        });
    }

    // audit log — best-effort (graceful, PDF 응답 영향 0).
    await createAuditLog({
      userId: session?.user?.id ?? undefined,
      organizationId: quote.organizationId ?? undefined,
      // §11.345-B — PDF 생성은 설정 변경이 아니라 문서 내보내기 → DATA_EXPORTED 로 재분류.
      //   export 라 before/after(changes) 없음이 정상(감사 페이지 "변경 내역" 비움이 옳음).
      eventType: "DATA_EXPORTED",
      entityType: "QUOTE",
      entityId: quote.id,
      action: "quote_pdf_generate",
      ...auditRequestMeta(request),
      metadata: {
        kind: "quote_request_pdf_generated",
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        itemCount: quote.items.length,
        byteSize: pdfBuffer.length,
        // §11.314-c — status PENDING/PARSED → SENT 전환 여부
        statusTransitioned,
        previousStatus: quote.status,
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
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error, "quotes/[id]/generate-pdf/POST");
  }
}
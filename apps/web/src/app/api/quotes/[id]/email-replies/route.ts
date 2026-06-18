/**
 * GET /api/quotes/[id]/email-replies — §inbound-rfq-autocapture P3
 *
 * 자동수신(공급사 이메일 회신) QuoteReply + 첨부 조회. quotes 상세 "received" 탭에서 표시.
 *   - canonical = QuoteReply(DB). 수동 가격입력(QuoteVendorResponseItem)과 별개 모델.
 *   - 권한: quote owner OR organization member(rfq-token route 와 동일 2-source ownership).
 *   - 첨부 path/bucket 은 메타만 반환(다운로드 URL 서명은 별도 — P2 storage 정합).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";

/** quote 접근 권한(owner OR org member). rfq-token route 정합. */
async function verifyQuoteAccess(quoteId: string, userId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, userId: true, organizationId: true },
  });
  if (!quote) throw new Error("Quote not found or access denied");

  const isOwner = quote.userId === userId;
  let isOrgMember = false;
  if (!isOwner && quote.organizationId) {
    const membership = await db.organizationMember.findFirst({
      where: { userId, organizationId: quote.organizationId },
      select: { id: true },
    });
    isOrgMember = !!membership;
  }
  if (!isOwner && !isOrgMember) throw new Error("Quote not found or access denied");
  return quote;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const quoteId = params.id;
    await verifyQuoteAccess(quoteId, session.user.id);

    const replies = await db.quoteReply.findMany({
      where: { quoteId },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        vendorName: true,
        fromEmail: true,
        subject: true,
        bodyText: true,
        receivedAt: true,
        attachments: {
          select: {
            id: true,
            fileName: true,
            contentType: true,
            sizeBytes: true,
            bucket: true,
            path: true,
          },
        },
      },
    });

    return NextResponse.json({ replies, count: replies.length });
  } catch (error) {
    if ((error as Error).message.includes("access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handleApiError(error, "quotes/[id]/email-replies");
  }
}

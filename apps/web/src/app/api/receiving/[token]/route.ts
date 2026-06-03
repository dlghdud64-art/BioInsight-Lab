import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidVendorRequestToken } from "@/lib/api/vendor-request-token";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

/**
 * GET /api/receiving/:token  (§11.348-A-2)
 * 공급사 입고 회신 폼 데이터 (public). 발주(PO) snapshot freeze 기준.
 * Rate limited: 60 req/min/IP. 토큰 형식은 vendor-request 와 동일(48 base64url).
 *
 * canonical: ReceivingDraft = 검증 대기 입고안(derived). 재고 mutation 0.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!isValidVendorRequestToken(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`receiving-draft:${clientIp}`, {
      interval: 60 * 1000,
      maxRequests: 60,
    });
    const headers = new Headers({
      "X-RateLimit-Limit": rateLimit.limit.toString(),
      "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      "X-RateLimit-Reset": new Date(rateLimit.reset).toISOString(),
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers });
    }

    const draft = await db.receivingDraft.findUnique({
      where: { token },
      include: { items: true },
    });

    if (!draft) {
      return NextResponse.json({ error: "Request not found" }, { status: 404, headers });
    }

    // 만료 / 종결 상태 가드
    if (draft.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This request has expired", isExpired: true },
        { status: 410, headers },
      );
    }
    if (draft.status === "APPROVED" || draft.status === "REJECTED" || draft.status === "EXPIRED") {
      return NextResponse.json(
        { error: "This request is closed", status: draft.status, isClosed: true },
        { status: 410, headers },
      );
    }

    // 발송 시점 PO snapshot (freeze) — A-1 이 기록.
    const snapshot = (draft.snapshot ?? {}) as {
      orderNumber?: string;
      items?: Array<{
        orderItemId: string;
        productId: string | null;
        name: string;
        quantity: number;
      }>;
    };
    const snapItems = snapshot.items ?? [];

    return NextResponse.json(
      {
        draft: {
          id: draft.id,
          status: draft.status,
          expiresAt: draft.expiresAt,
          submittedAt: draft.submittedAt,
          vendorNote: draft.vendorNote,
        },
        order: { orderNumber: snapshot.orderNumber ?? null },
        items: snapItems.map((it) => {
          const existing = draft.items.find((d: { orderItemId: string | null }) => d.orderItemId === it.orderItemId) || null;
          return {
            orderItemId: it.orderItemId,
            productId: it.productId,
            name: it.name,
            expectedQuantity: it.quantity,
            existingResponse: existing
              ? {
                  receivedQuantity: existing.receivedQuantity,
                  lotNumber: existing.lotNumber,
                  expiryDate: existing.expiryDate,
                  vendorNote: existing.vendorNote,
                }
              : null,
          };
        }),
      },
      { headers },
    );
  } catch (error) {
    console.error("Error fetching receiving draft:", error);
    return NextResponse.json({ error: "Failed to fetch request" }, { status: 500 });
  }
}

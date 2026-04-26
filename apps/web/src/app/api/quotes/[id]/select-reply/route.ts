/**
 * apps/web/src/app/api/quotes/[id]/select-reply/route.ts
 *
 * α-D session A (ADR-002 §11.21). Persists the operator's choice of
 * which QuoteReply this quote will be converted from. Single-purpose
 * mutation: nothing else changes on the quote.
 *
 * Request:
 *   POST /api/quotes/{id}/select-reply
 *   body: { replyId: string | null }
 *   - replyId !== null : the reply must belong to this quote.
 *   - replyId === null : un-select (operator cleared their choice).
 *
 * Response (200):
 *   { success: true, data: { quoteId, selectedReplyId } }
 *
 * Security:
 *   - auth() session required (401 otherwise).
 *   - Quote ownership: only the quote owner may set selectedReplyId.
 *     Anyone else gets 404 (not 403) so we don't leak existence.
 *   - CSRF gate: handled by middleware.ts via csrf-route-registry
 *     default config (`protection: 'required'`). High-risk flag is
 *     intentionally NOT set — selection is reversible.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  enforceAction,
  type InlineEnforcementHandle,
} from "@/lib/security/server-enforcement-middleware";

const bodySchema = z.object({
  replyId: z.string().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { id: quoteId } = await params;

    // ── Security enforcement (auth + CSRF defense-in-depth) ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "quote_status_change", // closest existing action class
      targetEntityType: "quote",
      targetEntityId: quoteId,
      sourceSurface: "purchase-conversion-rail",
      routePath: "/api/quotes/[id]/select-reply",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // Body parse
    // Every early-return below the `enforceAction` line MUST call
    // `enforcement.fail()` to release the concurrency lock. The lock is
    // acquired inside enforceAction(); only complete() / fail() release
    // it. A returned 4xx without a fail() leaks the lock and the next
    // mutation on the same entity returns 409 — caught in production
    // probe (ADR §11.21 followup).
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      enforcement.fail();
      return NextResponse.json(
        { success: false, error: "유효하지 않은 JSON 형식입니다." },
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
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { replyId } = parsed.data;

    // Ownership + reply membership in a single fetch so we never need a
    // separate quote lookup.
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        userId: true,
        replies: { select: { id: true } },
      },
    });

    if (!quote || quote.userId !== session.user.id) {
      enforcement.fail();
      // Don't distinguish "not found" from "not yours" — same response.
      return NextResponse.json(
        { success: false, error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Validate reply membership when replyId !== null. Empty replies set
    // also fails the membership test, which is the correct rejection.
    if (replyId !== null && !quote.replies.some((r: { id: string }) => r.id === replyId)) {
      enforcement.fail();
      return NextResponse.json(
        {
          success: false,
          error: "해당 견적에 속하지 않는 회신입니다.",
          code: "REPLY_NOT_ON_QUOTE",
        },
        { status: 400 },
      );
    }

    const updated = await db.quote.update({
      where: { id: quoteId },
      data: { selectedReplyId: replyId },
      select: { id: true, selectedReplyId: true },
    });

    enforcement.complete({
      beforeState: { selectedReplyId: null },
      afterState: { selectedReplyId: updated.selectedReplyId },
    });

    return NextResponse.json({
      success: true,
      data: {
        quoteId: updated.id,
        selectedReplyId: updated.selectedReplyId,
      },
    });
  } catch (error: any) {
    if (enforcement) enforcement.fail();
    console.error("[POST /api/quotes/[id]/select-reply] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "선택안 저장 중 오류가 발생했습니다.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

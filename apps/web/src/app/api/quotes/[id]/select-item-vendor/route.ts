/**
 * apps/web/src/app/api/quotes/[id]/select-item-vendor/route.ts
 *
 * §quote-item-vendor-selection Phase 2 (호영님 C안 정공법, 2026-08-07).
 * 품목 단위 vendor 확정 truth 를 저장한다. select-reply(quote 단위 선택)의
 * per-item 형제 — 관례(권한·lock·404 leak 차단)를 그대로 승계한다.
 *
 * Request:
 *   POST /api/quotes/{id}/select-item-vendor
 *   body: { quoteItemId: string, vendorRequestId: string | null }
 *   - vendorRequestId !== null : 그 요청(vendor)이 **해당 품목에 응답을 제출**했어야 함.
 *     (QuoteVendorResponseItem 실존 검증 — 응답 없는 vendor 확정 = 가짜 선택 금지)
 *   - vendorRequestId === null : 선택 해제.
 *
 * Response (200): { success: true, data: { quoteItemId, selectedVendorRequestId } }
 *
 * Security:
 *   - auth() 필수(401). 소유권 = quote owner OR organization member, 그 외 404
 *     (not-found 와 not-yours 를 구분하지 않아 존재 leak 차단).
 *   - CSRF: middleware csrf-route-registry 기본값(required). 클라이언트는
 *     csrfFetch 사용 — raw fetch 는 403 (§support-csrf-fix·§reorder-quote-handoff 사고).
 *   - enforceAction 이후 모든 early-return 은 fail() 로 lock 해제
 *     (ADR §11.21 lock leak → 409 사고 관례).
 *
 * 선택은 가역 — high-risk 플래그 미설정(select-reply 동일).
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
  quoteItemId: z.string().min(1),
  vendorRequestId: z.string().nullable(),
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

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "quote_status_change", // select-reply 와 동일 action class (가역 선택)
      targetEntityType: "quote",
      targetEntityId: quoteId,
      sourceSurface: "purchase-conversion-rail",
      routePath: "/api/quotes/[id]/select-item-vendor",
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    const { quoteItemId, vendorRequestId } = parsed.data;

    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        items: { select: { id: true } },
        vendorRequests: { select: { id: true } },
      },
    });

    if (!quote) {
      enforcement.fail();
      return NextResponse.json(
        { success: false, error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // 소유권 — user owner OR organization member (select-reply 형제 관례)
    const isOwner = quote.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: quote.organizationId },
        select: { id: true },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      enforcement.fail();
      // not-found 와 not-yours 를 구분하지 않는다 (존재 leak 차단)
      return NextResponse.json(
        { success: false, error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // S3 — 품목 소속 검증
    if (!quote.items.some((it: { id: string }) => it.id === quoteItemId)) {
      enforcement.fail();
      return NextResponse.json(
        {
          success: false,
          error: "해당 견적에 속하지 않는 품목입니다.",
          code: "ITEM_NOT_ON_QUOTE",
        },
        { status: 400 },
      );
    }

    if (vendorRequestId !== null) {
      // S3b — 요청 소속 검증
      if (!quote.vendorRequests.some((vr: { id: string }) => vr.id === vendorRequestId)) {
        enforcement.fail();
        return NextResponse.json(
          {
            success: false,
            error: "해당 견적에 속하지 않는 공급사 요청입니다.",
            code: "VENDOR_REQUEST_NOT_ON_QUOTE",
          },
          { status: 400 },
        );
      }

      // S4 — 응답 실존 검증 (핵심 계약: 응답 없는 vendor 확정 금지).
      //   선택은 "비교한 것 중 고르기" — 비교 대상이 아니면 확정 대상도 아니다.
      const response = await db.quoteVendorResponseItem.findFirst({
        where: { vendorRequestId, quoteItemId },
        select: { id: true },
      });
      if (!response) {
        enforcement.fail();
        return NextResponse.json(
          {
            success: false,
            error: "이 공급사는 해당 품목에 회신하지 않았습니다.",
            code: "NO_RESPONSE_FOR_ITEM",
          },
          { status: 400 },
        );
      }
    }

    const updated = await db.quoteListItem.update({
      where: { id: quoteItemId },
      data: { selectedVendorRequestId: vendorRequestId },
      select: { id: true, selectedVendorRequestId: true },
    });

    enforcement.complete({
      beforeState: { selectedVendorRequestId: null },
      afterState: { selectedVendorRequestId: updated.selectedVendorRequestId },
    });

    return NextResponse.json({
      success: true,
      data: {
        quoteItemId: updated.id,
        selectedVendorRequestId: updated.selectedVendorRequestId,
      },
    });
  } catch (error: unknown) {
    if (enforcement) enforcement.fail();
    console.error("[POST /api/quotes/[id]/select-item-vendor] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "선택 저장 중 오류가 발생했습니다.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

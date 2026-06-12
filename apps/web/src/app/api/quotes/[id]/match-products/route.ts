import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  matchQuoteItemToProduct,
  type QuoteProductTarget,
} from "@/lib/catalog/quote-product-match";

// §catalog-A P3b — quote-scoped 매칭 (호영님 P-track, 2026-06-12)
//   파싱 라인 ↔ 이 견적의 QuoteListItem 매칭 → quoteItemId 반환(vendor-reply 등록 직결).
//   read-only(write 0). pool = 이 견적 items(QuoteListItem, name/catalogNumber denormalized).
//   게이트: 401 + quote-access(isOwner ‖ isOrgMember). role 게이트 아님(read, 승격 아님).
//   tier 판정 = lib/catalog/quote-product-match 순수함수(candidates-agnostic) 재사용.
//
//   ⚠️ 이전 /api/quotes/match-products(전 카탈로그 Product 매칭)와 축 다름:
//      이건 quote-scoped(이 견적 QuoteListItem). 등록 축(quoteItemId)과 정합 → 끊긴 등록 봉합.
//      전 카탈로그 매칭(BOM 등)은 별도 products/batch-match(P3c)로 분리.

const matchSchema = z.object({
  items: z
    .array(
      z.object({
        productName: z.string().nullable().optional(),
        catalogNumber: z.string().nullable().optional(),
      }),
    )
    .max(100),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id: quoteId } = await params;

    // quote-scoped pool + 접근 권한(vendor-replies 동형 패턴 이식)
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: { items: { select: { id: true, name: true, catalogNumber: true } } },
    });
    if (!quote) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
    }

    const isOwner = quote.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: quote.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { items } = matchSchema.parse(await request.json());

    // 후보 = 이 견적의 QuoteListItem. id = quoteItemId(vendor-reply 등록키).
    //   modelNumber 는 QuoteListItem 에 없음 → null(순수함수 catalog 분기에서 안전 skip).
    const candidates: QuoteProductTarget[] = quote.items.map((li: { id: string; name: string; catalogNumber: string | null }) => ({
      id: li.id,
      name: li.name,
      catalogNumber: li.catalogNumber,
      modelNumber: null,
    }));

    const results = items.map((it, lineIndex) => {
      const r = matchQuoteItemToProduct(
        {
          productName: it.productName ?? null,
          catalogNumber: it.catalogNumber ?? null,
          specification: null,
        },
        candidates,
      );
      // matches[].id = QuoteListItem.id = quoteItemId. 모달 등록 직결 위해 명시 키로 노출.
      return {
        lineIndex,
        tier: r.tier,
        matches: r.matches.map((m) => ({
          quoteItemId: m.id,
          name: m.name,
          catalogNumber: m.catalogNumber,
        })),
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    console.error("quote [id] match-products failed:", error);
    return NextResponse.json({ error: "매칭에 실패했습니다." }, { status: 500 });
  }
}

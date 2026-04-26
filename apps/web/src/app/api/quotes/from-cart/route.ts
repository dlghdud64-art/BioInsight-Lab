import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { generateQuoteNumber } from "@/lib/api/quote-number";

// =====================================================
// 스키마 정의
// =====================================================

const createQuoteSchema = z.object({
  title: z.string().min(1, "견적 제목은 필수입니다.").max(200),
  description: z.string().max(2000).optional(),
  clearCart: z.boolean().default(false), // 장바구니 비우기 여부
  validDays: z.number().int().min(1).max(365).default(30), // 유효기간 (일)
});

// =====================================================
// 견적번호 생성: lib/api/quote-number.ts 의 generateQuoteNumber 사용.
// 이전에 이 파일 내 dead inline `generateQuoteNumber()` (sequence-based,
// no-args) 가 있었으나 실제 호출 경로는 cuid-based suffix 였으며
// 어디서도 호출되지 않는 dead code 였음. ADR-002 §11.19
// (#P02-followup-quote-number-missing) 에서 utility 단일화로 정리.
// =====================================================

// =====================================================
// POST /api/quotes/from-cart
// 장바구니 기반 공식 견적서 생성 API
//
// [Architecture Decision]
// - 장바구니(Cart) 아이템을 Quote + QuoteListItem으로 변환
// - 견적번호(quoteNumber) 자동 생성: Q-YYYYMMDD-XXXX
// - 유효기간(validUntil) 자동 설정: 기본 30일
// - 장바구니 유지 옵션 (clearCart: false가 기본)
// =====================================================

export async function POST(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    // 1. 인증 검증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_request_create',
      targetEntityType: 'quote',
      targetEntityId: 'from-cart',
      sourceSurface: 'quote-from-cart-api',
      routePath: '/api/quotes/from-cart',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 2. 요청 바디 파싱
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = createQuoteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "잘못된 요청 데이터입니다.",
          code: "INVALID_DATA",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { title, description, clearCart, validDays } = parseResult.data;

    // 3. 장바구니 조회
    const cart = await db.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                vendors: {
                  where: { isActive: true },
                  select: {
                    priceInKRW: true,
                    vendor: {
                      select: {
                        name: true,
                      },
                    },
                  },
                  take: 1,
                  orderBy: { priceInKRW: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json(
        { error: "장바구니가 비어있습니다.", code: "CART_EMPTY" },
        { status: 400 }
      );
    }

    // 4. 유효기간 계산
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // 5. 총액 계산
    let totalAmount = 0;
    const quoteItemsData = cart.items.map((item: any) => {
      const unitPrice = item.product?.vendors[0]?.priceInKRW || item.unitPrice || 0;
      const lineTotal = unitPrice * item.quantity;
      totalAmount += lineTotal;

      return {
        productId: item.productId,
        productName: item.productName,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        notes: item.notes,
        vendorName: item.product?.vendors[0]?.vendor?.name,
      };
    });

    // 6. 트랜잭션으로 Quote + QuoteListItem 생성
    //    quoteNumber를 트랜잭션 외부에서 generateQuoteNumber()로 생성하면
    //    동시 요청 시 동일 번호 충돌(P2002) 발생 가능 → quote.id 기반으로 생성하여 방지
    const today = new Date();
    const result = await db.$transaction(async (tx: any) => {
      // Quote 먼저 생성 (quoteNumber 없이)
      const quote = await tx.quote.create({
        data: {
          userId,
          title,
          description,
          status: "PENDING",
          currency: "KRW",
          totalAmount,
          validUntil,
        },
      });

      // quote.id가 확정된 후 고유한 quoteNumber 생성 (race condition 원천 차단).
      // generateQuoteNumber 유틸 사용 — createQuote() Normal path 와 동일 형식.
      // ADR-002 §11.19 (#P02-followup-quote-number-missing).
      const quoteNumber = generateQuoteNumber(quote.id, today);
      await tx.quote.update({
        where: { id: quote.id },
        data: { quoteNumber },
      });

      // QuoteListItem 생성
      await tx.quoteListItem.createMany({
        data: quoteItemsData.map((item: any) => ({
          quoteId: quote.id,
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          catalogNumber: item.catalogNumber,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          notes: item.notes,
        })),
      });

      // 장바구니 비우기 (옵션)
      if (clearCart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      }

      return { ...quote, quoteNumber };
    });

    // 8. 생성된 견적 상세 조회
    const quote = await db.quote.findUnique({
      where: { id: result.id },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: true,
          },
        },
      },
    });

    enforcement.complete({
      beforeState: { source: 'cart', itemCount: cart.items.length },
      afterState: { quoteId: quote?.id, quoteNumber: quote?.quoteNumber, itemCount: quote?.items.length },
    });

    return NextResponse.json({
      success: true,
      message: "견적서가 생성되었습니다.",
      data: {
        quote: {
          id: quote?.id,
          quoteNumber: quote?.quoteNumber,
          title: quote?.title,
          description: quote?.description,
          status: quote?.status,
          totalAmount: quote?.totalAmount,
          currency: quote?.currency,
          validUntil: quote?.validUntil,
          itemCount: quote?.items.length,
          createdAt: quote?.createdAt,
        },
        cartCleared: clearCart,
      },
    });

  } catch (error) {
    enforcement?.fail();
    console.error("[Quotes/FromCart] Error:", error);
    return NextResponse.json(
      { error: "견적서 생성 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

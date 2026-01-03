import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

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
// 견적번호 생성 유틸리티
// Q-YYYYMMDD-XXXX 형식
// =====================================================

async function generateQuoteNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `Q-${dateStr}-`;

  // 오늘 날짜의 마지막 견적번호 조회
  const lastQuote = await db.quote.findFirst({
    where: {
      quoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quoteNumber: "desc",
    },
    select: {
      quoteNumber: true,
    },
  });

  let sequence = 1;
  if (lastQuote?.quoteNumber) {
    const lastSeq = parseInt(lastQuote.quoteNumber.split("-")[2], 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

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

    // 4. 견적번호 생성
    const quoteNumber = await generateQuoteNumber();

    // 5. 유효기간 계산
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // 6. 총액 계산
    let totalAmount = 0;
    const quoteItemsData = cart.items.map((item) => {
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

    // 7. 트랜잭션으로 Quote + QuoteListItem 생성
    const result = await db.$transaction(async (tx) => {
      // Quote 생성
      const quote = await tx.quote.create({
        data: {
          userId,
          quoteNumber,
          title,
          description,
          status: "PENDING",
          currency: "KRW",
          totalAmount,
          validUntil,
        },
      });

      // QuoteListItem 생성
      await tx.quoteListItem.createMany({
        data: quoteItemsData.map((item) => ({
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

      return quote;
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
    console.error("[Quotes/FromCart] Error:", error);
    return NextResponse.json(
      { error: "견적서 생성 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

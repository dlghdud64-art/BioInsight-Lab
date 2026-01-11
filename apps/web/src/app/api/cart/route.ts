import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// =====================================================
// GET /api/cart
// 사용자 장바구니 조회 API
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 장바구니 조회 (없으면 빈 배열 반환)
    const cart = await db.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: "desc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                vendors: {
                  where: { isActive: true },
                  select: {
                    priceInKRW: true,
                    inStock: true,
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

    if (!cart) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          summary: {
            totalItems: 0,
            totalQuantity: 0,
            totalAmount: 0,
          },
        },
      });
    }

    // 총계 계산
    let totalAmount = 0;
    let totalQuantity = 0;

    const items = cart.items.map((item: any) => {
      const currentPrice = item.product?.vendors[0]?.priceInKRW || item.unitPrice || 0;
      const lineTotal = currentPrice * item.quantity;
      totalAmount += lineTotal;
      totalQuantity += item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unitPrice: currentPrice,
        lineTotal,
        notes: item.notes,
        sourceType: item.sourceType,
        imageUrl: item.product?.imageUrl,
        inStock: item.product?.vendors[0]?.inStock ?? true,
        createdAt: item.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        cartId: cart.id,
        items,
        summary: {
          totalItems: items.length,
          totalQuantity,
          totalAmount,
        },
      },
    });

  } catch (error) {
    console.error("[Cart GET] Error:", error);
    return NextResponse.json(
      { error: "장바구니 조회 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/cart
// 장바구니 비우기 API
// =====================================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const cart = await db.cart.findUnique({
      where: { userId: session.user.id },
    });

    if (!cart) {
      return NextResponse.json({
        success: true,
        message: "장바구니가 비어있습니다.",
      });
    }

    // 모든 아이템 삭제
    await db.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return NextResponse.json({
      success: true,
      message: "장바구니를 비웠습니다.",
    });

  } catch (error) {
    console.error("[Cart DELETE] Error:", error);
    return NextResponse.json(
      { error: "장바구니 비우기 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/cart
// 장바구니에 직접 아이템 추가 (검색 결과 등에서)
// =====================================================

const addItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1),
  brand: z.string().optional(),
  catalogNumber: z.string().optional(),
  quantity: z.number().int().min(1).max(9999).default(1),
  unitPrice: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = addItemSchema.safeParse(body);
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

    const data = parseResult.data;

    // 장바구니 조회 또는 생성
    let cart = await db.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: { userId },
      });
    }

    // catalogNumber로 기존 아이템 확인
    let existingItem = null;
    if (data.catalogNumber) {
      existingItem = await db.cartItem.findFirst({
        where: {
          cartId: cart.id,
          catalogNumber: data.catalogNumber,
        },
      });
    }

    if (existingItem) {
      // 수량 합산
      await db.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + data.quantity,
        },
      });
    } else {
      // 새 아이템 추가
      await db.cartItem.create({
        data: {
          cartId: cart.id,
          productId: data.productId,
          productName: data.productName,
          brand: data.brand,
          catalogNumber: data.catalogNumber,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          notes: data.notes,
          sourceType: "MANUAL",
        },
      });
    }

    // 장바구니 요약 반환
    const summary = await db.cartItem.aggregate({
      where: { cartId: cart.id },
      _count: { id: true },
      _sum: { quantity: true },
    });

    return NextResponse.json({
      success: true,
      message: "장바구니에 추가되었습니다.",
      data: {
        cartSummary: {
          totalItems: summary._count.id,
          totalQuantity: summary._sum.quantity || 0,
        },
      },
    });

  } catch (error) {
    console.error("[Cart POST] Error:", error);
    return NextResponse.json(
      { error: "장바구니 추가 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

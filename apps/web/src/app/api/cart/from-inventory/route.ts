import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// =====================================================
// 스키마 정의 (Type Safety)
// =====================================================

const reorderSchema = z.object({
  inventoryId: z.string().min(1, "인벤토리 ID는 필수입니다."),
  quantity: z.number().int().min(1, "수량은 1 이상이어야 합니다.").max(9999),
});

// =====================================================
// POST /api/cart/from-inventory
// 인벤토리 기반 재주문 API (Re-order Flywheel)
//
// [Architecture Decision - Senior Backend Architect]
// 1. inventoryId로 인벤토리 조회 → catalogNumber 확보
// 2. catalogNumber로 Product 조회 → 판매 상태 확인
// 3. 사용자 Cart 조회/생성 (getOrCreate 패턴)
// 4. CartItem upsert (기존 있으면 수량 합산)
// 5. 장바구니 총 아이템 개수 반환
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

    // 2. 요청 바디 파싱 및 검증
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = reorderSchema.safeParse(body);
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

    const { inventoryId, quantity } = parseResult.data;

    // 3. 인벤토리 조회 및 소유권 검증
    const inventory = await db.userInventory.findUnique({
      where: { id: inventoryId },
      select: {
        id: true,
        userId: true,
        productName: true,
        brand: true,
        catalogNumber: true,
        unit: true,
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다.", code: "INVENTORY_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 소유권 검증 (데이터 무결성)
    if (inventory.userId !== userId) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 4. 제품 정보 조회 (catalogNumber 기반)
    let product = null;
    let productId = null;
    let unitPrice = null;

    if (inventory.catalogNumber) {
      product = await db.product.findFirst({
        where: { catalogNumber: inventory.catalogNumber },
        select: {
          id: true,
          name: true,
          brand: true,
          catalogNumber: true,
          // 판매 상태 체크를 위한 vendor 정보
          vendors: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              priceInKRW: true,
              inStock: true,
              isActive: true,
            },
            take: 1,
            orderBy: {
              priceInKRW: "asc",
            },
          },
        },
      });

      if (product) {
        productId = product.id;

        // 판매 상태 확인
        const activeVendor = product.vendors[0];
        if (!activeVendor) {
          return NextResponse.json(
            {
              error: "해당 제품은 현재 판매 중지 상태입니다.",
              code: "PRODUCT_DISCONTINUED",
              productName: product.name,
            },
            { status: 400 }
          );
        }

        if (!activeVendor.inStock) {
          return NextResponse.json(
            {
              error: "해당 제품은 현재 품절 상태입니다.",
              code: "PRODUCT_OUT_OF_STOCK",
              productName: product.name,
            },
            { status: 400 }
          );
        }

        unitPrice = activeVendor.priceInKRW;
      }
    }

    // 5. 사용자 장바구니 조회 또는 생성 (getOrCreate 패턴)
    let cart = await db.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      cart = await db.cart.create({
        data: { userId },
        select: { id: true },
      });
    }

    // 6. CartItem upsert (기존 있으면 수량 합산)
    // catalogNumber가 같으면 동일 제품으로 간주
    const existingItem = inventory.catalogNumber
      ? await db.cartItem.findFirst({
          where: {
            cartId: cart.id,
            catalogNumber: inventory.catalogNumber,
          },
        })
      : null;

    if (existingItem) {
      // 기존 아이템 수량 합산
      await db.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
          updatedAt: new Date(),
        },
      });
    } else {
      // 새 아이템 생성
      await db.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          productName: inventory.productName,
          brand: inventory.brand,
          catalogNumber: inventory.catalogNumber,
          quantity,
          unitPrice,
          sourceType: "REORDER",
          sourceId: inventoryId,
        },
      });
    }

    // 7. 장바구니 총 아이템 개수 조회 (UI 뱃지용)
    const cartStats = await db.cartItem.aggregate({
      where: { cartId: cart.id },
      _count: { id: true },
      _sum: { quantity: true },
    });

    return NextResponse.json({
      success: true,
      message: "장바구니에 추가되었습니다.",
      data: {
        cartId: cart.id,
        addedItem: {
          productName: inventory.productName,
          catalogNumber: inventory.catalogNumber,
          quantity,
          isExisting: !!existingItem,
        },
        cartSummary: {
          totalItems: cartStats._count.id, // 품목 종류 수
          totalQuantity: cartStats._sum.quantity || 0, // 총 수량
        },
      },
    });

  } catch (error) {
    console.error("[Cart/FromInventory] Error:", error);
    return NextResponse.json(
      {
        error: "재주문 처리 중 오류가 발생했습니다.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

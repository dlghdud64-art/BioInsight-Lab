import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// =====================================================
// PATCH /api/cart/items/[id]
// 장바구니 아이템 수정 (수량 변경 등)
// =====================================================

const updateSchema = z.object({
  quantity: z.number().int().min(1).max(9999).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: itemId } = await params;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = updateSchema.safeParse(body);
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

    // 아이템 조회 및 소유권 검증
    const item = await db.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: {
          select: { userId: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "장바구니 아이템을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (item.cart.userId !== session.user.id) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 업데이트
    const updated = await db.cartItem.update({
      where: { id: itemId },
      data: parseResult.data,
    });

    return NextResponse.json({
      success: true,
      message: "장바구니 아이템이 수정되었습니다.",
      data: {
        item: updated,
      },
    });

  } catch (error) {
    console.error("[CartItem PATCH] Error:", error);
    return NextResponse.json(
      { error: "아이템 수정 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/cart/items/[id]
// 장바구니 아이템 삭제
// =====================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: itemId } = await params;

    // 아이템 조회 및 소유권 검증
    const item = await db.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: {
          select: { id: true, userId: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "장바구니 아이템을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (item.cart.userId !== session.user.id) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 삭제
    await db.cartItem.delete({
      where: { id: itemId },
    });

    // 남은 아이템 수 반환
    const remaining = await db.cartItem.aggregate({
      where: { cartId: item.cart.id },
      _count: { id: true },
      _sum: { quantity: true },
    });

    return NextResponse.json({
      success: true,
      message: "장바구니에서 삭제되었습니다.",
      data: {
        deletedId: itemId,
        productName: item.productName,
        cartSummary: {
          totalItems: remaining._count.id,
          totalQuantity: remaining._sum.quantity || 0,
        },
      },
    });

  } catch (error) {
    console.error("[CartItem DELETE] Error:", error);
    return NextResponse.json(
      { error: "아이템 삭제 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

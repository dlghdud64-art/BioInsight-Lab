import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/user-inventory/[id]/restock-toggle
 * 재입고 알림 플래그 토글 (Simple Restock System)
 *
 * 복잡한 PurchaseRequest 대신 간단한 boolean 플래그 사용
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 인벤토리 조회 및 소유권 검증
    const inventory = await db.userInventory.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        productName: true,
        quantity: true,
        restockRequested: true,
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 소유권 확인
    if (inventory.userId !== session.user.id) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 플래그 토글
    const newValue = !inventory.restockRequested;
    const updated = await db.userInventory.update({
      where: { id },
      data: {
        restockRequested: newValue,
      },
    });

    return NextResponse.json({
      success: true,
      message: newValue
        ? "재입고 알림이 설정되었습니다."
        : "재입고 알림이 해제되었습니다.",
      data: {
        id: updated.id,
        productName: updated.productName,
        restockRequested: updated.restockRequested,
      },
    });
  } catch (error) {
    console.error("[Restock Toggle] Error:", error);
    return NextResponse.json(
      { error: "재입고 알림 설정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user-inventory/[id]/restock-toggle
 * 재입고 알림 상태 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await params;

    const inventory = await db.userInventory.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        productName: true,
        restockRequested: true,
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (inventory.userId !== session.user.id) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: inventory.id,
        productName: inventory.productName,
        restockRequested: inventory.restockRequested,
      },
    });
  } catch (error) {
    console.error("[Restock Toggle GET] Error:", error);
    return NextResponse.json(
      { error: "재입고 알림 상태 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 사용량 기록
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inventoryId, quantity, unit, usageDate, notes } = body;

    if (!inventoryId || !quantity) {
      return NextResponse.json(
        { error: "InventoryId and quantity are required" },
        { status: 400 }
      );
    }

    // 사용량 기록 생성
    const usage = await db.inventoryUsage.create({
      data: {
        inventoryId,
        userId: session.user.id,
        quantity,
        unit,
        usageDate: usageDate ? new Date(usageDate) : new Date(),
        notes,
      },
    });

    // 재고량 업데이트 (감소)
    const inventory = await db.productInventory.findUnique({
      where: { id: inventoryId },
    });

    if (inventory) {
      await db.productInventory.update({
        where: { id: inventoryId },
        data: {
          currentQuantity: Math.max(0, inventory.currentQuantity - quantity),
        },
      });
    }

    return NextResponse.json({ usage }, { status: 201 });
  } catch (error) {
    console.error("Error recording usage:", error);
    return NextResponse.json(
      { error: "Failed to record usage" },
      { status: 500 }
    );
  }
}




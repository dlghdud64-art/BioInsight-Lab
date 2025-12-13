import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 재고 사용 이력 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const inventoryId = searchParams.get("inventoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100;

    const where: any = {
      user: {
        id: session.user.id,
      },
    };

    if (inventoryId) {
      where.inventoryId = inventoryId;
    }

    if (startDate || endDate) {
      where.usageDate = {};
      if (startDate) {
        where.usageDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.usageDate.lte = new Date(endDate);
      }
    }

    const usageRecords = await db.inventoryUsage.findMany({
      where,
      include: {
        inventory: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                catalogNumber: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        usageDate: "desc",
      },
      take: limit,
    });

    // 통계 계산
    const totalUsage = usageRecords.reduce((sum: number, record: any) => sum + record.quantity, 0);
    const uniqueProducts = new Set(usageRecords.map((r: any) => r.inventory.productId)).size;
    const dateRange = usageRecords.length > 0
      ? {
          start: usageRecords[usageRecords.length - 1].usageDate,
          end: usageRecords[0].usageDate,
        }
      : null;

    return NextResponse.json({
      records: usageRecords,
      stats: {
        totalUsage,
        recordCount: usageRecords.length,
        uniqueProducts,
        dateRange,
      },
    });
  } catch (error) {
    console.error("Error fetching usage history:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage history" },
      { status: 500 }
    );
  }
}

// 재고 사용 기록
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

    // 재고 사용 기록 생성
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

    // 재고 수량 업데이트 (감소)
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

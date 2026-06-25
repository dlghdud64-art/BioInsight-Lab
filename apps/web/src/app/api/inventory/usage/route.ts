import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inventoryId, quantity, unit, usageDate, notes } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_use',
      targetEntityType: 'inventory',
      targetEntityId: inventoryId || 'unknown',
      sourceSurface: 'inventory-api',
      routePath: '/api/inventory/usage',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (!inventoryId || !quantity) {
      return NextResponse.json(
        { error: "InventoryId and quantity are required" },
        { status: 400 }
      );
    }

    // #api-inventory-mutation-info-leak — inventory ownership 검증 (write leak
    //   차단). 기존 코드는 inventoryId 만 받아 어떤 user 든 어떤 inventory 든
    //   사용 기록 생성 + quantity 감소 가능 (multi-tenant write leak). isOwner
    //   OR isOrgMember 검증 후 mutation 진행.
    const inventory = await db.productInventory.findUnique({
      where: { id: inventoryId },
      select: { id: true, userId: true, organizationId: true, currentQuantity: true, trackingMode: true },
    });
    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory not found" },
        { status: 404 }
      );
    }
    {
      const isOwner = inventory.userId === session.user.id;
      let isOrgMember = false;
      if (!isOwner && inventory.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: inventory.organizationId },
          select: { id: true },
        });
        isOrgMember = !!membership;
      }
      if (!isOwner && !isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // §inventory-phaseB P3 — legacy 경로는 lot/operator/destination 미수집 → LOT/GMP_STRICT 품목
    //   차감 차단(gating 우회·placeholder success 방지). 해당 품목은 /api/inventory/[id]/use 로 처리.
    if (inventory.trackingMode !== "QUANTITY") {
      return NextResponse.json(
        {
          error: "추적 모드 품목은 이 경로로 차감할 수 없습니다",
          trackingMode: inventory.trackingMode,
          message: "로트·담당자·사용처 입력이 필요한 품목입니다. 사용/출고 화면에서 차감하세요.",
        },
        { status: 422 }
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
    await db.productInventory.update({
      where: { id: inventoryId },
      data: {
        currentQuantity: Math.max(0, inventory.currentQuantity - quantity),
      },
    });

    enforcement.complete({});
    return NextResponse.json({ usage }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error recording usage:", error);
    return NextResponse.json(
      { error: "Failed to record usage" },
      { status: 500 }
    );
  }
}

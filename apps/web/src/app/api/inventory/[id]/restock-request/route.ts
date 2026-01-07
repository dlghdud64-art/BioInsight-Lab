import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";

/**
 * 인벤토리 재입고 요청 API
 * POST /api/inventory/[id]/restock-request
 * 
 * 인벤토리 아이템에서 직접 재입고 요청을 생성합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: inventoryId } = await params;

    // 인벤토리 조회
    const inventory = await db.productInventory.findUnique({
      where: { id: inventoryId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            catalogNumber: true,
          },
        },
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory not found" },
        { status: 404 }
      );
    }

    // 소유권 확인
    if (inventory.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: Not your inventory" },
        { status: 403 }
      );
    }

    // 사용자의 팀 조회
    const teamMember = await db.teamMember.findFirst({
      where: { userId: session.user.id },
      include: {
        team: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be a member of a team to request restock" },
        { status: 400 }
      );
    }

    // MEMBER만 요청 가능
    if (teamMember.role === TeamRole.OWNER || teamMember.role === TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "OWNER and ADMIN cannot create purchase requests. Please checkout directly." },
        { status: 400 }
      );
    }

    // 이미 요청이 있는지 확인 (같은 인벤토리, PENDING 상태)
    // JSON 필드에서 inventoryId를 찾기 위해 모든 PENDING 요청을 조회하고 필터링
    const pendingRequests = await db.purchaseRequest.findMany({
      where: {
        requesterId: session.user.id,
        teamId: teamMember.teamId,
        status: PurchaseRequestStatus.PENDING,
      },
      select: {
        id: true,
        items: true,
      },
    });

    const existingRequest = pendingRequests.find((req) => {
      const items = req.items as any;
      if (Array.isArray(items)) {
        return items.some((item: any) => item.inventoryId === inventoryId);
      }
      return false;
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Restock request already exists for this item" },
        { status: 400 }
      );
    }

    // 구매 요청 생성
    const purchaseRequest = await db.purchaseRequest.create({
      data: {
        requesterId: session.user.id,
        teamId: teamMember.teamId,
        title: `재입고 요청: ${inventory.product.name}`,
        message: `인벤토리에서 재입고 요청이 생성되었습니다.\n제품: ${inventory.product.name}\n현재 재고: ${inventory.currentQuantity} ${inventory.unit || "ea"}`,
        items: [
          {
            inventoryId: inventory.id,
            productId: inventory.product.id,
            productName: inventory.product.name,
            brand: inventory.product.brand,
            catalogNumber: inventory.product.catalogNumber,
            quantity: inventory.minOrderQty || 1,
            unit: inventory.unit || "ea",
            notes: `재입고 요청 - 현재 재고: ${inventory.currentQuantity} ${inventory.unit || "ea"}`,
          },
        ] as any,
        status: PurchaseRequestStatus.PENDING,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ purchaseRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating restock request:", error);
    return NextResponse.json(
      { error: "Failed to create restock request" },
      { status: 500 }
    );
  }
}

/**
 * 재입고 요청 상태 조회
 * GET /api/inventory/[id]/restock-request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: inventoryId } = await params;

    // 사용자의 팀 조회
    const teamMember = await db.teamMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!teamMember) {
      return NextResponse.json({ hasRequest: false });
    }

    // PENDING 상태의 요청 확인
    // JSON 필드에서 inventoryId를 찾기 위해 모든 PENDING 요청을 조회하고 필터링
    const pendingRequests = await db.purchaseRequest.findMany({
      where: {
        requesterId: session.user.id,
        teamId: teamMember.teamId,
        status: PurchaseRequestStatus.PENDING,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        items: true,
      },
    });

    const existingRequest = pendingRequests.find((req) => {
      const items = req.items as any;
      if (Array.isArray(items)) {
        return items.some((item: any) => item.inventoryId === inventoryId);
      }
      return false;
    });

    return NextResponse.json({
      hasRequest: !!existingRequest,
      request: existingRequest,
    });
  } catch (error) {
    console.error("Error checking restock request:", error);
    return NextResponse.json(
      { error: "Failed to check restock request" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// 입고 이력 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 재고 존재 + 권한 확인
    const inventory = await db.productInventory.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationId: true },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    const isOwner = inventory.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && inventory.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: inventory.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);

    const records = await db.inventoryRestock.findMany({
      where: { inventoryId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { restockedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error("[InventoryRestock/GET]", error);
    return NextResponse.json({ error: "Failed to fetch restock records" }, { status: 500 });
  }
}

// 입고 처리 (수량 증가 + 이력 기록 — 원자적 트랜잭션)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { quantity, lotNumber, expiryDate, notes } = body;

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity는 0보다 큰 숫자여야 합니다." },
        { status: 400 }
      );
    }

    // 재고 존재 + 권한 확인
    const inventory = await db.productInventory.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationId: true, unit: true, currentQuantity: true },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    const isOwner = inventory.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && inventory.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: inventory.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 트랜잭션: 수량 증가 + 신규 Lot 이력 기록 (기존 Lot 보존 — 덮어쓰기 금지)
    const [updatedInventory, restockRecord] = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // currentQuantity만 증가 — lotNumber/expiryDate는 ProductInventory에서 수정하지 않음
        // 각 Lot 이력은 InventoryRestock 레코드에 개별 보존됨
        const updated = await tx.productInventory.update({
          where: { id },
          data: {
            currentQuantity: { increment: quantity },
          },
          include: {
            product: { select: { id: true, name: true, catalogNumber: true } },
          },
        });

        const restock = await tx.inventoryRestock.create({
          data: {
            inventoryId: id,
            userId: session.user.id,
            quantity,
            unit: inventory.unit,
            lotNumber: lotNumber || null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            notes: notes || null,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });

        return [updated, restock];
      }
    );

    return NextResponse.json({
      inventory: updatedInventory,
      restock: restockRecord,
    });
  } catch (error) {
    console.error("[InventoryRestock/POST]", error);
    return NextResponse.json({ error: "입고 처리에 실패했습니다." }, { status: 500 });
  }
}

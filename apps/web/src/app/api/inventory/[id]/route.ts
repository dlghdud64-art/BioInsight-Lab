import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";

// 개별 재고 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inventory = await db.productInventory.findUnique({
      where: { id: params.id },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // 권한 확인: 자신의 재고 또는 같은 조직의 재고인지 확인
    if (inventory.userId !== session.user.id && !inventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

// 재고 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 기존 재고 확인
    const existingInventory = await db.productInventory.findUnique({
      where: { id: params.id },
    });

    if (!existingInventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // 권한 확인
    if (existingInventory.userId !== session.user.id && !existingInventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      quantity,
      location,
      notes,
      expiryDate,
      date,
      minOrderQty,
      autoReorderEnabled,
      autoReorderThreshold,
      lotNumber,
    } = body;

    // 업데이트할 데이터 준비
    const updateData: any = {};

    if (quantity !== undefined) {
      const parsedQuantity = typeof quantity === 'string'
        ? Number(quantity.replace(/,/g, ''))
        : Number(quantity);
      if (isNaN(parsedQuantity)) {
        return NextResponse.json({ error: "Invalid quantity value" }, { status: 400 });
      }
      updateData.currentQuantity = parsedQuantity;
    }

    if (location !== undefined) updateData.location = location || null;

    if (lotNumber !== undefined) {
      updateData.lotNumber = typeof lotNumber === "string" && lotNumber.trim() !== ""
        ? lotNumber.trim()
        : null;
    }

    if (notes !== undefined || date !== undefined) {
      let updatedNotes = notes || existingInventory.notes || '';
      if (date) {
        const dateNote = `\n[입고일: ${date}]`;
        if (!updatedNotes.includes(dateNote)) updatedNotes = updatedNotes + dateNote;
      }
      updateData.notes = updatedNotes || null;
    }

    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }

    if (minOrderQty !== undefined) {
      const parsedMinOrderQty = typeof minOrderQty === 'string'
        ? Number(minOrderQty.replace(/,/g, ''))
        : Number(minOrderQty);
      if (isNaN(parsedMinOrderQty)) {
        return NextResponse.json({ error: "Invalid minOrderQty value" }, { status: 400 });
      }
      updateData.minOrderQty = parsedMinOrderQty;
    }

    if (autoReorderEnabled !== undefined) {
      updateData.autoReorderEnabled = Boolean(autoReorderEnabled);
    }

    if (autoReorderThreshold !== undefined) {
      const parsedThreshold = typeof autoReorderThreshold === 'string'
        ? Number(autoReorderThreshold.replace(/,/g, ''))
        : Number(autoReorderThreshold);
      if (isNaN(parsedThreshold)) {
        return NextResponse.json({ error: "Invalid autoReorderThreshold value" }, { status: 400 });
      }
      updateData.autoReorderThreshold = parsedThreshold;
    }

    const { ipAddress, userAgent } = extractRequestMeta(request);

    // 트랜잭션: 업데이트 + 감사 로그를 원자적으로 처리
    const updatedInventory = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.productInventory.update({
        where: { id: params.id },
        data: updateData,
        include: {
          product: {
            include: {
              vendors: { include: { vendor: true } },
            },
          },
        },
      });

      await createAuditLog(
        {
          userId:         session.user.id,
          organizationId: existingInventory.organizationId,
          action:         AuditAction.UPDATE,
          entityType:     AuditEntityType.INVENTORY,
          entityId:       params.id,
          previousData: {
            currentQuantity: existingInventory.currentQuantity,
            location:        existingInventory.location,
            lotNumber:       existingInventory.lotNumber,
            notes:           existingInventory.notes,
            expiryDate:      existingInventory.expiryDate,
            minOrderQty:     existingInventory.minOrderQty,
            autoReorderEnabled:   (existingInventory as any).autoReorderEnabled,
            autoReorderThreshold: (existingInventory as any).autoReorderThreshold,
          },
          newData: updateData,
          ipAddress,
          userAgent,
        },
        tx
      );

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedInventory });
  } catch (error: any) {
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Failed to update inventory", details: error.message },
      { status: 500 }
    );
  }
}

// 재고 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 기존 재고 확인
    const existingInventory = await db.productInventory.findUnique({
      where: { id: params.id },
    });

    if (!existingInventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // 권한 확인
    if (existingInventory.userId !== session.user.id && !existingInventory.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ipAddress, userAgent } = extractRequestMeta(request);

    // 트랜잭션: 감사 로그 먼저 기록(FK 참조 전) → 삭제 순서 보장
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // DataAuditLog는 onDelete: SetNull이므로 삭제 전에 기록해도 FK 문제 없음
      await createAuditLog(
        {
          userId:         session.user.id,
          organizationId: existingInventory.organizationId,
          action:         AuditAction.DELETE,
          entityType:     AuditEntityType.INVENTORY,
          entityId:       params.id,
          previousData: {
            currentQuantity: existingInventory.currentQuantity,
            location:        existingInventory.location,
            lotNumber:       existingInventory.lotNumber,
            notes:           existingInventory.notes,
            expiryDate:      existingInventory.expiryDate,
          },
          newData: null,
          ipAddress,
          userAgent,
        },
        tx
      );

      await tx.productInventory.delete({ where: { id: params.id } });
    });

    return NextResponse.json({ success: true, message: "Inventory deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting inventory:", error);
    return NextResponse.json(
      { error: "Failed to delete inventory", details: error.message },
      { status: 500 }
    );
  }
}

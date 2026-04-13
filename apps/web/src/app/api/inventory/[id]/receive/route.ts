import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// 구매 입고 반영 완료 (inventory quantity update + restock record + purchase followup status)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_receive',
      targetEntityType: 'inventory',
      targetEntityId: id,
      sourceSurface: 'inventory-api',
      routePath: '/api/inventory/[id]/receive',
    });
    if (!enforcement.allowed) return enforcement.deny();
    const body = await request.json();
    const {
      purchaseId,
      quantity,
      lotNumber,
      expiryDate,
      location,
      receivedDate,
      notes,
      restockMethod,
    } = body;

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity는 0보다 큰 숫자여야 합니다." },
        { status: 400 }
      );
    }

    // 재고 존재 + 권한 확인
    const inventory = await db.productInventory.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        unit: true,
        currentQuantity: true,
      },
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

    const { ipAddress, userAgent } = extractRequestMeta(request);
    const quantityBefore = inventory.currentQuantity;

    const [updatedInventory, restockRecord] = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. 재고 수량 증가 + 보관 위치 업데이트
        const updateData: Prisma.ProductInventoryUpdateInput = {
          currentQuantity: { increment: quantity },
        };
        if (location) {
          updateData.location = location;
        }

        const updated = await tx.productInventory.update({
          where: { id },
          data: updateData,
          include: {
            product: { select: { id: true, name: true, catalogNumber: true } },
          },
        });

        // 2. 입고 이력 기록
        const restock = await tx.inventoryRestock.create({
          data: {
            inventoryId: id,
            userId: session.user.id,
            quantity,
            unit: inventory.unit,
            lotNumber: lotNumber || null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            notes: notes
              ? `[구매입고] ${notes}`
              : `[구매입고] Purchase ID: ${purchaseId || "-"}`,
            restockedAt: receivedDate ? new Date(receivedDate) : new Date(),
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });

        // 3. 구매 내역 followUpStatus 업데이트
        if (purchaseId) {
          await tx.purchaseRecord.update({
            where: { id: purchaseId },
            data: {
              followUpStatus: "inventory_reflected",
              receivedAt: new Date(),
            },
          }).catch(() => {
            // purchaseId가 유효하지 않아도 입고 반영은 진행
          });
        }

        // 4. 감사 로그
        await createAuditLog(
          {
            userId: session.user.id,
            organizationId: inventory.organizationId,
            action: AuditAction.CREATE,
            entityType: AuditEntityType.INVENTORY_RESTOCK,
            entityId: restock.id,
            previousData: { currentQuantity: quantityBefore },
            newData: {
              restockId: restock.id,
              inventoryId: id,
              purchaseId: purchaseId || null,
              quantity,
              restockMethod: restockMethod || "merge",
              lotNumber: lotNumber || null,
              expiryDate: expiryDate || null,
              location: location || null,
              receivedDate: receivedDate || null,
              notes: notes || null,
              currentQuantityAfter: updated.currentQuantity,
            },
            ipAddress,
            userAgent,
          },
          tx
        );

        return [updated, restock];
      }
    );

    enforcement.complete({});
    return NextResponse.json({
      inventory: updatedInventory,
      restock: restockRecord,
      followUpStatus: "inventory_reflected",
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[InventoryReceive/POST]", error);
    return NextResponse.json({ error: "입고 반영에 실패했습니다." }, { status: 500 });
  }
}

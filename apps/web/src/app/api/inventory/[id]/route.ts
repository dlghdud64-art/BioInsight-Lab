import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { dispatchNotificationEvent } from "@/lib/notifications/event-dispatcher";
import { sendPushNotification } from "@/lib/notifications/push-sender";

/**
 * §11.250a #inventory-low-notification-dispatch — 호영님 dead path audit 후속 (P0).
 *
 *   inventory PATCH 안 quantity 변경 시 transition detection (was OK → now low)
 *   → INVENTORY_LOW dispatch + push.
 *
 *   조건: existingInventory.safetyStock != null && existing > safetyStock &&
 *   updated.currentQuantity <= safetyStock (transition 만 알림 — noise 회피).
 *   §11.229b-5/-6 dispatch + push 1:1 정합 패턴 정확 reuse.
 *
 *   inventory.userId null (organizationId 만) 인 경우 skip — multi-recipient
 *   org broadcast 는 별도 cluster.
 */

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

    // #api-inventory-id-info-leak — isOwner OR isOrgMember 분기.
    //   기존 `userId !== session.user.id && !organizationId` 는 organizationId
    //   있는 row 를 어떤 user 든 통과시켜 multi-tenant info leak 위험. 조직 멤버
    //   verification 추가 (vendor-requests cluster 패턴).
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_update',
      targetEntityType: 'inventory',
      targetEntityId: params.id,
      sourceSurface: 'inventory-api',
      routePath: '/api/inventory/[id]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 기존 재고 확인
    const existingInventory = await db.productInventory.findUnique({
      where: { id: params.id },
    });

    if (!existingInventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // #api-inventory-id-info-leak — isOwner OR isOrgMember 분기 (PATCH).
    {
      const isOwner = existingInventory.userId === session.user.id;
      let isOrgMember = false;
      if (!isOwner && existingInventory.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: existingInventory.organizationId },
          select: { id: true },
        });
        isOrgMember = !!membership;
      }
      if (!isOwner && !isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

    // §11.250a #inventory-low-notification-dispatch — transition detection (was OK → now low).
    //   조건: safetyStock 정의됨 + 이전 quantity > safetyStock + 신규 quantity <= safetyStock.
    //   transition 만 알림 (noise 회피). dispatch + push 1:1 정합 (§11.229b-5/-6 패턴 reuse).
    //   userId null (org-only) 인 경우 skip — multi-recipient org broadcast 별도 cluster.
    {
      const safetyStock = existingInventory.safetyStock;
      const prevQty = existingInventory.currentQuantity;
      const newQty = updatedInventory.currentQuantity;
      const userId = updatedInventory.userId ?? existingInventory.userId;

      if (
        safetyStock != null &&
        safetyStock > 0 &&
        prevQty > safetyStock &&
        newQty <= safetyStock &&
        userId
      ) {
        const productName = updatedInventory.product?.name ?? "재고 항목";
        const unit = updatedInventory.unit ?? "개";

        // §11.250a — INVENTORY_LOW inApp notification dispatch.
        try {
          await dispatchNotificationEvent({
            eventType: "INVENTORY_LOW",
            entityType: "INVENTORY",
            entityId: params.id,
            triggeredBy: session.user.id,
            recipients: [{ userId }],
            metadata: {
              productName,
              currentQuantity: newQty,
              safetyStock,
              unit,
              location: updatedInventory.location ?? null,
            },
          });
        } catch (notifErr) {
          // graceful — mutation 정합 유지
          console.error("[inventory/[id]] INVENTORY_LOW notification 발송 실패 (mutation 정합 유지):", notifErr);
        }

        // §11.250a — Expo OS-level push (외근 운영자 즉시 인지).
        //   payload type "low_stock" 가 mobile ROUTE_MAP 안 등록됨 → /inventory/{id} deep-link 자동.
        try {
          await sendPushNotification(userId, {
            title: "재고 부족 경고",
            body: `${productName} — ${newQty}${unit} (안전재고 ${safetyStock}${unit})`,
            data: {
              type: "low_stock",
              id: params.id,
              productName,
            },
          });
        } catch (pushErr) {
          // graceful — mutation 정합 유지
          console.error("[inventory/[id]] INVENTORY_LOW push notification 실패 (mutation 정합 유지):", pushErr);
        }
      }
    }

    enforcement.complete({});
    return NextResponse.json({ success: true, data: updatedInventory });
  } catch (error: any) {
    enforcement?.fail();
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_delete',
      targetEntityType: 'inventory',
      targetEntityId: params.id,
      sourceSurface: 'inventory-api',
      routePath: '/api/inventory/[id]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 기존 재고 확인
    const existingInventory = await db.productInventory.findUnique({
      where: { id: params.id },
    });

    if (!existingInventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    // #api-inventory-id-info-leak — isOwner OR isOrgMember 분기 (DELETE).
    {
      const isOwner = existingInventory.userId === session.user.id;
      let isOrgMember = false;
      if (!isOwner && existingInventory.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: existingInventory.organizationId },
          select: { id: true },
        });
        isOrgMember = !!membership;
      }
      if (!isOwner && !isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

    enforcement.complete({});
    return NextResponse.json({ success: true, message: "Inventory deleted successfully" });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error deleting inventory:", error);
    return NextResponse.json(
      { error: "Failed to delete inventory", details: error.message },
      { status: 500 }
    );
  }
}

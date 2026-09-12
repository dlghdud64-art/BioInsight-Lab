import { NextRequest, NextResponse } from "next/server";
import { resolveNotesUpdate } from "@/lib/inventory/notes-update";
import { resolveNumericUpdate } from "@/lib/inventory/numeric-field-update";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createDataAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { assertTrackingModeAllowed, TrackingModePlanError } from "@/lib/billing/enforce-plan-limit";
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
      safetyStock, // §inventory-edit-blank-fields — 옛 판본은 이 키를 **꺼내지도 않았다**(편집 통째 무시).
      autoReorderEnabled,
      autoReorderThreshold,
      lotNumber,
      trackingMode, // §inventory-phaseB P3-UI-b — 추적 모드(QUANTITY/LOT/GMP_STRICT).
      catalogNumber, // §11.336 — Product 마스터 Cat.No 편집(수동 입력 동선).
    } = body;

    // 업데이트할 데이터 준비
    const updateData: any = {};
    // §11.336 — Product 마스터 catalogNumber 업데이트(옵션 A: 같은 Product 공유 재고에 반영).
    //   빈 문자열/공백 → null(채우기 취소). 값 있으면 trim. undefined 면 변경 안 함.
    let resolvedCatalogNumber: string | null | undefined = undefined;
    if (catalogNumber !== undefined) {
      resolvedCatalogNumber = typeof catalogNumber === "string" && catalogNumber.trim() !== ""
        ? catalogNumber.trim()
        : null;
    }

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

    // §pricing-enforce-p2 — LOT/GMP_STRICT 는 Pro 플랜만(서버 게이트). 미허용 plan 403 품위 안내.
    if (trackingMode === "LOT" || trackingMode === "GMP_STRICT") {
      try {
        await assertTrackingModeAllowed(session.user.id, trackingMode);
      } catch (e) {
        if (e instanceof TrackingModePlanError) {
          return NextResponse.json(
            { error: e.message, code: e.code, mode: e.mode },
            { status: 403 },
          );
        }
        throw e;
      }
    }

    // §inventory-phaseB P3-UI-b — 추적 모드 화이트리스트(임의 값 차단). 미전달/무효 시 변경 안 함.
    if (trackingMode === "QUANTITY" || trackingMode === "LOT" || trackingMode === "GMP_STRICT") {
      updateData.trackingMode = trackingMode;
    }

    if (lotNumber !== undefined) {
      updateData.lotNumber = typeof lotNumber === "string" && lotNumber.trim() !== ""
        ? lotNumber.trim()
        : null;
    }

    if (notes !== undefined || date !== undefined) {
      /* §inventory-notes-erase (2026-09-11 prod 실측 P1) — 옛 판본은 `notes || existingInventory.notes`
       *   라 빈 문자열이 기존 값으로 되돌아갔다(지우고 저장해도 그대로 · 성공 토스트·감사는 남음).
       *   undefined=유지 · ""/null=비움 을 가르는 해석은 lib 한 곳에 둔다(테스트가 그 함수를 잠근다). */
      updateData.notes = resolveNotesUpdate(notes, existingInventory.notes, date);
    }

    if (expiryDate !== undefined) {
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }

    /* §inventory-edit-blank-fields (호영님 2026-09-12) — "안 넘김" 과 "비움" 을 가른다.
     *   옛 판본은 `Number("")` = 0 이라 **빈 값이 0 으로 저장**됐다. 안전재고 0 은 미설정이 아니라
     *   "0개까지 괜찮다" 이고, 알림 조건이 safetyStock > 0 이라 경고가 영영 안 뜬다. */
    const resolvedMinOrderQty = resolveNumericUpdate(minOrderQty);
    if (resolvedMinOrderQty !== undefined) {
      if (resolvedMinOrderQty !== null && Number.isNaN(resolvedMinOrderQty)) {
        return NextResponse.json({ error: "Invalid minOrderQty value" }, { status: 400 });
      }
      updateData.minOrderQty = resolvedMinOrderQty;
    }

    const resolvedSafetyStock = resolveNumericUpdate(safetyStock);
    if (resolvedSafetyStock !== undefined) {
      if (resolvedSafetyStock !== null && Number.isNaN(resolvedSafetyStock)) {
        return NextResponse.json({ error: "Invalid safetyStock value" }, { status: 400 });
      }
      updateData.safetyStock = resolvedSafetyStock;
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

      // §11.336 — Cat.No 편집: 연결된 Product 마스터 catalogNumber 업데이트.
      //   옵션 A — 같은 Product 를 공유하는 모든 재고에 반영(제품 고유 식별자 정합).
      //   기존 값이 있는데 다른 값으로 변경 시 audit 로그에 before/after 남김.
      if (resolvedCatalogNumber !== undefined && existingInventory.productId) {
        const prevCatNo = updated.product?.catalogNumber ?? null;
        if (prevCatNo !== resolvedCatalogNumber) {
          await tx.product.update({
            where: { id: existingInventory.productId },
            data: { catalogNumber: resolvedCatalogNumber },
          });
          if (updated.product) updated.product.catalogNumber = resolvedCatalogNumber;
        }
      }

      await createDataAuditLog(
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
          newData: { ...updateData, ...(resolvedCatalogNumber !== undefined ? { catalogNumber: resolvedCatalogNumber } : {}) },
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
    // §11.250acd-2 #notification-org-broadcast — organizationMember OWNER+ADMIN 다중 recipient.
    //   기존 single userId + org broadcast 합산. userId Set dedup. push for-of multi-call.
    //   org-only 인벤토리 (userId null) 도 organizationMember 있으면 broadcast 가능.
    {
      const safetyStock = existingInventory.safetyStock;
      const prevQty = existingInventory.currentQuantity;
      const newQty = updatedInventory.currentQuantity;
      const userId = updatedInventory.userId ?? existingInventory.userId;
      const organizationId = updatedInventory.organizationId ?? existingInventory.organizationId;

      // §11.250acd-2 — recipients dedup (single userId + org broadcast).
      const recipientUserIds = new Set<string>();
      if (userId) recipientUserIds.add(userId);
      if (organizationId) {
        try {
          const orgMembers = await db.organizationMember.findMany({
            where: {
              organizationId,
              role: { in: ["OWNER", "ADMIN"] },
            },
            select: { userId: true },
          });
          for (const m of orgMembers as Array<{ userId: string }>) {
            if (m.userId) recipientUserIds.add(m.userId);
          }
        } catch (orgErr) {
          // graceful — single userId fallback
          console.error("[inventory/[id]] INVENTORY_LOW org broadcast member 조회 실패 (single fallback):", orgErr);
        }
      }

      if (
        safetyStock != null &&
        safetyStock > 0 &&
        prevQty > safetyStock &&
        newQty <= safetyStock &&
        recipientUserIds.size > 0
      ) {
        const productName = updatedInventory.product?.name ?? "재고 항목";
        const unit = updatedInventory.unit ?? "개";
        const recipients = Array.from(recipientUserIds).map((uid) => ({ userId: uid }));

        // §11.250a — INVENTORY_LOW inApp notification dispatch.
        try {
          await dispatchNotificationEvent({
            eventType: "INVENTORY_LOW",
            entityType: "INVENTORY",
            entityId: params.id,
            triggeredBy: session.user.id,
            recipients,
            metadata: {
              productName,
              currentQuantity: newQty,
              safetyStock,
              unit,
              location: updatedInventory.location ?? null,
              recipientCount: recipients.length,
            },
          });
        } catch (notifErr) {
          // graceful — mutation 정합 유지
          console.error("[inventory/[id]] INVENTORY_LOW notification 발송 실패 (mutation 정합 유지):", notifErr);
        }

        // §11.250a — Expo OS-level push (외근 운영자 즉시 인지).
        // §11.250acd-2 — multi-recipient for-of (sendPushNotification 은 single userId per call).
        //   payload type "low_stock" 가 mobile ROUTE_MAP 안 등록됨 → /inventory/{id} deep-link 자동.
        for (const recipientUserId of recipientUserIds) {
          try {
            await sendPushNotification(recipientUserId, {
              title: "재고 부족 경고",
              body: `${productName} — ${newQty}${unit} (안전재고 ${safetyStock}${unit})`,
            data: {
              type: "low_stock",
              id: params.id,
              productName,
            },
          }, "INVENTORY_LOW");
          } catch (pushErr) {
            // graceful — mutation 정합 유지
            console.error("[inventory/[id]] INVENTORY_LOW push notification 실패 (mutation 정합 유지):", pushErr);
          }
        }
      }
    }

    enforcement.complete({ organizationId: existingInventory.organizationId });
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
      await createDataAuditLog(
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

    enforcement.complete({ organizationId: existingInventory.organizationId });
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

/**
 * §11.309c #smart-receiving-api — 스마트 입고 등록 endpoint (POST).
 *
 * 호영님 P0 spec (2026-05-26):
 *   사용자가 OCR 스캔 후 확인한 데이터 → 기존 ProductInventory 매칭 시
 *   재고 increment + InventoryRestock 이력 / 신규 시 Product + ProductInventory
 *   + InventoryRestock 모두 create.
 *   §11.309a 의 InventoryRestock.ocrJobId + extractedData 필드 활용 — 스캔
 *   출처 감사 추적.
 *
 * 패턴 정합 (기존 /api/inventory/[id]/restock/route.ts 참조):
 *   - auth() + enforceAction() 보안 미들웨어
 *   - db.$transaction 원자성 (Product + ProductInventory + InventoryRestock +
 *     AuditLog 모두 같은 트랜잭션)
 *   - createAuditLog (INVENTORY_RESTOCK CREATE)
 *
 * 입력 payload:
 *   {
 *     ocrJobId: string;                    // §11.290 OcrJob.id (필수 — 감사)
 *     inventoryId?: string | null;         // 기존 ProductInventory.id (매칭 시)
 *     confirmedData: {                     // 사용자가 OCR 결과 확인/수정한 최종 데이터
 *       productName?: string | null;       // 신규 시 Product.name (필수)
 *       brand?: string | null;
 *       catalogNumber?: string | null;
 *       lotNumber?: string | null;
 *       expirationDate?: string | null;    // ISO date string
 *       quantity: number;                  // 입고 수량 (필수, > 0)
 *       unit?: string | null;
 *       storageCondition?: string | null;  // 신규 시 Product.storageCondition
 *       category?: string | null;          // 신규 시 Product.category (default OTHER)
 *       notes?: string | null;
 *     };
 *     organizationId?: string | null;       // 신규 ProductInventory.organizationId
 *   }
 *
 * 응답:
 *   { inventoryId, inventoryRestockId, productId, quantity, isNew: boolean }
 *
 * 보안:
 *   - 미인증 → 401
 *   - quantity ≤ 0 → 400
 *   - ocrJobId 미존재 또는 다른 org → 404
 *   - inventoryId 미존재 또는 권한 없음 → 403/404
 *   - 신규 시 productName 누락 → 400
 *
 * dead button 0 — 모든 분기에 real DB write + audit log.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma, ProductCategory } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

interface SmartReceivingBody {
  ocrJobId: string;
  inventoryId?: string | null;
  organizationId?: string | null;
  confirmedData: {
    productName?: string | null;
    brand?: string | null;
    catalogNumber?: string | null;
    lotNumber?: string | null;
    expirationDate?: string | null;
    quantity: number;
    unit?: string | null;
    storageCondition?: string | null;
    category?: string | null;
    notes?: string | null;
  };
}

// §11.309c — Prisma ProductCategory enum 의 default fallback.
// 사용자가 신규 시 category 미지정 → OTHER (후속 inventory 편집에서 보완).
const DEFAULT_CATEGORY: ProductCategory = "OTHER" as ProductCategory;

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as SmartReceivingBody;
    const { ocrJobId, inventoryId, organizationId, confirmedData } = body;

    // ── Input validation ──
    if (!ocrJobId || typeof ocrJobId !== "string") {
      return NextResponse.json(
        { error: "ocrJobId는 필수입니다." },
        { status: 400 },
      );
    }
    if (
      !confirmedData ||
      typeof confirmedData.quantity !== "number" ||
      confirmedData.quantity <= 0
    ) {
      return NextResponse.json(
        { error: "confirmedData.quantity는 0보다 큰 숫자여야 합니다." },
        { status: 400 },
      );
    }

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "inventory_smart_receiving",
      targetEntityType: "inventory",
      targetEntityId: inventoryId ?? `new:${ocrJobId}`,
      sourceSurface: "smart-receiving-api",
      routePath: "/api/inventory/smart-receiving",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // ── OcrJob 검증 (multi-tenant + 존재) ──
    const ocrJob = await db.ocrJob.findUnique({
      where: { id: ocrJobId },
      select: { id: true, organizationId: true, userId: true, type: true },
    });

    if (!ocrJob) {
      return NextResponse.json(
        { error: "ocrJob을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 같은 organization 또는 본인의 OcrJob 만 허용
    const ocrOrgMatches =
      organizationId && ocrJob.organizationId === organizationId;
    const ocrOwnerMatches = ocrJob.userId === session.user.id;
    if (!ocrOrgMatches && !ocrOwnerMatches) {
      // 다른 org 의 OcrJob 사용 차단 (multi-tenant 격리)
      const membership = ocrJob.organizationId
        ? await db.organizationMember.findFirst({
            where: {
              userId: session.user.id,
              organizationId: ocrJob.organizationId,
            },
          })
        : null;
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { ipAddress, userAgent } = extractRequestMeta(request);

    // ────────────────────────────────────────────────────────────
    // 분기 A: 기존 ProductInventory 매칭 시 (inventoryId 있음)
    //   → currentQuantity increment + InventoryRestock create
    // ────────────────────────────────────────────────────────────
    if (inventoryId) {
      const inventory = await db.productInventory.findUnique({
        where: { id: inventoryId },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          unit: true,
          currentQuantity: true,
          productId: true,
        },
      });

      if (!inventory) {
        return NextResponse.json(
          { error: "Inventory not found" },
          { status: 404 },
        );
      }

      const isOwner = inventory.userId === session.user.id;
      let isOrgMember = false;
      if (!isOwner && inventory.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: {
            userId: session.user.id,
            organizationId: inventory.organizationId,
          },
        });
        isOrgMember = !!membership;
      }
      if (!isOwner && !isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const quantityBefore = inventory.currentQuantity;

      const [updatedInventory, restock] = await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.productInventory.update({
            where: { id: inventoryId },
            data: { currentQuantity: { increment: confirmedData.quantity } },
            include: {
              product: {
                select: { id: true, name: true, catalogNumber: true },
              },
            },
          });

          const restockRecord = await tx.inventoryRestock.create({
            data: {
              inventoryId,
              userId: session.user.id,
              quantity: confirmedData.quantity,
              unit: confirmedData.unit ?? inventory.unit,
              lotNumber: confirmedData.lotNumber ?? null,
              expiryDate: confirmedData.expirationDate
                ? new Date(confirmedData.expirationDate)
                : null,
              notes: confirmedData.notes ?? null,
              // §11.309a 신규 필드 — OCR 출처 + 추출 데이터 감사 추적
              ocrJobId,
              extractedData: confirmedData as unknown as Prisma.InputJsonValue,
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          });

          await createAuditLog(
            {
              userId: session.user.id,
              organizationId: inventory.organizationId,
              action: AuditAction.CREATE,
              entityType: AuditEntityType.INVENTORY_RESTOCK,
              entityId: restockRecord.id,
              previousData: { currentQuantity: quantityBefore },
              newData: {
                restockId: restockRecord.id,
                inventoryId,
                productId: inventory.productId,
                quantity: confirmedData.quantity,
                lotNumber: confirmedData.lotNumber ?? null,
                expiryDate: confirmedData.expirationDate ?? null,
                ocrJobId,
                currentQuantityAfter: updated.currentQuantity,
                source: "smart_receiving",
              },
              ipAddress,
              userAgent,
            },
            tx,
          );

          return [updated, restockRecord];
        },
      );

      enforcement.complete({
        beforeState: { currentQuantity: quantityBefore },
        afterState: {
          currentQuantity: updatedInventory.currentQuantity,
          restockId: restock.id,
        },
      });

      return NextResponse.json({
        inventoryId: updatedInventory.id,
        inventoryRestockId: restock.id,
        productId: updatedInventory.productId,
        quantity: confirmedData.quantity,
        isNew: false,
      });
    }

    // ────────────────────────────────────────────────────────────
    // 분기 B: 신규 품목 (inventoryId 없음)
    //   → Product create + ProductInventory create + InventoryRestock create
    // ────────────────────────────────────────────────────────────
    if (!confirmedData.productName || confirmedData.productName.trim() === "") {
      return NextResponse.json(
        {
          error:
            "신규 품목 등록 시 confirmedData.productName이 필수입니다.",
        },
        { status: 400 },
      );
    }

    const targetOrgId = organizationId ?? ocrJob.organizationId ?? null;

    const created = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1) Product create
        const product = await tx.product.create({
          data: {
            name: confirmedData.productName!.trim(),
            brand: confirmedData.brand ?? null,
            catalogNumber: confirmedData.catalogNumber ?? null,
            lotNumber: confirmedData.lotNumber ?? null,
            category: (confirmedData.category as ProductCategory) ?? DEFAULT_CATEGORY,
            storageCondition: confirmedData.storageCondition ?? null,
          },
          select: { id: true, name: true, brand: true, catalogNumber: true },
        });

        // 2) ProductInventory create
        const newInventory = await tx.productInventory.create({
          data: {
            productId: product.id,
            userId: session.user.id,
            organizationId: targetOrgId,
            currentQuantity: confirmedData.quantity,
            unit: confirmedData.unit ?? null,
            lotNumber: confirmedData.lotNumber ?? null,
            expiryDate: confirmedData.expirationDate
              ? new Date(confirmedData.expirationDate)
              : null,
          },
          select: { id: true, currentQuantity: true, productId: true },
        });

        // 3) InventoryRestock create (with ocrJobId + extractedData)
        const restockRecord = await tx.inventoryRestock.create({
          data: {
            inventoryId: newInventory.id,
            userId: session.user.id,
            quantity: confirmedData.quantity,
            unit: confirmedData.unit ?? null,
            lotNumber: confirmedData.lotNumber ?? null,
            expiryDate: confirmedData.expirationDate
              ? new Date(confirmedData.expirationDate)
              : null,
            notes: confirmedData.notes ?? null,
            // §11.309a 신규 필드
            ocrJobId,
            extractedData: confirmedData as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        // 4) AuditLog (INVENTORY_RESTOCK CREATE)
        await createAuditLog(
          {
            userId: session.user.id,
            organizationId: targetOrgId,
            action: AuditAction.CREATE,
            entityType: AuditEntityType.INVENTORY_RESTOCK,
            entityId: restockRecord.id,
            previousData: null,
            newData: {
              restockId: restockRecord.id,
              inventoryId: newInventory.id,
              productId: product.id,
              quantity: confirmedData.quantity,
              lotNumber: confirmedData.lotNumber ?? null,
              expiryDate: confirmedData.expirationDate ?? null,
              ocrJobId,
              currentQuantityAfter: newInventory.currentQuantity,
              source: "smart_receiving",
              isNewProduct: true,
            },
            ipAddress,
            userAgent,
          },
          tx,
        );

        return { product, inventory: newInventory, restock: restockRecord };
      },
    );

    enforcement.complete({
      beforeState: null,
      afterState: {
        productId: created.product.id,
        inventoryId: created.inventory.id,
        restockId: created.restock.id,
        currentQuantity: created.inventory.currentQuantity,
      },
    });

    return NextResponse.json({
      inventoryId: created.inventory.id,
      inventoryRestockId: created.restock.id,
      productId: created.product.id,
      quantity: confirmedData.quantity,
      isNew: true,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[SmartReceiving/POST]", error);
    return NextResponse.json(
      { error: "스마트 입고 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}

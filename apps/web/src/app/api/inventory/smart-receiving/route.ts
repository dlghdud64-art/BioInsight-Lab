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
 *   - auth() 보안 + DataAuditLog 감사 추적 (§11.309c-hotfix-2)
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
// §cas-hazard-classification P3b — 입고 시 OCR casNumber → casNo 저장 + 정적 위험분류.
import { buildProductHazardFields } from "@/lib/safety/product-hazard-fields";
import { Prisma, ProductCategory } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
// §scan-registration-reason — 500 응답에 사유를 실어 보낸다(침묵 금지).
import { describeFailure } from "@/lib/api-failure-reason";
// 알림 고도화 #notif-inventory-received — 입고 완료 시 INVENTORY_RECEIVED 알림(best-effort).
import { dispatchNotificationEvent, resolveOrgRecipients } from "@/lib/notifications";
// §11.309c-hotfix-2 — security middleware import 제거 (단순화).
// IrreversibleActionType enum 미등록 → TS error. auth() + DataAuditLog 로 충분.
// 후속 §11.309c-3 에서 enum 추가 후 복원 검토.

interface SmartReceivingBody {
  ocrJobId: string;
  inventoryId?: string | null;
  organizationId?: string | null;
  confirmedData?: {
    productName?: string | null;
    brand?: string | null;
    catalogNumber?: string | null;
    lotNumber?: string | null;
    expirationDate?: string | null;
    quantity: number;
    unit?: string | null;
    packSize?: number | null;
    packUnit?: string | null;
    storageCondition?: string | null;
    category?: string | null;
    notes?: string | null;
    // §cas-hazard-classification P3b — CAS(선택 override). 미전달 시 OcrJob.finalResult 에서 파생.
    casNumber?: string | null;
  };
  // §scan-cat-guard — Cat.No. 없이 신규 등록 override(기본 false = 서버 방어).
  allowMissingCatalog?: boolean;
  // §scan-recognition-upgrade P2 — 명세서 다품목 일괄 등록(additive).
  //   있으면 $transaction 1회 안에서 라인별 처리(부분 실패 = 전체 롤백), 없으면 기존 단품 경로.
  items?: SmartReceivingLine[];
}

interface SmartReceivingLine {
  productName?: string | null;
  inventoryId?: string | null; // 기존 재고 라인(증가), 없으면 신규 Product 생성
  brand?: string | null;
  catalogNumber?: string | null;
  lotNumber?: string | null;
  expirationDate?: string | null;
  quantity: number;
  unit?: string | null;
  packSize?: number | null;
  packUnit?: string | null;
  notes?: string | null;
}

// §11.309c — Prisma ProductCategory enum 의 default fallback.
// 사용자가 신규 시 category 미지정 → OTHER (후속 inventory 편집에서 보완).
const DEFAULT_CATEGORY: ProductCategory = "OTHER" as ProductCategory;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as SmartReceivingBody;
    const { ocrJobId, inventoryId, organizationId, confirmedData, allowMissingCatalog } = body;

    // ── Input validation ──
    if (!ocrJobId || typeof ocrJobId !== "string") {
      return NextResponse.json(
        { error: "ocrJobId는 필수입니다." },
        { status: 400 },
      );
    }
    // §scan-recognition-upgrade P2 — items[] 다품목 경로는 라인별 수량을 검증하므로
    //   confirmedData 단품 필수 검증을 건너뛴다(additive · 단품 경로 무회귀).
    const isMultiRequest = Array.isArray(body.items) && body.items.length > 0;
    if (
      !isMultiRequest &&
      (!confirmedData ||
        typeof confirmedData.quantity !== "number" ||
        confirmedData.quantity <= 0)
    ) {
      return NextResponse.json(
        { error: "confirmedData.quantity는 0보다 큰 숫자여야 합니다." },
        { status: 400 },
      );
    }

    // ── OcrJob 검증 (multi-tenant + 존재) ──
    const ocrJob = await db.ocrJob.findUnique({
      where: { id: ocrJobId },
      select: { id: true, organizationId: true, userId: true, type: true, finalResult: { select: { parsedFields: true } } },
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
    // §scan-recognition-upgrade P2 — 다품목 일괄 등록 (items[] 있으면)
    //   전건 사전 검증 → $transaction 1회 안 라인별 처리(부분 실패 = 전체 롤백).
    //   등록 라인 수 = InventoryRestock 생성 수 계약(results 배열).
    // ────────────────────────────────────────────────────────────
    if (Array.isArray(body.items) && body.items.length > 0) {
      const lines = body.items;
      const targetOrgIdMulti = organizationId ?? ocrJob.organizationId ?? null;

      for (const line of lines) {
        if (typeof line.quantity !== "number" || line.quantity <= 0) {
          return NextResponse.json(
            { error: "각 라인의 수량은 0보다 큰 숫자여야 합니다.", code: "INVALID_LINE_QUANTITY" },
            { status: 400 },
          );
        }
        if (!line.inventoryId && (!line.productName || line.productName.trim() === "")) {
          return NextResponse.json(
            { error: "신규 라인은 품목명이 필수입니다.", code: "LINE_NAME_REQUIRED" },
            { status: 400 },
          );
        }
        // §scan-cat-guard — 라인 단위 동일 적용(override 1회로 전 라인 허용).
        if (
          !line.inventoryId &&
          (!line.catalogNumber || line.catalogNumber.trim() === "") &&
          !allowMissingCatalog
        ) {
          return NextResponse.json(
            {
              error: "식별 정보(Cat.No.) 없는 신규 라인이 있습니다 · Cat.No.를 입력하거나 확인 후 진행하세요.",
              code: "catalog_required",
            },
            { status: 422 },
          );
        }
      }

      // 소유/조직 스코프 사전 검증 — 트랜잭션 밖(단품 경로 403 계약 정합 · 실패 시 트랜잭션 진입 0).
      //   (호영님 검토 2026-08-31: 트랜잭션 안 throw 는 500 으로 위장되던 결함 교정)
      const invById = new Map<string, { id: string; userId: string; organizationId: string | null; unit: string | null; productId: string }>();
      for (const line of lines) {
        if (!line.inventoryId) continue;
        const inv = await db.productInventory.findUnique({
          where: { id: line.inventoryId },
          select: { id: true, userId: true, organizationId: true, unit: true, productId: true },
        });
        if (!inv) {
          return NextResponse.json(
            { error: "라인의 재고를 찾을 수 없습니다.", code: "LINE_INVENTORY_NOT_FOUND", inventoryId: line.inventoryId },
            { status: 404 },
          );
        }
        const owned = inv.userId === session.user.id;
        const orgOk = inv.organizationId != null && inv.organizationId === targetOrgIdMulti;
        if (!owned && !orgOk) {
          return NextResponse.json(
            { error: "라인 재고에 대한 권한이 없습니다.", code: "LINE_FORBIDDEN", inventoryId: line.inventoryId },
            { status: 403 },
          );
        }
        invById.set(line.inventoryId, inv);
      }

      const results = await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const out: { inventoryId: string; inventoryRestockId: string; productId: string | null; isNew: boolean }[] = [];
          for (const line of lines) {
            const expiry = line.expirationDate ? new Date(line.expirationDate) : null;
            if (line.inventoryId) {
              // 스코프는 위에서 사전 검증 완료 — 여기서는 증가·이력만.
              const inv = invById.get(line.inventoryId)!;
              const updated = await tx.productInventory.update({
                where: { id: inv.id },
                data: { currentQuantity: { increment: line.quantity } },
                select: { id: true, productId: true, currentQuantity: true },
              });
              const restock = await tx.inventoryRestock.create({
                data: {
                  inventoryId: inv.id,
                  userId: session.user.id,
                  quantity: line.quantity,
                  unit: line.unit ?? inv.unit,
                  lotNumber: line.lotNumber ?? null,
                  expiryDate: expiry,
                  notes: line.notes ?? null,
                  // §11.309a lineage — 다품목은 행별 근거(line)를 남긴다. 전체 payload 복제 금지.
                  ocrJobId,
                  extractedData: line as unknown as Prisma.InputJsonValue,
                },
                select: { id: true },
              });
              await createAuditLog(
                {
                  userId: session.user.id,
                  organizationId: targetOrgIdMulti,
                  action: AuditAction.CREATE,
                  entityType: AuditEntityType.INVENTORY_RESTOCK,
                  entityId: restock.id,
                  previousData: null,
                  newData: {
                    restockId: restock.id, inventoryId: inv.id, productId: inv.productId,
                    quantity: line.quantity, lotNumber: line.lotNumber ?? null, ocrJobId,
                    currentQuantityAfter: updated.currentQuantity,
                    source: "smart_receiving_multi",
                  },
                  ipAddress, userAgent,
                },
                tx,
              );
              out.push({ inventoryId: inv.id, inventoryRestockId: restock.id, productId: inv.productId, isNew: false });
            } else {
              const product = await tx.product.create({
                data: {
                  name: line.productName!.trim(),
                  brand: line.brand ?? null,
                  catalogNumber: line.catalogNumber ?? null,
                  lotNumber: line.lotNumber ?? null,
                  category: DEFAULT_CATEGORY,
                  packSize: typeof line.packSize === "number" ? line.packSize : null,
                  packUnit: line.packUnit ?? null,
                },
                select: { id: true },
              });
              const newInventory = await tx.productInventory.create({
                data: {
                  productId: product.id,
                  userId: session.user.id,
                  organizationId: targetOrgIdMulti,
                  currentQuantity: line.quantity,
                  unit: line.unit ?? null,
                  lotNumber: line.lotNumber ?? null,
                  expiryDate: expiry,
                },
                select: { id: true, currentQuantity: true },
              });
              const restock = await tx.inventoryRestock.create({
                data: {
                  inventoryId: newInventory.id,
                  userId: session.user.id,
                  quantity: line.quantity,
                  unit: line.unit ?? null,
                  lotNumber: line.lotNumber ?? null,
                  expiryDate: expiry,
                  notes: line.notes ?? null,
                  // §11.309a lineage — 다품목 신규 라인도 동일 계약.
                  ocrJobId,
                  extractedData: line as unknown as Prisma.InputJsonValue,
                },
                select: { id: true },
              });
              await createAuditLog(
                {
                  userId: session.user.id,
                  organizationId: targetOrgIdMulti,
                  action: AuditAction.CREATE,
                  entityType: AuditEntityType.INVENTORY_RESTOCK,
                  entityId: restock.id,
                  previousData: null,
                  newData: {
                    restockId: restock.id, inventoryId: newInventory.id, productId: product.id,
                    quantity: line.quantity, lotNumber: line.lotNumber ?? null, ocrJobId,
                    currentQuantityAfter: newInventory.currentQuantity,
                    source: "smart_receiving_multi", isNewProduct: true,
                  },
                  ipAddress, userAgent,
                },
                tx,
              );
              out.push({ inventoryId: newInventory.id, inventoryRestockId: restock.id, productId: product.id, isNew: true });
            }
          }
          return out;
        },
      );

      // 알림 — 일괄 1건(best-effort, mutation 비차단).
      try {
        const recipients = await resolveOrgRecipients(session.user.id, targetOrgIdMulti);
        if (recipients.length > 0) {
          await dispatchNotificationEvent({
            eventType: "INVENTORY_RECEIVED",
            entityType: "INVENTORY",
            entityId: results[0]?.inventoryId ?? "",
            triggeredBy: session.user.id,
            recipients,
            metadata: { multi: true, lineCount: results.length },
          });
        }
      } catch (notifyErr) {
        console.error("[SmartReceiving] multi INVENTORY_RECEIVED dispatch 실패 (무시):", notifyErr);
      }

      return NextResponse.json({ results, count: results.length, multi: true });
    }

    // 단품 경로 타입 방어 — multi 는 위에서 종료, 여기부터 confirmedData 필수(위 검증 통과분).
    if (!confirmedData) {
      return NextResponse.json(
        { error: "confirmedData가 필요합니다." },
        { status: 400 },
      );
    }

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
              // §11.309a — OCR 출처 + 확인된 추출 데이터(감사 추적). 컬럼은 진작 적용됐는데
              //   구 대기 주석이 남아 세 경로 모두 미기입이었다(2026-09-02 실측).
              //   lineage 가 없으면 스캔 입고를 스캔으로 식별할 수 없다(§receiving-scan-source-merge C3).
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

      // 알림 고도화 — 기존 재고 입고 완료 → INVENTORY_RECEIVED (best-effort, mutation 비차단).
      try {
        const recipients = await resolveOrgRecipients(
          inventory.userId,
          inventory.organizationId,
        );
        if (recipients.length > 0) {
          await dispatchNotificationEvent({
            eventType: "INVENTORY_RECEIVED",
            entityType: "INVENTORY",
            entityId: inventoryId,
            triggeredBy: session.user.id,
            recipients,
            metadata: {
              productName: updatedInventory.product?.name ?? null,
              quantity: confirmedData.quantity,
              lotNumber: confirmedData.lotNumber ?? null,
              isNewProduct: false,
            },
          });
        }
      } catch (notifyErr) {
        console.error("[SmartReceiving] INVENTORY_RECEIVED dispatch 실패 (무시):", notifyErr);
      }

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

    // §scan-cat-guard (호영님 2026-07-03) — Cat.No.(품목 유일 식별키) 없이 신규 Product 생성 방어.
    //   override 미승인 시 거절(422). UI 우회·직접 API 호출도 차단(defense-in-depth).
    if (
      (!confirmedData.catalogNumber || confirmedData.catalogNumber.trim() === "") &&
      !allowMissingCatalog
    ) {
      return NextResponse.json(
        {
          error:
            "식별 정보(Cat.No.)가 없어 신규 품목을 등록할 수 없습니다 — Cat.No.를 입력하거나 확인 후 진행하세요.",
          code: "catalog_required",
        },
        { status: 422 },
      );
    }

    const targetOrgId = organizationId ?? ocrJob.organizationId ?? null;

    const created = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1) Product create
        // §cas-hazard-classification P3b — CAS 소스: confirmedData override → OcrJob 파싱값.
        //   casNo 저장 + 정적 CAS→GHS 분류로 hazardCodes/pictograms 채움(위험물질만).
        const ocrParsed = ocrJob.finalResult?.parsedFields as { casNumber?: string | null } | null;
        const hazardFields = buildProductHazardFields(confirmedData.casNumber ?? ocrParsed?.casNumber ?? null);
        const product = await tx.product.create({
          data: {
            name: confirmedData.productName!.trim(),
            brand: confirmedData.brand ?? null,
            catalogNumber: confirmedData.catalogNumber ?? null,
            lotNumber: confirmedData.lotNumber ?? null,
            category: (confirmedData.category as ProductCategory) ?? DEFAULT_CATEGORY,
            packSize: typeof confirmedData.packSize === "number" ? confirmedData.packSize : null,
            packUnit: confirmedData.packUnit ?? null,
            storageCondition: confirmedData.storageCondition ?? null,
            ...hazardFields,
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
            // §11.309a — OCR 출처 + 확인된 추출 데이터(감사 추적). 위 분기 A 와 동일 계약.
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

    // 알림 고도화 — 신규 품목 입고 완료 → INVENTORY_RECEIVED (best-effort, mutation 비차단).
    try {
      const recipients = await resolveOrgRecipients(session.user.id, targetOrgId);
      if (recipients.length > 0) {
        await dispatchNotificationEvent({
          eventType: "INVENTORY_RECEIVED",
          entityType: "INVENTORY",
          entityId: created.inventory.id,
          triggeredBy: session.user.id,
          recipients,
          metadata: {
            productName: created.product.name,
            quantity: confirmedData.quantity,
            lotNumber: confirmedData.lotNumber ?? null,
            isNewProduct: true,
          },
        });
      }
    } catch (notifyErr) {
      console.error("[SmartReceiving] INVENTORY_RECEIVED dispatch 실패 (무시):", notifyErr);
    }

    return NextResponse.json({
      inventoryId: created.inventory.id,
      inventoryRestockId: created.restock.id,
      productId: created.product.id,
      quantity: confirmedData.quantity,
      isNew: true,
    });
  } catch (error) {
    console.error("[SmartReceiving/POST]", error);
    // §scan-registration-reason (호영님 2026-09-04) — 사유 없는 500 은 같은 자리로 돌아온다.
    //   고정 문구만 반환하던 탓에 존재하지 않는 enum 값이 prod 에서 완전히 침묵했다
    //   (신규 품목 등록 100% 실패 · 브라우저에서 판별 불가). 스캔 차단 skipReason 과 동일 계약.
    return NextResponse.json(
      { error: "스마트 입고 처리에 실패했습니다.", failReason: describeFailure(error) },
      { status: 500 },
    );
  }
}

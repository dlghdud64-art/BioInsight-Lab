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
 *       category?: string | null;          // 신규 시 Product.category (미전달·무효 시 fallback REAGENT)
 *       categoryTouched?: boolean;         // 사용자가 분류를 건드렸는가 (미전달 시 categorySource=UNKNOWN)
 *       notes?: string | null;
 *     };
 *     organizationId?: string | null;       // 조직 hint(선택). 멤버십 검증 통과 시만 채택,
 *                                           //   틀리면 403. 미전달 시 세션의 활성 조직.
 *   }
 *
 * 응답:
 *   { inventoryId, inventoryRestockId, productId, quantity, isNew: boolean }
 *
 * 보안:
 *   - 미인증 → 401
 *   - quantity ≤ 0 → 400
 *   - ocrJobId 미존재 → 404 / 본인 소유 아님 → 403 (§scan-org-identity)
 *   - 조직 hint 권한 없음 → 403 · 소속 조직 0 → 422 (§scan-org-identity)
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
import { Prisma } from "@prisma/client";
import { createAuditLog, extractRequestMeta, AuditAction, AuditEntityType } from "@/lib/audit";
// §scan-registration-reason — 500 응답에 사유를 실어 보낸다(침묵 금지).
import { describeFailure } from "@/lib/api-failure-reason";
// §scan-registration-category — 분류·출처 단일 소스(캐스트 0 · Record 로 전수 강제).
import { resolveProductCategory } from "@/lib/inventory/product-category-options";
// §scan-org-identity — 조직의 권위 있는 출처는 세션이다. OcrJob 의 조직 필드는 신뢰하지 않는다.
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";
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
    // §scan-category-touched — 사용자가 분류를 **실제로 건드렸는가**. 값만으로는
    //   선채움 통과와 사람의 선택이 구별되지 않는다(2026-09-04 스모크 실측).
    categoryTouched?: boolean;
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
  // §scan-registration-category — 라인별 분류(미전달·무효 시 fallback REAGENT + categorySource FALLBACK).
  category?: string | null;
  // §scan-category-touched — 라인별로 건드렸는지. 라인마다 다르다.
  categoryTouched?: boolean;
}

// §scan-registration-category (호영님 2026-09-04) — 분류 단일 소스로 이관.
//   구: `"OTHER" as ProductCategory` — prod enum 에 OTHER 가 없어 신규 품목 등록이 100% 실패했다.
//   `as` 캐스트가 타입 검사를 우회했고, 정적 sentinel 은 문자열만 봐서 GREEN 으로 지켜줬다.
//   이제 상수는 lib/inventory/product-category-options 한 곳에만 있고 캐스트가 없다.

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
      // §scan-org-identity — organizationId 는 **읽지 않는다**. 신뢰하지 않기로 한 필드를
      //   select 에 남겨두면 다음 사람이 다시 쓴다(이번 결함이 그렇게 살아남았다).
      select: { id: true, userId: true, type: true, finalResult: { select: { parsedFields: true } } },
    });

    if (!ocrJob) {
      return NextResponse.json(
        { error: "ocrJob을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // §scan-org-identity (호영님 2026-09-04) — 구 판본은 `ocrJob.organizationId === organizationId`
    //   로 조직 격리를 주장했다. 그런데 OCR 라우트 5곳이 그 필드에 **session.user.id 를**
    //   써 왔다(prod 실측: OcrJob.organizationId == userId · 그 조직 실재 안 함).
    //   즉 조직끼리가 아니라 **조직 자리의 userId 끼리** 비교하고 있었다 — 격리 계약이
    //   성립한 적이 없다. 신뢰할 수 없는 필드 간 비교는 보정이 아니라 폐기가 맞다.
    //   OcrJob 의 조직 필드가 정합될 때까지(§scan-org-identity B 배치) **소유자 본인만** 허용한다.
    //   같은 조직 동료의 스캔을 대신 등록하는 경로는 그때 복원한다(현재 조직당 1명 = 영향 0).
    if (ocrJob.userId !== session.user.id) {
      return NextResponse.json(
        { error: "본인이 스캔한 기록만 입고 등록할 수 있습니다.", code: "OCRJOB_NOT_OWNED" },
        { status: 403 },
      );
    }

    // §scan-org-identity — 조직의 권위 있는 출처는 **세션**이다.
    //   구 판본 `organizationId ?? ocrJob.organizationId ?? null` 는 오염된 값을 그대로
    //   ProductInventory.organizationId 에 넣어 P2003(FK 위반)으로 터졌다.
    //   오염값을 null 로 삼키지 않는다 — 그러면 개인 재고로 조용히 흘러 조직 격리가 사라진다.
    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
      hint: organizationId ?? null,
    });
    if (!orgResolution.ok) {
      return orgResolution.reason === "hint_forbidden"
        ? NextResponse.json(
            { error: "지정한 조직에 대한 권한이 없습니다.", code: "ORG_FORBIDDEN" },
            { status: 403 },
          )
        : NextResponse.json(
            {
              error: "소속 조직이 없어 입고를 등록할 수 없습니다 · 조직에 참여한 뒤 다시 시도하세요.",
              code: "NO_ORGANIZATION",
            },
            { status: 422 },
          );
    }
    const targetOrganizationId = orgResolution.organizationId;

    const { ipAddress, userAgent } = extractRequestMeta(request);

    // ────────────────────────────────────────────────────────────
    // §scan-recognition-upgrade P2 — 다품목 일괄 등록 (items[] 있으면)
    //   전건 사전 검증 → $transaction 1회 안 라인별 처리(부분 실패 = 전체 롤백).
    //   등록 라인 수 = InventoryRestock 생성 수 계약(results 배열).
    // ────────────────────────────────────────────────────────────
    if (Array.isArray(body.items) && body.items.length > 0) {
      const lines = body.items;
      const targetOrgIdMulti = targetOrganizationId;

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
              // §scan-registration-category — 라인별 분류. 사람이 고른 값이면 USER_SELECTED,
              //   아니면 fallback(REAGENT) + FALLBACK 을 근거로 남긴다.
              const lineCategory = resolveProductCategory(line.category, line.categoryTouched);
              const product = await tx.product.create({
                data: {
                  name: line.productName!.trim(),
                  brand: line.brand ?? null,
                  catalogNumber: line.catalogNumber ?? null,
                  lotNumber: line.lotNumber ?? null,
                  category: lineCategory.category,
                  categorySource: lineCategory.categorySource,
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

    const targetOrgId = targetOrganizationId;

    const created = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1) Product create
        // §cas-hazard-classification P3b — CAS 소스: confirmedData override → OcrJob 파싱값.
        //   casNo 저장 + 정적 CAS→GHS 분류로 hazardCodes/pictograms 채움(위험물질만).
        const ocrParsed = ocrJob.finalResult?.parsedFields as { casNumber?: string | null } | null;
        const hazardFields = buildProductHazardFields(confirmedData.casNumber ?? ocrParsed?.casNumber ?? null);
        // §scan-registration-category — 구: `(confirmedData.category as ProductCategory) ?? DEFAULT_CATEGORY`.
        //   `as` 는 검사를 우회할 뿐 아니라 빈 문자열·오타도 그대로 통과시켰다(?? 는 null/undefined 만 막는다).
        const resolvedCategory = resolveProductCategory(
          confirmedData.category,
          confirmedData.categoryTouched,
        );
        const product = await tx.product.create({
          data: {
            name: confirmedData.productName!.trim(),
            brand: confirmedData.brand ?? null,
            catalogNumber: confirmedData.catalogNumber ?? null,
            lotNumber: confirmedData.lotNumber ?? null,
            category: resolvedCategory.category,
            categorySource: resolvedCategory.categorySource,
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

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
// §order-entry-rewire P2 — confirm 봉합: 발주 예약과 PurchaseRecord 의 이중 계상 차단
import {
  buildConfirmEvent,
  activeReservedAmount,
  ORDER_RESERVED,
  ORDER_RELEASED,
  ORDER_CONFIRMED,
} from "@/lib/budget/order-reservation";
import { Prisma, PrismaClient } from "@prisma/client";

// Transaction client type for Prisma interactive transactions
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const logger = createLogger("quotes/markPurchased");

interface MarkPurchasedParams {
  quoteId: string;
  scopeKey: string;
  workspaceId?: string | null;
  vendorRequestId?: string; // 선택된 벤더의 회신 ID (있으면 회신 가격 우선 적용)
}

/**
 * Mark a quote as purchased and create PurchaseRecord entries
 *
 * Race Condition 방지:
 * - Prisma Interactive Transaction 사용 (Serializable Isolation Level)
 * - 멱등성 체크와 생성을 원자적으로 처리
 */
export async function markQuoteAsPurchased({ quoteId, scopeKey, workspaceId, vendorRequestId }: MarkPurchasedParams) {
  logger.info(`Marking quote ${quoteId} as purchased for scopeKey: ${scopeKey}`);

  // Prisma Interactive Transaction으로 Race Condition 방지
  return await db.$transaction(
    async (tx: TransactionClient) => {
      // Check idempotency: prevent duplicate purchase creation (트랜잭션 내에서 체크)
      const existingPurchases = await tx.purchaseRecord.findFirst({
        where: { quoteId },
      });

      if (existingPurchases) {
        logger.warn(`Purchases already exist for quote ${quoteId}, skipping creation`);
        return { alreadyPurchased: true, count: 0 };
      }

      // Fetch quote with items (트랜잭션 내에서 조회)
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!quote || quote.items.length === 0) {
        throw new Error("Quote not found or has no items");
      }

      // 벤더 회신 가격 맵 구성 (quoteItemId → unitPrice)
      const vendorReplyPriceMap = new Map<string, number>();
      if (vendorRequestId) {
        const replyItems = await tx.quoteVendorResponseItem.findMany({
          where: { vendorRequestId },
        });
        for (const ri of replyItems) {
          vendorReplyPriceMap.set(ri.quoteItemId, Math.round((ri.unitPrice as any) || 0));
        }
        logger.info(`Loaded ${replyItems.length} vendor reply prices for vendorRequestId: ${vendorRequestId}`);
      }

      // Build purchase records from QuoteListItem snapshots
      const purchaseData = await Promise.all(
        quote.items.map(async (item: any) => {
          // Get vendor info from product (트랜잭션 내에서 조회)
          const productVendor = await tx.productVendor.findFirst({
            where: { productId: item.productId },
            include: { vendor: true },
          });

          // 가격 우선순위: 벤더 회신 > QuoteListItem.unitPrice > ProductVendor.priceInKRW
          const unitPrice = vendorReplyPriceMap.has(item.id)
            ? vendorReplyPriceMap.get(item.id)!
            : item.unitPrice
            ? Math.round(item.unitPrice)
            : productVendor?.priceInKRW
            ? Math.round(productVendor.priceInKRW)
            : null;
          const qty = item.quantity;
          const amount = item.lineTotal
            ? Math.round(item.lineTotal)
            : unitPrice
            ? unitPrice * qty
            : 0;

          return {
            scopeKey,
            workspaceId: workspaceId ?? null,
            quoteId,
            purchasedAt: new Date(),
            vendorName: productVendor?.vendor?.name || "Unknown Vendor",
            category: item.product?.category || null,
            itemName: item.product?.name || item.name || "Unknown Item",
            catalogNumber: item.product?.catalogNumber || item.catalogNumber || null,
            unit: item.unit || "ea",
            qty,
            unitPrice,
            amount,
            currency: item.currency || "KRW",
            source: "quote",
          };
        })
      );

      // Bulk create purchase records (트랜잭션 내에서 생성)
      const result = await tx.purchaseRecord.createMany({
        data: purchaseData,
        skipDuplicates: true,
      });

      logger.info(`Created ${result.count} purchase records for quote ${quoteId}`);

      // §order-entry-rewire P2 — confirm 봉합. 이 quote 의 주문에 활성 발주 예약이
      // 있으면 ORDER_CONFIRMED 로 소멸시킨다: 지출은 방금 만든 PurchaseRecord 가
      // 들므로 예약을 남겨두면 같은 금액이 두 번 빠진다 (이중 계상 창 — 계약:
      // __tests__/budget/order-confirm-wiring.test.ts). 예약 없는 quote(주문 무관
      // 구매 처리)는 no-op — confirm 창작 금지. budgetEventKey unique 가 중복
      // confirm 을 막는다 (P2002 → 이미 확정됨 · 멱등 무시).
      const quoteOrders = await tx.order.findMany({
        where: { quoteId },
        select: { id: true },
      });
      if (quoteOrders.length > 0) {
        const orderIds = quoteOrders.map((o: { id: string }) => o.id);
        const orderEvents = await tx.budgetEvent.findMany({
          where: {
            sourceEntityId: { in: orderIds },
            budgetId: { not: null },
            eventType: { in: [ORDER_RESERVED, ORDER_RELEASED, ORDER_CONFIRMED] },
          },
        });
        // pre/postCommitted 는 **예산 전역** 활성 예약 축이다 (release 경로와 동형).
        // 주문 단위로 적으면 같은 예산에 활성 주문 2건 이상일 때 감사 열이 거짓이 된다
        // (로컬 세션 게이트 정정 2026-08-22 — ⑪ P4 의 2축 검증이 이 열에 기댄다).
        // 예산 전역 원장을 한 번 읽고, 루프에서 만든 confirm 을 메모리 원장에 이어
        // 붙여 다음 주문의 pre 가 앞선 confirm 을 본다.
        const budgetIds = [...new Set(
          orderEvents
            .filter((e: any) => e.eventType === ORDER_RESERVED && e.budgetId)
            .map((e: any) => e.budgetId as string),
        )];
        const ledger = budgetIds.length > 0
          ? await tx.budgetEvent.findMany({
              where: {
                budgetId: { in: budgetIds },
                eventType: { in: [ORDER_RESERVED, ORDER_RELEASED, ORDER_CONFIRMED] },
              },
              select: { eventType: true, amount: true, sourceEntityId: true, budgetId: true },
            })
          : [];
        for (const orderId of orderIds) {
          const mine = ledger.filter((e: any) => e.sourceEntityId === orderId);
          const active = activeReservedAmount(mine);
          if (active <= 0) continue;
          const reserve = orderEvents.find(
            (e: any) => e.sourceEntityId === orderId && e.eventType === ORDER_RESERVED,
          );
          if (!reserve?.budgetId) continue;
          const budgetLedger = ledger.filter((e: any) => e.budgetId === reserve.budgetId);
          const preActive = activeReservedAmount(budgetLedger);
          const confirmEvent = buildConfirmEvent({
            budget: { id: reserve.budgetId, organizationId: reserve.organizationId, amount: 0 },
            orderId,
            amount: active,
            sequence: 1,
          });
          try {
            await tx.budgetEvent.create({
              data: {
                organizationId: reserve.organizationId,
                budgetEventKey: confirmEvent.budgetEventKey,
                eventType: confirmEvent.eventType,
                sourceEntityType: confirmEvent.sourceEntityType,
                sourceEntityId: orderId,
                budgetId: reserve.budgetId,
                yearMonth: reserve.yearMonth,
                amount: active,
                preCommitted: preActive,
                postCommitted: Math.max(0, preActive - active),
                executedBy: "system:markPurchased",
              },
            });
            ledger.push({
              eventType: ORDER_CONFIRMED,
              amount: active,
              sourceEntityId: orderId,
              budgetId: reserve.budgetId,
            } as any);
            logger.info(`Order reservation confirmed for ${orderId} (${active})`);
          } catch (err: unknown) {
            if ((err as { code?: string })?.code !== "P2002") throw err;
          }
        }
      }

      return { alreadyPurchased: false, count: result.count, purchaseData };
    },
    {
      // Serializable isolation level로 Race Condition 완전 방지
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      // §order-entry-rewire P2 — 5s→20s: 함수 리전(iad1)↔DB(도쿄) 왕복 지연 ×
      // 트랜잭션 내 쿼리 수. /api/orders 가 같은 이유로 P2028 500 (2026-08-22 실측).
      // confirm 조회 2건이 추가돼 같은 형태의 재발을 선제 차단한다.
      timeout: 20000,
    }
  );
}

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

const logger = createLogger("quotes/markPurchased");

interface MarkPurchasedParams {
  quoteId: string;
  scopeKey: string;
}

/**
 * Mark a quote as purchased and create PurchaseRecord entries
 *
 * Race Condition 방지:
 * - Prisma Interactive Transaction 사용 (Serializable Isolation Level)
 * - 멱등성 체크와 생성을 원자적으로 처리
 */
export async function markQuoteAsPurchased({ quoteId, scopeKey }: MarkPurchasedParams) {
  logger.info(`Marking quote ${quoteId} as purchased for scopeKey: ${scopeKey}`);

  // Prisma Interactive Transaction으로 Race Condition 방지
  return await db.$transaction(
    async (tx) => {
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

      // Build purchase records from QuoteListItem snapshots
      const purchaseData = await Promise.all(
        quote.items.map(async (item: any) => {
          // Get vendor info from product (트랜잭션 내에서 조회)
          const productVendor = await tx.productVendor.findFirst({
            where: { productId: item.productId },
            include: { vendor: true },
          });

          const unitPrice = item.unitPrice
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
            quoteId,
            purchasedAt: new Date(),
            vendorName: productVendor?.vendor?.name || "Unknown Vendor",
            category: item.product?.category || null,
            itemName: item.product?.name || "Unknown Item",
            catalogNumber: item.product?.catalogNumber || null,
            unit: "ea",
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

      return { alreadyPurchased: false, count: result.count, purchaseData };
    },
    {
      // Serializable isolation level로 Race Condition 완전 방지
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      // 트랜잭션 타임아웃 설정 (5초)
      timeout: 5000,
    }
  );
}

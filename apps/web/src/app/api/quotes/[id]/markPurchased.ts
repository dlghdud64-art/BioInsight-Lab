import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("quotes/markPurchased");

interface MarkPurchasedParams {
  quoteId: string;
  scopeKey: string;
}

export async function markQuoteAsPurchased({ quoteId, scopeKey }: MarkPurchasedParams) {
  logger.info(`Marking quote ${quoteId} as purchased for scopeKey: ${scopeKey}`);

  // Check idempotency: prevent duplicate purchase creation
  const existingPurchases = await db.purchaseRecord.findFirst({
    where: { quoteId },
  });

  if (existingPurchases) {
    logger.warn(`Purchases already exist for quote ${quoteId}, skipping creation`);
    return { alreadyPurchased: true, count: 0 };
  }

  // Fetch quote with items
  const quote = await db.quote.findUnique({
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
      // Get vendor info from product
      const productVendor = await db.productVendor.findFirst({
        where: { productId: item.productId },
        include: { vendor: true },
      });

      const unitPrice = item.unitPrice ? Math.round(item.unitPrice) :
                      (productVendor?.priceInKRW ? Math.round(productVendor.priceInKRW) : null);
      const qty = item.quantity;
      const amount = item.lineTotal ? Math.round(item.lineTotal) :
                   (unitPrice ? unitPrice * qty : 0);

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

  // Bulk create purchase records
  const result = await db.purchaseRecord.createMany({
    data: purchaseData,
    skipDuplicates: true,
  });

  logger.info(`Created ${result.count} purchase records for quote ${quoteId}`);

  return { alreadyPurchased: false, count: result.count, purchaseData };
}

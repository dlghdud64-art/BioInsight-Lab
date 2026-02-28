import { db } from "@/lib/db";
import { translateText } from "@/lib/ai/openai";
import { cache } from "@/lib/cache";

export interface CreateQuoteParams {
  userId: string | null; // nullable for guest users
  guestKey?: string | null; // guest key for non-logged-in users
  organizationId?: string;
  title: string;
  message?: string;
  deliveryDate?: Date;
  deliveryLocation?: string;
  specialNotes?: string;
  productIds: string[];
  quantities?: Record<string, number>;
  notes?: Record<string, string>;
  vendorIds?: Record<string, string>; // productId -> vendorId 매핑
  /**
   * Draft/quote builder items (from /test/quote)
   * - productId may not exist in DB (e.g. "p1"); in that case we store a snapshot row with productId=null
   * - these fields map to QuoteListItem columns (name/vendor/brand/unitPrice/lineTotal/notes/lineNumber)
   */
  itemsDetailed?: Array<{
    productId?: string | null;
    productName?: string;
    vendorName?: string;
    brand?: string;
    catalogNumber?: string;
    lineNumber?: number;
    quantity?: number;
    unitPrice?: number;
    currency?: string;
    lineTotal?: number;
    notes?: string;
  }>;
}

export async function createQuote(params: CreateQuoteParams) {
  const {
    userId,
    guestKey,
    organizationId,
    title,
    message,
    deliveryDate,
    deliveryLocation,
    specialNotes,
    productIds,
    quantities = {},
    notes = {},
    vendorIds = {},
    itemsDetailed,
  } = params;

  // 메시지 번역 (영문 요청서 생성)
  let messageEn: string | undefined;
  if (message) {
    try {
      messageEn = await translateText(message, "ko", "en");
    } catch (error) {
      console.error("Failed to translate message:", error);
    }
  }

  // Draft builder path: store items even when productId doesn't exist in DB (snapshot rows)
  if (itemsDetailed && itemsDetailed.length > 0) {
    const requestedIds = Array.from(
      new Set(itemsDetailed.map((i) => i.productId).filter((v): v is string => !!v))
    );
    const existingProducts =
      requestedIds.length > 0
        ? await db.product.findMany({
            where: { id: { in: requestedIds } },
            include: {
              vendors: {
                include: {
                  vendor: true,
                },
              },
            },
          })
        : [];
    const existingIdSet = new Set(existingProducts.map((p: any) => p.id));

    const quote = await db.quote.create({
      data: {
        userId: userId || undefined,
        guestKey: guestKey || undefined,
        organizationId,
        title,
        description: message, // message를 description으로 사용
        items: {
          create: itemsDetailed.map((item, idx) => {
            const quantity = item.quantity ?? 1;
            const unitPrice = item.unitPrice ?? 0;
            const lineTotal = item.lineTotal ?? unitPrice * quantity;
            
            // productSnapshot 생성 (서버에서 계산, 클라 값 신뢰하지 않음)
            const snapshot = {
              productName: item.productName ?? null,
              vendorName: item.vendorName ?? null,
              brand: item.brand ?? null,
              catalogNumber: item.catalogNumber ?? null,
              quantity,
              unitPrice,
              currency: item.currency ?? "KRW",
              lineTotal,
              notes: item.notes ?? null,
              timestamp: new Date().toISOString(),
            };
            
            return {
              productId: item.productId && existingIdSet.has(item.productId) ? item.productId : null,
              name: item.productName ?? null,
              // NOTE: QuoteListItem 스키마에 vendor 컬럼 없음 → raw(snapshot)에 포함
              brand: item.brand ?? null,
              lineNumber: item.lineNumber ?? idx + 1,
              quantity,
              unitPrice,
              currency: item.currency ?? "KRW",
              lineTotal,
              notes: item.notes ?? null,
              raw: snapshot, // 스키마 컬럼명: raw (snapshot → raw)
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
                  include: {
                    vendor: true,
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: {
            lineNumber: "asc",
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return quote;
  }

  // Normal path: requires products to exist
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: {
      vendors: {
        include: {
          vendor: true,
        },
      },
    },
  });

  const validProductIds = products.map((p: any) => p.id);
  const filteredProductIds = productIds.filter((id) => validProductIds.includes(id));

  if (filteredProductIds.length === 0) {
    throw new Error("No valid products found. Please add products from the search.");
  }

  // 품목 리스트 생성 - Quote 먼저 생성
  const quote = await db.quote.create({
    data: {
      userId: userId || undefined,
      guestKey: guestKey || undefined,
      organizationId,
      title,
      description: message, // message를 description으로 사용
    },
  });

  // 그 다음 QuoteListItem 생성 (snapshot 포함하기 위해 개별 create)
  for (let index = 0; index < filteredProductIds.length; index++) {
    const productId = filteredProductIds[index];
    const product = products.find((p: any) => p.id === productId);
    const selectedVendorId = vendorIds[productId];
    const vendor = selectedVendorId
      ? product?.vendors?.find((v: any) => v.vendor?.id === selectedVendorId)
      : product?.vendors?.sort((a: any, b: any) => (a.priceInKRW || 0) - (b.priceInKRW || 0))[0];
    const quantity = quantities[productId] || 1;
    const unitPrice = vendor?.priceInKRW || 0;
    const lineTotal = unitPrice * quantity;

    // productSnapshot 생성 (서버에서 계산, 클라 값 신뢰하지 않음)
    const snapshot = {
      productName: product?.name || null,
      vendorName: vendor?.vendor?.name || null,
      brand: product?.brand || null,
      catalogNumber: product?.catalogNumber || null,
      quantity,
      unitPrice,
      currency: vendor?.currency || "KRW",
      lineTotal,
      notes: notes[productId] || null,
      timestamp: new Date().toISOString(),
    };

    await db.quoteListItem.create({
      data: {
        quoteId: quote.id,
        productId,
        name: product?.name || null,
        // NOTE: QuoteListItem 스키마에 vendor 컬럼 없음 → raw(snapshot)에 포함
        brand: product?.brand || null,
        catalogNumber: product?.catalogNumber || null,
        lineNumber: index + 1,
        quantity,
        unitPrice,
        currency: vendor?.currency || "KRW",
        lineTotal,
        notes: notes[productId] || null,
        raw: snapshot, // 스키마 컬럼명: raw (snapshot → raw)
      },
    });
  }

  // Quote를 다시 조회하여 items 포함
  const quoteWithItems = await db.quote.findUnique({
    where: { id: quote.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                include: {
                  vendor: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: {
          lineNumber: "asc",
        },
      },
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return quoteWithItems || quote;
}

// 견적 ID로 조회
export async function getQuoteById(id: string) {
  return await db.quote.findUnique({
    where: { id },
    include: {
      items: {
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
        orderBy: {
          lineNumber: "asc",
        },
      },
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      organization: true,
      responses: {
        include: {
          vendor: true,
        },
      },
    },
  });
}
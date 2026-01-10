import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { handleApiError, validateJsonBody } from "@/lib/api/utils";
import { logger } from "@/lib/api/logger";

// 입력 스키마
const QuoteItemInputSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "제품명은 필수입니다"),
  vendor: z.string().optional(),
  brand: z.string().optional(),
  catalogNumber: z.string().optional(),
  unitPrice: z.number().int().nonnegative().optional(),
  quantity: z.number().int().positive().default(1),
  lineTotal: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  snapshot: z.record(z.unknown()).optional(),
});

const CreateQuoteListSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  items: z.array(QuoteItemInputSchema).default([]),
});

/**
 * POST /api/quote-lists
 * 견적요청서 리스트 생성
 */
export async function POST(request: NextRequest) {
  try {
    // guestKey 확보
    const guestKey = await getOrCreateGuestKey();

    // JSON body 검증
    const validation = await validateJsonBody(request, CreateQuoteListSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { title, message, items = [] } = validation.data;

    // QuoteList 생성 + items createMany
    const quoteList = await db.quoteList.create({
      data: {
        guestKey,
        title: title || null,
        message: message || null,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId || null,
            name: item.name,
            vendor: item.vendor || null,
            brand: item.brand || null,
            catalogNumber: item.catalogNumber || null,
            unitPrice: item.unitPrice || null,
            quantity: item.quantity,
            lineTotal: item.lineTotal || null,
            notes: item.notes || null,
            snapshot: item.snapshot || null,
          })),
        },
        totalAmount: items.reduce((sum: number, item) => sum + (item.lineTotal || 0), 0) || null,
      },
      include: {
        items: true,
      },
    });

    logger.info("quote_list_created", {
      quoteListId: quoteList.id,
      guestKey,
      itemCount: items.length,
    });

    return NextResponse.json({ id: quoteList.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/quote-lists");
  }
}

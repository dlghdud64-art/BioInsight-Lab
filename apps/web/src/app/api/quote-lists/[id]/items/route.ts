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

const UpdateItemsSchema = z.object({
  items: z.array(QuoteItemInputSchema),
});

/**
 * PUT /api/quote-lists/[id]/items
 * 견적요청서 리스트의 items를 통째로 replace
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guestKey = await getOrCreateGuestKey();

    // JSON body 검증
    const validation = await validateJsonBody(request, UpdateItemsSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { items } = validation.data;

    // 권한 확인
    const existing = await db.quoteList.findFirst({
      where: {
        id,
        OR: [
          { guestKey },
          // TODO: userId는 추후 로그인 연결 시 추가
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 기존 items deleteMany 후 새로 createMany
    await db.quoteListItem.deleteMany({
      where: { quoteListId: id },
    });

    const createdItems = await db.quoteListItem.createMany({
      data: items.map((item) => ({
        quoteListId: id,
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
    });

    // totalAmount 업데이트
    const totalAmount = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    await db.quoteList.update({
      where: { id },
      data: { totalAmount: totalAmount || null },
    });

    logger.info("quote_list_items_updated", {
      quoteListId: id,
      guestKey,
      itemCount: items.length,
    });

    return NextResponse.json({
      success: true,
      itemCount: createdItems.count,
    });
  } catch (error) {
    return handleApiError(error, "PUT /api/quote-lists/[id]/items");
  }
}

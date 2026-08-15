import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db, dbTyped } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { handleApiError, validateJsonBody } from "@/lib/api/utils";
import { logger } from "@/lib/api/logger";
import { auth } from "@/auth";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_update',
      targetEntityType: 'quote',
      targetEntityId: id,
      sourceSurface: 'quote-lists-items-api',
      routePath: '/api/quote-lists/[id]/items',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const guestKey = await getOrCreateGuestKey();

    // JSON body 검증
    const validation = await validateJsonBody(request, UpdateItemsSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { items } = validation.data;

    // 권한 확인
    const existing = await dbTyped.quote.findFirst({
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

    // §unvalidated-create 계열 — replace 3단계를 단일 트랜잭션으로 묶는다.
    //   이전에는 deleteMany 가 **먼저 커밋**되고 createMany 가 실패하면
    //   기존 항목이 지워진 채 500 이 나갔다(비트랜잭션 손실 경로).
    //   지금까지 실손실이 0이었던 건 이 경로가 드리프트로 상시 500 이라
    //   사용자가 도달하지 못했기 때문이고, 드리프트 수정이 이 위험을 **활성화**한다.
    //   그래서 치환보다 **먼저** 닫는다 — 순서를 지키면 위험한 창이 생기지 않는다.
    const totalAmount = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

    const createdItems = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.quoteListItem.deleteMany({
        where: { quoteId: id },
      });

      const created = await tx.quoteListItem.createMany({
        data: items.map((item: any) => ({
          quoteId: id,
          productId: item.productId || null,
          name: item.name,
          // §D1c — 입력 계약(zod)의 `vendor`/`snapshot` 은 유지하고 **Prisma 매핑만** 고친다.
          //   QuoteListItem 의 실필드는 `vendorName` · `raw` 다.
          vendorName: item.vendor || null,
          brand: item.brand || null,
          catalogNumber: item.catalogNumber || null,
          unitPrice: item.unitPrice || null,
          quantity: item.quantity,
          lineTotal: item.lineTotal || null,
          notes: item.notes || null,
          raw: item.snapshot || null,
        })),
      });

      await tx.quote.update({
        where: { id },
        data: { totalAmount: totalAmount || null },
      });

      return created;
    });

    logger.info("quote_list_items_updated", {
      quoteId: id,
      guestKey,
      itemCount: items.length,
    });

    enforcement.complete({});

    return NextResponse.json({
      success: true,
      itemCount: createdItems.count,
    });
  } catch (error) {
    enforcement?.fail();
    return handleApiError(error, "PUT /api/quote-lists/[id]/items");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_update',
      targetEntityType: 'quote',
      targetEntityId: 'new',
      sourceSurface: 'quote-lists-api',
      routePath: '/api/quote-lists',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // guestKey 확보
    const guestKey = await getOrCreateGuestKey();

    // JSON body 검증
    const validation = await validateJsonBody(request, CreateQuoteListSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { title, message, items = [] } = validation.data;

    // QuoteList 생성 + items createMany
    const quoteList = await dbTyped.quote.create({
      data: {
        guestKey,
        // §phantom-model-call 이름 교정 — Quote.title 은 **required** 다.
        //   기존 `title || null` 은 any 라 통과했을 뿐 런타임에서 실패했을 값이다.
        title: title || "제목 없음",
        // §text-coupling-debt — 프론트는 `message`, 스키마는 `description`.
        //   응답 형태 유지를 위해 **서버에서 흡수**한다(프론트 불변).
        description: message || null,
        items: {
          // ⚠️ `.map()` 결과는 **excess property check 가 적용되지 않는다**.
          //   타입 있는 client 로 바꿔도 여기 잘못된 필드는 컴파일러가 못 잡는다
          //   (실측: title 만 잡히고 vendor/snapshot 은 통과했다). 수동 대조 필요.
          create: items.map((item: any) => ({
            productId: item.productId || null,
            name: item.name,
            brand: item.brand || null,
            catalogNumber: item.catalogNumber || null,
            unitPrice: item.unitPrice || null,
            quantity: item.quantity,
            lineTotal: item.lineTotal || null,
            notes: item.notes || null,
            // §text-coupling-debt — 프론트 `snapshot` ↔ 스키마 `raw`.
            // ⚠️ 항목별 `vendor` 는 QuoteListItem 에 **컬럼이 없다**(스키마 부족).
            //   견적 단위 `Quote.vendor` 로 복제하지 않는다 — 화면이 거짓을 말하게 된다.
            //   유실을 막기 위해 스냅샷 blob 안에만 보존한다. 표시 경로는 미배선.
            //   → §quote-item-vendor-column 상신.
            raw: {
              ...(typeof item.snapshot === "object" && item.snapshot !== null ? item.snapshot : {}),
              ...(item.vendor ? { vendorName: item.vendor } : {}),
            },
          })),
        },
        totalAmount: items.reduce((sum, item) => sum + (item.lineTotal || 0), 0) || null,
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

    enforcement.complete({});

    return NextResponse.json({ id: quoteList.id }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    return handleApiError(error, "POST /api/quote-lists");
  }
}

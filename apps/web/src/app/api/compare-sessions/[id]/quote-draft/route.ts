/**
 * POST /api/compare-sessions/[id]/quote-draft — 비교 결과에서 견적 초안 생성
 *
 * compare session의 제품 맥락을 사용하여 Quote를 생성하고
 * comparisonId로 비교 세션과 연결한다.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, message, selectedProductIds } = body;

    const compareSession = await db.compareSession.findUnique({
      where: { id },
    });

    if (!compareSession) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 비교 대상 제품 중 선택된 것만 사용 (없으면 전체)
    const productIds = selectedProductIds?.length
      ? selectedProductIds
      : (compareSession.productIds as string[]);

    // 제품 정보 조회
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      include: {
        vendors: {
          include: { vendor: true },
          orderBy: { priceInKRW: "asc" },
          take: 1,
        },
      },
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: "유효한 제품이 없습니다." },
        { status: 400 }
      );
    }

    // diff summary에서 verdict 추출
    const diffResults = compareSession.diffResult as any[];
    const verdict = diffResults?.[0]?.summary?.overallVerdict ?? "UNKNOWN";

    // Quote 생성 (comparisonId로 비교 세션 연결)
    const quote = await db.quote.create({
      data: {
        userId,
        organizationId: compareSession.organizationId,
        comparisonId: id,
        title: title || `비교 분석 기반 견적 — ${products.map((p: { name: string }) => p.name).join(", ")}`,
        description: message || `비교 판정: ${verdict}. 비교 세션 ${id}에서 생성됨.`,
        status: "PENDING",
        items: {
          create: products.map((product: any, idx: number) => {
            const vendor = product.vendors[0];
            return {
              productId: product.id,
              lineNumber: idx + 1,
              name: product.name,
              brand: product.brand,
              catalogNumber: product.catalogNumber,
              quantity: 1,
              unitPrice: vendor?.priceInKRW ?? null,
              currency: vendor?.currency ?? "KRW",
              lineTotal: vendor?.priceInKRW ?? null,
              raw: {
                productName: product.name,
                vendorName: vendor?.vendor?.name ?? null,
                compareSessionId: id,
                compareVerdict: verdict,
                timestamp: new Date().toISOString(),
              },
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });

    // Activity log: Quote 생성
    await createActivityLog({
      activityType: "QUOTE_CREATED",
      entityType: "QUOTE",
      entityId: quote.id,
      taskType: "QUOTE_FROM_COMPARE",
      userId,
      organizationId: compareSession.organizationId,
      metadata: {
        compareSessionId: id,
        compareVerdict: verdict,
        productCount: products.length,
      },
    });

    // Activity log: 비교 세션에서 견적 초안 시작
    await createActivityLog({
      activityType: "QUOTE_DRAFT_STARTED_FROM_COMPARE",
      entityType: "COMPARE_SESSION",
      entityId: id,
      userId,
      organizationId: compareSession.organizationId,
      metadata: {
        quoteId: quote.id,
        productCount: products.length,
      },
    });

    return NextResponse.json({
      quote: {
        id: quote.id,
        title: quote.title,
        itemCount: quote.items.length,
        comparisonId: quote.comparisonId,
      },
    });
  } catch (error) {
    return handleApiError(error, "POST /api/compare-sessions/[id]/quote-draft");
  }
}

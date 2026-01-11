import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { searchProducts } from "@/lib/api/products";

// Protocol → BOM 생성 API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      reagents,
      organizationId,
      experimentRounds = 1,
    }: {
      title: string;
      reagents: Array<{
        name: string;
        quantity?: string;
        unit?: string;
        estimatedUsage?: number;
        category?: "REAGENT" | "TOOL" | "EQUIPMENT";
        description?: string;
      }>;
      organizationId?: string;
      experimentRounds?: number;
    } = body;

    if (!title || !reagents || reagents.length === 0) {
      return NextResponse.json(
        { error: "제목과 시약 리스트가 필요합니다." },
        { status: 400 }
      );
    }

    // 각 시약에 대해 제품 검색 시도 (자동 매칭)
    const bomItems: Array<{
      reagentName: string;
      productId?: string;
      quantity: number;
      unit?: string;
      notes?: string;
      category?: string;
    }> = [];

    for (const reagent of reagents) {
      // 제품 검색 시도
      let matchedProductId: string | undefined;
      try {
        const searchResults = await searchProducts({
          query: reagent.name,
          category: reagent.category,
          limit: 1,
        });

        // 타입 에러 수정: searchResults가 products 속성을 가지는지 확인
        if ((searchResults as any).products && (searchResults as any).products.length > 0) {
          // 첫 번째 결과를 자동 매칭
          matchedProductId = (searchResults as any).products[0].id;
        }
      } catch (error) {
        console.error(`Failed to search product for ${reagent.name}:`, error);
        // 검색 실패해도 계속 진행
      }

      // 수량 계산
      const baseQuantity = reagent.estimatedUsage || parseFloat(reagent.quantity || "1") || 1;
      const totalQuantity = Math.ceil(baseQuantity * experimentRounds);

      bomItems.push({
        reagentName: reagent.name,
        productId: matchedProductId,
        quantity: totalQuantity,
        unit: reagent.unit,
        notes: reagent.description || `프로토콜에서 추출: ${reagent.name}`,
        category: reagent.category,
      });
    }

    // 매칭된 제품들의 가격 정보 조회
    const matchedProductIds = bomItems
      .filter((item) => item.productId)
      .map((item: any) => item.productId!);

    const products = await db.product.findMany({
      where: { id: { in: matchedProductIds } },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
          orderBy: {
            priceInKRW: "asc",
          },
          take: 1, // 가장 저렴한 벤더 선택
        },
      },
    });

    // 타입 에러 수정: p 파라미터에 타입 명시
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // QuoteList 생성
    const quote = await db.quote.create({
      data: {
        userId: session.user.id,
        organizationId,
        title,
        description: `프로토콜에서 자동 생성된 BOM (${reagents.length}개 항목, ${experimentRounds}회 실험 기준)`,
        items: {
          create: bomItems
            .filter((item) => item.productId) // 제품이 매칭된 항목만 추가
            .map((item: any, index: number) => {
              // 타입 에러 수정: productMap.get()의 반환 타입이 제대로 추론되지 않아 타입 캐스팅 추가
              const product = productMap.get(item.productId!) as any;
              const vendor = product?.vendors?.[0];
              const unitPrice = vendor?.priceInKRW || 0;
              const lineTotal = unitPrice * item.quantity;

              return {
                productId: item.productId!,
                lineNumber: index + 1,
                quantity: item.quantity,
                unitPrice,
                currency: vendor?.currency || "KRW",
                lineTotal,
                notes: item.notes || null,
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
        },
      },
    });

    // 매칭되지 않은 항목들도 반환
    const unmatchedItems = bomItems.filter((item) => !item.productId);

    return NextResponse.json({
      quote,
      unmatchedItems,
      message: `BOM이 생성되었습니다. ${bomItems.filter((i) => i.productId).length}개 항목이 자동 매칭되었고, ${unmatchedItems.length}개 항목은 수동으로 추가해주세요.`,
    });
  } catch (error: any) {
    console.error("Error creating BOM:", error);
    return NextResponse.json(
      { error: error.message || "BOM 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
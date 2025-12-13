import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzePurchasePatterns, analyzeQuotePatterns, getFrequentlyBoughtTogether } from "@/lib/ai/purchase-pattern-analyzer";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

// 구매 패턴 분석 API
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get("type") || "both"; // "purchase", "quote", "both"
    const productId = searchParams.get("productId"); // 특정 제품과 함께 구매되는 제품 조회
    const organizationId = searchParams.get("organizationId");
    const limit = parseInt(searchParams.get("limit") || "20");

    // 조직 ID 결정 (세션의 조직 또는 파라미터)
    let finalOrganizationId = organizationId || session?.user?.organizationId || undefined;

    // 특정 제품과 함께 구매되는 제품 조회
    if (productId) {
      const recommendations = await getFrequentlyBoughtTogether(productId, {
        organizationId: finalOrganizationId,
        limit,
      });

      // 제품 정보 포함
      const products = await db.product.findMany({
        where: {
          id: { in: recommendations.map((r) => r.productId) },
        },
        include: {
          vendors: {
            include: {
              vendor: true,
            },
            take: 1,
          },
        },
      });

      const recommendationsWithProducts = recommendations.map((rec) => {
        const product = products.find((p) => p.id === rec.productId);
        return {
          ...rec,
          product,
        };
      });

      return NextResponse.json({
        recommendations: recommendationsWithProducts,
        type: "frequently_bought_together",
      });
    }

    // 전체 패턴 분석
    let patterns: any[] = [];

    if (type === "purchase" || type === "both") {
      const purchasePatterns = await analyzePurchasePatterns({
        organizationId: finalOrganizationId,
        limit,
      });
      patterns = patterns.concat(
        purchasePatterns.map((p) => ({ ...p, source: "purchase" }))
      );
    }

    if (type === "quote" || type === "both") {
      const quotePatterns = await analyzeQuotePatterns({
        organizationId: finalOrganizationId,
        userId: session?.user?.id,
        limit,
      });
      patterns = patterns.concat(
        quotePatterns.map((p) => ({ ...p, source: "quote" }))
      );
    }

    // 제품 정보 포함
    const allProductIds = Array.from(
      new Set(patterns.flatMap((p) => p.productIds))
    );

    const products = await db.product.findMany({
      where: {
        id: { in: allProductIds },
      },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
          take: 1,
        },
      },
    });

    const patternsWithProducts = patterns.map((pattern) => ({
      ...pattern,
      products: pattern.productIds
        .map((id: string) => products.find((p) => p.id === id))
        .filter(Boolean),
    }));

    return NextResponse.json({
      patterns: patternsWithProducts,
      type,
    });
  } catch (error) {
    console.error("Error analyzing purchase patterns:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        patterns: [],
        recommendations: [],
        demo: true,
      });
    }
    
    return NextResponse.json(
      { error: "Failed to analyze purchase patterns" },
      { status: 500 }
    );
  }
}




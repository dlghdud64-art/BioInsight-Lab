import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 추천 성과 추적 API
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { recommendationId, productId, action, metadata } = body;

    if (!recommendationId || !productId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 행동 타입: 'view', 'click', 'compare_add', 'quote_add', 'feedback'
    // 추천 관련 행동 추적
    
    // 추천 피드백은 별도 API로 처리 (POST /api/recommendations/feedback)
    if (action === "feedback") {
      // 피드백은 별도 엔드포인트로 리다이렉트
      return NextResponse.json(
        { error: "Use /api/recommendations/feedback for feedback" },
        { status: 400 }
      );
    }

    // 추천 관련 행동 로깅 (향후 RecommendationMetric 모델로 확장 가능)
    // 현재는 검색 기록에 통합하여 추적
    if (action === "click" && session?.user?.id) {
      // 검색 기록에 클릭 정보 저장
      await db.searchHistory.create({
        data: {
          userId: session.user.id,
          query: `recommendation:${recommendationId}`,
          clickedProductId: productId,
          metadata: {
            recommendationId,
            action: "recommendation_click",
            ...metadata,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking recommendation metrics:", error);
    return NextResponse.json(
      { error: "Failed to track recommendation metrics" },
      { status: 500 }
    );
  }
}

// 추천 성과 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    if (!session?.user?.id) {
      return NextResponse.json({ metrics: null });
    }

    // 간단한 메트릭 계산 (향후 더 정교한 분석 가능)
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 사용자의 검색 기록에서 클릭률 계산
    const searchHistory = await db.searchHistory.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
    });

    const totalSearches = searchHistory.length;
    const clickedSearches = searchHistory.filter((s) => s.clickedProductId).length;
    const clickRate = totalSearches > 0 ? (clickedSearches / totalSearches) * 100 : 0;

    // 비교 추가율
    const comparisons = await db.comparison.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
    });

    // 견적 전환율
    const quotes = await db.quote.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate },
      },
    });

    return NextResponse.json({
      metrics: {
        totalSearches,
        clickedSearches,
        clickRate: clickRate.toFixed(2),
        comparisons: comparisons.length,
        quotes: quotes.length,
        conversionRate: totalSearches > 0 
          ? ((quotes.length / totalSearches) * 100).toFixed(2)
          : "0.00",
      },
    });
  } catch (error) {
    console.error("Error fetching recommendation metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendation metrics" },
      { status: 500 }
    );
  }
}


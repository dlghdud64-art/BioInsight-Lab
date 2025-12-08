import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 추천 성과 추적 API - 중복 정의 제거
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

// 추천 성과 조회 - 중복 정의 제거
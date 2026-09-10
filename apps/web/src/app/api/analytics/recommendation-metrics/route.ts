import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 추천 성과 추적 API - 중복 정의 제거
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
      action: 'sensitive_data_export',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (analytics) — 'unknown' 유지.
      //   ⚠️ 불일치: targetEntityType 은 'ai_action' 인데 body 가 다루는 건 productId 와
      //   recommendationId 다. 게다가 recommendationId 는 FK 가 아니라 문자열이다
      //   (query 접두사·metadata JSON 에만 쓰인다) → §audit-taxonomy-review 상신.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/analytics/recommendation-metrics',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const body = await request.json();

    const { recommendationId, productId, action, metadata } = body;

    if (!recommendationId || !productId || !action) {
      enforcement.fail();
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 행동 타입: 'view', 'click', 'compare_add', 'quote_add', 'feedback'
    // 추천 관련 행동 추적
    
    // 추천 피드백은 별도 API로 처리 (POST /api/recommendations/feedback)
    if (action === "feedback") {
      enforcement.fail(); // redirect guidance only - no write
      // 피드백은 별도 엔드포인트로 리다이렉트
      return NextResponse.json(
        { error: "Use /api/recommendations/feedback for feedback" },
        { status: 400 }
      );
    }

    // 추천 관련 행동 로깅 (향후 RecommendationMetric 모델로 확장 가능)
    // 현재는 검색 기록에 통합하여 추적
    // Write is CONDITIONAL (click + session). Unconditional complete() would record a
    // "change completed" audit for calls that wrote nothing -> track it with a flag.
    let recorded = false;
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
      recorded = true;
    }

    if (recorded) {
      enforcement.complete({
        beforeState: { recommendationId, productId, recorded: false },
        afterState: { recommendationId, productId, recorded: true, action },
      });
    } else {
      enforcement.fail(); // no write happened - release lock only
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("Error tracking recommendation metrics:", error);
    return NextResponse.json(
      { error: "Failed to track recommendation metrics" },
      { status: 500 }
    );
  }
}

// 추천 성과 조회 - 중복 정의 제거
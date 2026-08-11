import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ì¶ì² ì±ê³¼ ì¶ì  API - ì¤ë³µ ì ì ì ê±°
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

    // íë íì: 'view', 'click', 'compare_add', 'quote_add', 'feedback'
    // ì¶ì² ê´ë ¨ íë ì¶ì 
    
    // ì¶ì² í¼ëë°±ì ë³ë APIë¡ ì²ë¦¬ (POST /api/recommendations/feedback)
    if (action === "feedback") {
      enforcement.fail(); // redirect guidance only - no write
      // í¼ëë°±ì ë³ë ìëí¬ì¸í¸ë¡ ë¦¬ë¤ì´ë í¸
      return NextResponse.json(
        { error: "Use /api/recommendations/feedback for feedback" },
        { status: 400 }
      );
    }

    // ì¶ì² ê´ë ¨ íë ë¡ê¹ (í¥í RecommendationMetric ëª¨ë¸ë¡ íì¥ ê°ë¥)
    // íì¬ë ê²ì ê¸°ë¡ì íµí©íì¬ ì¶ì 
    // Write is CONDITIONAL (click + session). Unconditional complete() would record a
    // "change completed" audit for calls that wrote nothing -> track it with a flag.
    let recorded = false;
    if (action === "click" && session?.user?.id) {
      // ê²ì ê¸°ë¡ì í´ë¦­ ì ë³´ ì ì¥
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

// ì¶ì² ì±ê³¼ ì¡°í - ì¤ë³µ ì ì ì ê±°
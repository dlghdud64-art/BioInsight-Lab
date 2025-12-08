import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ì¶ì² ì±ê³¼ ì¶ì  API - ì¤ë³µ ì ì ì ê±°
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { recommendationId, productId, action, metadata } = body;

    if (!recommendationId || !productId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // íë íì: 'view', 'click', 'compare_add', 'quote_add', 'feedback'
    // ì¶ì² ê´ë ¨ íë ì¶ì 
    
    // ì¶ì² í¼ëë°±ì ë³ë APIë¡ ì²ë¦¬ (POST /api/recommendations/feedback)
    if (action === "feedback") {
      // í¼ëë°±ì ë³ë ìëí¬ì¸í¸ë¡ ë¦¬ë¤ì´ë í¸
      return NextResponse.json(
        { error: "Use /api/recommendations/feedback for feedback" },
        { status: 400 }
      );
    }

    // ì¶ì² ê´ë ¨ íë ë¡ê¹ (í¥í RecommendationMetric ëª¨ë¸ë¡ íì¥ ê°ë¥)
    // íì¬ë ê²ì ê¸°ë¡ì íµí©íì¬ ì¶ì 
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

// ì¶ì² ì±ê³¼ ì¡°í - ì¤ë³µ ì ì ì ê±°
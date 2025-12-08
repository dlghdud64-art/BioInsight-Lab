import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ì¬ì©ì íë ì¶ì  (í´ë¦­, ë¹êµ ì¶ê°, ê²¬ì  ìì²­ ë±)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { action, productId, metadata } = body;

    if (!action || !productId) {
      return NextResponse.json({ error: "Action and productId are required" }, { status: 400 });
    }

    // íë íì: 'view', 'click', 'compare_add', 'compare_remove', 'quote_add', 'favorite_add'
    // íì¬ë ê²ì ê¸°ë¡ì íµí©íì¬ ì ì¥ (í¥í ë³ë UserBehavior ëª¨ë¸ë¡ íì¥ ê°ë¥)
    
    // í´ë¦­ íëì SearchHistoryì clickedProductIdë¡ ì ì¥
    if (action === "click" && session?.user?.id) {
      // ê°ì¥ ìµê·¼ ê²ì ê¸°ë¡ì í´ë¦­ ì ë³´ ìë°ì´í¸
      const recentSearch = await db.searchHistory.findFirst({
        where: {
          userId: session.user.id,
          query: metadata?.query || "",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentSearch) {
        await db.searchHistory.update({
          where: { id: recentSearch.id },
          data: { clickedProductId: productId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking user behavior:", error);
    return NextResponse.json(
      { error: "Failed to track user behavior" },
      { status: 500 }
    );
  }
}
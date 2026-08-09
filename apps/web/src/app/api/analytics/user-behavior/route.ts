import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ì¬ì©ì íë ì¶ì  (í´ë¦­, ë¹êµ ì¶ê°, ê²¬ì  ìì²­ ë±)
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
      //   ⚠️ 불일치: targetEntityType 은 'ai_action' 인데 body 필수값은 productId 다
      //   → §audit-taxonomy-review 상신.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/analytics/user-behavior',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const body = await request.json();

    const { action, productId, metadata } = body;

    if (!action || !productId) {
      enforcement.fail();
      return NextResponse.json({ error: "Action and productId are required" }, { status: 400 });
    }

    // íë íì: 'view', 'click', 'compare_add', 'compare_remove', 'quote_add', 'favorite_add'
    // íì¬ë ê²ì ê¸°ë¡ì íµí©íì¬ ì ì¥ (í¥í ë³ë UserBehavior ëª¨ë¸ë¡ íì¥ ê°ë¥)
    
    // í´ë¦­ íëì SearchHistoryì clickedProductIdë¡ ì ì¥
    // Write is CONDITIONAL (click + session + a matching recent search exists).
    let recorded = false;
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
        recorded = true;
      }
    }

    if (recorded) {
      enforcement.complete({
        beforeState: { productId, clickedProductId: null },
        afterState: { productId, clickedProductId: productId, action },
      });
    } else {
      enforcement.fail(); // no write happened - release lock only
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("Error tracking user behavior:", error);
    return NextResponse.json(
      { error: "Failed to track user behavior" },
      { status: 500 }
    );
  }
}
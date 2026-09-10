import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 사용자 행동 추적 (클릭, 비교 추가, 견적 요청 등)
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
      routePath: '/api/analytics/user-behavior',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const body = await request.json();

    const { action, productId, metadata } = body;

    if (!action || !productId) {
      enforcement.fail();
      return NextResponse.json({ error: "Action and productId are required" }, { status: 400 });
    }

    // 행동 타입: 'view', 'click', 'compare_add', 'compare_remove', 'quote_add', 'favorite_add'
    // 현재는 검색 기록에 통합하여 저장 (향후 별도 UserBehavior 모델로 확장 가능)
    
    // 클릭 행동은 SearchHistory의 clickedProductId로 저장
    // Write is CONDITIONAL (click + session + a matching recent search exists).
    let recorded = false;
    if (action === "click" && session?.user?.id) {
      // 가장 최근 검색 기록에 클릭 정보 업데이트
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
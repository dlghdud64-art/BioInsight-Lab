import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ê²ì ê¸°ë¡ ì ì¥
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
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/analytics/search-history',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const body = await request.json();

    const { query, intent, category, filters, resultCount, clickedProductId } = body;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const searchHistory = await db.searchHistory.create({
      data: {
        userId: session?.user?.id || null,
        query,
        intent: intent ? JSON.parse(JSON.stringify(intent)) : null,
        category: category || null,
        filters: filters ? JSON.parse(JSON.stringify(filters)) : null,
        resultCount: resultCount || null,
        clickedProductId: clickedProductId || null,
      },
    });

    return NextResponse.json({ success: true, id: searchHistory.id });
  } catch (error) {
    console.error("Error saving search history:", error);
    return NextResponse.json(
      { error: "Failed to save search history" },
      { status: 500 }
    );
  }
}

// ì¬ì©ìë³ ê²ì ê¸°ë¡ ì¡°í
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { analyzeSearchIntent } from "@/lib/ai/openai";

// GPT 기반 검색 의도 분류 API
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
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/search/intent',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const intent = await analyzeSearchIntent(query);

    return NextResponse.json({ intent });
  } catch (error) {
    console.error("Error analyzing search intent:", error);
    return NextResponse.json(
      { error: "Failed to analyze search intent" },
      { status: 500 }
    );
  }
}

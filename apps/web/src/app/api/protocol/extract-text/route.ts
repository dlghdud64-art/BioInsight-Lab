import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { extractReagentsFromText } from "@/lib/ai/text-extractor";

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
      routePath: '/protocol/extract-text',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "텍스트는 50,000자 이하여야 합니다." },
        { status: 400 }
      );
    }

    // 텍스트에서 시약 추출
    const result = await extractReagentsFromText(text);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing protocol text:", error);
    return NextResponse.json(
      { error: error.message || "프로토콜 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}


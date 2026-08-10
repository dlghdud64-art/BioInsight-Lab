import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/ai/openai";

// GPT 기반 번역 API
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
      // §enforcement-handle-close-sweep (기타) — 'unknown' 유지.
      //   텍스트를 번역해 반환할 뿐 대상 엔티티도 DB 쓰기도 없다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/translate',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { text, sourceLang = "en", targetLang = "ko" } = body;

    if (!text || typeof text !== "string") {
      enforcement.fail();
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const translated = await translateText(text, sourceLang, targetLang);

    // 번역 전용: DB 쓰기 0 → audit envelope 없이 lock 만 해제한다.
    enforcement.fail();
    return NextResponse.json({
      original: text,
      translated,
      sourceLang,
      targetLang,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("Error translating text:", error);
    return NextResponse.json(
      { error: "Failed to translate text" },
      { status: 500 }
    );
  }
}

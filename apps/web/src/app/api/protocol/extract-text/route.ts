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
      // §enforcement-handle-close-sweep (protocol) — 'unknown' 유지. 텍스트를 파싱해 반환할 뿐 대상 엔티티가 없다.
      //   ⚠️ targetEntityType 이 'ai_action' 이나 이 라우트는 프로토콜 처리다
      //   → §audit-taxonomy-review 후보.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/protocol/extract-text',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      enforcement.fail();
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

    // Parse-only route: no DB writes. complete() would record a false "change completed".
    enforcement.fail();
    return NextResponse.json(result);
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error processing protocol text:", error);
    return NextResponse.json(
      { error: error.message || "프로토콜 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}


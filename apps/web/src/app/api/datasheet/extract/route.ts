import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { extractProductInfoFromDatasheet } from "@/lib/ai/datasheet-extractor";

// ë°ì´í°ìí¸ íì¤í¸ìì ì í ì ë³´ ì¶ì¶ API
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
      // §enforcement-handle-close-sweep (datasheet) — 'unknown' 유지. 파일/URL 에서
      //   데이터시트 텍스트를 뽑아 반환할 뿐 대상 엔티티가 없다.
      //   ⚠️ targetEntityType 'ai_action' 은 문서 추출과 어긋난다 → §audit-taxonomy-review 후보.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/datasheet/extract',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      enforcement.fail();
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Text cannot be empty" },
        { status: 400 }
      );
    }

    const extractedInfo = await extractProductInfoFromDatasheet(text);

    // Extract-only route: no DB writes.
    enforcement.fail();
    return NextResponse.json({
      success: true,
      data: extractedInfo,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error extracting datasheet info:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract datasheet info" },
      { status: 500 }
    );
  }
}


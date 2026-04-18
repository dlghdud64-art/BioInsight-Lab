import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parseQuoteWithGemini } from "@/lib/ocr/gemini-quote-parser";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/quotes/parse-image
 *
 * 견적서 이미지(jpg/png/webp)를 Gemini 멀티모달로 파싱하여
 * 구조화된 JSON을 반환합니다.
 *
 * Body: { imageBase64: string } (data URI 형식)
 */
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
      action: 'order_create',
      targetEntityType: 'quote',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/quotes/parse-image',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "이미지 데이터가 없습니다." }, { status: 400 });
    }

    // 간이 사이즈 체크 (base64는 원본 대비 ~33% 증가)
    if (imageBase64.length > MAX_FILE_SIZE * 1.4) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다.` },
        { status: 400 }
      );
    }

    const result = await parseQuoteWithGemini(imageBase64);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[parse-image] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "견적서 이미지 파싱에 실패했습니다." },
      { status: 500 }
    );
  }
}

// §11.290 Phase 4a — parseQuoteWithGemini 직접 호출 → runQuoteOcrPipeline
// wrapper swap (호영님 Phase 0 결정 minimum-diff). STORAGE_PROVIDER 미설정
// 시 graceful fallback. Phase 5 SDK install 후 multi-provider fallback 자동 활성.
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { runQuoteOcrPipeline } from "@/lib/ocr/run-quote-ocr-pipeline";

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

    // §11.290 Phase 4c — pipelineResult metadata outer scope retain
    // (jobId / providerUsed / cached). QuoteScannerModal review step 에서
    // ProviderBadge + CacheHitIndicator 표시 위해 ocrMetadata response 노출.
    let ocrMetadata: {
      jobId: string | null;
      providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
      cached: boolean;
    } | null = null;

    const pipelineResult = await runQuoteOcrPipeline({
      kind: "image",
      base64: imageBase64,
      organizationId: session.user.id,
      userId: session.user.id,
    });
    const result = pipelineResult.result;
    ocrMetadata = {
      jobId: pipelineResult.jobId,
      providerUsed: pipelineResult.providerUsed,
      cached: pipelineResult.cached,
    };

    return NextResponse.json({
      success: true,
      ...result,
      // §11.290 Phase 4c — OCR pipeline metadata (provider / cache / jobId).
      ocrMetadata,
    });
  } catch (error: any) {
    console.error("[parse-image] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "견적서 이미지 파싱에 실패했습니다." },
      { status: 500 }
    );
  }
}

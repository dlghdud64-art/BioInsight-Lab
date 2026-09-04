// §11.290 Phase 4a — parseQuotePDFWithGemini 직접 호출 → runQuoteOcrPipeline (완료 이력)
//   sentinel anchor: __tests__/regression/ocr-route-swap-290-p4a.test.ts (`§11\.290` 매칭)
//   🛑 미완료 표시가 아니다. 지우면 그 sentinel 이 RED 가 된다.
// wrapper swap (호영님 Phase 0 결정 minimum-diff). STORAGE_PROVIDER 미설정
// 시 graceful fallback. Phase 5 SDK install 후 multi-provider fallback 자동 활성.
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
// §scan-org-identity B-1 — 스캔 기록의 조직은 세션에서 해석한다(user 식별자 대입 금지).
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";
import { NextRequest, NextResponse } from "next/server";
import { runQuoteOcrPipeline } from "@/lib/ocr/run-quote-ocr-pipeline";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/quotes/parse-pdf
 *
 * 견적서 PDF를 Gemini 2.5 Flash에 직접 전송하여 구조화된 JSON으로 파싱.
 * 기존 OpenAI + pdf-parse 2단계 → Gemini 네이티브 PDF 1단계로 교체.
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
      // §enforcement-handle-close-sweep (quotes) — 'unknown' 유지. 업로드 PDF 에서 견적
      //   항목을 추출해 반환할 뿐 대상 견적 엔티티가 없다(quoteId 미수신). 'unknown' 은
      //   전역 공용 키가 아니라 userId 폴백(§11.369-3)이라 연타 보호는 유지된다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/quotes/parse-pdf',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      enforcement.fail();
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      enforcement.fail();
      return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      enforcement.fail();
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다.` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // §11.290 Phase 4c — pipelineResult metadata outer scope retain
    // (jobId / providerUsed / cached). QuoteScannerModal review step 에서
    // ProviderBadge + CacheHitIndicator 표시 위해 ocrMetadata response 노출.
    let ocrMetadata: {
      jobId: string | null;
      providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
      cached: boolean;
    } | null = null;

    // §scan-org-identity B-1 (호영님 2026-09-04) — OcrJob 의 조직은 **세션에서 해석한 실제 조직**이다.
    //   구: `organizationId: session.user.id` — 조직 자리에 user 식별자를 넣고 있었다.
    //   OcrJob 쪽에 FK 가 없어 DB 가 안 막았고, 그 값이 ProductInventory 로 승계되며
    //   P2003 으로 터졌다(2026-09-04 prod). 조용히 넘기지 않고 조직이 없으면 거절한다.
    const scanOrganizationId = await resolveActiveOrganizationId({ userId: session.user.id });
    if (!scanOrganizationId) {
      return NextResponse.json(
        {
          error: "소속 조직이 없어 스캔 기록을 남길 수 없습니다 · 조직에 참여한 뒤 다시 시도하세요.",
          code: "NO_ORGANIZATION",
        },
        { status: 422 },
      );
    }

    const pipelineResult = await runQuoteOcrPipeline({
      kind: "pdf",
      buffer,
      organizationId: scanOrganizationId,
      userId: session.user.id,
    });
    const result = pipelineResult.result;
    ocrMetadata = {
      jobId: pipelineResult.jobId,
      providerUsed: pipelineResult.providerUsed,
      cached: pipelineResult.cached,
    };

    // 기존 QuoteExtractionResult 호환 형태로도 반환
    // ⚠️ 정상 완료 경로인데 fail() 이다 — **버그 아님. complete() 로 바꾸지 말 것.**
    //   PDF 파싱 결과를 반환할 뿐 DB 쓰기가 0이다. complete() 는 before/after 를 남기므로
    //   아무것도 바꾸지 않은 호출에 "변경 완료" 감사가 생긴다 = 거짓 감사.
    enforcement.fail();
    return NextResponse.json({
      // 새 구조 (상세)
      success: true,
      ...result,
      // §11.290 Phase 4c — OCR pipeline metadata (provider / cache / jobId).
      ocrMetadata,
      // 기존 호환 필드
      items: result.parsed.items.map((item) => ({
        productName: item.productName,
        catalogNumber: item.catalogNumber,
        // #catalog-spec-backfill ①-a — 파서가 이미 추출하던 규격을 응답에 통과 (떨굼 제거)
        specification: item.specification,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        leadTime: item.leadTimeDays,
        minOrderQty: null,
        notes: item.notes,
      })),
      vendorName: result.parsed.vendor?.name,
      vendorEmail: result.parsed.vendor?.email,
      vendorPhone: result.parsed.vendor?.phone,
      quoteDate: result.parsed.quoteDate,
      validUntil: result.parsed.validUntil,
      totalAmount: result.parsed.totalAmount,
      currency: result.parsed.currency,
      notes: result.parsed.specialNotes,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("[parse-pdf] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "견적서 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}

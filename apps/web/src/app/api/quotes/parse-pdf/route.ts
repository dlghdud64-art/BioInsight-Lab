import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parseQuotePDFWithGemini } from "@/lib/ocr/gemini-quote-parser";

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
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/quotes/parse-pdf',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다.` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await parseQuotePDFWithGemini(buffer);

    // 기존 QuoteExtractionResult 호환 형태로도 반환
    return NextResponse.json({
      // 새 구조 (상세)
      success: true,
      ...result,
      // 기존 호환 필드
      items: result.parsed.items.map((item) => ({
        productName: item.productName,
        catalogNumber: item.catalogNumber,
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
    console.error("[parse-pdf] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "견적서 처리에 실패했습니다." },
      { status: 500 },
    );
  }
}

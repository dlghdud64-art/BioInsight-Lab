// 🔧 서버 환경 폴리필 (DOMMatrix 등) — 반드시 최상단에서 import
import "@/lib/server-polyfills";

import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";

export const runtime = "nodejs";

/**
 * POST /api/protocol/extract-pdf-text
 * PDF 파일에서 텍스트를 추출합니다.
 *
 * pdfjs-dist(pdf-parse 종속)는 DOMMatrix 등 DOM API를 내부적으로 참조하므로,
 * Node.js 환경에서는 server-polyfills를 미리 로드해야 합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다." }, { status: 400 });
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    // File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF에서 텍스트 추출
    const pdfText = await extractTextFromPDF(buffer);

    // 추출 결과가 문자열이 아닌 경우 (pdf-parse v2 내부 이슈 대응)
    const text = typeof pdfText === "string" ? pdfText : "";

    if (!text || text.trim().length === 0) {
      return NextResponse.json({
        error: "PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF이거나 텍스트 레이어가 없는 파일일 수 있습니다.",
        code: "PDF_NO_TEXT",
      }, { status: 422 });
    }

    return NextResponse.json({
      text,
      length: text.length,
    });
  } catch (error: any) {
    console.error("[extract-pdf-text] Error:", error?.message);

    // 에러 분류
    const msg = error?.message ?? "";

    // 1. 런타임/환경 에러 (DOMMatrix, window, document 등)
    if (/DOMMatrix|is not defined|window|document|navigator/i.test(msg)) {
      return NextResponse.json({
        error: "이 PDF는 현재 환경에서 바로 읽을 수 없습니다. 텍스트 붙여넣기로 계속 진행하거나 다른 PDF로 다시 시도해 주세요.",
        code: "RUNTIME_ERROR",
        details: process.env.NODE_ENV === "development" ? msg : undefined,
      }, { status: 500 });
    }

    // 2. 암호화된 PDF
    if (/password|encrypted|PasswordException/i.test(msg)) {
      return NextResponse.json({
        error: "암호로 보호된 PDF입니다. 암호를 해제한 후 다시 시도해 주세요.",
        code: "PDF_ENCRYPTED",
      }, { status: 422 });
    }

    // 3. 손상된 PDF
    if (/invalid|corrupt|InvalidPDFException|damaged/i.test(msg)) {
      return NextResponse.json({
        error: "PDF 파일이 손상되었거나 올바르지 않습니다. 다른 파일로 다시 시도해 주세요.",
        code: "PDF_INVALID",
      }, { status: 422 });
    }

    // 4. 스캔본 / 텍스트 없음
    if (/텍스트.*없|no text|empty|스캔/i.test(msg)) {
      return NextResponse.json({
        error: "이 PDF에는 텍스트 레이어가 없습니다. 스캔된 이미지 PDF일 수 있습니다. 텍스트 붙여넣기로 진행해 주세요.",
        code: "PDF_NO_TEXT",
      }, { status: 422 });
    }

    // 5. 기타 에러
    return NextResponse.json({
      error: "PDF에서 텍스트를 추출하는 중 오류가 발생했습니다. 텍스트 붙여넣기로 진행하거나 다시 시도해 주세요.",
      code: "PDF_PARSE_ERROR",
      details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    }, { status: 500 });
  }
}

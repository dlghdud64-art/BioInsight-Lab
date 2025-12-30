import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";

export const runtime = "nodejs";

/**
 * POST /api/protocol/extract-pdf-text
 * Extract plain text from PDF file for protocol extraction
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

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF에서 텍스트 추출
    const pdfText = await extractTextFromPDF(buffer);

    return NextResponse.json({
      text: pdfText,
      length: pdfText.length,
    });
  } catch (error: any) {
    console.error("Error extracting text from PDF:", error);
    const errorMessage = error?.message || "PDF에서 텍스트를 추출하는 중 오류가 발생했습니다.";
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}


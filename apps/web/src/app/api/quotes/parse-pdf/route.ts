import { NextRequest, NextResponse } from "next/server";
import { extractQuoteFromPDF } from "@/lib/ai/quote-extractor";

// pdf-parse는 Node.js 네이티브 모듈이므로 Node.js 런타임 필요
export const runtime = "nodejs";

// 파일 업로드 제한 상수 (DoS 방지)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (10MB에서 축소)

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

    // 파일 크기 제한 (5MB - DoS 방지를 위해 축소)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다.` },
        { status: 400 }
      );
    }

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 견적서에서 정보 추출
    const result = await extractQuoteFromPDF(buffer);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing quote PDF:", error);
    const errorMessage = error?.message || "견적서 처리에 실패했습니다.";
    console.error("Error details:", {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
























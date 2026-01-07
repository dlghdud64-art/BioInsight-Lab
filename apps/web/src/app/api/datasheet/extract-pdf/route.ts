import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";
import { extractProductInfoFromDatasheet } from "@/lib/ai/datasheet-extractor";

// pdf-parse는 Node.js 네이티브 모듈이므로 Node.js 런타임 필요
export const runtime = "nodejs";

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

    // 🎭 파일명 추출 (데모 cheat key용)
    const fileName = file.name;
    if (process.env.NODE_ENV === "development") {
      console.log(`[PDF Extract API] Processing file: ${fileName}`);
    }

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF에서 텍스트 추출
    const pdfText = await extractTextFromPDF(buffer);

    // 텍스트가 너무 길면 앞부분만 사용
    let cleanedText = pdfText;
    if (cleanedText.length > 15000) {
      cleanedText = cleanedText.substring(0, 15000) + "...";
    }

    // 데이터시트 정보 추출 (파일명 전달 - 데모 cheat key 활성화)
    const extractedInfo = await extractProductInfoFromDatasheet(cleanedText, fileName);

    return NextResponse.json({
      data: {
        ...extractedInfo,
        extractedTextLength: pdfText.length,
        sourceType: "pdf",
      },
    });
  } catch (error: any) {
    console.error("Error processing datasheet PDF:", error);
    const errorMessage = error?.message || "데이터시트 PDF 처리에 실패했습니다.";
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



























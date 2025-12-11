import { NextRequest, NextResponse } from "next/server";
import { extractReagentsFromProtocol } from "@/lib/ai/protocol-extractor";

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

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 프로토콜에서 시약 추출
    const result = await extractReagentsFromProtocol(buffer);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing protocol:", error);
    const errorMessage = error?.message || "프로토콜 처리에 실패했습니다.";
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


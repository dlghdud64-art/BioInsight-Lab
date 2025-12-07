import { NextRequest, NextResponse } from "next/server";
import { extractProductInfoFromDatasheet } from "@/lib/ai/datasheet-extractor";

// 데이터시트 텍스트에서 제품 정보 추출 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text cannot be empty" },
        { status: 400 }
      );
    }

    const extractedInfo = await extractProductInfoFromDatasheet(text);

    return NextResponse.json({
      success: true,
      data: extractedInfo,
    });
  } catch (error: any) {
    console.error("Error extracting datasheet info:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract datasheet info" },
      { status: 500 }
    );
  }
}


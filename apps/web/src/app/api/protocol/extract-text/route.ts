import { NextRequest, NextResponse } from "next/server";
import { extractReagentsFromText } from "@/lib/ai/text-extractor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "텍스트는 50,000자 이하여야 합니다." },
        { status: 400 }
      );
    }

    // 텍스트에서 시약 추출
    const result = await extractReagentsFromText(text);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing protocol text:", error);
    return NextResponse.json(
      { error: error.message || "프로토콜 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}



import { extractReagentsFromText } from "@/lib/ai/text-extractor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "텍스트는 50,000자 이하여야 합니다." },
        { status: 400 }
      );
    }

    // 텍스트에서 시약 추출
    const result = await extractReagentsFromText(text);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing protocol text:", error);
    return NextResponse.json(
      { error: error.message || "프로토콜 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}



import { extractReagentsFromText } from "@/lib/ai/text-extractor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: "텍스트는 50,000자 이하여야 합니다." },
        { status: 400 }
      );
    }

    // 텍스트에서 시약 추출
    const result = await extractReagentsFromText(text);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing protocol text:", error);
    return NextResponse.json(
      { error: error.message || "프로토콜 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}







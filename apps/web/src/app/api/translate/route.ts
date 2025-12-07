import { NextRequest, NextResponse } from "next/server";
import { translateText } from "@/lib/ai/openai";

// GPT 기반 번역 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, sourceLang = "en", targetLang = "ko" } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const translated = await translateText(text, sourceLang, targetLang);

    return NextResponse.json({
      original: text,
      translated,
      sourceLang,
      targetLang,
    });
  } catch (error) {
    console.error("Error translating text:", error);
    return NextResponse.json(
      { error: "Failed to translate text" },
      { status: 500 }
    );
  }
}


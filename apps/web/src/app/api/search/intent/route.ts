import { NextRequest, NextResponse } from "next/server";
import { analyzeSearchIntent } from "@/lib/ai/openai";

// GPT 기반 검색 의도 분류 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const intent = await analyzeSearchIntent(query);

    return NextResponse.json({ intent });
  } catch (error) {
    console.error("Error analyzing search intent:", error);
    return NextResponse.json(
      { error: "Failed to analyze search intent" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRecommendationFeedback, getRecommendationFeedback } from "@/lib/api/recommendation-feedback";

// 추천 피드백 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getRecommendationFeedback(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching recommendation feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// 추천 피드백 생성/업데이트
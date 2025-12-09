import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 추천 피드백 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { recommendationId, isHelpful, reason } = body;

    if (!recommendationId || typeof isHelpful !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 추천이 존재하는지 확인
    const recommendation = await db.productRecommendation.findUnique({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    // 피드백 저장
    const feedback = await db.recommendationFeedback.create({
      data: {
        recommendationId,
        userId: session?.user?.id,
        isHelpful,
        reason: reason || null,
      },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error("Error saving recommendation feedback:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}

// 추천 피드백 조회


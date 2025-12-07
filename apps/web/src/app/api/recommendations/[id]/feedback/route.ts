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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isHelpful, reason } = body;

    if (typeof isHelpful !== "boolean") {
      return NextResponse.json(
        { error: "isHelpful is required" },
        { status: 400 }
      );
    }

    const feedback = await createRecommendationFeedback(
      session.user.id,
      id,
      {
        isHelpful,
        reason,
      }
    );

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("Error creating recommendation feedback:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}




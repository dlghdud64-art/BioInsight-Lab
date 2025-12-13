import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 추천 피드백 수집
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recommendationId, isHelpful, reason } = body;

    if (!recommendationId || isHelpful === undefined) {
      return NextResponse.json(
        { error: "recommendationId and isHelpful are required" },
        { status: 400 }
      );
    }

    // 기존 피드백 확인
    const existingFeedback = await db.recommendationFeedback.findFirst({
      where: {
        recommendationId,
        userId: session.user.id,
      },
    });

    let feedback;
    if (existingFeedback) {
      // 기존 피드백 업데이트
      feedback = await db.recommendationFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          isHelpful,
          reason: reason || null,
        },
      });
    } else {
      // 새 피드백 생성
      feedback = await db.recommendationFeedback.create({
        data: {
          recommendationId,
          userId: session.user.id,
          isHelpful,
          reason: reason || null,
        },
      });
    }

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("Error saving recommendation feedback:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}

// 추천 피드백 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get("recommendationId");

    if (!recommendationId) {
      return NextResponse.json(
        { error: "recommendationId is required" },
        { status: 400 }
      );
    }

    const feedback = await db.recommendationFeedback.findFirst({
      where: {
        recommendationId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("Error fetching recommendation feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

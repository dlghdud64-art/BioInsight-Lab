import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 추천 피드백 수집
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const body = await request.json();
    const { recommendationId, isHelpful, reason } = body;

    if (!recommendationId || isHelpful === undefined) {
      return NextResponse.json(
        { error: "recommendationId and isHelpful are required" },
        { status: 400 }
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (recommendations) — 대상 확정 이후로 핸들 이동.
      //   400 검증이 lock 보다 앞서므로 잘못된 요청은 lock 을 잡지 않는다.
      //   쓰기 대상은 RecommendationFeedback 이지만 사용자당 1건이라 recommendationId
      //   가 실질 대상 키다. ⚠️ enum 에 recommendation 타입 부재 → §audit-taxonomy-review.
      targetEntityId: recommendationId,
      sourceSurface: 'web_app',
      routePath: '/api/recommendations/feedback',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    // update / create 어느 분기든 쓰기가 실재한다 → 무조건 complete().
    enforcement.complete({
      beforeState: existingFeedback
        ? { feedbackId: existingFeedback.id, isHelpful: existingFeedback.isHelpful }
        : { feedbackId: null },
      afterState: { feedbackId: feedback.id, isHelpful: feedback.isHelpful },
    });

    return NextResponse.json({ feedback });
  } catch (error: any) {
    enforcement?.fail();
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

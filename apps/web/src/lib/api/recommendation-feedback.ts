import { db } from "@/lib/db";

// 추천 피드백 생성
export async function createRecommendationFeedback(
  userId: string,
  recommendationId: string,
  data: {
    isHelpful: boolean;
    reason?: string;
  }
) {
  // 기존 피드백 확인
  const existing = await db.recommendationFeedback.findFirst({
    where: {
      userId,
      recommendationId,
    },
  });

  if (existing) {
    // 기존 피드백 업데이트
    return db.recommendationFeedback.update({
      where: { id: existing.id },
      data: {
        isHelpful: data.isHelpful,
        reason: data.reason,
      },
    });
  }

  // 새 피드백 생성
  return db.recommendationFeedback.create({
    data: {
      userId,
      recommendationId,
      isHelpful: data.isHelpful,
      reason: data.reason,
    },
  });
}

// 추천 피드백 조회
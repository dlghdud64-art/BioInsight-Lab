import { db } from "@/lib/db";

// 제품 리뷰 조회
export async function getProductReviews(productId: string, params?: {
  page?: number;
  limit?: number;
  sortBy?: "recent" | "rating_high" | "rating_low";
}) {
  const { page = 1, limit = 20, sortBy = "recent" } = params || {};
  const skip = (page - 1) * limit;

  let orderBy: any = {};
  switch (sortBy) {
    case "rating_high":
      orderBy = { rating: "desc" };
      break;
    case "rating_low":
      orderBy = { rating: "asc" };
      break;
    case "recent":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    db.review.count({ where: { productId } }),
  ]);

  // 평균 평점 계산
  const avgRating = await db.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    reviews,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    averageRating: avgRating._avg.rating || 0,
    totalReviews: avgRating._count.rating || 0,
    ratingDistribution: await getRatingDistribution(productId),
  };
}

// 평점 분포 조회
async function getRatingDistribution(productId: string) {
  const distribution = await db.review.groupBy({
    by: ["rating"],
    where: { productId },
    _count: { rating: true },
  });

  const result: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach((item) => {
    result[item.rating] = item._count.rating;
  });

  return result;
}

// 리뷰 삭제
export async function deleteReview(reviewId: string, userId: string) {
  // 리뷰 소유자 확인
  const review = await db.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  if (review.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return await db.review.delete({
    where: { id: reviewId },
  });
}

// 리뷰 생성
export async function createReview(
  userId: string,
  productId: string,
  rating: number,
  comment: string
) {
  return await db.review.create({
    data: {
      userId,
      productId,
      rating,
      comment,
    },
  });
}

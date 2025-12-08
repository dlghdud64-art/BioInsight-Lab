import { db } from "@/lib/db";

export async function getRecentProducts(userId: string | null, limit: number = 20) {
  if (!userId) {
    return [];
  }

  const history = await db.searchHistory.findMany({
    where: {
      userId,
      clickedProductId: {
        not: null,
      },
    },
    include: {
      product: {
        include: {
          vendors: {
            include: {
              vendor: true,
            },
            orderBy: {
              priceInKRW: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    distinct: ["clickedProductId"],
  });

  // 중복 제거 (같은 제품의 최신 기록만)
  const productMap = new Map();
  history.forEach((item) => {
    if (item.clickedProductId && item.product) {
      if (!productMap.has(item.clickedProductId)) {
        productMap.set(item.clickedProductId, item.product);
      }
    }
  });

  return Array.from(productMap.values());
}

// 제품 조회 기록 저장
export async function recordProductView(userId: string | null, productId: string) {
  if (!userId) {
    return;
  }

  try {
    await db.searchHistory.create({
      data: {
        userId,
        clickedProductId: productId,
      },
    });
  } catch (error) {
    console.error("Failed to record product view:", error);
  }
}

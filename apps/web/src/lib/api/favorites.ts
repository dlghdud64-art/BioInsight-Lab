import { db } from "@/lib/db";

// 사용자의 즐겨찾기 목록 조회
export async function getFavoritesByUser(userId: string) {
  return db.favorite.findMany({
    where: { userId },
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
  });
}

// 즐겨찾기 추가
export async function addFavorite(userId: string, productId: string) {
  return db.favorite.create({
    data: {
      userId,
      productId,
    },
  });
}

// 즐겨찾기 제거
export async function removeFavorite(userId: string, productId: string) {
  return db.favorite.deleteMany({
    where: {
      userId,
      productId,
    },
  });
}

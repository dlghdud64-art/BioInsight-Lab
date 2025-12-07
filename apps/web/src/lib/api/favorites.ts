import { db } from "@/lib/db";

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

export async function addFavorite(userId: string, productId: string) {
  return db.favorite.create({
    data: {
      userId,
      productId,
    },
    include: {
      product: true,
    },
  });
}

export async function removeFavorite(userId: string, productId: string) {
  return db.favorite.deleteMany({
    where: {
      userId,
      productId,
    },
  });
}

export async function isFavorite(userId: string, productId: string): Promise<boolean> {
  const favorite = await db.favorite.findFirst({
    where: {
      userId,
      productId,
    },
  });
  return !!favorite;
}




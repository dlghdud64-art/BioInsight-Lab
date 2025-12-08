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
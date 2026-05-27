import { db } from "@/lib/db";

// 벤더가 받은 견적 요청 조회 (벤더의 제품이 포함된 견적)
export async function getQuotesForVendor(vendorId: string) {
  // 벤더의 제품이 포함된 견적 요청 찾기
  const quotes = await db.quote.findMany({
    where: {
      items: {
        some: {
          product: {
            vendors: {
              some: {
                vendorId,
              },
            },
          },
        },
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                where: {
                  vendorId,
                },
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
      },
      responses: {
        where: {
          vendorId,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      organization: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return quotes;
}

// 벤더의 견적 응답 생성
export async function createQuoteResponse(
  vendorId: string,
  quoteId: string,
  data: {
    totalPrice?: number;
    currency?: string;
    message?: string;
    validUntil?: Date;
    price?: number; // 하위 호환성을 위해 유지
    leadTime?: number;
    notes?: string;
  }
) {
  // totalPrice가 있으면 price로 사용, 없으면 price 사용
  const price = data.totalPrice ?? data.price ?? 0;
  
  return await db.quoteResponse.create({
    data: {
      quoteId,
      vendorId,
      totalPrice: data.totalPrice ?? data.price ?? null,
      currency: data.currency || "KRW",
      message: data.message || data.notes || null,
      validUntil: data.validUntil || null,
    },
  });
}

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
  quoteId: string,
  vendorId: string,
  data: {
    price: number;
    leadTime?: number;
    notes?: string;
  }
) {
  return await db.quoteResponse.create({
    data: {
      quoteId,
      vendorId,
      price: data.price,
      leadTime: data.leadTime,
      notes: data.notes,
    },
  });
}

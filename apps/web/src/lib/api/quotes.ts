import { db } from "@/lib/db";
import { translateText } from "@/lib/ai/openai";
import { cache } from "@/lib/cache";

export interface CreateQuoteParams {
  userId: string;
  organizationId?: string;
  title: string;
  message?: string;
  deliveryDate?: Date;
  deliveryLocation?: string;
  specialNotes?: string;
  productIds: string[];
  quantities?: Record<string, number>;
  notes?: Record<string, string>;
}

export async function createQuote(params: CreateQuoteParams) {
  const {
    userId,
    organizationId,
    title,
    message,
    deliveryDate,
    deliveryLocation,
    specialNotes,
    productIds,
    quantities = {},
    notes = {},
  } = params;

  // 메시지 번역 (영문 요청서 생성)
  let messageEn: string | undefined;
  if (message) {
    try {
      messageEn = await translateText(message, "ko", "en");
    } catch (error) {
      console.error("Failed to translate message:", error);
    }
  }

  // 제품 정보 조회 (가격 정보 포함)
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: {
      vendors: {
        include: {
          vendor: true,
        },
        orderBy: {
          priceInKRW: "asc",
        },
        take: 1, // 가장 저렴한 벤더 선택
      },
    },
  });

  // 품목 리스트 생성 (그룹웨어용)
  const quote = await db.quote.create({
    data: {
      userId,
      organizationId,
      title,
      description: message, // message를 description으로 사용
      items: {
        create: productIds.map((productId, index) => {
          const product = products.find((p) => p.id === productId);
          const vendor = product?.vendors?.[0];
          const quantity = quantities[productId] || 1;
          const unitPrice = vendor?.priceInKRW || 0;
          const lineTotal = unitPrice * quantity;

          return {
            productId,
            lineNumber: index + 1,
            quantity,
            unitPrice,
            currency: vendor?.currency || "KRW",
            lineTotal,
            notes: notes[productId] || null,
          };
        }),
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                include: {
                  vendor: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: {
          lineNumber: "asc",
        },
      },
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return quote;
}

// 견적 ID로 조회
export async function getQuoteById(id: string) {
  return await db.quote.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
        orderBy: {
          lineNumber: "asc",
        },
      },
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      organization: true,
      responses: {
        include: {
          vendor: true,
        },
      },
    },
  });
}
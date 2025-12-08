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
  }
) {
  // 견적이 존재하고 벤더의 제품이 포함되어 있는지 확인
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                where: {
                  vendorId,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found");
  }

  // 벤더의 제품이 포함되어 있는지 확인
  const hasVendorProduct = quote.items.some((item) =>
    item.product.vendors.some((pv) => pv.vendorId === vendorId)
  );

  if (!hasVendorProduct) {
    throw new Error("This quote does not contain products from your vendor");
  }

  // 이미 응답이 있는지 확인
  const existingResponse = await db.quoteResponse.findFirst({
    where: {
      quoteId,
      vendorId,
    },
  });

  if (existingResponse) {
    // 기존 응답 업데이트
    return db.quoteResponse.update({
      where: { id: existingResponse.id },
      data: {
        totalPrice: data.totalPrice,
        currency: data.currency || "KRW",
        message: data.message,
        validUntil: data.validUntil,
      },
    });
  }

  // 새 응답 생성
  const response = await db.quoteResponse.create({
    data: {
      quoteId,
      vendorId,
      totalPrice: data.totalPrice,
      currency: data.currency || "KRW",
      message: data.message,
      validUntil: data.validUntil,
    },
  });

  // 견적 상태 업데이트
  await db.quote.update({
    where: { id: quoteId },
    data: {
      status: "RESPONDED",
    },
  });

  return response;
}

// 벤더 통계 조회
export async function getVendorStats(vendorId: string) {
  const quotes = await getQuotesForVendor(vendorId);
  const responses = await db.quoteResponse.findMany({
    where: { vendorId },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const thisMonthQuotes = quotes.filter(
    (q) => new Date(q.createdAt) >= thisMonth
  );

  const responseRate =
    quotes.length > 0 ? (responses.length / quotes.length) * 100 : 0;

  const completedQuotes = quotes.filter((q) => q.status === "COMPLETED");
  const successRate =
    responses.length > 0
      ? (completedQuotes.length / responses.length) * 100
      : 0;

  return {
    totalQuotes: quotes.length,
    thisMonthQuotes: thisMonthQuotes.length,
    totalResponses: responses.length,
    responseRate: Math.round(responseRate * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
  };
}




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
  }
) {
  // 견적이 존재하고 벤더의 제품이 포함되어 있는지 확인
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                where: {
                  vendorId,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found");
  }

  // 벤더의 제품이 포함되어 있는지 확인
  const hasVendorProduct = quote.items.some((item) =>
    item.product.vendors.some((pv) => pv.vendorId === vendorId)
  );

  if (!hasVendorProduct) {
    throw new Error("This quote does not contain products from your vendor");
  }

  // 이미 응답이 있는지 확인
  const existingResponse = await db.quoteResponse.findFirst({
    where: {
      quoteId,
      vendorId,
    },
  });

  if (existingResponse) {
    // 기존 응답 업데이트
    return db.quoteResponse.update({
      where: { id: existingResponse.id },
      data: {
        totalPrice: data.totalPrice,
        currency: data.currency || "KRW",
        message: data.message,
        validUntil: data.validUntil,
      },
    });
  }

  // 새 응답 생성
  const response = await db.quoteResponse.create({
    data: {
      quoteId,
      vendorId,
      totalPrice: data.totalPrice,
      currency: data.currency || "KRW",
      message: data.message,
      validUntil: data.validUntil,
    },
  });

  // 견적 상태 업데이트
  await db.quote.update({
    where: { id: quoteId },
    data: {
      status: "RESPONDED",
    },
  });

  return response;
}

// 벤더 통계 조회
export async function getVendorStats(vendorId: string) {
  const quotes = await getQuotesForVendor(vendorId);
  const responses = await db.quoteResponse.findMany({
    where: { vendorId },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const thisMonthQuotes = quotes.filter(
    (q) => new Date(q.createdAt) >= thisMonth
  );

  const responseRate =
    quotes.length > 0 ? (responses.length / quotes.length) * 100 : 0;

  const completedQuotes = quotes.filter((q) => q.status === "COMPLETED");
  const successRate =
    responses.length > 0
      ? (completedQuotes.length / responses.length) * 100
      : 0;

  return {
    totalQuotes: quotes.length,
    thisMonthQuotes: thisMonthQuotes.length,
    totalResponses: responses.length,
    responseRate: Math.round(responseRate * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
  };
}




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
  }
) {
  // 견적이 존재하고 벤더의 제품이 포함되어 있는지 확인
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        include: {
          product: {
            include: {
              vendors: {
                where: {
                  vendorId,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found");
  }

  // 벤더의 제품이 포함되어 있는지 확인
  const hasVendorProduct = quote.items.some((item) =>
    item.product.vendors.some((pv) => pv.vendorId === vendorId)
  );

  if (!hasVendorProduct) {
    throw new Error("This quote does not contain products from your vendor");
  }

  // 이미 응답이 있는지 확인
  const existingResponse = await db.quoteResponse.findFirst({
    where: {
      quoteId,
      vendorId,
    },
  });

  if (existingResponse) {
    // 기존 응답 업데이트
    return db.quoteResponse.update({
      where: { id: existingResponse.id },
      data: {
        totalPrice: data.totalPrice,
        currency: data.currency || "KRW",
        message: data.message,
        validUntil: data.validUntil,
      },
    });
  }

  // 새 응답 생성
  const response = await db.quoteResponse.create({
    data: {
      quoteId,
      vendorId,
      totalPrice: data.totalPrice,
      currency: data.currency || "KRW",
      message: data.message,
      validUntil: data.validUntil,
    },
  });

  // 견적 상태 업데이트
  await db.quote.update({
    where: { id: quoteId },
    data: {
      status: "RESPONDED",
    },
  });

  return response;
}

// 벤더 통계 조회
export async function getVendorStats(vendorId: string) {
  const quotes = await getQuotesForVendor(vendorId);
  const responses = await db.quoteResponse.findMany({
    where: { vendorId },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const thisMonthQuotes = quotes.filter(
    (q) => new Date(q.createdAt) >= thisMonth
  );

  const responseRate =
    quotes.length > 0 ? (responses.length / quotes.length) * 100 : 0;

  const completedQuotes = quotes.filter((q) => q.status === "COMPLETED");
  const successRate =
    responses.length > 0
      ? (completedQuotes.length / responses.length) * 100
      : 0;

  return {
    totalQuotes: quotes.length,
    thisMonthQuotes: thisMonthQuotes.length,
    totalResponses: responses.length,
    responseRate: Math.round(responseRate * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
  };
}






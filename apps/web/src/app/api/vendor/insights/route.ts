import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 벤더 데이터 인사이트 리포트 생성
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Only suppliers can access this" }, { status: 403 });
    }

    const vendor = await db.vendor.findFirst({
      where: { email: user.email || undefined },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 기본 30일
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : new Date();

    // 견적 요청 통계
    const quotes = await db.quote.findMany({
      where: {
        items: {
          some: {
            product: {
              vendors: {
                some: {
                  vendorId: vendor.id,
                },
              },
            },
          },
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        responses: {
          where: {
            vendorId: vendor.id,
          },
        },
      },
    });

    // 응답 통계
    const responses = await db.quoteResponse.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        quote: true,
      },
    });

    // 제품별 통계
    const productStats: Record<string, any> = {};
    // 타입 에러 수정: quote와 item 파라미터에 타입 명시
    quotes.forEach((quote: any) => {
      quote.items.forEach((item: any) => {
        const productId = item.productId;
        if (!productStats[productId]) {
          productStats[productId] = {
            productId,
            productName: item.product.name,
            quoteCount: 0,
            totalQuantity: 0,
            respondedCount: 0,
            completedCount: 0,
          };
        }
        productStats[productId].quoteCount += 1;
        productStats[productId].totalQuantity += item.quantity;
      });
    });

    // 타입 에러 수정: response와 item 파라미터에 타입 명시
    responses.forEach((response: any) => {
      response.quote.items.forEach((item: any) => {
        const productId = item.productId;
        if (productStats[productId]) {
          productStats[productId].respondedCount += 1;
          if (response.quote.status === "COMPLETED") {
            productStats[productId].completedCount += 1;
          }
        }
      });
    });

    // 카테고리별 통계
    const categoryStats: Record<string, any> = {};
    // 타입 에러 수정: quote와 item 파라미터에 타입 명시
    quotes.forEach((quote: any) => {
      quote.items.forEach((item: any) => {
        const category = item.product.category;
        if (!categoryStats[category]) {
          categoryStats[category] = {
            category,
            quoteCount: 0,
            totalQuantity: 0,
          };
        }
        categoryStats[category].quoteCount += 1;
        categoryStats[category].totalQuantity += item.quantity;
      });
    });

    // 월별 트렌드
    const monthlyTrends: Record<string, any> = {};
    // 타입 에러 수정: quote 파라미터에 타입 명시
    quotes.forEach((quote: any) => {
      const month = new Date(quote.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyTrends[month]) {
        monthlyTrends[month] = {
          month,
          quoteCount: 0,
          responseCount: 0,
          completedCount: 0,
        };
      }
      monthlyTrends[month].quoteCount += 1;
    });

    // 타입 에러 수정: response 파라미터에 타입 명시
    responses.forEach((response: any) => {
      const month = new Date(response.createdAt).toISOString().slice(0, 7);
      if (monthlyTrends[month]) {
        monthlyTrends[month].responseCount += 1;
        if (response.quote.status === "COMPLETED") {
          monthlyTrends[month].completedCount += 1;
        }
      }
    });

    const insights = {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalQuotes: quotes.length,
        totalResponses: responses.length,
        responseRate: quotes.length > 0 ? ((responses.length / quotes.length) * 100).toFixed(2) : "0.00",
        // 타입 에러 수정: q 파라미터에 타입 명시
        completedQuotes: quotes.filter((q: any) => q.status === "COMPLETED").length,
        completionRate:
          quotes.length > 0
            ? ((quotes.filter((q: any) => q.status === "COMPLETED").length / quotes.length) * 100).toFixed(2)
            : "0.00",
        totalRevenue: vendor.totalRevenue,
        totalLeads: vendor.totalLeads,
      },
      productStats: Object.values(productStats),
      categoryStats: Object.values(categoryStats),
      monthlyTrends: Object.values(monthlyTrends).sort((a: any, b: any) => a.month.localeCompare(b.month)),
    };

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}

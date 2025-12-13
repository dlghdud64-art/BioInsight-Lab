import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 벤더 통계 API
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 벤더 정보 조회
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        vendor: true,
      },
    });

    if (!user?.vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const vendorId = user.vendor.id;

    // 견적 요청 통계
    const totalQuotes = await db.quote.count({
      where: {
        items: {
          some: {
            product: {
              vendors: {
                some: {
                  vendorId: vendorId,
                },
              },
            },
          },
        },
      },
    });

    // 견적 응답 통계
    const totalResponses = await db.quoteResponse.count({
      where: { vendorId: vendorId },
    });

    // 응답률 계산
    const responseRate = totalQuotes > 0 ? (totalResponses / totalQuotes) * 100 : 0;

    // 최근 30일 통계
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentQuotes = await db.quote.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        items: {
          some: {
            product: {
              vendors: {
                some: {
                  vendorId: vendorId,
                },
              },
            },
          },
        },
      },
    });

    const recentResponses = await db.quoteResponse.count({
      where: {
        vendorId: vendorId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // 평균 응답 시간 (시간 단위)
    const responsesWithTime = await db.quoteResponse.findMany({
      where: { vendorId: vendorId },
      include: {
        quote: {
          select: { createdAt: true },
        },
      },
      take: 100, // 최근 100개만 계산
    });

    const avgResponseTime = responsesWithTime.length > 0
      ? responsesWithTime.reduce((sum: number, response: typeof responsesWithTime[0]) => {
          const timeDiff = response.createdAt.getTime() - response.quote.createdAt.getTime();
          return sum + timeDiff / (1000 * 60 * 60); // 시간 단위
        }, 0) / responsesWithTime.length
      : 0;

    // 총 거래 금액 (응답한 견적의 총액)
    const totalRevenue = await db.quoteResponse.aggregate({
      where: { vendorId: vendorId },
      _sum: { totalPrice: true },
    });

    // 카테고리별 견적 통계
    const quotesByCategory = await db.quote.findMany({
      where: {
        items: {
          some: {
            product: {
              vendors: {
                some: {
                  vendorId: vendorId,
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
              select: {
                category: true,
              },
            },
          },
        },
      },
    });

    const categoryStats: Record<string, { quotes: number; responses: number }> = {};
    quotesByCategory.forEach((quote: any) => {
      quote.items.forEach((item: any) => {
        const category = item.product?.category || "UNKNOWN";
        if (!categoryStats[category]) {
          categoryStats[category] = { quotes: 0, responses: 0 };
        }
        categoryStats[category].quotes += 1;
      });
    });

    // 응답한 견적의 카테고리별 통계
    const responsesByCategory = await db.quoteResponse.findMany({
      where: { vendorId: vendorId },
      include: {
        quote: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    responsesByCategory.forEach((response: any) => {
      response.quote.items.forEach((item: any) => {
        const category = item.product?.category || "UNKNOWN";
        if (categoryStats[category]) {
          categoryStats[category].responses += 1;
        }
      });
    });

    // 시간대별 통계 (최근 7일)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyStats = await db.quoteResponse.findMany({
      where: {
        vendorId: vendorId,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        createdAt: true,
        totalPrice: true,
      },
    });

    const dailyRevenue: Record<string, number> = {};
    dailyStats.forEach((response: any) => {
      const date = response.createdAt.toISOString().split("T")[0];
      dailyRevenue[date] = (dailyRevenue[date] || 0) + (response.totalPrice || 0);
    });

    return NextResponse.json({
      totalQuotes,
      totalResponses,
      responseRate: Math.round(responseRate * 10) / 10,
      recentQuotes,
      recentResponses,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      categoryStats,
      dailyRevenue,
    });
  } catch (error: any) {
    console.error("Error fetching vendor stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor stats" },
      { status: 500 }
    );
  }
}


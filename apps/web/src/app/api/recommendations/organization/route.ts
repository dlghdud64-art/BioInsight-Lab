import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 조직별 추천 API
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!session?.user?.id) {
      return NextResponse.json({ recommendations: [] });
    }

    const userId = session.user.id;

    // 사용자가 속한 조직 조회
    const orgMembers = await db.organizationMember.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
    });

    if (orgMembers.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // 타입 에러 수정: m 파라미터에 타입 명시
    const organizationIds = orgMembers.map((m: any) => m.organizationId);

    // 조직 내 다른 멤버들의 견적 요청 분석
    const orgQuotes = await db.quote.findMany({
      where: {
        organizationId: { in: organizationIds },
        userId: { not: userId }, // 본인 제외
        createdAt: {
          gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 최근 180일
        },
      },
      include: {
        items: {
          include: {
            quote: true,
          },
        },
      },
    });

    // 조직 내 자주 사용되는 제품 카운트
    const productUsageCount: Record<string, number> = {};
    const productCategories: Record<string, string> = {};
    const productBrands: Record<string, string> = {};

    // 타입 에러 수정: quote 파라미터에 타입 명시
    orgQuotes.forEach((quote: any) => {
      // 타입 에러 수정: item 파라미터에 타입 명시
      quote.items.forEach((item: any) => {
        productUsageCount[item.productId] = (productUsageCount[item.productId] || 0) + 1;
      });
    });

    // 제품 정보 가져오기
    const productIds = Object.keys(productUsageCount);
    if (productIds.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
      },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });

    // 사용 빈도순으로 정렬
    // 타입 에러 수정: product 파라미터에 타입 명시
    const recommendations = products
      .map((product: any) => ({
        product,
        usageCount: productUsageCount[product.id],
        reason: `이 조직에서 ${productUsageCount[product.id]}번 사용되었습니다`,
      }))
      // 타입 에러 수정: a, b 파라미터에 타입 명시
      .sort((a: any, b: any) => b.usageCount - a.usageCount)
      .slice(0, limit);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error generating organization recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate organization recommendations" },
      { status: 500 }
    );
  }
}

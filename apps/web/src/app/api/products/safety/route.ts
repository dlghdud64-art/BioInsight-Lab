import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 안전 필드 기반 제품 필터링 API
 * 안전관리자용 뷰에서 사용
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("filterType"); // "high-risk" | "no-msds" | "hazard-code"
    const hazardCode = searchParams.get("hazardCode"); // 특정 위험 코드
    const organizationId = searchParams.get("organizationId"); // 조직 ID (선택)

    let where: any = {};

    // 필터 타입에 따른 조건 설정
    switch (filterType) {
      case "high-risk":
        // 고위험군 필터링 (발암성, 독성, 인화성 등)
        // Prisma JSON 필드는 path를 사용하여 검색
        where.OR = [
          { pictograms: { path: ["$"], array_contains: "skull" } }, // 독성
          { pictograms: { path: ["$"], array_contains: "flame" } }, // 인화성
          { pictograms: { path: ["$"], array_contains: "corrosive" } }, // 부식성
          { hazardCodes: { path: ["$"], array_contains: "H350" } }, // 발암성
          { hazardCodes: { path: ["$"], array_contains: "H300" } }, // 치명적 독성
        ];
        break;

      case "no-msds":
        // MSDS/SDS URL이 없는 품목
        where.msdsUrl = null;
        break;

      case "hazard-code":
        // 특정 위험 코드 포함
        if (hazardCode) {
          where.hazardCodes = { path: ["$"], array_contains: hazardCode };
        }
        break;

      default:
        // 모든 안전 필드가 있는 제품
        where.OR = [
          { hazardCodes: { not: null } },
          { pictograms: { not: null } },
          { storageCondition: { not: null } },
          { ppe: { not: null } },
        ];
    }

    // 조직별 필터링 (조직의 구매 내역에 포함된 제품만)
    if (organizationId) {
      const purchaseProductIds = await db.purchaseRecord.findMany({
        where: {
          organizationId,
        },
        select: {
          productId: true,
        },
        distinct: ["productId"],
      });

      const productIds = purchaseProductIds.map((p) => p.productId);
      if (productIds.length > 0) {
        where.id = { in: productIds };
      } else {
        // 구매 내역이 없으면 빈 결과 반환
        return NextResponse.json({
          products: [],
          total: 0,
        });
      }
    }

    const products = await db.product.findMany({
      where,
      include: {
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // 최대 100개
    });

    // JSON 필드를 배열로 변환
    const formattedProducts = products.map((product) => ({
      ...product,
      hazardCodes: Array.isArray(product.hazardCodes) ? product.hazardCodes : [],
      pictograms: Array.isArray(product.pictograms) ? product.pictograms : [],
      ppe: Array.isArray(product.ppe) ? product.ppe : [],
    }));

    return NextResponse.json({
      products: formattedProducts,
      total: formattedProducts.length,
    });
  } catch (error: any) {
    console.error("Error fetching safety products:", error);
    return NextResponse.json(
      { error: "Failed to fetch safety products" },
      { status: 500 }
    );
  }
}


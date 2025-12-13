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
    // Prisma의 JSON 필드는 raw query를 사용하거나 모든 제품을 가져온 후 필터링
    // 성능을 위해 raw query 사용
    let productIds: string[] = [];

    switch (filterType) {
      case "high-risk":
        // 고위험군 필터링 (발암성, 독성, 인화성 등)
        // PostgreSQL JSONB 연산자 사용
        try {
          const highRiskResults = await db.$queryRawUnsafe(`
            SELECT id FROM "Product"
            WHERE 
              ("pictograms"::jsonb @> '["skull"]'::jsonb OR
               "pictograms"::jsonb @> '["flame"]'::jsonb OR
               "pictograms"::jsonb @> '["corrosive"]'::jsonb OR
               "hazardCodes"::jsonb @> '["H350"]'::jsonb OR
               "hazardCodes"::jsonb @> '["H300"]'::jsonb)
          `) as Array<{ id: string }>;
          productIds = highRiskResults.map((r: { id: string }) => r.id);
        } catch (error) {
          console.error("Error querying high-risk products:", error);
          // 에러 발생 시 빈 결과 반환
          return NextResponse.json({
            products: [],
            total: 0,
          });
        }
        if (productIds.length > 0) {
          where.id = { in: productIds };
        } else {
          // 결과가 없으면 빈 결과 반환
          return NextResponse.json({
            products: [],
            total: 0,
          });
        }
        break;

      case "no-msds":
        // MSDS/SDS URL이 없는 품목
        where.msdsUrl = null;
        break;

      case "hazard-code":
        // 특정 위험 코드 포함
        if (hazardCode) {
          try {
            const hazardResults = await db.$queryRawUnsafe(
              `SELECT id FROM "Product" WHERE "hazardCodes"::jsonb @> $1::jsonb`,
              JSON.stringify([hazardCode])
            ) as Array<{ id: string }>;
            productIds = hazardResults.map((r: { id: string }) => r.id);
          } catch (error) {
            console.error("Error querying hazard code products:", error);
            return NextResponse.json({
              products: [],
              total: 0,
            });
          }
          if (productIds.length > 0) {
            where.id = { in: productIds };
          } else {
            return NextResponse.json({
              products: [],
              total: 0,
            });
          }
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

      const productIds = purchaseProductIds.map((p: { productId: string }) => p.productId);
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
    const formattedProducts = products.map((product: any) => ({
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


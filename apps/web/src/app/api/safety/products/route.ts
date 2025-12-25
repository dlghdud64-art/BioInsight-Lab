import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

// 안전 필드 기반 제품 필터링
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);

    // workspace scope 확인
    const organizationId = searchParams.get("organizationId");
    const missingSds = searchParams.get("missingSds") === "true";
    const hazardCode = searchParams.get("hazardCode");
    const pictogram = searchParams.get("pictogram");
    const storage = searchParams.get("storage");
    const vendorId = searchParams.get("vendorId");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 권한 확인: safety_admin 또는 admin
    if (organizationId) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
          role: {
            in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER], // VIEWER = safety_admin
          },
        },
      });

      if (!membership && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: safety_admin or admin role required" },
          { status: 403 }
        );
      }
    } else {
      // 조직이 없으면 guest는 read-only 또는 금지
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Unauthorized: organization scope required" },
          { status: 401 }
        );
      }
    }

    // 필터 조건 구성
    const where: any = {};

    // SDS 없는 품목 필터
    if (missingSds) {
      const missingSdsConditions: any[] = [
        {
          OR: [
            { msdsUrl: null },
            { msdsUrl: "" },
          ],
        },
        {
          sdsDocuments: {
            none: {},
          },
        },
      ];
      
      if (where.AND) {
        where.AND = [...where.AND, ...missingSdsConditions];
      } else {
        where.AND = missingSdsConditions;
      }
    }

    // 위험 코드 필터 (JSON 배열에 포함 여부 확인)
    let hazardCodeProductIds: string[] | null = null;
    if (hazardCode) {
      try {
        const results = await db.$queryRawUnsafe(
          `SELECT id FROM "Product" WHERE "hazardCodes"::jsonb @> $1::jsonb`,
          JSON.stringify([hazardCode])
        ) as Array<{ id: string }>;
        hazardCodeProductIds = results.map((r) => r.id);
      } catch (error) {
        console.error("Error querying hazard code products:", error);
      }
    }

    // 피크토그램 필터 (JSON 배열에 포함 여부 확인)
    let pictogramProductIds: string[] | null = null;
    if (pictogram) {
      try {
        const results = await db.$queryRawUnsafe(
          `SELECT id FROM "Product" WHERE "pictograms"::jsonb @> $1::jsonb`,
          JSON.stringify([pictogram])
        ) as Array<{ id: string }>;
        pictogramProductIds = results.map((r) => r.id);
      } catch (error) {
        console.error("Error querying pictogram products:", error);
      }
    }

    // 필터 결과를 where 조건에 추가
    const filterProductIds: string[] = [];
    if (hazardCodeProductIds && hazardCodeProductIds.length > 0) {
      filterProductIds.push(...hazardCodeProductIds);
    }
    if (pictogramProductIds && pictogramProductIds.length > 0) {
      if (filterProductIds.length > 0) {
        // 두 필터 모두 있으면 교집합
        filterProductIds.splice(0, filterProductIds.length, 
          ...filterProductIds.filter(id => pictogramProductIds!.includes(id))
        );
      } else {
        filterProductIds.push(...pictogramProductIds);
      }
    }

    if (filterProductIds.length > 0) {
      if (where.id) {
        // 기존 id 필터가 있으면 교집합
        const existingIds = Array.isArray(where.id.in) ? where.id.in : [];
        where.id = { 
          in: existingIds.filter((id: string) => filterProductIds.includes(id))
        };
      } else {
        where.id = { in: filterProductIds };
      }
    } else if ((hazardCode && !hazardCodeProductIds) || (pictogram && !pictogramProductIds)) {
      // 필터가 있지만 결과가 없으면 빈 결과 반환
      return NextResponse.json({
        products: [],
        total: 0,
        limit,
        offset,
      });
    }

    // 보관 조건 필터 (부분 일치)
    if (storage) {
      where.storageCondition = {
        contains: storage,
        mode: "insensitive",
      };
    }

    // 벤더 필터
    if (vendorId) {
      where.vendors = {
        some: {
          vendorId,
        },
      };
    }

    // 카테고리 필터
    if (category) {
      where.category = category;
    }

    // 제품 조회
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          vendors: {
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            take: 3,
          },
          sdsDocuments: {
            select: {
              id: true,
              fileName: true,
              source: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1, // 최신 1개만
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching safety products:", error);
    return NextResponse.json(
      { error: "Failed to fetch safety products" },
      { status: 500 }
    );
  }
}


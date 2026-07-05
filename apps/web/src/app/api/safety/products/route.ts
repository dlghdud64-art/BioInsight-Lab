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

    // §safety-modal-upgrade SM-P4c (호영님 2026-07-04) — 안전 목록 owner/org 스코프 정합.
    //   기존: organizationId 파라미터 없으면 세션만 확인하고 where 무스코프 → 임의 로그인
    //   사용자에게 전 테넌트 제품 노출(멀티테넌트 과다노출) + POST 점검(owner/org 게이트)과
    //   읽기/쓰기 불일치(목록엔 보이나 점검 403). 아래로 GET where 를 owner/org 로 스코프해
    //   목록 = 실행가능집합(POST 게이트와 동일), 과다노출 동시 해소.
    //   ⚠ Product 는 글로벌 카탈로그(userId/organizationId 없음) — 소유·스코프는 ProductInventory
    //     (userId/organizationId 보유)로만 가능. inventories relation 으로 스코프(SM-P4c-fix).
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });
    const userOrgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    // 필터 조건 구성
    const where: any = {};

    if (organizationId) {
      // 명시 org 스코프: 해당 org 의 safety_admin(VIEWER)/ADMIN 멤버 또는 플랫폼 ADMIN 만.
      const isMember = memberships.some(
        (m: { organizationId: string; role: OrganizationRole }) =>
          m.organizationId === organizationId &&
          (m.role === OrganizationRole.ADMIN || m.role === OrganizationRole.VIEWER)
      );
      if (!isMember && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: safety_admin or admin role required" },
          { status: 403 }
        );
      }
      // 해당 org 이 재고를 보유한 제품만(ProductInventory 스코프).
      where.inventories = { some: { organizationId } };
    } else {
      // 무파라미터(안전 페이지 기본): 세션 사용자/속한 org 이 재고 보유한 제품만 = POST 점검 게이트와 동일 집합.
      where.inventories = {
        some: userOrgIds.length > 0
          ? { OR: [{ userId: session.user.id }, { organizationId: { in: userOrgIds } }] }
          : { userId: session.user.id },
      };
    }

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
        hazardCodeProductIds = results.map((r: any) => r.id);
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
        pictogramProductIds = results.map((r: any) => r.id);
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

    // 카테고리 필터 — §SM-S1 (호영님 2026-07-05): 콤마구분 다중 카테고리 in[] 지원.
    //   단일 값(category=REAGENT)은 스칼라 유지 = 하위호환·무회귀. 복수(a,b)면 in[].
    //   기본 안전 대상은 REAGENT 이나, org 설정(safetyCategories, P1 operator)이
    //   RAW_MATERIAL 등을 추가하면 안전 페이지가 콤마구분으로 넘긴다.
    if (category) {
      const cats = category.split(",").map((c) => c.trim()).filter(Boolean);
      if (cats.length > 1) {
        where.category = { in: cats };
      } else if (cats.length === 1) {
        where.category = cats[0];
      }
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
            // §msds-version-validation — 버전상태 휴리스틱 분류 입력 메타 포함.
            select: {
              id: true,
              fileName: true,
              source: true,
              createdAt: true,
              docVersion: true,
              issuedAt: true,
              expiresAt: true,
              supersededAt: true,
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


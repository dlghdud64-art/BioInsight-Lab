import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 재고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 검색/필터 파라미터
    const search   = searchParams.get("search")?.trim()   || null; // 다중 필드 검색어
    const status   = searchParams.get("status")           || null; // "low" | "expired" | "expiring"
    const location = searchParams.get("location")?.trim() || null; // 보관 위치 부분 일치
    const category = searchParams.get("category")         || null; // ProductCategory enum 값

    // 하위 호환: lowStock=true 는 status=low 와 동일하게 처리
    const lowStock =
      searchParams.get("lowStock") === "true" || status === "low";

    // -----------------------------------------------------------------------
    // 소유권 조건 (userId OR organizationId)
    // -----------------------------------------------------------------------
    const ownerCondition: any = {
      OR: [
        { userId: session.user.id },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    };

    // -----------------------------------------------------------------------
    // AND 필터 목록 동적 구성
    // -----------------------------------------------------------------------
    const andFilters: any[] = [];

    // 1. 다중 필드 부분 일치 검색 (product 관계 필드 OR)
    //    대상: name(시약명), nameEn(영문명), catalogNumber(카탈로그 번호),
    //          lotNumber(로트 번호), brand(브랜드)
    //    + notes(비고): 운영자가 lotNo 등을 notes에 기록하는 경우 포함
    if (search) {
      andFilters.push({
        OR: [
          {
            product: {
              OR: [
                { name:          { contains: search, mode: "insensitive" } },
                { nameEn:        { contains: search, mode: "insensitive" } },
                { catalogNumber: { contains: search, mode: "insensitive" } },
                { lotNumber:     { contains: search, mode: "insensitive" } },
                { brand:         { contains: search, mode: "insensitive" } },
              ],
            },
          },
          // 재고 비고(notes)에서도 검색 (lotNo 등 메모 포함)
          { notes: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // 2. 보관 위치 부분 일치 (대소문자 무시)
    if (location) {
      andFilters.push({
        location: { contains: location, mode: "insensitive" },
      });
    }

    // 3. 카테고리 필터 (product.category 정확 일치, ProductCategory enum)
    if (category) {
      andFilters.push({
        product: { category },
      });
    }

    // 4. 재고 상태 필터
    if (lowStock) {
      // 안전 재고 이하: safetyStock 없으면 0 이하를 기준으로 판단
      andFilters.push({
        OR: [
          { safetyStock: { not: null }, currentQuantity: { lte: { safetyStock: true } } },
          { safetyStock: null,          currentQuantity: { lte: 0 } },
        ],
      });
    } else if (status === "expired") {
      // 유통기한 만료
      andFilters.push({ expiryDate: { lt: new Date() } });
    } else if (status === "expiring") {
      // 30일 이내 유통기한 만료 예정
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      andFilters.push({
        expiryDate: { gte: new Date(), lt: in30Days },
      });
    }

    // -----------------------------------------------------------------------
    // 최종 where 조건 조합
    // -----------------------------------------------------------------------
    const where: any = {
      ...ownerCondition,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const inventories = await db.productInventory.findMany({
      where,
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
              take: 1,
              orderBy: {
                priceInKRW: "asc",
              },
            },
          },
        },
        // 다중 Lot 표시를 위한 입고 이력 포함 (Lot 번호 + 유효기한만 조회)
        restockRecords: {
          select: {
            id: true,
            lotNumber: true,
            expiryDate: true,
            quantity: true,
          },
          orderBy: { restockedAt: "desc" },
        },
      },
      orderBy: {
        currentQuantity: "asc",
      },
    });

    return NextResponse.json({ inventories });
  } catch (error) {
    console.error("Error fetching inventories:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventories" },
      { status: 500 }
    );
  }
}

// 재고 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      productId: rawProductId,
      // 수기 입력 시 클라이언트가 전달하는 제품 메타 정보 (Find-or-Create 에 사용)
      productName,
      brand,
      catalogNumber,
      manufacturer,
      category: clientCategory,
      currentQuantity,
      unit,
      safetyStock,
      minOrderQty,
      location,
      expiryDate,
      notes,
      autoReorderEnabled,
      autoReorderThreshold,
      organizationId,
      // 아래 필드는 스키마에 없으므로 notes에 병합 처리
      lotNumber,
      testPurpose,
    } = body;

    // productId가 없거나 "manual-" 접두사(수기 임시 ID)인 경우 수기 입력으로 판별
    const isManual =
      !rawProductId ||
      (typeof rawProductId === "string" && rawProductId.startsWith("manual-"));

    // 수기 입력 시 품목명은 필수
    if (isManual && !productName?.trim()) {
      return NextResponse.json(
        { error: "수기 입력 시 품목명(productName)은 필수입니다." },
        { status: 400 }
      );
    }

    // notes에 testPurpose 병합 (lotNumber는 전용 DB 컬럼으로 저장)
    const mergedNotes = [
      notes,
      testPurpose ? `[시험항목: ${testPurpose}]` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

    // 공통 재고 데이터 (productId 제외)
    const inventoryData = {
      userId: organizationId ? null : session.user.id,
      organizationId: organizationId || null,
      currentQuantity: parseFloat(String(currentQuantity)) || 0,
      unit: unit || "ea",
      safetyStock:
        safetyStock !== undefined && safetyStock !== null && safetyStock !== ""
          ? parseFloat(String(safetyStock))
          : null,
      minOrderQty:
        minOrderQty !== undefined && minOrderQty !== null && minOrderQty !== ""
          ? parseFloat(String(minOrderQty))
          : null,
      location: location || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      lotNumber: lotNumber?.trim() || null,
      notes: mergedNotes,
      autoReorderEnabled: Boolean(autoReorderEnabled),
      autoReorderThreshold:
        autoReorderThreshold !== undefined &&
        autoReorderThreshold !== null &&
        autoReorderThreshold !== ""
          ? parseFloat(String(autoReorderThreshold))
          : null,
    };

    const inventoryInclude = {
      product: {
        include: {
          vendors: {
            include: { vendor: true },
            take: 1,
            orderBy: { priceInKRW: "asc" },
          },
        },
      },
    } as const;

    // -----------------------------------------------------------------------
    // 수기 입력 경로: Find-or-Create Product → Create Inventory (트랜잭션)
    // -----------------------------------------------------------------------
    if (isManual) {
      const resolvedBrand = (brand || manufacturer || "").trim() || null;
      const resolvedCatalog = (catalogNumber || "").trim() || null;
      const resolvedName = productName.trim();

      const inventory = await db.$transaction(async (tx: any) => {
        // 1. 동일 품목명+카탈로그번호로 기존 제품 검색 (중복 생성 방지)
        const existingProduct = await tx.product.findFirst({
          where: {
            name: { equals: resolvedName, mode: "insensitive" },
            ...(resolvedCatalog
              ? { catalogNumber: { equals: resolvedCatalog, mode: "insensitive" } }
              : {}),
          },
          select: { id: true },
        });

        // 2. 없으면 새 제품 마스터 생성
        const product = existingProduct
          ? existingProduct
          : await tx.product.create({
              data: {
                name: resolvedName,
                brand: resolvedBrand,
                catalogNumber: resolvedCatalog,
                manufacturer: resolvedBrand, // manufacturer 컬럼도 동일 값으로 저장
                category: clientCategory ?? "REAGENT", // 미지정 시 기본값 REAGENT
              },
              select: { id: true },
            });

        // 3. 중복 재고 확인 (동일 user/org + product)
        const duplicateCheck = organizationId
          ? await tx.productInventory.findFirst({
              where: { organizationId, productId: product.id },
            })
          : await tx.productInventory.findFirst({
              where: { userId: session.user.id, productId: product.id },
            });

        if (duplicateCheck) {
          // 트랜잭션 내에서 에러를 throw하면 롤백 처리됨
          throw Object.assign(new Error("이미 등록된 재고입니다. 수정 기능을 이용해 주세요."), {
            statusCode: 409,
          });
        }

        // 4. 재고 생성 (Find-or-Create 된 productId 사용)
        return await tx.productInventory.create({
          data: { productId: product.id, ...inventoryData },
          include: inventoryInclude,
        });
      });

      return NextResponse.json({ inventory }, { status: 201 });
    }

    // -----------------------------------------------------------------------
    // 기존 경로: productId로 직접 조회 후 재고 생성
    // -----------------------------------------------------------------------
    const productId = rawProductId as string;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json(
        { error: "존재하지 않는 제품입니다." },
        { status: 404 }
      );
    }

    // 중복 재고 확인 (동일 user/org + product)
    const existing = organizationId
      ? await db.productInventory.findFirst({
          where: { organizationId, productId },
        })
      : await db.productInventory.findFirst({
          where: { userId: session.user.id, productId },
        });

    if (existing) {
      return NextResponse.json(
        { error: "이미 등록된 재고입니다. 수정 기능을 이용해 주세요." },
        { status: 409 }
      );
    }

    const inventory = await db.productInventory.create({
      data: { productId, ...inventoryData },
      include: inventoryInclude,
    });

    return NextResponse.json({ inventory }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating inventory:", error);
    const status = error?.statusCode ?? 500;
    return NextResponse.json(
      { error: error.message || "재고 등록에 실패했습니다." },
      { status }
    );
  }
}

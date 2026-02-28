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
      productId,
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

    if (!productId) {
      return NextResponse.json(
        { error: "productId는 필수입니다." },
        { status: 400 }
      );
    }

    // 제품 존재 여부 확인
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

    // notes에 lotNumber, testPurpose 병합 (스키마 미지원 필드)
    const mergedNotes = [
      notes,
      lotNumber ? `[Lot: ${lotNumber}]` : null,
      testPurpose ? `[시험항목: ${testPurpose}]` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

    const inventory = await db.productInventory.create({
      data: {
        productId,
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
        notes: mergedNotes,
        autoReorderEnabled: Boolean(autoReorderEnabled),
        autoReorderThreshold:
          autoReorderThreshold !== undefined &&
          autoReorderThreshold !== null &&
          autoReorderThreshold !== ""
            ? parseFloat(String(autoReorderThreshold))
            : null,
      },
      include: {
        product: {
          include: {
            vendors: {
              include: { vendor: true },
              take: 1,
              orderBy: { priceInKRW: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ inventory }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating inventory:", error);
    return NextResponse.json(
      { error: error.message || "재고 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}

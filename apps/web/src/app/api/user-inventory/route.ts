import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// =====================================================
// 타입 정의 (Type Safety 보장)
// =====================================================

const InventoryStatus = {
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
} as const;

type InventoryStatusType = (typeof InventoryStatus)[keyof typeof InventoryStatus];

// 쿼리 파라미터 검증 스키마
const querySchema = z.object({
  status: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "all"]).optional(),
  location: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["receivedAt", "productName", "quantity", "location"]).default("receivedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// PATCH 요청 바디 검증 스키마
const updateSchema = z.object({
  location: z.string().min(1).max(100).optional(),
  quantity: z.number().int().min(0).optional(),
  status: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  notes: z.string().max(1000).optional(),
});

// =====================================================
// GET /api/user-inventory
// 사용자 인벤토리 조회 API (배송 완료 품목)
//
// [Architecture Decision]
// - Performance: userId 인덱스 기반 최적화 쿼리
// - Sorting: 최신 입고품(receivedAt desc) 기본 정렬
// - Data: 위치 미지정(Unassigned) 상태 즉시 식별 가능
// =====================================================

export async function GET(req: NextRequest) {
  try {
    // 1. 인증 검증 (필수)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. 쿼리 파라미터 파싱 및 검증 (Zod 스키마)
    const searchParams = req.nextUrl.searchParams;
    const parseResult = querySchema.safeParse({
      status: searchParams.get("status") || undefined,
      location: searchParams.get("location") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      sortBy: searchParams.get("sortBy") || "receivedAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "잘못된 요청 파라미터입니다.",
          code: "INVALID_PARAMS",
          details: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { status, location, search, page, limit, sortBy, sortOrder } = parseResult.data;

    // 3. WHERE 조건 구성 (userId 기반 - @@index([userId]) 활용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId, // Primary filter - 인덱스 최적화
    };

    // 상태 필터
    if (status && status !== "all") {
      where.status = status as InventoryStatusType;
    }

    // 위치 필터 ("unassigned" = "미지정")
    if (location) {
      if (location === "unassigned") {
        where.location = "미지정";
      } else {
        where.location = location;
      }
    }

    // 검색 필터 (제품명, 카탈로그번호, 브랜드)
    if (search && search.trim()) {
      where.OR = [
        { productName: { contains: search.trim(), mode: "insensitive" } },
        { catalogNumber: { contains: search.trim(), mode: "insensitive" } },
        { brand: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    // 4. 병렬 쿼리 실행 (총 개수 + 데이터 + 통계 + 위치그룹)
    const [totalCount, items, stats, locationGroups] = await Promise.all([
      db.userInventory.count({ where }),
      db.userInventory.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          productName: true,
          brand: true,
          catalogNumber: true,
          quantity: true,
          unit: true,
          location: true,
          status: true,
          notes: true,
          orderId: true,
          orderItemId: true,
          receivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.userInventory.groupBy({
        by: ["status"],
        where: { userId },
        _count: { id: true },
      }),
      db.userInventory.groupBy({
        by: ["location"],
        where: { userId },
        _count: { id: true },
      }),
    ]);

    // 5. 응답 데이터 구성
    const totalPages = Math.ceil(totalCount / limit);

    const statusCounts: Record<string, number> = {
      IN_STOCK: 0,
      LOW_STOCK: 0,
      OUT_OF_STOCK: 0,
      total: 0,
    };

    stats.forEach((stat) => {
      const count = stat._count.id;
      statusCounts[stat.status] = count;
      statusCounts.total += count;
    });

    const locations = locationGroups
      .map((loc) => ({
        name: loc.location,
        count: loc._count.id,
        isUnassigned: loc.location === "미지정",
      }))
      .sort((a, b) => {
        if (a.isUnassigned) return -1;
        if (b.isUnassigned) return 1;
        return a.name.localeCompare(b.name, "ko");
      });

    const unassignedCount = locations.find((l) => l.isUnassigned)?.count || 0;

    return NextResponse.json({
      success: true,
      data: {
        items: items.map((item) => ({
          ...item,
          isUnassigned: item.location === "미지정",
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        stats: {
          ...statusCounts,
          unassignedCount,
        },
        locations,
      },
    });

  } catch (error) {
    console.error("[UserInventory GET] Error:", error);
    return NextResponse.json(
      { error: "인벤토리 조회 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH /api/user-inventory
// 사용자 인벤토리 수정 API
//
// [Data Integrity Rules]
// - 소유권 검증: 요청자가 해당 인벤토리의 userId와 일치해야 함
// - 수량 방어: quantity는 0 미만으로 내려갈 수 없음
// - 상태 자동 갱신: 수량에 따라 status 자동 조정
// =====================================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 JSON 형식입니다.", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const { id, ...updateFields } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "인벤토리 ID가 필요합니다.", code: "MISSING_ID" },
        { status: 400 }
      );
    }

    const parseResult = updateSchema.safeParse(updateFields);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "잘못된 업데이트 데이터입니다.",
          code: "INVALID_DATA",
          details: parseResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    if (Object.keys(validatedData).length === 0) {
      return NextResponse.json(
        { error: "업데이트할 필드가 없습니다.", code: "NO_UPDATE_FIELDS" },
        { status: 400 }
      );
    }

    // 소유권 검증 (엄격한 검사 - 데이터 무결성 보장)
    const existing = await db.userInventory.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        quantity: true,
        status: true,
        location: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "인벤토리를 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: "이 인벤토리에 대한 접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (validatedData.location !== undefined) {
      updateData.location = validatedData.location;
    }

    if (validatedData.quantity !== undefined) {
      const newQuantity = Math.max(0, validatedData.quantity);
      updateData.quantity = newQuantity;

      if (validatedData.status === undefined) {
        if (newQuantity === 0) {
          updateData.status = "OUT_OF_STOCK";
        } else if (newQuantity < 5) {
          updateData.status = "LOW_STOCK";
        } else {
          updateData.status = "IN_STOCK";
        }
      }
    }

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    const updated = await db.userInventory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "인벤토리가 업데이트되었습니다.",
      data: {
        inventory: {
          ...updated,
          isUnassigned: updated.location === "미지정",
        },
        changes: {
          ...(validatedData.location !== undefined && {
            location: { from: existing.location, to: updated.location }
          }),
          ...(validatedData.quantity !== undefined && {
            quantity: { from: existing.quantity, to: updated.quantity }
          }),
          ...(updateData.status && updateData.status !== existing.status && {
            status: { from: existing.status, to: updated.status }
          }),
        },
      },
    });

  } catch (error) {
    console.error("[UserInventory PATCH] Error:", error);
    return NextResponse.json(
      { error: "인벤토리 업데이트 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

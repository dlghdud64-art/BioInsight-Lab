import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// =====================================================
// 쿼리 파라미터 스키마
// =====================================================

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["PENDING", "COMPLETED", "REJECTED", "PURCHASED", "all"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "quoteNumber", "totalAmount", "validUntil"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// =====================================================
// GET /api/quotes/my
// 내 견적 보관함 목록 조회 API
//
// [Features]
// - 페이지네이션, 상태 필터, 검색
// - 유효기간 만료 여부 표시
// - 통계 정보 (상태별 카운트)
// =====================================================

export async function GET(req: NextRequest) {
  try {
    // 1. 인증 검증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. 쿼리 파라미터 파싱
    const searchParams = req.nextUrl.searchParams;
    const parseResult = querySchema.safeParse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "잘못된 요청 파라미터입니다.",
          code: "INVALID_PARAMS",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { page, limit, status, search, sortBy, sortOrder } = parseResult.data;

    // 3. WHERE 조건 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId,
      quoteNumber: { not: null }, // 견적번호가 있는 것만 (장바구니 기반 견적)
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { quoteNumber: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    // 4. 병렬 쿼리 실행
    const [totalCount, quotes, statusStats] = await Promise.all([
      db.quote.count({ where }),
      db.quote.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          quoteNumber: true,
          title: true,
          description: true,
          status: true,
          totalAmount: true,
          currency: true,
          validUntil: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { items: true },
          },
        },
      }),
      db.quote.groupBy({
        by: ["status"],
        where: { userId, quoteNumber: { not: null } },
        _count: { id: true },
      }),
    ]);

    // 5. 응답 데이터 구성
    const totalPages = Math.ceil(totalCount / limit);
    const now = new Date();

    // 상태별 카운트
    const stats = {
      total: 0,
      PENDING: 0,
      COMPLETED: 0,
      REJECTED: 0,
      PURCHASED: 0,
      expired: 0,
    };

    statusStats.forEach((stat: any) => {
      stats[stat.status as keyof typeof stats] = stat._count.id;
      stats.total += stat._count.id;
    });

    // 만료된 견적 수 계산
    const expiredCount = await db.quote.count({
      where: {
        userId,
        quoteNumber: { not: null },
        validUntil: { lt: now },
        status: "PENDING",
      },
    });
    stats.expired = expiredCount;

    return NextResponse.json({
      success: true,
      data: {
        quotes: quotes.map((quote: any) => ({
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          title: quote.title,
          description: quote.description,
          status: quote.status,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
          validUntil: quote.validUntil,
          isExpired: quote.validUntil ? quote.validUntil < now : false,
          itemCount: quote._count.items,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        stats,
      },
    });

  } catch (error) {
    console.error("[Quotes/My] Error:", error);
    return NextResponse.json(
      { error: "견적 목록 조회 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

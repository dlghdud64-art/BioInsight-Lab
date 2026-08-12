import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 벤더가 받은 견적 요청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // 개발 모드: 인증 없이도 데모 데이터 조회 가능
    // TODO: 프로덕션에서는 인증 필수로 변경
    let vendor = null;

    if (session?.user?.id) {
      // 사용자의 역할 확인
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, email: true },
      });

      // 사용자 이메일로 벤더 찾기
      if (user?.email) {
        vendor = await db.vendor.findFirst({
          where: { email: user.email },
        });
      }
    }

    // 벤더가 없으면 데모용 첫 번째 벤더 사용
    if (!vendor) {
      vendor = await db.vendor.findFirst({
        orderBy: { createdAt: "asc" },
      });
    }

    if (!vendor) {
      return NextResponse.json({
        quotes: [],
        stats: {
          totalQuotes: 0,
          thisMonthQuotes: 0,
          totalResponses: 0,
          responseRate: 0,
          successRate: 0,
        },
        message: "등록된 벤더가 없습니다.",
      });
    }

    // 벤더 ID로 필터링: 견적 요청의 품목 중 이 벤더가 공급하는 제품이 포함된 견적만 조회
    const quotes = await db.quote.findMany({
      where: {
        items: {
          some: {
            product: {
              vendors: {
                some: {
                  vendorId: vendor.id,
                },
              },
            },
          },
        },
        // 이미 응답한 견적은 제외 (선택사항)
        // responses: {
        //   none: {
        //     vendorId: vendor.id,
        //   },
        // },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
                  where: {
                    vendorId: vendor.id,
                  },
                  include: {
                    vendor: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
        responses: {
          include: {
            vendor: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        organization: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // 최근 50개만
    });

    // 통계 계산
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthQuotes = quotes.filter(
      (q: any) => new Date(q.createdAt) >= startOfMonth
    ).length;

    // 이 벤더의 응답 수 계산
    const totalResponses = quotes.reduce(
      (acc: number, q: any) =>
        acc + (q.responses?.filter((r: any) => r.vendorId === vendor.id).length || 0),
      0
    );

    const responseRate =
      quotes.length > 0 ? Math.round((totalResponses / quotes.length) * 100) : 0;

    // 성공률 (완료된 견적 중 이 벤더가 선택된 비율) - 임시로 0
    const successRate = 0;

    return NextResponse.json({
      quotes,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        isPremium: false, // TODO: 프리미엄 상태 추가
      },
      stats: {
        totalQuotes: quotes.length,
        thisMonthQuotes,
        totalResponses,
        responseRate,
        successRate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching vendor quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
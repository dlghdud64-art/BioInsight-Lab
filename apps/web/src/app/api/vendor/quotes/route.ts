import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 벤더가 받은 견적 요청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자의 역할 확인
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    // SUPPLIER 역할이 아니면 빈 결과 반환
    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ quotes: [] });
    }

    // 사용자 이메일로 벤더 찾기 (임시: 실제로는 User-Vendor 관계 테이블이 필요)
    const vendor = await db.vendor.findFirst({
      where: {
        email: user.email || "",
      },
    });

    if (!vendor) {
      // 보안 강화: 등록되지 않은 벤더는 빈 결과 반환
      // 개발 환경에서만 경고 로그 출력
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[Vendor Portal] Unregistered vendor attempted access: ${user.email}`
        );
      }
      return NextResponse.json({
        quotes: [],
        message: "벤더 등록이 필요합니다. 관리자에게 문의하세요.",
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

    return NextResponse.json({ quotes });
  } catch (error: any) {
    console.error("Error fetching vendor quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
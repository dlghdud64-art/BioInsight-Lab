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

    // TODO: 실제로는 벤더 ID로 필터링해야 함
    // 현재는 모든 견적 요청을 반환 (개발용)
    const quotes = await db.quote.findMany({
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
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

import { db } from "@/lib/db";

// 벤더가 받은 견적 요청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: 실제로는 벤더 ID로 필터링해야 함
    // 현재는 모든 견적 요청을 반환 (개발용)
    const quotes = await db.quote.findMany({
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
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

import { db } from "@/lib/db";

// 벤더가 받은 견적 요청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: 실제로는 벤더 ID로 필터링해야 함
    // 현재는 모든 견적 요청을 반환 (개발용)
    const quotes = await db.quote.findMany({
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
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

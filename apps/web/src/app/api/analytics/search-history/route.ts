import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 검색 기록 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { query, intent, category, filters, resultCount, clickedProductId } = body;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const searchHistory = await db.searchHistory.create({
      data: {
        userId: session?.user?.id || null,
        query,
        intent: intent ? JSON.parse(JSON.stringify(intent)) : null,
        category: category || null,
        filters: filters ? JSON.parse(JSON.stringify(filters)) : null,
        resultCount: resultCount || null,
        clickedProductId: clickedProductId || null,
      },
    });

    return NextResponse.json({ success: true, id: searchHistory.id });
  } catch (error) {
    console.error("Error saving search history:", error);
    return NextResponse.json(
      { error: "Failed to save search history" },
      { status: 500 }
    );
  }
}

// 사용자별 검색 기록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!session?.user?.id) {
      return NextResponse.json({ searches: [] });
    }

    const searches = await db.searchHistory.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
          },
        },
      },
    });

    return NextResponse.json({ searches });
  } catch (error) {
    console.error("Error fetching search history:", error);
    return NextResponse.json(
      { error: "Failed to fetch search history" },
      { status: 500 }
    );
  }
}


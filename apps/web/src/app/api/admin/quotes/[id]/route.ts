import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 관리자용 견적 상세 조회 API
 * GET /api/admin/quotes/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // §drift D1 — `listItems` 는 Quote 의 관계가 아니다(QuoteListItem 관계명은 `items`).
        //   같은 include 에 `items` 가 이미 있었으므로 **중복 키를 제거**한 것이지 rename 이 아니다.
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("Error fetching admin quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

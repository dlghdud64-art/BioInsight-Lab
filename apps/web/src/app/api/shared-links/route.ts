import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 사용자가 생성한 공유 링크 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자가 생성한 공유 링크 조회
    const sharedLinks = await db.sharedList.findMany({
      where: {
        createdBy: session.user.id,
      },
      include: {
        quote: {
          select: {
            id: true,
            title: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ sharedLinks });
  } catch (error: any) {
    console.error("Error fetching shared links:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared links" },
      { status: 500 }
    );
  }
}


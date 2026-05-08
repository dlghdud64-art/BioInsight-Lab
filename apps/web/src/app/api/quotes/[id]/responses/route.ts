import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 응답 목록 조회
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
        responses: {
          include: {
            vendor: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" }, { status: 404 });
    }

    // #quote-responses-organization-scope — info leak 차단.
    //   ownership check: user owner OR organization member.
    //   404 fallback (existence leak avoidance) 일관 — "not yours" 노출 0.
    //   vendor-requests / share / select-reply cluster 동일 sweep pattern.
    const isOwner = quote.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: quote.organizationId,
        },
        select: { id: true },
      });
      isOrgMember = !!membership;
    }

    if (!isOwner && !isOrgMember) {
      // existence leak avoidance — same response as not-found.
      return NextResponse.json({ error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ responses: quote.responses });
  } catch (error: any) {
    console.error("Error fetching quote responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }
}

// 견적 응답 생성
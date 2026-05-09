import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 견적 상태 변경 이력 조회
 * GET /api/quotes/[id]/history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // #quote-multi-user-ownership-sweep-final — info leak 차단.
    //   ownership check: user owner OR organization member.
    //   404 fallback (existence leak avoidance).
    const quote = await db.quote.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, organizationId: true },
    });
    if (!quote) {
      return NextResponse.json(
        { error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    const isOwner = quote.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: quote.organizationId },
        select: { id: true },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      // existence leak avoidance — same response as not-found.
      return NextResponse.json(
        { error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const logs = await db.activityLog.findMany({
      where: {
        entityType: "quote",
        entityId: params.id,
        activityType: "QUOTE_STATUS_CHANGED",
      },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const history = logs.map((log: any) => ({
      id: log.id,
      previousStatus: (log.metadata as any)?.previousStatus ?? null,
      newStatus: (log.metadata as any)?.newStatus ?? null,
      reason: (log.metadata as any)?.reason ?? null,
      changedBy: log.user?.name || log.user?.email || "시스템",
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching quote history:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote history" },
      { status: 500 }
    );
  }
}

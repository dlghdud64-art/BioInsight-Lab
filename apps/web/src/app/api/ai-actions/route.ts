import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AiActionStatus, AiActionType } from "@prisma/client";

/**
 * GET /api/ai-actions — AI 작업함 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as AiActionStatus | null;
    const type = searchParams.get("type") as AiActionType | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      db.aiActionItem.findMany({
        where,
        orderBy: [
          { priority: "asc" }, // HIGH(0) first
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          status: true,
          priority: true,
          title: true,
          description: true,
          relatedEntityType: true,
          relatedEntityId: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
      db.aiActionItem.count({ where }),
    ]);

    // PENDING 카운트 (배지용)
    const pendingCount = await db.aiActionItem.count({
      where: { userId: session.user.id, status: AiActionStatus.PENDING },
    });

    return NextResponse.json({ items, total, pendingCount });
  } catch (error) {
    console.error("Error fetching AI actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI actions" },
      { status: 500 }
    );
  }
}

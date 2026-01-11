import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 팀 인벤토리 조회 (팀 멤버들의 모든 인벤토리)
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

    const { id: teamId } = await params;

    // 팀 멤버인지 확인 (Multi-tenancy isolation)
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!userMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    // 팀 멤버 목록 조회
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });

    const memberIds = teamMembers.map((m: any) => m.userId);

    // 팀 멤버들의 인벤토리 조회
    const inventories = await db.userInventory.findMany({
      where: {
        userId: {
          in: memberIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        receivedAt: "desc",
      },
    });

    return NextResponse.json({ inventories });
  } catch (error) {
    console.error("Error fetching team inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch team inventory" },
      { status: 500 }
    );
  }
}



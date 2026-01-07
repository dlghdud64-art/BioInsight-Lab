import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 사용자의 팀 역할 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    // 팀 멤버 조회
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json({
        isTeamMember: false,
        role: null,
        team: null,
      });
    }

    return NextResponse.json({
      isTeamMember: true,
      role: teamMember.role,
      team: teamMember.team,
    });
  } catch (error) {
    console.error("Error fetching user team role:", error);
    return NextResponse.json(
      { error: "Failed to fetch user team role" },
      { status: 500 }
    );
  }
}



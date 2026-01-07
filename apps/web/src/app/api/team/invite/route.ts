import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";

/**
 * 팀 멤버 초대
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, email, role = TeamRole.MEMBER } = body;

    if (!teamId || !email) {
      return NextResponse.json(
        { error: "Team ID and email are required" },
        { status: 400 }
      );
    }

    // 권한 확인: OWNER 또는 ADMIN만 초대 가능
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!teamMember || (teamMember.role !== TeamRole.OWNER && teamMember.role !== TeamRole.ADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Only OWNER or ADMIN can invite members" },
        { status: 403 }
      );
    }

    // 사용자 찾기 (이메일로)
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 404 }
      );
    }

    // 이미 팀 멤버인지 확인
    const existingMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this team" },
        { status: 400 }
      );
    }

    // 팀 멤버 추가
    const newMember = await db.teamMember.create({
      data: {
        userId: user.id,
        teamId,
        role: role as TeamRole,
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
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { error: "Failed to invite team member" },
      { status: 500 }
    );
  }
}



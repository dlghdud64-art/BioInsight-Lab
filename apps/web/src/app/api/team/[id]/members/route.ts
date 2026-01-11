import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TeamRole } from "@prisma/client";

/**
 * 팀 멤버 목록 조회
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
    const members = await db.teamMember.findMany({
      where: { teamId },
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
      orderBy: [
        { role: "asc" }, // OWNER, ADMIN, MEMBER 순서
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({
      members: members.map((m: any) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

/**
 * 팀 멤버 역할 변경
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json(
        { error: "memberId and role are required" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 역할 변경 가능
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!userMember || (userMember.role !== TeamRole.ADMIN && userMember.role !== TeamRole.ADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN or OWNER can change roles" },
        { status: 403 }
      );
    }

    // 대상 멤버 확인
    const targetMember = await db.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // OWNER 역할은 변경 불가
    if (targetMember.role === TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "Cannot change OWNER role" },
        { status: 400 }
      );
    }

    // 역할 업데이트
    const updatedMember = await db.teamMember.update({
      where: { id: memberId },
      data: { role: role as TeamRole },
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

    return NextResponse.json({
      member: {
        id: updatedMember.id,
        userId: updatedMember.user.id,
        name: updatedMember.user.name,
        email: updatedMember.user.email,
        image: updatedMember.user.image,
        role: updatedMember.role,
        joinedAt: updatedMember.createdAt,
      },
    });
  } catch (error) {
    console.error("Error updating team member role:", error);
    return NextResponse.json(
      { error: "Failed to update team member role" },
      { status: 500 }
    );
  }
}

/**
 * 팀 멤버 제거
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 멤버 제거 가능
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!userMember || (userMember.role !== TeamRole.ADMIN && userMember.role !== TeamRole.ADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN or OWNER can remove members" },
        { status: 403 }
      );
    }

    // 대상 멤버 확인
    const targetMember = await db.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // OWNER는 제거 불가
    if (targetMember.role === TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "Cannot remove OWNER" },
        { status: 400 }
      );
    }

    // 자기 자신은 제거 불가
    if (targetMember.userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    // 멤버 제거
    await db.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}



import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { enforceAction } from "@/lib/security/server-enforcement-middleware";

// 조직 멤버 조회 API
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
    const members = await db.organizationMember.findMany({
      where: { organizationId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization members" },
      { status: 500 }
    );
  }
}

// 멤버 역할 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { memberId, role } = body;

    // ── Security enforcement ──
    const enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'member_role_change',
      targetEntityType: 'organization',
      targetEntityId: memberId || id,
      sourceSurface: 'org-members-api',
      routePath: '/api/organizations/[id]/members',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (!memberId || !role) {
      return NextResponse.json(
        { error: "memberId and role are required" },
        { status: 400 }
      );
    }

    // 관리자 권한 확인 (OWNER 또는 ADMIN)
    const requesterMembership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
      },
    });

    if (!requesterMembership) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // OrganizationRole enum 유효성 검증 (OWNER는 직접 할당 불가)
    const validRoles: string[] = Object.values(OrganizationRole).filter((r) => r !== OrganizationRole.OWNER);
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Valid roles: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // 보안: 대상 멤버가 해당 조직에 속하는지 검증 (Cross-Organization Attack 방지)
    const targetMember = await db.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: id,
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found in this organization" },
        { status: 404 }
      );
    }

    // OWNER는 역할 변경 불가 (보안: 최고 관리자 보호)
    if (targetMember.role === OrganizationRole.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Cannot change the role of the organization owner" },
        { status: 403 }
      );
    }

    // 역할 변경
    const updatedMember = await db.organizationMember.update({
      where: {
        id: memberId,
        organizationId: id, // 조직 ID 추가 검증
      },
      data: { role: role as OrganizationRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    enforcement.complete({
      beforeState: { memberId, previousRole: targetMember.role },
      afterState: { memberId, newRole: role },
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error: any) {
    enforcement.fail();
    console.error("Error updating member role:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
}

// 멤버 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    // 관리자 권한 확인 (OWNER 또는 ADMIN)
    const requesterMembershipForDelete = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
      },
    });

    if (!requesterMembershipForDelete) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 보안: 대상 멤버가 해당 조직에 속하는지 검증 (Cross-Organization Attack 방지)
    const memberToDelete = await db.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: id,
      },
    });

    if (!memberToDelete) {
      return NextResponse.json(
        { error: "Member not found in this organization" },
        { status: 404 }
      );
    }

    // OWNER는 삭제 불가 (보안: 최고 관리자 보호)
    if (memberToDelete.role === OrganizationRole.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Cannot remove the organization owner" },
        { status: 403 }
      );
    }

    // 자기 자신은 삭제 불가
    if (memberToDelete.userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    // 멤버 삭제
    await db.organizationMember.delete({
      where: {
        id: memberId,
        organizationId: id, // 조직 ID 추가 검증
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}

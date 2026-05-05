import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { z } from "zod";
// #approver-routing-per-user-limit-organization-member-admin-ui Phase 2 —
// approvalLimit 변경 audit (best effort, mutation atomic 보호).
import { createAuditLog } from "@/lib/audit/audit-logger";

// #approver-routing-per-user-limit-organization-member-admin-ui — zod schema.
// role + approvalLimit 둘 다 optional (partial update). approvalLimit
// nullable (null = 무제한 reset).
const updateOrgMemberSchema = z.object({
  memberId: z.string(),
  role: z.nativeEnum(OrganizationRole).optional(),
  approvalLimit: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
});

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { memberId, role, approvalLimit } = updateOrgMemberSchema.parse(body);

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'member_role_change',
      targetEntityType: 'organization',
      targetEntityId: memberId || id,
      sourceSurface: 'org-members-api',
      routePath: '/api/organizations/[id]/members',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }
    // role + approvalLimit 둘 다 미명시 → 변경 사항 0
    if (role === undefined && approvalLimit === undefined) {
      return NextResponse.json(
        { error: "At least one of role or approvalLimit must be provided" },
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

    // OrganizationRole enum 유효성 검증 (OWNER는 직접 할당 불가). role 변경 시만 검증.
    if (role !== undefined) {
      const validRoles: string[] = Object.values(OrganizationRole).filter((r) => r !== OrganizationRole.OWNER);
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Valid roles: ${validRoles.join(", ")}` },
          { status: 400 }
        );
      }
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

    // OWNER는 역할 변경 불가 (보안: 최고 관리자 보호). approvalLimit 단독
    // 변경은 OWNER 도 가능 (cluster 결재 정합 — 본인 한도 설정).
    if (role !== undefined && targetMember.role === OrganizationRole.OWNER) {
      return NextResponse.json(
        { error: "Forbidden: Cannot change the role of the organization owner" },
        { status: 403 }
      );
    }

    // #approver-routing-per-user-limit-organization-member-admin-ui — audit
    // before snapshot capture (approvalLimit 변경 시만).
    const beforeApprovalLimit = approvalLimit !== undefined ? targetMember.approvalLimit : null;

    // 역할 + approvalLimit 변경 (partial update — 둘 중 하나라도)
    const updatedMember = await db.organizationMember.update({
      where: {
        id: memberId,
        organizationId: id, // 조직 ID 추가 검증
      },
      data: {
        ...(role !== undefined && { role: role as OrganizationRole }),
        ...(approvalLimit !== undefined && { approvalLimit }),
      },
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
      afterState: { memberId, newRole: role ?? targetMember.role },
    });

    // #approver-routing-per-user-limit-organization-member-admin-ui — audit
    // log (best effort, mutation 정합 보호). approvalLimit 변경 시만.
    if (approvalLimit !== undefined) {
      try {
        await createAuditLog({
          organizationId: id,
          userId: session.user.id,
          eventType: "MEMBER_APPROVAL_LIMIT_CHANGED" as never,
          entityType: "ORGANIZATION_MEMBER",
          entityId: memberId,
          action: "approval_limit_update",
          changes: {
            before: { approvalLimit: beforeApprovalLimit },
            after: { approvalLimit },
          },
          metadata: {
            targetUserId: targetMember.userId,
            organizationId: id,
          },
        });
      } catch (auditErr) {
        // graceful — mutation 정합 유지
        console.error("[org/members/PATCH] approvalLimit audit log 실패 (mutation 정합 유지):", auditErr);
      }
    }

    return NextResponse.json({ member: updatedMember });
  } catch (error: any) {
    enforcement?.fail();
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

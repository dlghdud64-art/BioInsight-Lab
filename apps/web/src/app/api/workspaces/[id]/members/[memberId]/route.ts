import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
// #approver-routing-per-user-limit-audit-log — approvalLimit 변경 audit 추적성.
// best effort (try/catch graceful — mutation atomic 보호).
import { createAuditLog, auditRequestMeta } from "@/lib/audit/audit-logger";

const logger = createLogger("api/workspaces/[id]/members/[memberId]");

// #approver-routing-per-user-limit-admin-ui — role + approvalLimit 둘 다
// optional (partial update 호환). approvalLimit nullable (null = 무제한).
const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  approvalLimit: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
});

/**
 * Verify user has admin access to workspace
 */
async function verifyAdminAccess(workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
    },
  });

  if (!member) {
    throw new Error("Workspace not found or access denied");
  }

  if (member.role !== "ADMIN") {
    throw new Error("Admin permission required");
  }

  return member;
}

/**
 * PATCH /api/workspaces/[id]/members/[memberId]
 * Update member role (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: workspaceId, memberId } = params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'workspace_manage',
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
      sourceSurface: 'workspaces-api',
      routePath: '/api/workspaces/[id]/members/[memberId]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // Verify admin access
    await verifyAdminAccess(workspaceId, session.user.id);

    const body = await request.json();
    const { role, approvalLimit } = updateMemberSchema.parse(body);

    // #approver-routing-per-user-limit-audit-log — approvalLimit 변경 시
    // before snapshot capture (audit log 의 changes.before).
    const beforeMember =
      approvalLimit !== undefined
        ? await db.workspaceMember.findUnique({
            where: { id: memberId },
            select: {
              userId: true,
              approvalLimit: true,
              workspace: { select: { organizationId: true } },
            },
          })
        : null;

    // Prevent demoting the last admin
    if (role === "MEMBER") {
      const adminCount = await db.workspaceMember.count({
        where: {
          workspaceId,
          role: "ADMIN",
        },
      });

      const targetMember = await db.workspaceMember.findUnique({
        where: { id: memberId },
      });

      if (targetMember?.role === "ADMIN" && adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin" },
          { status: 400 }
        );
      }
    }

    // #approver-routing-per-user-limit-admin-ui — role 단독 / approvalLimit
    // 단독 / 둘 다 변경 모두 지원 (partial update). approvalLimit === null
    // 명시 시 무제한 reset.
    const updatedMember = await db.workspaceMember.update({
      where: { id: memberId },
      data: {
        ...(role !== undefined && { role }),
        ...(approvalLimit !== undefined && { approvalLimit }),
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

    logger.info(`Member role updated`, {
      workspaceId,
      memberId,
      newRole: role,
      updatedBy: session.user.id,
    });

    // #approver-routing-per-user-limit-audit-log — approvalLimit 변경 시
    // audit log (best effort, mutation atomic 외 try/catch graceful).
    if (approvalLimit !== undefined && beforeMember) {
      try {
        await createAuditLog({
          organizationId: beforeMember.workspace?.organizationId ?? undefined,
          userId: session.user.id,
          eventType: "MEMBER_APPROVAL_LIMIT_CHANGED" as never,
          entityType: "WORKSPACE_MEMBER",
          entityId: memberId,
          action: "approval_limit_update",
          ...auditRequestMeta(request), // §11.345-B4 — IP/UA 캡처
          changes: {
            before: { approvalLimit: beforeMember.approvalLimit },
            after: { approvalLimit },
          },
          metadata: {
            targetUserId: beforeMember.userId,
            workspaceId,
          },
        });
      } catch (auditErr) {
        // graceful — mutation 정합 유지
        logger.error("[members/PATCH] approvalLimit audit log 실패 (mutation 정합 유지)", auditErr);
      }
    }

    enforcement.complete({});
    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    enforcement?.fail();
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return handleApiError(error, "workspaces/[id]/members/[memberId]");
  }
}

/**
 * DELETE /api/workspaces/[id]/members/[memberId]
 * Remove member from workspace (admin only, or self-removal)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: workspaceId, memberId } = params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'workspace_manage',
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
      sourceSurface: 'workspaces-api',
      routePath: '/api/workspaces/[id]/members/[memberId]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const targetMember = await db.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Allow self-removal or admin removal
    const isSelf = targetMember.userId === session.user.id;

    if (!isSelf) {
      // Verify admin access for removing others
      await verifyAdminAccess(workspaceId, session.user.id);
    }

    // Prevent removing the last admin
    if (targetMember.role === "ADMIN") {
      const adminCount = await db.workspaceMember.count({
        where: {
          workspaceId,
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin" },
          { status: 400 }
        );
      }
    }

    await db.workspaceMember.delete({
      where: { id: memberId },
    });

    logger.info(`Member removed from workspace`, {
      workspaceId,
      memberId,
      removedBy: session.user.id,
      isSelfRemoval: isSelf,
    });

    enforcement.complete({});
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]/members/[memberId]");
  }
}

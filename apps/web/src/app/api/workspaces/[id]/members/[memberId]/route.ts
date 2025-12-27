import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api/workspaces/[id]/members/[memberId]");

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
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
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: workspaceId, memberId } = params;

    // Verify admin access
    await verifyAdminAccess(workspaceId, session.user.id);

    const body = await request.json();
    const { role } = updateMemberSchema.parse(body);

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

    const updatedMember = await db.workspaceMember.update({
      where: { id: memberId },
      data: { role },
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

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
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
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: workspaceId, memberId } = params;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]/members/[memberId]");
  }
}

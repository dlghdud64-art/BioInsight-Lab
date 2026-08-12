import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/workspaces/[id]/members");

/**
 * Verify user has access to workspace
 */
async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requiredRole?: "ADMIN" | "MEMBER"
) {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
    },
  });

  if (!member) {
    throw new Error("Workspace not found or access denied");
  }

  if (requiredRole === "ADMIN" && member.role !== "ADMIN") {
    throw new Error("Admin permission required");
  }

  return member;
}

/**
 * GET /api/workspaces/[id]/members
 * List workspace members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const workspaceId = params.id;

    // Verify access (any member can view members)
    await verifyWorkspaceAccess(workspaceId, session.user.id);

    const members = await db.workspaceMember.findMany({
      where: { workspaceId },
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
        createdAt: "asc",
      },
    });

    return NextResponse.json({ members });
  } catch (error) {
    if ((error as Error).message.includes("access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]/members");
  }
}

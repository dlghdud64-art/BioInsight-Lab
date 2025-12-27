import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api/workspaces/[id]");

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
});

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
 * GET /api/workspaces/[id]
 * Get workspace details
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

    // Verify access
    await verifyWorkspaceAccess(workspaceId, session.user.id);

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
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
        },
        _count: {
          select: {
            purchases: true,
            budgets: true,
            quotes: true,
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    if ((error as Error).message.includes("access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]");
  }
}

/**
 * PATCH /api/workspaces/[id]
 * Update workspace details (admin only)
 */
export async function PATCH(
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

    // Verify admin access
    await verifyWorkspaceAccess(workspaceId, session.user.id, "ADMIN");

    const body = await request.json();
    const updateData = updateWorkspaceSchema.parse(body);

    // Check slug uniqueness if changing slug
    if (updateData.slug) {
      const existing = await db.workspace.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: workspaceId },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Workspace slug already taken" },
          { status: 409 }
        );
      }
    }

    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      include: {
        members: {
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
        },
      },
    });

    logger.info(`Workspace updated: ${workspace.slug}`, {
      workspaceId,
      userId: session.user.id,
    });

    return NextResponse.json({ workspace });
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
    return handleApiError(error, "workspaces/[id]");
  }
}

/**
 * DELETE /api/workspaces/[id]
 * Delete workspace (admin only)
 */
export async function DELETE(
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

    // Verify admin access
    await verifyWorkspaceAccess(workspaceId, session.user.id, "ADMIN");

    // Delete workspace (cascade will delete members, invites, and set workspaceId to null on related records)
    await db.workspace.delete({
      where: { id: workspaceId },
    });

    logger.info(`Workspace deleted`, {
      workspaceId,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]");
  }
}

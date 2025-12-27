import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import crypto from "crypto";

const logger = createLogger("api/workspaces/[id]/invites");

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  expiresInDays: z.number().min(1).max(30).default(7),
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
 * Generate unique invite token
 */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * GET /api/workspaces/[id]/invites
 * List pending invites (admin only)
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

    // Verify admin access
    await verifyAdminAccess(workspaceId, session.user.id);

    const invites = await db.workspaceInvite.findMany({
      where: {
        workspaceId,
        acceptedAt: null, // Only pending invites
        expiresAt: { gte: new Date() }, // Not expired
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]/invites");
  }
}

/**
 * POST /api/workspaces/[id]/invites
 * Create workspace invite (admin only)
 */
export async function POST(
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
    await verifyAdminAccess(workspaceId, session.user.id);

    const body = await request.json();
    const { email, role, expiresInDays } = createInviteSchema.parse(body);

    // Check if user is already a member
    const existingUser = await db.user.findUnique({
      where: { email },
      include: {
        workspaceMembers: {
          where: { workspaceId },
        },
      },
    });

    if (existingUser?.workspaceMembers.length) {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 409 }
      );
    }

    // Check for existing pending invite
    const existingInvite = await db.workspaceInvite.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        expiresAt: { gte: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "Pending invite already exists for this email" },
        { status: 409 }
      );
    }

    // Create invite
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invite = await db.workspaceInvite.create({
      data: {
        workspaceId,
        token,
        email,
        role,
        expiresAt,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    logger.info(`Workspace invite created`, {
      workspaceId,
      email,
      role,
      invitedBy: session.user.id,
    });

    // TODO: Send email with invite link
    // const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    return NextResponse.json({ invite }, { status: 201 });
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
    return handleApiError(error, "workspaces/[id]/invites");
  }
}

/**
 * DELETE /api/workspaces/[id]/invites/[inviteId]
 * Revoke/cancel invite (admin only)
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
    const inviteId = request.nextUrl.searchParams.get("inviteId");

    if (!inviteId) {
      return NextResponse.json(
        { error: "Invite ID required" },
        { status: 400 }
      );
    }

    // Verify admin access
    await verifyAdminAccess(workspaceId, session.user.id);

    await db.workspaceInvite.delete({
      where: {
        id: inviteId,
        workspaceId, // Ensure invite belongs to this workspace
      },
    });

    logger.info(`Workspace invite revoked`, {
      workspaceId,
      inviteId,
      revokedBy: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]/invites");
  }
}

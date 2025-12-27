import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api/invites/accept");

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /api/invites/accept
 * Accept workspace invite
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to accept this invite." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { token } = acceptInviteSchema.parse(body);

    // Find invite
    const invite = await db.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Invite has already been accepted" },
        { status: 409 }
      );
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 }
      );
    }

    // Verify email matches (if user is authenticated)
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.email !== invite.email) {
      return NextResponse.json(
        { error: "Invite email does not match your account email" },
        { status: 403 }
      );
    }

    // Check if already a member
    const existingMember = await db.workspaceMember.findFirst({
      where: {
        workspaceId: invite.workspaceId,
        userId: session.user.id,
      },
    });

    if (existingMember) {
      // Mark invite as accepted even though they're already a member
      await db.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.json(
        { error: "You are already a member of this workspace" },
        { status: 409 }
      );
    }

    // Accept invite: create membership and mark invite as accepted
    const [member] = await db.$transaction([
      db.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          role: invite.role,
        },
        include: {
          workspace: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      db.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    logger.info(`Workspace invite accepted`, {
      workspaceId: invite.workspaceId,
      userId: session.user.id,
      role: invite.role,
    });

    return NextResponse.json({
      success: true,
      workspace: member.workspace,
      member,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return handleApiError(error, "invites/accept");
  }
}

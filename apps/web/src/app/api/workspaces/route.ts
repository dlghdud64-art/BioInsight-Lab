import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { getUserWorkspaces } from "@/lib/auth/scope";
import { z } from "zod";

const logger = createLogger("api/workspaces");

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
});

/**
 * GET /api/workspaces
 * List all workspaces for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const workspaces = await getUserWorkspaces(session.user.id);

    return NextResponse.json({ workspaces });
  } catch (error) {
    return handleApiError(error, "workspaces");
  }
}

/**
 * POST /api/workspaces
 * Create a new workspace
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, slug } = createWorkspaceSchema.parse(body);

    // Check if slug is already taken
    const existing = await db.workspace.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Workspace slug already taken" },
        { status: 409 }
      );
    }

    // Create workspace with creator as admin
    const workspace = await db.workspace.create({
      data: {
        name,
        slug,
        plan: "FREE",
        members: {
          create: {
            userId: session.user.id,
            role: "ADMIN",
          },
        },
      },
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

    logger.info(`Workspace created: ${workspace.slug}`, {
      workspaceId: workspace.id,
      userId: session.user.id,
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return handleApiError(error, "workspaces");
  }
}

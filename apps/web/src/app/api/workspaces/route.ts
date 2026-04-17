import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { getUserWorkspaces } from "@/lib/auth/scope";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      // 신규 Workspace 생성 — 생성자는 아직 어떤 Workspace의 ADMIN도 아니므로
      // workspace_manage(기존 Workspace 관리)와 분리된 workspace_create 액션을 사용한다.
      action: 'workspace_create',
      targetEntityType: 'workspace',
      targetEntityId: 'new',
      sourceSurface: 'workspaces-api',
      routePath: '/api/workspaces',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    enforcement.complete({});
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return handleApiError(error, "workspaces");
  }
}

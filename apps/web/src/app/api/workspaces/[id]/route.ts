import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
// #approver-routing-audit-log — workspace 결재 임계치 변경 audit 추적성.
// best effort (try/catch graceful — mutation atomic 보호).
import { createAuditLog } from "@/lib/audit/audit-logger";

const logger = createLogger("api/workspaces/[id]");

// #approver-routing-multi-tier-validation-zod-refine — cross-field validation
// 추가 (둘 다 명시된 경우 low ≤ high 강제). server-side defense in depth —
// form-level validation 외 직접 API 호출 (CSRF skip) 시에도 정합 보장.
// partial update 호환 (둘 중 하나만 명시 시 refine skip).
export const updateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    slug: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
      .optional(),
    // §11.209d-approver-routing — 결재 임계치 (KRW). admin UI override.
    // min 0 = 모든 결재 OWNER escalation 가능, max 10000000000 (100억) = 비현실적
    // 큰 값 차단. ADMIN role 만 변경 (PATCH 의 verifyWorkspaceAccess 게이트).
    approvalThresholdKrw: z.number().int().min(0).max(10_000_000_000).optional(),
    // #approver-routing-multi-tier-threshold — 중액/저액 구분 임계치 (KRW).
    // amount < approvalLowThresholdKrw → low tier (workspace_admin first).
    // default 1,000,000 (100만원). max cap 동일 (100억).
    approvalLowThresholdKrw: z.number().int().min(0).max(10_000_000_000).optional(),
  })
  .refine(
    (data) => {
      // 둘 다 명시된 경우만 cross-field 검증 (partial update 호환)
      if (data.approvalLowThresholdKrw == null || data.approvalThresholdKrw == null) {
        return true;
      }
      return data.approvalLowThresholdKrw <= data.approvalThresholdKrw;
    },
    {
      message: "저액 임계치는 고액 임계치 이하여야 합니다",
      path: ["approvalLowThresholdKrw"],
    },
  );

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const workspaceId = params.id;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'workspace_manage',
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
      sourceSurface: 'workspaces-api',
      routePath: '/api/workspaces/[id]',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // Verify admin access
    await verifyWorkspaceAccess(workspaceId, session.user.id, "ADMIN");

    const body = await request.json();
    const updateData = updateWorkspaceSchema.parse(body);

    // #approver-routing-audit-log — threshold 변경 시 before snapshot capture
    // (audit log 의 changes.before). update 전에 기존 값 fetch.
    const isThresholdUpdate =
      updateData.approvalLowThresholdKrw != null ||
      updateData.approvalThresholdKrw != null;
    const beforeThresholds = isThresholdUpdate
      ? await db.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            approvalLowThresholdKrw: true,
            approvalThresholdKrw: true,
            organizationId: true,
          },
        })
      : null;

    // #approver-routing-cross-field-validation-runtime-current-vs-pending —
    // partial update 시 cross-field validation. zod refine 은 둘 다 명시된
    // 경우만 검증 (request body 만 본다) — partial update (low 또는 high
    // 단독 변경) 시 DB 의 기존 값과 합성 후 finalLow ≤ finalHigh 검증.
    // workspace.update 전에 차단 (mutation atomic 보호).
    if (isThresholdUpdate && beforeThresholds) {
      const finalLow =
        updateData.approvalLowThresholdKrw ??
        beforeThresholds.approvalLowThresholdKrw;
      const finalHigh =
        updateData.approvalThresholdKrw ??
        beforeThresholds.approvalThresholdKrw;
      if (finalLow > finalHigh) {
        enforcement?.fail();
        return NextResponse.json(
          {
            error: "INVALID_THRESHOLD_ORDER",
            message: "저액 임계치는 고액 임계치 이하여야 합니다.",
          },
          { status: 400 },
        );
      }
    }

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

    // #approver-routing-audit-log — 결재 임계치 변경 audit log (best effort).
    // mutation 성공 후 호출 — fail 시 mutation 결과 영향 0 (try/catch graceful).
    if (isThresholdUpdate && beforeThresholds) {
      try {
        await createAuditLog({
          organizationId: beforeThresholds.organizationId ?? undefined,
          userId: session.user.id,
          eventType: "SETTINGS_CHANGED" as never,
          entityType: "WORKSPACE",
          entityId: workspaceId,
          action: "threshold_update",
          changes: {
            before: {
              approvalLowThresholdKrw: beforeThresholds.approvalLowThresholdKrw,
              approvalThresholdKrw: beforeThresholds.approvalThresholdKrw,
            },
            after: {
              approvalLowThresholdKrw:
                updateData.approvalLowThresholdKrw ??
                beforeThresholds.approvalLowThresholdKrw,
              approvalThresholdKrw:
                updateData.approvalThresholdKrw ??
                beforeThresholds.approvalThresholdKrw,
            },
          },
        });
      } catch (auditErr) {
        // graceful — mutation 정합 유지
        logger.error("[workspaces/PATCH] threshold audit log 실패 (mutation 정합 유지)", auditErr);
      }
    }

    enforcement.complete({});
    return NextResponse.json({ workspace });
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const workspaceId = params.id;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'workspace_manage',
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
      sourceSurface: 'workspaces-api',
      routePath: '/api/workspaces/[id]',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    enforcement.complete({});
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    if ((error as Error).message.includes("Admin permission required")) {
      return NextResponse.json({ error: "Admin permission required" }, { status: 403 });
    }
    return handleApiError(error, "workspaces/[id]");
  }
}

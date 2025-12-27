/**
 * Scope resolution utility for workspace/guest key handling
 *
 * Priority order:
 * 1. Session userId -> get user's default/selected workspace
 * 2. x-workspace-id header (for workspace switching)
 * 3. x-guest-key header (fallback for anonymous users)
 *
 * This allows gradual migration from guestKey-only to workspace-based system
 */

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type ScopeType = "workspace" | "guest";

export interface Scope {
  type: ScopeType;
  workspaceId?: string;
  guestKey?: string;
  userId?: string;
}

export interface WorkspaceScope extends Scope {
  type: "workspace";
  workspaceId: string;
  userId: string;
}

export interface GuestScope extends Scope {
  type: "guest";
  guestKey: string;
}

/**
 * Get scope from request
 * Returns workspace scope if user is authenticated and has a workspace,
 * otherwise returns guest scope from x-guest-key header
 */
export async function getScope(request: NextRequest): Promise<Scope> {
  // Priority 1: Check for authenticated user session
  const session = await auth();

  if (session?.user?.id) {
    const userId = session.user.id;

    // Priority 2: Check for explicit workspace selection via header
    const workspaceIdHeader = request.headers.get("x-workspace-id");

    if (workspaceIdHeader) {
      // Verify user has access to this workspace
      const member = await db.workspaceMember.findFirst({
        where: {
          workspaceId: workspaceIdHeader,
          userId: userId,
        },
      });

      if (member) {
        return {
          type: "workspace",
          workspaceId: workspaceIdHeader,
          userId: userId,
        } as WorkspaceScope;
      }
    }

    // Priority 3: Get user's default/last used workspace
    const defaultMember = await db.workspaceMember.findFirst({
      where: {
        userId: userId,
      },
      orderBy: {
        updatedAt: "desc", // Most recently joined workspace
      },
      include: {
        workspace: true,
      },
    });

    if (defaultMember) {
      return {
        type: "workspace",
        workspaceId: defaultMember.workspaceId,
        userId: userId,
      } as WorkspaceScope;
    }

    // User is authenticated but has no workspace yet
    // Still use workspace type but without workspaceId
    // This allows APIs to handle "personal workspace" scenario
    const guestKey = request.headers.get("x-guest-key");
    if (guestKey) {
      return {
        type: "guest",
        guestKey: guestKey,
        userId: userId, // Include userId for potential migration
      } as GuestScope;
    }
  }

  // Fallback: Use guest key from header
  const guestKey = request.headers.get("x-guest-key");

  if (!guestKey) {
    throw new Error("Missing authentication: no session or guest key");
  }

  return {
    type: "guest",
    guestKey: guestKey,
  } as GuestScope;
}

/**
 * Get scope key for database queries
 * For workspace scope: returns workspaceId
 * For guest scope: returns guestKey
 */
export function getScopeKey(scope: Scope): string {
  if (scope.type === "workspace" && scope.workspaceId) {
    return scope.workspaceId;
  }
  if (scope.type === "guest" && scope.guestKey) {
    return scope.guestKey;
  }
  throw new Error("Invalid scope: missing workspaceId or guestKey");
}

/**
 * Build Prisma where clause for scoped queries
 * Supports both workspace and guest key filtering
 */
export function buildScopeWhere(scope: Scope): {
  OR?: Array<{ workspaceId?: string; scopeKey?: string }>;
  workspaceId?: string;
  scopeKey?: string;
} {
  if (scope.type === "workspace" && scope.workspaceId) {
    return { workspaceId: scope.workspaceId };
  }

  if (scope.type === "guest" && scope.guestKey) {
    // For guest scope, we need to check both scopeKey (old data) and potentially null workspaceId
    return {
      AND: [
        { scopeKey: scope.guestKey },
        { workspaceId: null }, // Ensure we don't accidentally access workspace data
      ],
    };
  }

  throw new Error("Invalid scope: missing workspaceId or guestKey");
}

/**
 * Check if user has permission in workspace
 * For workspace scope: checks WorkspaceMember role
 * For guest scope: always returns true (guest owns their data)
 */
export async function hasWorkspacePermission(
  scope: Scope,
  permission: "read" | "write" | "admin"
): Promise<boolean> {
  if (scope.type === "guest") {
    // Guest users have full access to their own data
    return true;
  }

  if (scope.type === "workspace" && scope.workspaceId && scope.userId) {
    const member = await db.workspaceMember.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        userId: scope.userId,
      },
    });

    if (!member) {
      return false;
    }

    // Admin role has all permissions
    if (member.role === "ADMIN") {
      return true;
    }

    // Member role has read/write but not admin
    if (member.role === "MEMBER") {
      return permission === "read" || permission === "write";
    }
  }

  return false;
}

/**
 * Require admin permission in workspace
 * Throws error if user doesn't have admin access
 */
export async function requireAdmin(scope: Scope): Promise<void> {
  const hasPermission = await hasWorkspacePermission(scope, "admin");
  if (!hasPermission) {
    throw new Error("Admin permission required");
  }
}

/**
 * Get all workspaces for a user
 */
export async function getUserWorkspaces(userId: string) {
  const members = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return members.map((m) => ({
    ...m.workspace,
    role: m.role,
    joinedAt: m.createdAt,
  }));
}

/**
 * Get workspace plan for scope
 * Returns plan type: FREE, TEAM, or ENTERPRISE
 * Guest scope is always FREE
 */
export async function getWorkspacePlan(scope: Scope): Promise<"FREE" | "TEAM" | "ENTERPRISE"> {
  if (scope.type === "guest") {
    return "FREE"; // Guest users always on FREE plan
  }

  if (scope.type === "workspace" && scope.workspaceId) {
    const workspace = await db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { plan: true },
    });

    return workspace?.plan || "FREE";
  }

  return "FREE";
}

/**
 * Check if workspace plan allows a feature
 * Feature gates based on plan tier
 */
export async function hasFeatureAccess(
  scope: Scope,
  feature: "basic" | "team" | "enterprise"
): Promise<boolean> {
  const plan = await getWorkspacePlan(scope);

  switch (feature) {
    case "basic":
      return true; // Available on all plans

    case "team":
      return plan === "TEAM" || plan === "ENTERPRISE";

    case "enterprise":
      return plan === "ENTERPRISE";

    default:
      return false;
  }
}

/**
 * Require specific plan tier
 * Throws error if workspace doesn't have required plan
 */
export async function requirePlan(
  scope: Scope,
  minPlan: "FREE" | "TEAM" | "ENTERPRISE"
): Promise<void> {
  const plan = await getWorkspacePlan(scope);

  const planHierarchy = { FREE: 0, TEAM: 1, ENTERPRISE: 2 };

  if (planHierarchy[plan] < planHierarchy[minPlan]) {
    throw new Error(`${minPlan} plan required. Current plan: ${plan}`);
  }
}

/**
 * Get billing status for workspace
 * Returns null for guest scope
 */
export async function getBillingStatus(
  scope: Scope
): Promise<"ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | null> {
  if (scope.type === "guest") {
    return null;
  }

  if (scope.type === "workspace" && scope.workspaceId) {
    const workspace = await db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { billingStatus: true },
    });

    return workspace?.billingStatus || null;
  }

  return null;
}

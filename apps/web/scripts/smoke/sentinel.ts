/**
 * Sentinel identifiers for isolated WRITE smoke (ADR-001 §6.2).
 *
 * All S01/S02/S03 smoke writes must be scoped to these exact IDs so that
 * the #16c evidence data (already present in the test project — see
 * ADR-001 §11.2) is never touched. Cleanup is by exact ID match only.
 * No LIKE, no prefix, no deleteMany.
 *
 * This file is pure: no Prisma, no fs, no env. Import it from both the
 * seed and the cleanup entry points so a single source of truth drives
 * both sides.
 */

// Organization (root sentinel)
export const SENTINEL_ORG_ID = "org-smoke-isolated";
export const SENTINEL_ORG_NAME = "Smoke Isolated Org (#26 ADR-001)";
export const SENTINEL_ORG_SLUG = "org-smoke-isolated";

// Workspace (1:1 with the sentinel org; onDelete: Cascade from org → ws)
export const SENTINEL_WORKSPACE_ID = "workspace-smoke-isolated";
export const SENTINEL_WORKSPACE_NAME = "Smoke Isolated Workspace (#26 ADR-001)";
export const SENTINEL_WORKSPACE_SLUG = "workspace-smoke-isolated";

export type SentinelModel = "organization" | "workspace";

/**
 * Declarative description of what cleanup is allowed to touch. Every
 * entry is an exact-ID delete target. The cleanup test uses this to
 * enforce "no filter-based delete" — any regression that starts using
 * `where: { id: { startsWith: '...' } }` or `deleteMany` will fail
 * because the structure below won't express it.
 */
export interface SentinelCleanupPlan {
  readonly deleteByExactId: ReadonlyArray<{
    readonly model: SentinelModel;
    readonly id: string;
  }>;
}

export function buildCleanupPlan(): SentinelCleanupPlan {
  return {
    deleteByExactId: [
      // Order matters for explicit logging even though Organization's
      // cascade would catch Workspace anyway. Deleting the workspace
      // first makes the log line count accurate.
      { model: "workspace", id: SENTINEL_WORKSPACE_ID },
      { model: "organization", id: SENTINEL_ORG_ID },
    ],
  };
}

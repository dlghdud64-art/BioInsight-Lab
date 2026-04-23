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

// User (Quote/Order owner for write-chain smoke). The write chain uses
// this user via Quote.userId and Order.userId, both of which have
// onDelete: Cascade. Deleting this user drops every smoke-created
// Quote / QuoteListItem / Order / OrderItem in one step.
export const SENTINEL_USER_ID = "user-smoke-sentinel";
export const SENTINEL_USER_EMAIL = "smoke-sentinel@labaxis.test";
export const SENTINEL_USER_NAME = "Smoke Sentinel (#26 ADR-001)";

// Product (ProductInventory target for write-chain S03). Product.id is
// the FK target for QuoteListItem.productId and ProductInventory.productId;
// both relations have onDelete: Cascade, so deleting this product clears
// every smoke-created inventory row and draft line item.
export const SENTINEL_PRODUCT_ID = "product-smoke-sentinel";
export const SENTINEL_PRODUCT_NAME = "Smoke Sentinel Product (#26 ADR-001)";
export const SENTINEL_PRODUCT_CATEGORY = "REAGENT" as const;

export type SentinelModel = "organization" | "workspace" | "user" | "product";

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
      // Order notes:
      //   1. Workspace first (FK to Organization → onDelete: Cascade from
      //      org, but explicit delete keeps log line count honest).
      //   2. User second — User cascade drops all smoke Quotes, Orders,
      //      QuoteListItems, OrderItems, OrganizationMembers,
      //      WorkspaceMembers in one step. Must run BEFORE the org delete
      //      because Quote.organization is onDelete: SetNull, so the org
      //      delete alone would not remove Quote rows.
      //   3. Organization third — picks up anything left scoped by
      //      organizationId (ProductInventory, etc.).
      //   4. Product last — ProductInventory cascade + any draft
      //      QuoteListItem that survived (shouldn't happen after User
      //      delete, but keeps the plan explicit).
      { model: "workspace", id: SENTINEL_WORKSPACE_ID },
      { model: "user", id: SENTINEL_USER_ID },
      { model: "organization", id: SENTINEL_ORG_ID },
      { model: "product", id: SENTINEL_PRODUCT_ID },
    ],
  };
}

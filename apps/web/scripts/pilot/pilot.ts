/**
 * Pilot Tenant Shared Identifiers — #P01 / ADR-002
 *
 * This file is the single source of truth for every pilot row the
 * pilot-seed and pilot-cleanup scripts are allowed to create or
 * delete. It is pure data + pure functions: no Prisma, no env, no
 * fs. Importable from both seed and cleanup so the two sides stay
 * in lockstep.
 *
 * Governance contract
 * -------------------
 * 1. Everything below is sentinel-scoped to the "pilot-internal"
 *    namespace. IDs deliberately collide with nothing in
 *    prisma/seed.ts (org-bioinsight-lab, guest-demo) or the ADR-001
 *    smoke sentinel (org-smoke-isolated, workspace-smoke-isolated,
 *    user-smoke-sentinel, product-smoke-sentinel).
 *
 * 2. The pilot owner is the existing ADMIN user (호영) — we attach
 *    membership rows to that user's cuid instead of creating a
 *    pilot-only User. Deleting the pilot never deletes the user;
 *    the cleanup plan targets membership rows keyed on the compound
 *    {userId, organizationId} / {workspaceId, userId} unique so the
 *    user's memberships in any other organization remain untouched.
 *
 * 3. The pilot target is PRODUCTION DB (project-ref
 *    xhidynwpkqeaojuudhsw, region ap-northeast-1 / Tokyo). The opt-in
 *    is enforced one layer up in ./guard.ts — this file assumes the
 *    guard has already cleared.
 *
 * 4. Any change to the catalog, identifiers, or owner cuid requires
 *    a fresh pilot-cleanup --apply run against the previous state to
 *    avoid orphan rows. ADR-002 §11 deviations must be appended when
 *    this file changes after first deploy.
 */

// ──────────────────────────────────────────────────────────
// Organization (root sentinel)
// ──────────────────────────────────────────────────────────

export const PILOT_ORG_ID = "org-pilot-internal";
export const PILOT_ORG_NAME = "Pilot Internal Org (#P01 ADR-002)";
export const PILOT_ORG_SLUG = "org-pilot-internal";

/**
 * Plan choice rationale (Q2, 2026-04-23): "ORGANIZATION" matches the
 * plan used by org-bioinsight-lab in prisma/seed.ts, removing the
 * FREE-tier maxMembers / maxQuotesPerMonth ceilings during pilot so
 * that feature limits do not mask workflow bugs. Subscription-limit
 * verification is a separate track.
 */
export const PILOT_ORG_PLAN = "ORGANIZATION" as const;

// ──────────────────────────────────────────────────────────
// Workspace (1:1 with the pilot org — onDelete: Cascade from org)
// ──────────────────────────────────────────────────────────

export const PILOT_WORKSPACE_ID = "workspace-pilot-internal";
export const PILOT_WORKSPACE_NAME = "Pilot Internal Workspace (#P01 ADR-002)";
export const PILOT_WORKSPACE_SLUG = "workspace-pilot-internal";

// ──────────────────────────────────────────────────────────
// Pilot owner (existing User reuse — Q1 approved 2026-04-23)
// ──────────────────────────────────────────────────────────

/**
 * The real cuid of the ADMIN user (호영, dlghdud64@gmail.com).
 * Captured from /api/admin/users during the ADR-001 session on
 * 2026-04-23. The user row itself is canonical and must never be
 * touched by pilot-seed or pilot-cleanup — see PILOT_OWNER_PROTECTION
 * guard messages below.
 */
export const PILOT_OWNER_USER_ID = "cmo4mcbih00003ut3ozub29tc";

/**
 * Documentation-only — the membership role the pilot owner takes
 * inside the pilot organization. Reflected in OrganizationMember
 * and WorkspaceMember upserts in pilot-seed.ts.
 */
export const PILOT_OWNER_ORG_ROLE = "ADMIN" as const;
export const PILOT_OWNER_WORKSPACE_ROLE = "ADMIN" as const;

/** Human-readable reminder embedded into cleanup log output. */
export const PILOT_OWNER_PROTECTION =
  "Pilot cleanup must never delete the User row with id=" +
  PILOT_OWNER_USER_ID +
  " — only its OrganizationMember + WorkspaceMember rows scoped to PILOT_ORG_ID / PILOT_WORKSPACE_ID.";

// ──────────────────────────────────────────────────────────
// Pilot product catalog (15 items — Q3 approved 2026-04-23)
//
// Each entry must include id / name / category. Other fields are
// optional and deliberately omitted so the catalog stays minimal;
// brand / catalogNumber / specifications can be layered in a
// subsequent phase (#P02) without re-seeding.
// ──────────────────────────────────────────────────────────

export type PilotProductCategory =
  | "REAGENT"
  | "TOOL"
  | "EQUIPMENT"
  | "RAW_MATERIAL";

export interface PilotProductSpec {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly category: PilotProductCategory;
}

export const PILOT_PRODUCT_CATALOG: readonly PilotProductSpec[] = [
  {
    id: "product-pilot-ethanol-500ml",
    name: "Ethanol 99.9% 500ml",
    nameEn: "Ethanol 99.9% 500ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-pbs-1l",
    name: "PBS 1X 1L",
    nameEn: "PBS 1X 1L",
    category: "REAGENT",
  },
  {
    id: "product-pilot-dmem-500ml",
    name: "DMEM high glucose 500ml",
    nameEn: "DMEM high glucose 500ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-fbs-500ml",
    name: "FBS heat-inactivated 500ml",
    nameEn: "FBS heat-inactivated 500ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-antibody-gapdh",
    name: "Anti-GAPDH antibody",
    nameEn: "Anti-GAPDH antibody",
    category: "REAGENT",
  },
  {
    id: "product-pilot-trypsin-100ml",
    name: "Trypsin-EDTA 100ml",
    nameEn: "Trypsin-EDTA 100ml",
    category: "REAGENT",
  },
  {
    id: "product-pilot-filter-022",
    name: "0.22μm sterile filter",
    nameEn: "0.22μm sterile filter",
    category: "TOOL",
  },
  {
    id: "product-pilot-falcon-50ml",
    name: "50ml Falcon conical tube",
    nameEn: "50ml Falcon conical tube",
    category: "TOOL",
  },
  {
    id: "product-pilot-tips-1000ul",
    name: "Pipette tips 1000μL",
    nameEn: "Pipette tips 1000μL",
    category: "TOOL",
  },
  {
    id: "product-pilot-hplc-c18",
    name: "HPLC C18 column",
    nameEn: "HPLC C18 column",
    category: "EQUIPMENT",
  },
  {
    id: "product-pilot-dish-100mm",
    name: "Cell culture dish 100mm",
    nameEn: "Cell culture dish 100mm",
    category: "TOOL",
  },
  {
    id: "product-pilot-plate-96well",
    name: "96-well plate",
    nameEn: "96-well plate",
    category: "TOOL",
  },
  {
    id: "product-pilot-bsa-100g",
    name: "BSA powder 100g",
    nameEn: "BSA powder 100g",
    category: "REAGENT",
  },
  {
    id: "product-pilot-tris-buffer",
    name: "Tris-HCl buffer",
    nameEn: "Tris-HCl buffer",
    category: "REAGENT",
  },
  {
    id: "product-pilot-sds-running-buffer",
    name: "SDS-PAGE Running Buffer",
    nameEn: "SDS-PAGE Running Buffer",
    category: "REAGENT",
  },
];

/** Helper — typed set of pilot product ids for cleanup filters. */
export const PILOT_PRODUCT_IDS: readonly string[] =
  PILOT_PRODUCT_CATALOG.map((p) => p.id);

// ──────────────────────────────────────────────────────────
// Cleanup plan — declarative, consumed by pilot-cleanup.ts
// ──────────────────────────────────────────────────────────

export type PilotModel =
  | "workspaceMember"
  | "organizationMember"
  | "workspace"
  | "organization"
  | "product";

/**
 * One cleanup operation. Deliberately models compound keys as a
 * separate field so the cleanup test can prove "no filter-based
 * delete ever runs" — see pilot-cleanup.test.ts in Phase 4.
 */
export type PilotCleanupOperation =
  | {
      readonly model: "workspaceMember";
      readonly where: {
        readonly workspaceId_userId: {
          readonly workspaceId: string;
          readonly userId: string;
        };
      };
    }
  | {
      readonly model: "organizationMember";
      readonly where: {
        readonly userId_organizationId: {
          readonly userId: string;
          readonly organizationId: string;
        };
      };
    }
  | {
      readonly model: "workspace";
      readonly where: { readonly id: string };
    }
  | {
      readonly model: "organization";
      readonly where: { readonly id: string };
    }
  | {
      readonly model: "product";
      readonly where: { readonly id: string };
    };

export interface PilotCleanupPlan {
  readonly operations: readonly PilotCleanupOperation[];
}

/**
 * Build the full pilot cleanup plan. Order matters:
 *
 *   1. WorkspaceMember   — drop pilot owner's workspace membership.
 *   2. OrganizationMember — drop pilot owner's org membership.
 *   3. Workspace         — delete the pilot workspace shell.
 *   4. Organization      — deleting the org cascades residual rows
 *                          (e.g., remaining OrganizationMember if any
 *                          got added out-of-band), but Quote /
 *                          ProductInventory are SetNull so they
 *                          survive — we do not rely on org cascade
 *                          for those.
 *   5. Products          — remove each pilot product by exact id,
 *                          one call per id. No deleteMany, no filter.
 *                          Product cascade from ProductInventory /
 *                          QuoteListItem handles any downstream rows.
 *
 * The pilot OWNER USER is intentionally NOT in this plan — the user
 * row is canonical. See PILOT_OWNER_PROTECTION.
 */
export function buildPilotCleanupPlan(
  /** Override for smoke-DB deviation (ADR-002 §11). Defaults to PILOT_OWNER_USER_ID. */
  ownerUserId: string = PILOT_OWNER_USER_ID,
): PilotCleanupPlan {
  const operations: PilotCleanupOperation[] = [
    {
      model: "workspaceMember",
      where: {
        workspaceId_userId: {
          workspaceId: PILOT_WORKSPACE_ID,
          userId: ownerUserId,
        },
      },
    },
    {
      model: "organizationMember",
      where: {
        userId_organizationId: {
          userId: ownerUserId,
          organizationId: PILOT_ORG_ID,
        },
      },
    },
    {
      model: "workspace",
      where: { id: PILOT_WORKSPACE_ID },
    },
    {
      model: "organization",
      where: { id: PILOT_ORG_ID },
    },
    ...PILOT_PRODUCT_IDS.map(
      (id): PilotCleanupOperation => ({
        model: "product",
        where: { id },
      }),
    ),
  ];
  return { operations };
}

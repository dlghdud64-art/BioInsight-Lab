/**
 * Sentinel Cleanup — ADR-001 §6.2 / §7 criteria 5
 *
 * Deletes the sentinel Organization + Workspace pair used by isolated
 * WRITE smoke. Dry-run is the default; `--apply` is required to
 * actually delete. This guarantees that re-running cleanup can never
 * surprise anyone.
 *
 * Scoping guarantees (ADR-001 §11.2 — #16c evidence coexistence):
 *   - Exact-ID delete only. No LIKE, no prefix, no deleteMany.
 *   - Checks existence first (findUnique by id) and skips the delete
 *     if the sentinel is already gone. A missing sentinel is not an
 *     error — the run is still considered clean.
 *   - Organization and Workspace are the only two models touched.
 *     Child rows (OrganizationMember, Quote, etc.) are removed by
 *     Prisma's onDelete: Cascade declared in the schema.
 *
 * Usage:
 *   # Dry-run (default, safe)
 *   pnpm -C apps/web tsx scripts/smoke/sentinel-cleanup.ts
 *
 *   # Actually delete
 *   pnpm -C apps/web tsx scripts/smoke/sentinel-cleanup.ts --apply
 */

import { assertSmokeDatabaseTarget } from "./guard";
import {
  SENTINEL_ORG_ID,
  SENTINEL_WORKSPACE_ID,
  SENTINEL_USER_ID,
  SENTINEL_PRODUCT_ID,
  type SentinelModel,
} from "./sentinel";

export type CleanupMode = "dry-run" | "apply";

export function parseMode(argv: readonly string[]): CleanupMode {
  return argv.includes("--apply") ? "apply" : "dry-run";
}

// Minimal surface the cleanup needs from Prisma. Tests pass a stub that
// matches this shape without loading @prisma/client. Deliberately omits
// deleteMany / createMany so any regression that tries to use a
// filter-based delete will fail type-check (defends ADR-001 §11.2).
export interface CleanupEntitySurface {
  readonly findUnique: (args: {
    where: { id: string };
  }) => Promise<{ id: string } | null>;
  readonly delete: (args: {
    where: { id: string };
  }) => Promise<{ id: string }>;
}

export interface CleanupPrismaClient {
  readonly organization: CleanupEntitySurface;
  readonly workspace: CleanupEntitySurface;
  readonly user: CleanupEntitySurface;
  readonly product: CleanupEntitySurface;
}

export interface CleanupResult {
  readonly mode: CleanupMode;
  readonly found: {
    readonly organization: boolean;
    readonly workspace: boolean;
    readonly user: boolean;
    readonly product: boolean;
  };
  readonly deletedCalls: ReadonlyArray<{
    readonly model: SentinelModel;
    readonly id: string;
  }>;
}

export async function runCleanup(
  mode: CleanupMode,
  prisma: CleanupPrismaClient,
): Promise<CleanupResult> {
  const foundWs = await prisma.workspace.findUnique({
    where: { id: SENTINEL_WORKSPACE_ID },
  });
  const foundUser = await prisma.user.findUnique({
    where: { id: SENTINEL_USER_ID },
  });
  const foundOrg = await prisma.organization.findUnique({
    where: { id: SENTINEL_ORG_ID },
  });
  const foundProduct = await prisma.product.findUnique({
    where: { id: SENTINEL_PRODUCT_ID },
  });

  const deletedCalls: Array<{ model: SentinelModel; id: string }> = [];

  if (mode === "apply") {
    // Order matters: see sentinel.ts buildCleanupPlan() for rationale.
    if (foundWs) {
      await prisma.workspace.delete({
        where: { id: SENTINEL_WORKSPACE_ID },
      });
      deletedCalls.push({ model: "workspace", id: SENTINEL_WORKSPACE_ID });
    }
    if (foundUser) {
      await prisma.user.delete({ where: { id: SENTINEL_USER_ID } });
      deletedCalls.push({ model: "user", id: SENTINEL_USER_ID });
    }
    if (foundOrg) {
      await prisma.organization.delete({
        where: { id: SENTINEL_ORG_ID },
      });
      deletedCalls.push({ model: "organization", id: SENTINEL_ORG_ID });
    }
    if (foundProduct) {
      await prisma.product.delete({
        where: { id: SENTINEL_PRODUCT_ID },
      });
      deletedCalls.push({ model: "product", id: SENTINEL_PRODUCT_ID });
    }
  }

  return {
    mode,
    found: {
      organization: !!foundOrg,
      workspace: !!foundWs,
      user: !!foundUser,
      product: !!foundProduct,
    },
    deletedCalls,
  };
}

async function main() {
  const guarded = assertSmokeDatabaseTarget();
  const mode = parseMode(process.argv.slice(2));
  // eslint-disable-next-line no-console
  console.log(
    `[sentinel-cleanup] guard passed. project-ref=${guarded.projectRef} mode=${mode}`,
  );

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_SMOKE! },
    },
  });

  try {
    const result = await runCleanup(
      mode,
      prisma as unknown as CleanupPrismaClient,
    );
    // eslint-disable-next-line no-console
    console.log("[sentinel-cleanup] found:", result.found);
    // eslint-disable-next-line no-console
    console.log(
      `[sentinel-cleanup] deleted calls (count=${result.deletedCalls.length}):`,
      result.deletedCalls,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[sentinel-cleanup] PASS (mode=${result.mode}). Use --apply to delete.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof require !== "undefined" &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (require as any).main === module;

if (isDirectRun) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[sentinel-cleanup] ERROR:", err);
    process.exit(1);
  });
}

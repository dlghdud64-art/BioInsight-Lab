/**
 * Sentinel Seed — ADR-001 §6.2 / §7 criteria 5
 *
 * Idempotent upsert of the Organization + Workspace sentinel pair for
 * isolated WRITE smoke. All S01/S02/S03 writes hang off of these two
 * IDs so that the pre-existing #16c evidence data (see ADR-001 §11.2)
 * is never touched.
 *
 * Contract:
 *   - Calls assertSmokeDatabaseTarget() first (ADR-001 §6.1). The
 *     process cannot reach the database until the guard clears.
 *   - Uses `upsert` with `where: { id }` exact match + empty `update`
 *     block → re-runs are no-ops, never overwrite existing state.
 *   - Never creates anything outside the sentinel pair.
 *
 * Usage:
 *   DATABASE_URL_SMOKE=... \
 *   SMOKE_DB_PROJECT_REF=... \
 *   ALLOWED_SMOKE_DB_SENTINELS=... \
 *   PRODUCTION_DB_PROJECT_REF=... \
 *   pnpm -C apps/web tsx scripts/smoke/sentinel-seed.ts
 */

import { assertSmokeDatabaseTarget } from "./guard";
import {
  SENTINEL_ORG_ID,
  SENTINEL_ORG_NAME,
  SENTINEL_ORG_SLUG,
  SENTINEL_WORKSPACE_ID,
  SENTINEL_WORKSPACE_NAME,
  SENTINEL_WORKSPACE_SLUG,
} from "./sentinel";

async function main() {
  const guarded = assertSmokeDatabaseTarget();
  // eslint-disable-next-line no-console
  console.log(
    `[sentinel-seed] guard passed. project-ref=${guarded.projectRef}`,
  );

  // Dynamic import so assertSmokeDatabaseTarget runs before any Prisma
  // client is instantiated.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_SMOKE! },
    },
  });

  try {
    const org = await prisma.organization.upsert({
      where: { id: SENTINEL_ORG_ID },
      create: {
        id: SENTINEL_ORG_ID,
        name: SENTINEL_ORG_NAME,
        slug: SENTINEL_ORG_SLUG,
      },
      update: {},
    });
    // eslint-disable-next-line no-console
    console.log(`[sentinel-seed] organization upserted: id=${org.id}`);

    const ws = await prisma.workspace.upsert({
      where: { id: SENTINEL_WORKSPACE_ID },
      create: {
        id: SENTINEL_WORKSPACE_ID,
        name: SENTINEL_WORKSPACE_NAME,
        slug: SENTINEL_WORKSPACE_SLUG,
        organizationId: SENTINEL_ORG_ID,
      },
      update: {},
    });
    // eslint-disable-next-line no-console
    console.log(
      `[sentinel-seed] workspace upserted: id=${ws.id} organizationId=${ws.organizationId}`,
    );

    // eslint-disable-next-line no-console
    console.log("[sentinel-seed] PASS");
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
    console.error("[sentinel-seed] ERROR:", err);
    process.exit(1);
  });
}

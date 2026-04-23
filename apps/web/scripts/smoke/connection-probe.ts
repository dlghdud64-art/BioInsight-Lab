/**
 * Connection Probe — ADR-001 §7 criteria 6
 *
 * Confirms that the smoke runner reaches ONLY the isolated DB and does NOT
 * fall-through to production. This is the final gate before S01/S02/S03
 * can be re-opened.
 *
 * What this probe does (read-only):
 *   1. Calls assertSmokeDatabaseTarget() — guard must pass with smoke
 *      project-ref. If DATABASE_URL_SMOKE is missing or points to
 *      production, we abort here.
 *   2. Opens a Prisma client pointed at DATABASE_URL_SMOKE.
 *   3. SELECT-only: reads the sentinel org and workspace rows seeded in
 *      Phase 4. Both must be present.
 *   4. Confirms we are NOT connected to the production project-ref by
 *      comparing the resolved project-ref with PRODUCTION_DB_PROJECT_REF.
 *   5. Prints a structured PASS/FAIL report and exits non-zero on any
 *      failure.
 *
 * No writes, no upserts, no deletes. Pure read probe.
 *
 * Usage:
 *   DATABASE_URL_SMOKE=... \
 *   ALLOWED_SMOKE_DB_SENTINELS=... \
 *   PRODUCTION_DB_PROJECT_REF=... \
 *   pnpm -C apps/web tsx scripts/smoke/connection-probe.ts
 */

import { assertSmokeDatabaseTarget } from "./guard";
import { SENTINEL_ORG_ID, SENTINEL_WORKSPACE_ID } from "./sentinel";

interface ProbeResult {
  step: string;
  pass: boolean;
  detail: string;
}

async function main() {
  const results: ProbeResult[] = [];

  // ── Step 1: Guard ─────────────────────────────────────────────────────────
  const guarded = assertSmokeDatabaseTarget();
  // eslint-disable-next-line no-console
  console.log(
    `[connection-probe] guard passed. project-ref=${guarded.projectRef}`,
  );

  // ── Step 2: Production ref cross-check ────────────────────────────────────
  const productionRef = process.env.PRODUCTION_DB_PROJECT_REF?.trim() ?? "";
  if (productionRef && guarded.projectRef === productionRef) {
    // Should be impossible (guard already blocks this) but double-check.
    // eslint-disable-next-line no-console
    console.error(
      "[connection-probe] ABORT: smoke project-ref equals production ref. Guard logic error.",
    );
    process.exit(2);
  }
  results.push({
    step: "smoke-ref ≠ prod-ref",
    pass: true,
    detail:
      productionRef
        ? `smoke=${guarded.projectRef} / prod=${productionRef} — distinct`
        : `smoke=${guarded.projectRef} / prod=<not set> — guard relied on allow-list only`,
  });

  // ── Step 3: Open Prisma against smoke DB ──────────────────────────────────
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_SMOKE! },
    },
  });

  try {
    // ── Step 4: Sentinel org present? ───────────────────────────────────────
    const org = await prisma.organization.findUnique({
      where: { id: SENTINEL_ORG_ID },
      select: { id: true, name: true, slug: true },
    });
    const orgFound = org !== null && org.id === SENTINEL_ORG_ID;
    results.push({
      step: "sentinel org present",
      pass: orgFound,
      detail: orgFound
        ? `id=${org!.id} name="${org!.name}"`
        : `org id=${SENTINEL_ORG_ID} NOT FOUND — run sentinel-seed.ts first`,
    });

    // ── Step 5: Sentinel workspace present? ─────────────────────────────────
    const ws = await prisma.workspace.findUnique({
      where: { id: SENTINEL_WORKSPACE_ID },
      select: { id: true, name: true, organizationId: true },
    });
    const wsFound = ws !== null && ws.id === SENTINEL_WORKSPACE_ID;
    results.push({
      step: "sentinel workspace present",
      pass: wsFound,
      detail: wsFound
        ? `id=${ws!.id} organizationId=${ws!.organizationId}`
        : `workspace id=${SENTINEL_WORKSPACE_ID} NOT FOUND — run sentinel-seed.ts first`,
    });

    // ── Step 6: Workspace is under sentinel org ──────────────────────────────
    if (wsFound) {
      const parentMatch = ws!.organizationId === SENTINEL_ORG_ID;
      results.push({
        step: "workspace.organizationId = sentinel org",
        pass: parentMatch,
        detail: parentMatch
          ? `organizationId=${ws!.organizationId} ✓`
          : `organizationId=${ws!.organizationId} ≠ ${SENTINEL_ORG_ID} — unexpected`,
      });
    }

    // ── Step 7: Row count sanity (we should NOT see production-scale data) ──
    // We check that the sentinel org exists as a normal org row. We do NOT
    // count all orgs — that would reveal production data volume. Instead, we
    // just verify we can query the table at all.
    const orgTableAccessible = await prisma.organization
      .findFirst({ select: { id: true }, take: 1 })
      .then(() => true)
      .catch(() => false);
    results.push({
      step: "Organization table accessible (read-only)",
      pass: orgTableAccessible,
      detail: orgTableAccessible
        ? "SELECT returned without error"
        : "query failed — DB connectivity issue",
    });

  } finally {
    await prisma.$disconnect();
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const allPass = results.every((r) => r.pass);
  // eslint-disable-next-line no-console
  console.log("\n[connection-probe] ── PROBE REPORT ──────────────────────────");
  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    // eslint-disable-next-line no-console
    console.log(`  ${icon}  ${r.step}`);
    // eslint-disable-next-line no-console
    console.log(`       ${r.detail}`);
  }
  // eslint-disable-next-line no-console
  console.log("─────────────────────────────────────────────────────────────");
  if (allPass) {
    // eslint-disable-next-line no-console
    console.log(
      `[connection-probe] PASS — project-ref=${guarded.projectRef} ` +
        `(ADR-001 §7 criteria 6 CLOSED ✅)`,
    );
  } else {
    const failedSteps = results.filter((r) => !r.pass).map((r) => r.step);
    // eslint-disable-next-line no-console
    console.error(
      `[connection-probe] FAIL — failed steps: ${failedSteps.join(", ")}`,
    );
    process.exit(1);
  }
}

const isDirectRun =
  typeof require !== "undefined" &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (require as any).main === module;

if (isDirectRun) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[connection-probe] ERROR:", err);
    process.exit(1);
  });
}

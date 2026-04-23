/**
 * Migrate Revision Diff — ADR-001 §7 criteria 3
 *
 * Read-only verification that the smoke DB's `_prisma_migrations`
 * ledger matches the repo's `prisma/migrations/` directory.
 *
 * Contract:
 *   - Calls assertSmokeDatabaseTarget() first. The process cannot
 *     reach the database until the §6.1 guard has cleared.
 *   - Lists migration names from the repo filesystem (directory
 *     entries under prisma/migrations/, excluding migration_lock.toml).
 *   - Queries `_prisma_migrations` on DATABASE_URL_SMOKE and collects
 *     the applied migration names.
 *   - Prints a diff: missing (expected but not applied) / extra
 *     (applied but not in repo) / matching.
 *   - No writes. No Prisma data queries. Purely a schema-level probe.
 *
 * Usage:
 *   DATABASE_URL_SMOKE=... \
 *   SMOKE_DB_PROJECT_REF=... \
 *   ALLOWED_SMOKE_DB_SENTINELS=... \
 *   PRODUCTION_DB_PROJECT_REF=... \
 *   pnpm tsx apps/web/scripts/smoke/migrate-revision-diff.ts
 */

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { assertSmokeDatabaseTarget } from "./guard";

// ──────────────────────────────────────────────────────────
// Pure helpers (testable)
// ──────────────────────────────────────────────────────────

export interface MigrationDiff {
  readonly expected: readonly string[]; // repo filesystem list
  readonly applied: readonly string[]; // _prisma_migrations list
  readonly missing: readonly string[]; // in repo, not applied
  readonly extra: readonly string[]; // applied, not in repo
  readonly matches: number;
}

/**
 * Pure diff of two migration name lists. No IO.
 * - `expected` is the repo's prisma/migrations/ directory listing.
 * - `applied` is the DB's _prisma_migrations row set.
 *
 * Result is sorted to make output deterministic.
 */
export function diffMigrationSets(
  expected: readonly string[],
  applied: readonly string[],
): MigrationDiff {
  const expectedSet = new Set(expected);
  const appliedSet = new Set(applied);

  const missing = [...expectedSet]
    .filter((m) => !appliedSet.has(m))
    .sort();
  const extra = [...appliedSet]
    .filter((m) => !expectedSet.has(m))
    .sort();

  let matches = 0;
  for (const m of expectedSet) if (appliedSet.has(m)) matches += 1;

  return {
    expected: [...expected].sort(),
    applied: [...applied].sort(),
    missing,
    extra,
    matches,
  };
}

/**
 * Pure filter — keep directory entries that look like Prisma
 * migration folders (timestamp-prefixed). Exclude `migration_lock.toml`
 * and any stray non-directory noise. The caller supplies the listing.
 */
export function filterMigrationDirNames(
  entries: ReadonlyArray<{ name: string; isDirectory: boolean }>,
): string[] {
  return entries
    .filter((e) => e.isDirectory)
    .map((e) => e.name)
    .filter((n) => !n.startsWith("."))
    .sort();
}

// ──────────────────────────────────────────────────────────
// Filesystem + DB integration (NOT unit tested — manual run)
// ──────────────────────────────────────────────────────────

function loadRepoMigrationNames(): string[] {
  // Resolve against this file's location so the script works from any cwd.
  const root = resolve(__dirname, "..", "..", "prisma", "migrations");
  const entries = readdirSync(root).map((name) => {
    const full = resolve(root, name);
    const s = statSync(full);
    return { name, isDirectory: s.isDirectory() };
  });
  return filterMigrationDirNames(entries);
}

async function loadAppliedMigrationNames(): Promise<string[]> {
  // Dynamic import so the guard runs before any Prisma instantiation.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_SMOKE! },
    },
  });

  try {
    // _prisma_migrations is managed by Prisma itself. We only read it.
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at ASC
    `;
    return rows.map((r) => r.migration_name);
  } finally {
    await prisma.$disconnect();
  }
}

function formatDiff(diff: MigrationDiff): string {
  const lines: string[] = [];
  lines.push(
    `repo migrations    : ${diff.expected.length} (${diff.expected.join(", ") || "—"})`,
  );
  lines.push(
    `applied migrations : ${diff.applied.length} (${diff.applied.join(", ") || "—"})`,
  );
  lines.push(`matches            : ${diff.matches}`);
  lines.push(
    `missing (in repo, not applied) : ${diff.missing.length} ${
      diff.missing.length ? `[${diff.missing.join(", ")}]` : ""
    }`,
  );
  lines.push(
    `extra   (applied, not in repo) : ${diff.extra.length} ${
      diff.extra.length ? `[${diff.extra.join(", ")}]` : ""
    }`,
  );
  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────

async function main() {
  // §6.1 guard must succeed before any DB interaction.
  const guarded = assertSmokeDatabaseTarget();
  // eslint-disable-next-line no-console
  console.log(
    `[migrate-revision-diff] guard passed. project-ref=${guarded.projectRef}`,
  );

  const expected = loadRepoMigrationNames();
  const applied = await loadAppliedMigrationNames();
  const diff = diffMigrationSets(expected, applied);

  // eslint-disable-next-line no-console
  console.log(formatDiff(diff));

  if (diff.missing.length > 0 || diff.extra.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      "[migrate-revision-diff] FAIL: smoke DB migration set does not match the repo.",
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(
    "[migrate-revision-diff] PASS: smoke DB migration set matches the repo.",
  );
}

// Only run when executed directly, not when imported by tests. tsx + node
// provide `require.main === module` at runtime; we cast to silence the
// TS check without changing behavior.
const isDirectRun =
  typeof require !== "undefined" &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (require as any).main === module;

if (isDirectRun) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[migrate-revision-diff] unexpected error:", err);
    process.exit(1);
  });
}

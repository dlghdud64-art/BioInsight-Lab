/**
 * Pilot Tenant Cleanup — #P01 / ADR-002 Phase 4
 *
 * Removes the pilot Organization + Workspace + membership rows + 15
 * seeded Products. Dry-run is the default; `--apply` is required to
 * delete anything. This makes re-running cleanup cannot surprise
 * anyone.
 *
 * Scoping guarantees
 * ------------------
 * - Every delete is keyed on an exact id or a compound @@unique.
 *   No LIKE, no prefix match, no deleteMany, no filter-based delete.
 * - The canonical pilot owner User row is NEVER touched. The
 *   PilotCleanupPrismaClient interface below deliberately omits the
 *   `user` surface so the cleanup cannot even express a delete
 *   against it.
 * - Existence is probed with findUnique BEFORE delete; missing rows
 *   are skipped silently.
 *
 * Usage
 *   # Dry-run (safe default)
 *   pnpm -C apps/web tsx scripts/pilot/pilot-cleanup.ts
 *
 *   # Actually delete
 *   pnpm -C apps/web tsx scripts/pilot/pilot-cleanup.ts --apply
 */

import { assertPilotDatabaseTarget } from "./guard";
import {
  PILOT_OWNER_PROTECTION,
  buildPilotCleanupPlan,
  type PilotModel,
} from "./pilot";

export type CleanupMode = "dry-run" | "apply";

export function parseMode(argv: readonly string[]): CleanupMode {
  return argv.includes("--apply") ? "apply" : "dry-run";
}

// ──────────────────────────────────────────────────────────
// Prisma surfaces needed by cleanup. Deliberately typed to expose
// only findUnique + delete on the 5 allowed models. `user` is NOT
// here — any regression that tries to add it would fail typecheck.
// ──────────────────────────────────────────────────────────

interface Surface<K> {
  readonly findUnique: (args: { where: K }) => Promise<object | null>;
  readonly delete: (args: { where: K }) => Promise<object>;
}

export type WorkspaceMemberWhere = {
  readonly workspaceId_userId: {
    readonly workspaceId: string;
    readonly userId: string;
  };
};

export type OrganizationMemberWhere = {
  readonly userId_organizationId: {
    readonly userId: string;
    readonly organizationId: string;
  };
};

export type IdWhere = { readonly id: string };

export interface PilotCleanupPrismaClient {
  readonly workspaceMember: Surface<WorkspaceMemberWhere>;
  readonly organizationMember: Surface<OrganizationMemberWhere>;
  readonly workspace: Surface<IdWhere>;
  readonly organization: Surface<IdWhere>;
  readonly product: Surface<IdWhere>;
  // NOTE: no `user` surface on purpose. See PILOT_OWNER_PROTECTION.
}

export interface CleanupProbeRecord {
  readonly model: PilotModel;
  readonly where: unknown;
  readonly present: boolean;
}

export interface CleanupDeleteRecord {
  readonly model: PilotModel;
  readonly where: unknown;
}

export interface CleanupResult {
  readonly mode: CleanupMode;
  readonly probes: readonly CleanupProbeRecord[];
  readonly deletedCalls: readonly CleanupDeleteRecord[];
}

export async function runCleanup(
  mode: CleanupMode,
  prisma: PilotCleanupPrismaClient,
  /** Override for smoke-DB deviation (ADR-002 §11). */
  ownerUserIdOverride?: string,
): Promise<CleanupResult> {
  const plan = buildPilotCleanupPlan(ownerUserIdOverride);
  const probes: CleanupProbeRecord[] = [];
  const deletedCalls: CleanupDeleteRecord[] = [];

  for (const op of plan.operations) {
    let entity: object | null = null;

    switch (op.model) {
      case "workspaceMember":
        entity = await prisma.workspaceMember.findUnique({
          where: op.where,
        });
        break;
      case "organizationMember":
        entity = await prisma.organizationMember.findUnique({
          where: op.where,
        });
        break;
      case "workspace":
        entity = await prisma.workspace.findUnique({ where: op.where });
        break;
      case "organization":
        entity = await prisma.organization.findUnique({ where: op.where });
        break;
      case "product":
        entity = await prisma.product.findUnique({ where: op.where });
        break;
    }

    probes.push({
      model: op.model,
      where: op.where,
      present: !!entity,
    });

    if (mode === "apply" && entity) {
      switch (op.model) {
        case "workspaceMember":
          await prisma.workspaceMember.delete({ where: op.where });
          break;
        case "organizationMember":
          await prisma.organizationMember.delete({ where: op.where });
          break;
        case "workspace":
          await prisma.workspace.delete({ where: op.where });
          break;
        case "organization":
          await prisma.organization.delete({ where: op.where });
          break;
        case "product":
          await prisma.product.delete({ where: op.where });
          break;
      }
      deletedCalls.push({ model: op.model, where: op.where });
    }
  }

  return { mode, probes, deletedCalls };
}

async function main() {
  const guarded = assertPilotDatabaseTarget();
  const mode = parseMode(process.argv.slice(2));
  // eslint-disable-next-line no-console
  console.log(
    `[pilot-cleanup] guard passed. project-ref=${guarded.projectRef} mode=${mode}`,
  );
  // eslint-disable-next-line no-console
  console.log(`[pilot-cleanup] ${PILOT_OWNER_PROTECTION}`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_PILOT! },
    },
  });

  try {
    const ownerOverride = process.env.PILOT_OWNER_USER_ID_OVERRIDE;
    const result = await runCleanup(
      mode,
      prisma as unknown as PilotCleanupPrismaClient,
      ownerOverride,
    );

    // eslint-disable-next-line no-console
    console.log("[pilot-cleanup] probes:");
    for (const p of result.probes) {
      // eslint-disable-next-line no-console
      console.log(`  ${p.model.padEnd(20)} present=${p.present}`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-cleanup] deleted calls: ${result.deletedCalls.length}`,
    );
    for (const d of result.deletedCalls) {
      // eslint-disable-next-line no-console
      console.log(`  ${d.model.padEnd(20)} deleted`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-cleanup] PASS (mode=${mode}). Use --apply to delete.`,
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
    console.error("[pilot-cleanup] ERROR:", err);
    process.exit(1);
  });
}

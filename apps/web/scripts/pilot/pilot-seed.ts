/**
 * Pilot Tenant Seed — #P01 / ADR-002 Phase 3
 *
 * Writes the pilot Organization + Workspace + membership rows +
 * 15-product catalog into PRODUCTION DB, gated by the pilot guard.
 *
 * Contract
 * --------
 * 1. assertPilotDatabaseTarget() runs first. No Prisma call is made
 *    until the guard clears (opt-in token + allow-listed
 *    project-ref + DATABASE_URL_PILOT set).
 * 2. The sentinel owner (호영) user row is NEVER created here. If
 *    the user is absent the script aborts — the user is canonical
 *    and must pre-exist from Google OAuth.
 * 3. Every write is an idempotent upsert keyed on either the
 *    primary id or the compound (@@unique) tuple. Re-running is a
 *    no-op.
 * 4. The whole seed runs inside prisma.$transaction so a partial
 *    failure rolls back. Re-run is safe either way.
 *
 * Usage
 * -----
 *   DATABASE_URL_PILOT="<production connection string>" \
 *   ALLOWED_PILOT_DB_SENTINELS="xhidynwpkqeaqjuudhsw" \
 *   PILOT_REQUIRES_EXPLICIT_OPT_IN="YES-SEED-PRODUCTION-PILOT-2026" \
 *   pnpm -C apps/web tsx scripts/pilot/pilot-seed.ts
 */

import { assertPilotDatabaseTarget } from "./guard";
import {
  PILOT_ORG_ID,
  PILOT_ORG_NAME,
  PILOT_ORG_SLUG,
  PILOT_ORG_PLAN,
  PILOT_WORKSPACE_ID,
  PILOT_WORKSPACE_NAME,
  PILOT_WORKSPACE_SLUG,
  PILOT_OWNER_USER_ID,
  PILOT_OWNER_ORG_ROLE,
  PILOT_OWNER_WORKSPACE_ROLE,
  PILOT_PRODUCT_CATALOG,
} from "./pilot";

async function main() {
  const guarded = assertPilotDatabaseTarget();
  // eslint-disable-next-line no-console
  console.log(
    `[pilot-seed] guard passed. project-ref=${guarded.projectRef}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[pilot-seed] target: org=${PILOT_ORG_ID} workspace=${PILOT_WORKSPACE_ID} owner=${PILOT_OWNER_USER_ID} products=${PILOT_PRODUCT_CATALOG.length}`,
  );

  // Dynamic import so the guard runs before any Prisma client is
  // instantiated.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_PILOT! },
    },
  });

  try {
    const summary = await prisma.$transaction(
      async (tx) => {
        // 1. The owner user must already exist. We never create it —
        //    it is canonical and owned by the OAuth provider.
        const owner = await tx.user.findUnique({
          where: { id: PILOT_OWNER_USER_ID },
        });
        if (!owner) {
          throw new Error(
            `[pilot-seed] owner user ${PILOT_OWNER_USER_ID} not found. ` +
              "This script refuses to create the user row (canonical). " +
              "Sign in with the ADMIN account first so the user exists, then re-run.",
          );
        }

        // 2. Organization
        const org = await tx.organization.upsert({
          where: { id: PILOT_ORG_ID },
          create: {
            id: PILOT_ORG_ID,
            name: PILOT_ORG_NAME,
            slug: PILOT_ORG_SLUG,
            plan: PILOT_ORG_PLAN as never,
          },
          update: {},
        });

        // 3. Workspace (FK to Organization — onDelete: Cascade)
        const workspace = await tx.workspace.upsert({
          where: { id: PILOT_WORKSPACE_ID },
          create: {
            id: PILOT_WORKSPACE_ID,
            name: PILOT_WORKSPACE_NAME,
            slug: PILOT_WORKSPACE_SLUG,
            organizationId: PILOT_ORG_ID,
          },
          update: {},
        });

        // 4. OrganizationMember — compound unique (userId, organizationId)
        const orgMember = await tx.organizationMember.upsert({
          where: {
            userId_organizationId: {
              userId: PILOT_OWNER_USER_ID,
              organizationId: PILOT_ORG_ID,
            },
          },
          create: {
            userId: PILOT_OWNER_USER_ID,
            organizationId: PILOT_ORG_ID,
            role: PILOT_OWNER_ORG_ROLE as never,
          },
          update: {},
        });

        // 5. WorkspaceMember — compound unique (workspaceId, userId)
        const workspaceMember = await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: PILOT_WORKSPACE_ID,
              userId: PILOT_OWNER_USER_ID,
            },
          },
          create: {
            workspaceId: PILOT_WORKSPACE_ID,
            userId: PILOT_OWNER_USER_ID,
            role: PILOT_OWNER_WORKSPACE_ROLE as never,
          },
          update: {},
        });

        // 6. Products — idempotent upsert loop (15 items). Each
        //    product is keyed on its exact id from pilot.ts, so
        //    the cleanup side can drop them by the same id without
        //    a filter-based delete.
        const products: Array<{ id: string; name: string }> = [];
        for (const spec of PILOT_PRODUCT_CATALOG) {
          const p = await tx.product.upsert({
            where: { id: spec.id },
            create: {
              id: spec.id,
              name: spec.name,
              nameEn: spec.nameEn,
              category: spec.category as never,
            },
            update: {},
          });
          products.push({ id: p.id, name: p.name });
        }

        return { org, workspace, orgMember, workspaceMember, products };
      },
      {
        // 15 product upserts + 4 parent rows. Default Prisma timeout
        // (5s) can be tight on cold pooler starts; give headroom.
        timeout: 30_000,
        maxWait: 10_000,
      },
    );

    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] organization: id=${summary.org.id} plan=${String(
        summary.org.plan,
      )}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] workspace: id=${summary.workspace.id} organizationId=${summary.workspace.organizationId}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] organizationMember: userId=${summary.orgMember.userId} role=${String(
        summary.orgMember.role,
      )}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] workspaceMember: userId=${summary.workspaceMember.userId} role=${String(
        summary.workspaceMember.role,
      )}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] products: ${summary.products.length} upserted`,
    );
    for (const p of summary.products) {
      // eslint-disable-next-line no-console
      console.log(`  - ${p.id}  ${p.name}`);
    }
    // eslint-disable-next-line no-console
    console.log("[pilot-seed] PASS");
    // eslint-disable-next-line no-console
    console.log(
      "[pilot-seed] NEXT: probe /api/organizations/mine + /api/products/search; cleanup via pilot-cleanup.ts --apply (Phase 4).",
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
    console.error("[pilot-seed] ERROR:", err);
    process.exit(1);
  });
}

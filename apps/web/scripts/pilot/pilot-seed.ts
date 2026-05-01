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
 *   ALLOWED_PILOT_DB_SENTINELS="xhidynwpkqeaojuudhsw" \
 *   PILOT_REQUIRES_EXPLICIT_OPT_IN="YES-SEED-PRODUCTION-PILOT-2026" \
 *   pnpm -C apps/web tsx scripts/pilot/pilot-seed.ts
 *
 * NOTE (ADR-002 §11.7): DATABASE_URL_PILOT MUST point at Supabase
 * SESSION pooler (port :5432), NOT transaction pooler (:6543). Prisma
 * `$transaction` requires a sticky connection — transaction pooler
 * dispatches statements across different backends and breaks the
 * session-scoped locks. Symptom is hang / timeout with no error row.
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
  PILOT_VENDOR_CATALOG,
  PILOT_PRODUCT_VENDOR_LINKS,
  // §11.178 — Quote + Inventory pilot fixtures
  PILOT_QUOTE_CATALOG,
  PILOT_INVENTORY_CATALOG,
  // §11.178b — Order pilot fixtures
  PILOT_ORDER_CATALOG,
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
        //    PILOT_OWNER_USER_ID_OVERRIDE: smoke-DB deviation only (ADR-002 §11).
        //    Set to the smoke DB user's cuid when the smoke DB has the same
        //    email under a different id than production.
        const resolvedOwnerId =
          process.env.PILOT_OWNER_USER_ID_OVERRIDE ?? PILOT_OWNER_USER_ID;
        const owner = await tx.user.findUnique({
          where: { id: resolvedOwnerId },
        });
        if (!owner) {
          throw new Error(
            `[pilot-seed] owner user ${resolvedOwnerId} not found. ` +
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
              userId: resolvedOwnerId,
              organizationId: PILOT_ORG_ID,
            },
          },
          create: {
            userId: resolvedOwnerId,
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
              userId: resolvedOwnerId,
            },
          },
          create: {
            workspaceId: PILOT_WORKSPACE_ID,
            userId: resolvedOwnerId,
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

        // 7. Vendors — pilot vendor catalog (ADR-002 §11.20).
        //    Currently a single supplier (Thermo Fisher Scientific) so
        //    every pilot product has a non-pending vendor-present path
        //    to exercise. Vendor.id is fixed in pilot.ts so cleanup is
        //    keyed on the exact id, not a filter.
        const vendors: Array<{ id: string; name: string }> = [];
        for (const spec of PILOT_VENDOR_CATALOG) {
          const v = await tx.vendor.upsert({
            where: { id: spec.id },
            create: {
              id: spec.id,
              name: spec.name,
              nameEn: spec.nameEn,
              email: spec.email ?? undefined,
              country: spec.country,
              currency: spec.currency,
            },
            update: {},
          });
          vendors.push({ id: v.id, name: v.name });
        }

        // 8. ProductVendor links — 15 rows, one per pilot product.
        //    Keyed on the deterministic `id` from pilot.ts so re-runs
        //    upsert in place. ProductVendor cascades on either Product
        //    or Vendor delete (schema), so cleanup never needs to
        //    delete ProductVendor explicitly — see buildPilotCleanupPlan.
        const productVendors: Array<{ id: string; productId: string; vendorId: string }> = [];
        for (const link of PILOT_PRODUCT_VENDOR_LINKS) {
          const pv = await tx.productVendor.upsert({
            where: { id: link.id },
            create: {
              id: link.id,
              productId: link.productId,
              vendorId: link.vendorId,
              priceInKRW: link.priceInKRW,
              currency: "KRW",
              stockStatus: link.stockStatus,
              leadTime: link.leadTime,
            },
            update: {
              // Idempotent re-runs refresh price / stock / leadTime so
              // the operator can adjust placeholder values in pilot.ts
              // and re-seed without manual SQL.
              priceInKRW: link.priceInKRW,
              stockStatus: link.stockStatus,
              leadTime: link.leadTime,
            },
          });
          productVendors.push({
            id: pv.id,
            productId: pv.productId,
            vendorId: pv.vendorId,
          });
        }

        // 9. §11.178 — Quote pilot fixtures (1 row).
        //    Quote.organizationId 는 onDelete: SetNull 이라 cleanup 시 별도 op 필요.
        //    userId 는 PILOT_OWNER_USER_ID 로 고정 (canonical user 보호: cascade
        //    on user delete 가 있으나 user 자체는 cleanup 대상 0).
        //    quoteNumber 는 고정 시 unique 충돌 가능 → null 로 두고 surface 에서
        //    필요 시 backfill (§11.19 quote-number utility).
        const quotes: Array<{ id: string; title: string }> = [];
        for (const spec of PILOT_QUOTE_CATALOG) {
          const q = await tx.quote.upsert({
            where: { id: spec.id },
            create: {
              id: spec.id,
              userId: ownerUserId,
              organizationId: PILOT_ORG_ID,
              workspaceId: PILOT_WORKSPACE_ID,
              title: spec.title,
              description: spec.description,
              status: spec.status as never,
              currency: spec.currency,
              totalAmount: spec.totalAmount,
            },
            update: {
              title: spec.title,
              description: spec.description,
              status: spec.status as never,
              totalAmount: spec.totalAmount,
            },
          });
          quotes.push({ id: q.id, title: q.title });
        }

        // 10. §11.178 — ProductInventory pilot fixtures (3 rows).
        //     ProductInventory.organizationId 는 onDelete: Cascade 라 org 삭제 시
        //     자동 cleanup. cleanup operation 별도 등록 0.
        //     compound unique (organizationId, productId) 활용.
        const inventories: Array<{ id: string; productId: string; currentQuantity: number }> = [];
        for (const spec of PILOT_INVENTORY_CATALOG) {
          const inv = await tx.productInventory.upsert({
            where: { id: spec.id },
            create: {
              id: spec.id,
              organizationId: PILOT_ORG_ID,
              productId: spec.productId,
              currentQuantity: spec.currentQuantity,
              unit: spec.unit,
              safetyStock: spec.safetyStock,
              minOrderQty: spec.minOrderQty,
              location: spec.location,
              lotNumber: spec.lotNumber,
            },
            update: {
              currentQuantity: spec.currentQuantity,
              safetyStock: spec.safetyStock,
              minOrderQty: spec.minOrderQty,
              location: spec.location,
            },
          });
          inventories.push({
            id: inv.id,
            productId: inv.productId,
            currentQuantity: inv.currentQuantity,
          });
        }

        // 11. §11.178b — Order pilot fixtures (1 row, 1:1 with quote).
        //     Order.quoteId 는 unique 이고 onDelete: Cascade — Quote 삭제 시
        //     자동 삭제되어 cleanup operation 등록 불필요.
        //     orderNumber 는 deterministic 으로 고정 (`ORD-PILOT-2026-0001`).
        const orders: Array<{ id: string; quoteId: string; orderNumber: string }> = [];
        for (const spec of PILOT_ORDER_CATALOG) {
          const ord = await tx.order.upsert({
            where: { id: spec.id },
            create: {
              id: spec.id,
              userId: ownerUserId,
              organizationId: PILOT_ORG_ID,
              quoteId: spec.quoteId,
              orderNumber: spec.orderNumber,
              totalAmount: spec.totalAmount,
              status: spec.status as never,
              notes: spec.notes,
            },
            update: {
              totalAmount: spec.totalAmount,
              status: spec.status as never,
              notes: spec.notes,
            },
          });
          orders.push({
            id: ord.id,
            quoteId: ord.quoteId,
            orderNumber: ord.orderNumber,
          });
        }

        return { org, workspace, orgMember, workspaceMember, products, vendors, productVendors, quotes, inventories, orders };
      },
      {
        // 15 product upserts + 1 vendor + 15 productVendor + 4 parent
        // rows + §11.178 1 quote + 3 inventory + §11.178b 1 order = 40 writes. 30s 여전 충분.
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
    console.log(
      `[pilot-seed] vendors: ${summary.vendors.length} upserted`,
    );
    for (const v of summary.vendors) {
      // eslint-disable-next-line no-console
      console.log(`  - ${v.id}  ${v.name}`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] productVendor links: ${summary.productVendors.length} upserted`,
    );
    // §11.178 — quote + inventory log
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] quotes: ${summary.quotes.length} upserted`,
    );
    for (const q of summary.quotes) {
      // eslint-disable-next-line no-console
      console.log(`  - ${q.id}  ${q.title}`);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] inventories: ${summary.inventories.length} upserted`,
    );
    for (const inv of summary.inventories) {
      // eslint-disable-next-line no-console
      console.log(`  - ${inv.id}  product=${inv.productId}  qty=${inv.currentQuantity}`);
    }
    // §11.178b — order log
    // eslint-disable-next-line no-console
    console.log(
      `[pilot-seed] orders: ${summary.orders.length} upserted`,
    );
    for (const ord of summary.orders) {
      // eslint-disable-next-line no-console
      console.log(`  - ${ord.id}  quoteId=${ord.quoteId}  orderNumber=${ord.orderNumber}`);
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

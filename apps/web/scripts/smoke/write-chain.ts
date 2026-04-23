/**
 * Write Chain Smoke — #26 S01 / S02 / S03 (API-level, ADR-001 Path C)
 *
 * Exercises the canonical truth write path end-to-end against the
 * isolated Supabase test project:
 *
 *   S01 — create a Quote + QuoteListItem under the sentinel org /
 *         workspace / user.
 *   S02 — transition the Quote status to COMPLETED and create the
 *         matching Order + OrderItem.
 *   S03 — upsert ProductInventory for the sentinel product inside
 *         the sentinel organization.
 *
 * All writes are scoped to the sentinel identifiers exported from
 * ./sentinel. Nothing outside the sentinel scope is touched, so the
 * pre-existing #16c evidence (see ADR-001 §11.2) is safe.
 *
 * Runs are additive: each invocation creates a fresh Quote / Order
 * and increments the sentinel inventory. Cleanup is the job of
 * sentinel-cleanup --apply (one delete cascades every smoke row in
 * a single pass).
 *
 * Usage:
 *   DATABASE_URL_SMOKE=... \
 *   SMOKE_DB_PROJECT_REF=... \
 *   ALLOWED_SMOKE_DB_SENTINELS=... \
 *   PRODUCTION_DB_PROJECT_REF=... \
 *   pnpm -C apps/web tsx scripts/smoke/write-chain.ts
 */

import { assertSmokeDatabaseTarget } from "./guard";
import {
  SENTINEL_ORG_ID,
  SENTINEL_WORKSPACE_ID,
  SENTINEL_USER_ID,
  SENTINEL_PRODUCT_ID,
} from "./sentinel";

// ──────────────────────────────────────────────────────────
// Pure builders (testable — no Prisma, no env)
// ──────────────────────────────────────────────────────────

export interface SmokeRunContext {
  readonly runId: string;
  readonly startedAt: Date;
}

export function createRunContext(now: number = Date.now()): SmokeRunContext {
  return {
    runId: `smoke-${now}`,
    startedAt: new Date(now),
  };
}

export interface SmokeQuoteData {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status: "PENDING";
  readonly currency: "KRW";
}

export function buildSmokeQuoteData(runId: string): SmokeQuoteData {
  return {
    userId: SENTINEL_USER_ID,
    organizationId: SENTINEL_ORG_ID,
    workspaceId: SENTINEL_WORKSPACE_ID,
    title: `Smoke Write Chain — ${runId}`,
    status: "PENDING",
    currency: "KRW",
  };
}

export interface SmokeQuoteItemData {
  readonly productId: string;
  readonly name: string;
  readonly quantity: 1;
  readonly unitPrice: 10000;
  readonly lineTotal: 10000;
  readonly unit: "ea";
  readonly currency: "KRW";
}

export function buildSmokeQuoteItemData(): SmokeQuoteItemData {
  return {
    productId: SENTINEL_PRODUCT_ID,
    name: "Smoke Quote Line Item",
    quantity: 1,
    unitPrice: 10000,
    lineTotal: 10000,
    unit: "ea",
    currency: "KRW",
  };
}

export interface SmokeOrderData {
  readonly userId: string;
  readonly quoteId: string;
  readonly organizationId: string;
  readonly orderNumber: string;
  readonly totalAmount: 10000;
}

export function buildSmokeOrderData(
  runId: string,
  quoteId: string,
): SmokeOrderData {
  return {
    userId: SENTINEL_USER_ID,
    quoteId,
    organizationId: SENTINEL_ORG_ID,
    orderNumber: `ORD-SMOKE-${runId}`,
    totalAmount: 10000,
  };
}

export interface SmokeOrderItemData {
  readonly name: string;
  readonly quantity: 1;
  readonly unitPrice: 10000;
  readonly lineTotal: 10000;
}

export function buildSmokeOrderItemData(): SmokeOrderItemData {
  return {
    name: "Smoke Order Line Item",
    quantity: 1,
    unitPrice: 10000,
    lineTotal: 10000,
  };
}

export interface SmokeInventoryWhere {
  readonly organizationId_productId: {
    readonly organizationId: string;
    readonly productId: string;
  };
}

export function buildSmokeInventoryWhere(): SmokeInventoryWhere {
  return {
    organizationId_productId: {
      organizationId: SENTINEL_ORG_ID,
      productId: SENTINEL_PRODUCT_ID,
    },
  };
}

// ──────────────────────────────────────────────────────────
// Assertion helpers (pure, for test + runtime)
// ──────────────────────────────────────────────────────────

export function assertSentinelScoped(row: {
  organizationId?: string | null;
}): void {
  if (row.organizationId !== SENTINEL_ORG_ID) {
    throw new Error(
      `[write-chain] scope violation: organizationId=${String(
        row.organizationId,
      )}, expected=${SENTINEL_ORG_ID}`,
    );
  }
}

export function assertSentinelUserOwned(row: {
  userId?: string | null;
}): void {
  if (row.userId !== SENTINEL_USER_ID) {
    throw new Error(
      `[write-chain] owner violation: userId=${String(
        row.userId,
      )}, expected=${SENTINEL_USER_ID}`,
    );
  }
}

// ──────────────────────────────────────────────────────────
// Entry point (integrates Prisma + guard + chain)
// ──────────────────────────────────────────────────────────

async function main() {
  const guarded = assertSmokeDatabaseTarget();
  const ctx = createRunContext();
  // eslint-disable-next-line no-console
  console.log(
    `[write-chain] guard passed. project-ref=${guarded.projectRef} runId=${ctx.runId}`,
  );

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL_SMOKE! },
    },
  });

  try {
    // ── S01 — Quote + QuoteListItem ─────────────────────
    // eslint-disable-next-line no-console
    console.log("[write-chain] S01: creating Quote + QuoteListItem ...");
    const quote = await prisma.quote.create({
      data: {
        ...buildSmokeQuoteData(ctx.runId),
        items: { create: [buildSmokeQuoteItemData()] },
      },
      include: { items: true },
    });
    assertSentinelScoped(quote);
    assertSentinelUserOwned(quote);
    if (quote.items.length !== 1) {
      throw new Error(
        `[write-chain] S01: expected 1 QuoteListItem, got ${quote.items.length}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `[write-chain] S01 PASS: quoteId=${quote.id} items=${quote.items.length}`,
    );

    // ── S02 — Quote → COMPLETED + Order ─────────────────
    // eslint-disable-next-line no-console
    console.log("[write-chain] S02: transitioning Quote + creating Order ...");
    const completed = await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "COMPLETED" },
    });
    if (completed.status !== "COMPLETED") {
      throw new Error(
        `[write-chain] S02: expected status=COMPLETED, got ${completed.status}`,
      );
    }
    const order = await prisma.order.create({
      data: {
        ...buildSmokeOrderData(ctx.runId, quote.id),
        items: { create: [buildSmokeOrderItemData()] },
      },
      include: { items: true },
    });
    assertSentinelScoped(order);
    assertSentinelUserOwned(order);
    if (order.quoteId !== quote.id) {
      throw new Error(
        `[write-chain] S02: order.quoteId=${order.quoteId}, expected=${quote.id}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `[write-chain] S02 PASS: orderId=${order.id} orderNumber=${order.orderNumber}`,
    );

    // ── S03 — ProductInventory upsert ───────────────────
    // eslint-disable-next-line no-console
    console.log("[write-chain] S03: upserting ProductInventory ...");
    const inventory = await prisma.productInventory.upsert({
      where: buildSmokeInventoryWhere(),
      create: {
        organizationId: SENTINEL_ORG_ID,
        productId: SENTINEL_PRODUCT_ID,
        currentQuantity: 1,
        unit: "ea",
      },
      update: {
        currentQuantity: { increment: 1 },
      },
    });
    assertSentinelScoped(inventory);
    if (inventory.productId !== SENTINEL_PRODUCT_ID) {
      throw new Error(
        `[write-chain] S03: inventory.productId=${inventory.productId}, expected=${SENTINEL_PRODUCT_ID}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `[write-chain] S03 PASS: inventoryId=${inventory.id} currentQuantity=${inventory.currentQuantity}`,
    );

    // ── Closeout ────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log(
      `[write-chain] ALL PASS (runId=${ctx.runId}). Created: quote=${quote.id} order=${order.id} inventory=${inventory.id}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      "[write-chain] NEXT: run sentinel-cleanup --apply when you want to drop all smoke rows.",
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[write-chain] FAIL (runId=${ctx.runId}):`, err);
    // eslint-disable-next-line no-console
    console.error(
      "[write-chain] partial rows (if any) will be removed by: pnpm tsx scripts/smoke/sentinel-cleanup.ts --apply",
    );
    process.exit(1);
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
    console.error("[write-chain] unexpected error:", err);
    process.exit(1);
  });
}

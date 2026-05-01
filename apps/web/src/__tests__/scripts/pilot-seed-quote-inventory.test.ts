/**
 * §11.178 #pilot-tenant-seed-quote-purchase-inventory (Phase 1: quote 1 + inventory 3)
 *
 * pilot.ts catalog + buildPilotCleanupPlan + pilot-seed.ts 통합 검증.
 *
 * Order 추가는 §11.178b 별도 batch — quote/inventory 만 우선.
 */

import { describe, it, expect } from "vitest";
import {
  PILOT_QUOTE_CATALOG,
  PILOT_QUOTE_IDS,
  PILOT_INVENTORY_CATALOG,
  PILOT_INVENTORY_IDS,
  PILOT_PRODUCT_IDS,
  buildPilotCleanupPlan,
} from "../../../scripts/pilot/pilot";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.178 PILOT_QUOTE_CATALOG", () => {
  it("정확히 1건 (Phase 1 minimum fixture)", () => {
    expect(PILOT_QUOTE_CATALOG).toHaveLength(1);
  });

  it("필수 field — id / title / status / currency / totalAmount", () => {
    const q = PILOT_QUOTE_CATALOG[0];
    expect(q.id).toMatch(/^quote-pilot-/);
    expect(q.title.length).toBeGreaterThan(0);
    expect(q.currency).toBe("KRW");
    expect(q.totalAmount).toBeGreaterThan(0);
    expect(["PENDING", "REPLIED", "REVIEW_REQUIRED", "READY_FOR_PO", "COMPLETED"]).toContain(q.status);
  });

  it("PILOT_QUOTE_IDS 길이 = catalog 길이", () => {
    expect(PILOT_QUOTE_IDS.length).toBe(PILOT_QUOTE_CATALOG.length);
  });
});

describe("§11.178 PILOT_INVENTORY_CATALOG", () => {
  it("정확히 3건 (DMEM 부족 / FBS 충분 / Trypsin 0재고)", () => {
    expect(PILOT_INVENTORY_CATALOG).toHaveLength(3);
  });

  it("모든 productId 가 PILOT_PRODUCT_IDS 안에 존재 — FK orphan 0", () => {
    const productIdSet = new Set(PILOT_PRODUCT_IDS);
    for (const inv of PILOT_INVENTORY_CATALOG) {
      expect(productIdSet.has(inv.productId), `${inv.productId} not in PILOT_PRODUCT_IDS`).toBe(true);
    }
  });

  it("currentQuantity / safetyStock / minOrderQty 모두 음수 아님", () => {
    for (const inv of PILOT_INVENTORY_CATALOG) {
      expect(inv.currentQuantity).toBeGreaterThanOrEqual(0);
      expect(inv.safetyStock).toBeGreaterThanOrEqual(0);
      expect(inv.minOrderQty).toBeGreaterThan(0);
    }
  });

  it("PILOT_INVENTORY_IDS 길이 = catalog 길이", () => {
    expect(PILOT_INVENTORY_IDS.length).toBe(PILOT_INVENTORY_CATALOG.length);
  });
});

describe("§11.178 buildPilotCleanupPlan — quote operation 추가", () => {
  it("quote model 정확히 1개 op", () => {
    const plan = buildPilotCleanupPlan();
    const quoteOps = plan.operations.filter((o) => o.model === "quote");
    expect(quoteOps).toHaveLength(1);
  });

  it("quote op 의 where.id 가 PILOT_QUOTE_IDS 와 일치", () => {
    const plan = buildPilotCleanupPlan();
    const quoteOps = plan.operations.filter((o) => o.model === "quote");
    const ids = quoteOps.map((o) => (o.where as { id: string }).id).sort();
    expect(ids).toEqual([...PILOT_QUOTE_IDS].sort());
  });

  it("quote op 가 organization op 보다 먼저 등장 (SetNull orphan 방지)", () => {
    const plan = buildPilotCleanupPlan();
    const models = plan.operations.map((o) => o.model);
    const quoteIdx = models.indexOf("quote");
    const orgIdx = models.indexOf("organization");
    expect(quoteIdx).toBeGreaterThan(-1);
    expect(orgIdx).toBeGreaterThan(-1);
    expect(quoteIdx).toBeLessThan(orgIdx);
  });

  it("inventory cleanup op 등록 0 — ProductInventory 는 org Cascade 로 처리됨", () => {
    const plan = buildPilotCleanupPlan();
    const inventoryOps = plan.operations.filter(
      (o) => (o as unknown as { model: string }).model === "productInventory",
    );
    expect(inventoryOps).toHaveLength(0);
  });
});

describe("§11.178 pilot-seed.ts upsert 로직", () => {
  // REPO_ROOT 가 __dirname 4단계 위 (apps) 이므로 web/scripts/...
  const PATH = "web/scripts/pilot/pilot-seed.ts";

  it("PILOT_QUOTE_CATALOG / PILOT_INVENTORY_CATALOG import", () => {
    const src = read(PATH);
    expect(src).toMatch(/PILOT_QUOTE_CATALOG/);
    expect(src).toMatch(/PILOT_INVENTORY_CATALOG/);
  });

  it("tx.quote.upsert 호출 (idempotent)", () => {
    const src = read(PATH);
    expect(src).toMatch(/tx\.quote\.upsert/);
  });

  it("tx.productInventory.upsert 호출 (idempotent)", () => {
    const src = read(PATH);
    expect(src).toMatch(/tx\.productInventory\.upsert/);
  });

  it("quote upsert 가 organizationId / workspaceId 채움", () => {
    const src = read(PATH);
    expect(src).toMatch(/tx\.quote\.upsert[\s\S]*?organizationId:\s*PILOT_ORG_ID/);
    expect(src).toMatch(/tx\.quote\.upsert[\s\S]*?workspaceId:\s*PILOT_WORKSPACE_ID/);
  });

  it("inventory upsert 가 organizationId 채움 (org Cascade 의존)", () => {
    const src = read(PATH);
    expect(src).toMatch(/tx\.productInventory\.upsert[\s\S]*?organizationId:\s*PILOT_ORG_ID/);
  });
});

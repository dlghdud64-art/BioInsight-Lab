/**
 * #inventory-lot-entity (RED -> GREEN) — COA lot-scoping via InventoryRestock.
 *
 * lot = InventoryRestock(기존). COA를 lot에 종속.
 * - P2: context-panel이 real restockRecords 렌더(generateMockLots 제거).
 * - P3: SDSDocument.restockId FK + CHECK(coa→restockId NOT NULL). route restockId 수용.
 * - P4: COA 업로드/열람을 lot(restockId) 카드 단위로 (GREEN).
 * 회귀: P1-1 catalog COA 미노출, catalog SDS 보존.
 *
 * Phase 1 기대: schema/route/surface RED, 회귀 GREEN.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(WEB, rel), "utf8");

const SCHEMA = "prisma/schema.prisma";
const ROUTE = "src/app/api/products/[id]/sds/route.ts";
const PANEL = "src/components/inventory/inventory-context-panel.tsx";
const PAGE = "src/app/products/[id]/page.tsx";
const MAIN = "src/app/dashboard/inventory/inventory-main.tsx";
const SDS = "src/components/safety/sds-documents-section.tsx";
const MIG = "prisma/migrations";

function migrationsContain(re: RegExp): boolean {
  const dir = join(WEB, MIG);
  if (!existsSync(dir)) return false;
  for (const d of readdirSync(dir)) {
    const sql = join(dir, d, "migration.sql");
    if (existsSync(sql) && re.test(readFileSync(sql, "utf8"))) return true;
  }
  return false;
}

describe("#inventory-lot-entity P3 — schema restockId + CHECK (RED)", () => {
  it("SDSDocument 에 restockId(nullable FK) 추가", () => {
    const block = read(SCHEMA).match(/model SDSDocument \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/restockId\s+String\?/);
  });
  it("CHECK 양조건 — coa→restockId NOT NULL", () => {
    expect(migrationsContain(/CHECK[\s\S]*"?docType"?\s*=\s*'coa'[\s\S]*"?restockId"?\s+IS\s+NOT\s+NULL/i)).toBe(true);
  });
});

describe("#inventory-lot-entity P3 — route restockId 수용 (RED)", () => {
  it("upload route restockId 처리", () => {
    expect(read(ROUTE)).toContain("restockId");
  });
});

describe("#inventory-lot-entity P2 — real-lot 렌더 (RED)", () => {
  it("generateMockLots 제거", () => {
    expect(read(PANEL)).not.toContain("generateMockLots");
  });
  it("panel real restock 매핑(realLots/item.restocks)", () => {
    const src = read(PANEL);
    expect(src).toContain("realLots");
    expect(src).toContain("item.restocks");
  });
  it("inventory-main이 restockRecords plumb", () => {
    expect(read(MAIN)).toContain("restockRecords");
  });
});

describe("#inventory-lot-entity P4 — per-lot COA surface (GREEN)", () => {
  it("ContextLotInfo restockId 필드", () => {
    expect(read(PANEL)).toContain("restockId: string");
  });
  it("realLots restockId 매핑(r.id)", () => {
    expect(read(PANEL)).toContain("restockId: r.id");
  });
  it("panel COA를 lot(restockId) 단위로 렌더", () => {
    expect(read(PANEL)).toContain("restockId={lot.restockId}");
  });
  it("item-level COA(inventoryId) section 제거", () => {
    expect(read(PANEL)).not.toContain('docType="coa" inventoryId={item.id}');
  });
  it("SdsDocumentsSection restockId prop 수용", () => {
    expect(read(SDS)).toContain("restockId");
  });
  it("GET route restockId 필터", () => {
    const r = read(ROUTE);
    expect(r).toContain('searchParams.get("restockId")');
  });
});

describe("#inventory-lot-entity 회귀 (GREEN)", () => {
  it("catalog COA 미노출 (P1-1)", () => {
    expect(read(PAGE)).not.toContain('docType="coa"');
  });
  it("catalog SDS 보존", () => {
    expect(read(PAGE)).toContain('docType="sds"');
  });
});

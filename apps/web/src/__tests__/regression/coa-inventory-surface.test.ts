/**
 * §detail-page P3 (RED→GREEN) — COA lot-scoped surface (route + inventory) sentinel.
 *
 * Track: #coa-inventory-surface (reconcile P1-3 deferred RED 해소).
 * COA(시험성적서)는 catalog(제품)이 아니라 inventory record(ProductInventory)에 귀속.
 * - route: POST가 inventoryId 수용(coa→필수, sds→null). P2 CHECK(coa→NOT NULL) 정합.
 * - SdsDocumentsSection: inventoryId prop 추가(upload FormData + GET 필터).
 * - InventoryContextPanel: docType="coa" 섹션을 same-canvas로 흡수, real item.id 게이트(mock 비활성).
 * 회귀(GREEN): catalog SDS 보존(docType="sds"), P1-1(catalog COA 미노출).
 *
 * Phase 1 기대: route/section/panel describe = RED, 회귀 describe = GREEN.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(APP_WEB_ROOT, rel), "utf8");

const ROUTE = "src/app/api/products/[id]/sds/route.ts";
const SECTION = "src/components/safety/sds-documents-section.tsx";
const PANEL = "src/components/inventory/inventory-context-panel.tsx";
const PAGE = "src/app/products/[id]/page.tsx";

describe("P3-route — upload route가 inventoryId 수용 (P1-3)", () => {
  it("POST route에 inventoryId 처리 존재", () => {
    expect(read(ROUTE)).toContain("inventoryId");
  });
});

describe("P3-section — SdsDocumentsSection inventoryId prop", () => {
  it("inventoryId prop 수용", () => {
    expect(read(SECTION)).toContain("inventoryId");
  });
});

describe("P3-surface — InventoryContextPanel COA 섹션", () => {
  it("SdsDocumentsSection docType=coa 흡수", () => {
    const src = read(PANEL);
    expect(src).toContain("SdsDocumentsSection");
    expect(src).toContain('docType="coa"');
  });
  it("COA에 inventoryId(item.id) 전달", () => {
    expect(read(PANEL)).toContain("inventoryId={item.id}");
  });
  it("mock 재고는 COA 비활성 게이트(real id만)", () => {
    expect(read(PANEL)).toContain('startsWith("mock")');
  });
});

describe("P3-regression(GREEN) — catalog SDS 보존 / P1-1 미회귀", () => {
  it("catalog SDS는 유지(docType=sds)", () => {
    expect(read(PAGE)).toContain('docType="sds"');
  });
  it("catalog COA는 미노출(P1-1)", () => {
    expect(read(PAGE)).not.toContain('docType="coa"');
  });
});

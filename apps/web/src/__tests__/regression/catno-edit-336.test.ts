/**
 * §11.336 (회귀) — 제품 Cat.No 편집 동선 sentinel
 *
 * 진단: 신규 등록/라벨 스캔/import 는 catalogNumber 저장 ✅. 기존 재고 사후 편집 ❌(PATCH 미수용).
 * 수정: inventory/[id] PATCH 가 catalogNumber 수용 → 연결 Product 마스터 update(옵션 A).
 *   AddInventoryModal 편집모드 Cat.No 입력 활성화 + 부모 PATCH body 전달(content/main 2화면).
 *
 * 환각 방지(§11.335): 자동 생성 X, 사용자 입력만. 빈 값 → null(채우기 취소).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/inventory/[id]/route.ts";
const MODAL = "src/components/inventory/AddInventoryModal.tsx";
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";
const MAIN = "src/app/dashboard/inventory/inventory-main.tsx";

describe("§11.336 — PATCH route Cat.No 수용 + Product 마스터 update(옵션 A)", () => {
  it("body 에서 catalogNumber 구조분해 + 정규화(빈 값→null)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/catalogNumber,\s*\/\/ §11\.336/);
    expect(src).toMatch(/resolvedCatalogNumber/);
    expect(src).toMatch(/catalogNumber\.trim\(\)\s*!==\s*""/);
  });
  it("연결 Product 마스터 catalogNumber update (트랜잭션)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/tx\.product\.update\(\{[\s\S]{0,120}catalogNumber: resolvedCatalogNumber/);
    expect(src).toMatch(/existingInventory\.productId/);
  });
  it("값 변경 시에만 update(prev !== resolved) — 불필요 write 회피", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/prevCatNo !== resolvedCatalogNumber/);
  });
});

describe("§11.336 — AddInventoryModal 편집모드 Cat.No 입력 활성화", () => {
  it("editableCatNo state + 편집모드 prefill", () => {
    const src = read(MODAL);
    expect(src).toMatch(/const \[editableCatNo, setEditableCatNo\]/);
  });
  it("catNo input 편집모드만 editable(readOnly={!inventory})", () => {
    const src = read(MODAL);
    expect(src).toMatch(/data-testid="catno-edit-input"/);
    expect(src).toMatch(/readOnly=\{!inventory\}/);
    expect(src).toMatch(/value=\{inventory \? editableCatNo : formCatNo\}/);
  });
  it("handleSubmit 편집모드 catalogNumber 포함(빈 값→null)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/inventory \? \{ catalogNumber: editableCatNo\.trim\(\) \|\| null \}/);
  });
});

describe("§11.336 — 부모 핸들러 PATCH body catalogNumber 전달(2화면)", () => {
  it("inventory-content edit body 에 catalogNumber", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/catalogNumber: formPayload\.catalogNumber/);
  });
  it("inventory-main edit body 에 catalogNumber", () => {
    const src = read(MAIN);
    expect(src).toMatch(/catalogNumber: data\.catalogNumber/);
  });
});

describe("§11.336 회귀 0 — 기존 PATCH 동작 보존", () => {
  it("기존 quantity/location/lotNumber PATCH 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/updateData\.currentQuantity/);
    expect(src).toMatch(/updateData\.lotNumber/);
  });
  it("RBAC inventory_update enforceAction 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/action: 'inventory_update'/);
  });
});

/**
 * §inventory-redesign P3 (호영님 2026-07-10) — 재고 테이블 위치 이동 실 배선.
 *   PLAN_inventory-redesign Phase 3. 핸드오프 §재고 테이블(inline 위치지정).
 *
 * 매핑 결론: Lot 펼침(expandedProducts) + inline 위치 UI(onMoveLocation) 는 라이브 이미 정합.
 *   유일 이슈 = onMoveLocation 이 fake success 토스트("위치 이동 기능은 곧 제공될 예정입니다").
 *   → 실 mutation(PATCH /api/inventory/[id] location 저장) 존재하므로 편집 모달 재사용으로 배선.
 *
 * canonical 보존:
 *   - InventoryTable onMoveLocation / expandedProducts / toggleExpand prop·state 보존.
 *   - 위치 저장 truth = PATCH /api/inventory/[id] (신규 mutation 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";
const MAIN = "src/app/dashboard/inventory/inventory-main.tsx";
const TABLE = "src/components/inventory/InventoryTable.tsx";

describe("§inventory-redesign P3 — onMoveLocation fake success 제거 + 편집 모달 배선", () => {
  it("content: 위치 이동 fake toast('곧 제공') 잔재 0", () => {
    const src = read(CONTENT);
    expect(src).not.toMatch(/위치 이동 기능은 곧 제공될 예정입니다/);
  });

  it("main: 위치 이동 fake toast('곧 제공') 잔재 0", () => {
    const src = read(MAIN);
    expect(src).not.toMatch(/위치 이동 기능은 곧 제공될 예정입니다/);
  });

  it("content: onMoveLocation → 편집 모달(setEditingInventory + setIsDialogOpen) 실 배선", () => {
    const src = read(CONTENT);
    expect(src).toMatch(
      /onMoveLocation=\{\(inventory\)\s*=>\s*\{[\s\S]{0,240}setEditingInventory\(inventory\);[\s\S]{0,80}setIsDialogOpen\(true\);/,
    );
  });

  it("main: onMoveLocation → 편집 모달(setEditingInventory + setIsDialogOpen) 실 배선", () => {
    const src = read(MAIN);
    expect(src).toMatch(
      /onMoveLocation=\{\(inventory\)\s*=>\s*\{[\s\S]{0,240}setEditingInventory\(inventory\);[\s\S]{0,80}setIsDialogOpen\(true\);/,
    );
  });
});

describe("§inventory-redesign P3 — 위치 저장 truth = PATCH /api/inventory/[id] (신규 mutation 0)", () => {
  it("PATCH 라우터가 location 필드 수신·저장", () => {
    const src = read("src/app/api/inventory/[id]/route.ts");
    expect(src).toMatch(/export async function PATCH/);
    expect(src).toMatch(/updateData\.location\s*=\s*location/);
  });

  it("편집 모달 location Input 보존 (저장 진입점)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/id="location"/);
  });
});

describe("§inventory-redesign P3 — 회귀 0 (Lot 펼침 + prop 보존)", () => {
  it("InventoryTable Lot 펼침 state/handler 보존", () => {
    const src = read(TABLE);
    expect(src).toMatch(/expandedProducts/);
    expect(src).toMatch(/toggleExpand/);
  });

  it("InventoryTable onMoveLocation prop 보존 (inline 위치 지정 진입점)", () => {
    const src = read(TABLE);
    expect(src).toMatch(/onMoveLocation\?:/);
  });
});

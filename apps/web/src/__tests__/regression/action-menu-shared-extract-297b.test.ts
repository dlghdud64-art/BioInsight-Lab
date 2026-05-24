/**
 * §11.297b #action-menu-shared-extract — ActionMenu shared helper 추출.
 *
 * 호영님 spec (2026-05-24): 재고 3 file (InventoryTable + inventory-main
 *   + inventory-content) 의 12 dropdown plain button 단순화의 기반 작업.
 *   §11.297 의 inline ActionMenu (InventoryTable.tsx 안) 를 shared
 *   component (components/inventory/action-menu.tsx) 로 추출.
 *
 *   inventory-main (4 dropdown) + inventory-content (5 dropdown) 는 별도
 *   batch (§11.297c/d) — 이 batch 는 shared extract + InventoryTable
 *   refactor 만.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHARED = readFileSync(
  resolve(__dirname, "../../components/inventory/action-menu.tsx"),
  "utf8",
);
const TABLE = readFileSync(
  resolve(__dirname, "../../components/inventory/InventoryTable.tsx"),
  "utf8",
);

describe("§11.297b — ActionMenu shared 추출 + InventoryTable refactor", () => {
  describe("shared component (action-menu.tsx)", () => {
    it("§11.297b trace marker + ActionMenuItem export", () => {
      expect(SHARED).toMatch(/§11\.297b/);
      expect(SHARED).toMatch(/export interface ActionMenuItem/);
      expect(SHARED).toMatch(/export function ActionMenu\(/);
    });

    it("ActionMenuItem 필드 (label/icon/onClick/danger?/separator?)", () => {
      expect(SHARED).toMatch(/label: string/);
      expect(SHARED).toMatch(/icon: ReactNode/);
      expect(SHARED).toMatch(/onClick: \(\) => void/);
      expect(SHARED).toMatch(/danger\?: boolean/);
      expect(SHARED).toMatch(/separator\?: boolean/);
    });

    it('plain <button aria-label="작업 메뉴" aria-expanded aria-haspopup>', () => {
      expect(SHARED).toMatch(/aria-label="작업 메뉴"/);
      expect(SHARED).toMatch(/aria-expanded=\{isOpen\}/);
      expect(SHARED).toMatch(/aria-haspopup="menu"/);
    });

    it("MoreVertical icon (pointer-events-none) + backdrop + role=\"menu\"", () => {
      expect(SHARED).toMatch(/<MoreVertical[\s\S]{0,100}pointer-events-none/);
      expect(SHARED).toMatch(/fixed inset-0[\s\S]{0,100}onClick=\{\(\)\s*=>\s*onOpenChange\(null\)\}/);
      expect(SHARED).toMatch(/role="menu"/);
    });

    it("e.stopPropagation (button + menuItem 모두)", () => {
      const stopProps = (SHARED.match(/e\.stopPropagation\(\)/g) || []).length;
      expect(stopProps).toBeGreaterThanOrEqual(2);
    });

    it("danger style (text-red-600 hover:bg-red-50) 분기 + separator 분기", () => {
      expect(SHARED).toMatch(/text-red-600 hover:bg-red-50/);
      expect(SHARED).toMatch(/item\.separator && idx > 0/);
    });
  });

  describe("InventoryTable.tsx refactor", () => {
    it("inline ActionMenu 정의 제거 + shared import", () => {
      expect(TABLE).toMatch(/import \{ ActionMenu \} from "@\/components\/inventory\/action-menu"/);
      expect(TABLE).not.toMatch(/function ActionMenu\(/);
      expect(TABLE).not.toMatch(/interface ActionMenuItem/);
    });

    it("3 ActionMenu instance 보존 (lot1/group/lot2)", () => {
      expect(TABLE).toMatch(/menuId=\{`lot1-\$\{lot\.id\}`\}/);
      expect(TABLE).toMatch(/menuId=\{`group-\$\{group\.productId\}`\}/);
      expect(TABLE).toMatch(/menuId=\{`lot2-\$\{lot\.id\}`\}/);
    });

    it("Radix DropdownMenu 사용/import 부재 (§11.297 보존)", () => {
      expect(TABLE).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
      expect(TABLE).not.toMatch(/<DropdownMenu/);
    });

    it("openActionMenuId single state 보존", () => {
      expect(TABLE).toMatch(/const \[openActionMenuId, setOpenActionMenuId\] = useState<string \| null>\(null\)/);
    });

    it("기존 handler 5종 보존 (회귀 0)", () => {
      expect(TABLE).toMatch(/onDetailClick\?\.\(lot\)/);
      expect(TABLE).toMatch(/onEdit\(lot\)/);
      expect(TABLE).toMatch(/onDelete\(lot\)/);
      expect(TABLE).toMatch(/onPrintLabel\(/);
    });
  });
});

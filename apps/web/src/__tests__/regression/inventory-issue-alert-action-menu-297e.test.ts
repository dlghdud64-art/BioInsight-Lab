/**
 * §11.297e #inventory-issue-alert-action-menu — issue alert 2 dropdown swap
 *   + inventory-main Radix import 제거. inventory-content D3 (filter) +
 *   Radix import 제거 = §11.297f.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAIN = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-main.tsx"),
  "utf8",
);
const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.297e — inventory issue alert ActionMenu + Radix import 정리", () => {
  it("§11.297e trace marker (main + content)", () => {
    expect(MAIN).toMatch(/§11\.297e/);
    expect(CONTENT).toMatch(/§11\.297e/);
  });

  describe("inventory-main.tsx — 4/4 dropdown 완료 + Radix import 제거", () => {
    it("ActionMenu inv-issue-${inv.id} instance (issue alert)", () => {
      expect(MAIN).toMatch(/menuId=\{`inv-issue-\$\{inv\.id\}`\}/);
    });

    it("issueType expiring 분기 — 폐기 검토 + 재발주 검토 items", () => {
      expect(MAIN).toMatch(/issueType === "expiring" \?/);
      expect(MAIN).toMatch(/폐기 검토/);
      expect(MAIN).toMatch(/재발주 검토/);
    });

    it("issueType expired 분기 — 대체품 재발주 검토", () => {
      expect(MAIN).toMatch(/issueType === "expired" \?/);
      expect(MAIN).toMatch(/대체품 재발주 검토/);
    });

    it("issueType out_of_stock|low_stock 분기 — 입고 등록", () => {
      expect(MAIN).toMatch(/issueType === "out_of_stock" \|\| issueType === "low_stock"/);
      expect(MAIN).toMatch(/입고 등록/);
    });

    it("aiPanel.preparePanel handler 보존 (expiring + expired)", () => {
      const prepareCount = (MAIN.match(/aiPanel\.preparePanel/g) || []).length;
      expect(prepareCount).toBeGreaterThanOrEqual(2);
    });

    it("Radix DropdownMenu* import 제거 + 사용 부재", () => {
      expect(MAIN).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
      expect(MAIN).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
    });
  });

  describe("inventory-content.tsx — D4 issue alert swap + D3 filter 잔존", () => {
    it("ActionMenu inv-content-issue-${inv.id} instance (D4)", () => {
      expect(CONTENT).toMatch(/menuId=\{`inv-content-issue-\$\{inv\.id\}`\}/);
    });

    it("D3 filter Radix DropdownMenu 제거 완료 (§11.297f ActionMenu 이관)", () => {
      // §11.297f + §298f anti-Radix 로 D3 filter Radix DropdownMenu 제거. 부재-lock.
      expect(CONTENT).not.toMatch(/<DropdownMenu>/);
    });

    it("Radix dropdown-menu import 제거 완료 (§11.297f)", () => {
      expect(CONTENT).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
    });
  });
});

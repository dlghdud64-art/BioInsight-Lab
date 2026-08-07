/**
 * §11.297e #inventory-issue-alert-action-menu — issue alert 2 dropdown swap
 *   + inventory-main Radix import 제거. inventory-content D3 (filter) +
 *   Radix import 제거 = §11.297f.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.297e — inventory issue alert ActionMenu + Radix import 정리", () => {
  it("§11.297e trace marker (라이브)", () => {
    expect(CONTENT).toMatch(/§11\.297e/);
  });

  // §inventory-dead-file-cleanup 2차(2026-08-06) — inventory-main describe(6건) 은퇴:
  //   dead file(importer 0) 세대 잠금. issue alert intent 는 아래 라이브 describe 가
  //   보존·확장. aiPanel.preparePanel 은 구세대 API — 라이브는 통합 패널 라우팅
  //   openReorderReview(§inventory-panel-unify P3b-1)로 대체(의도된 진화).

  describe("inventory-content.tsx — D4 issue alert swap + D3 filter 잔존", () => {
    it("ActionMenu inv-content-issue-${inv.id} instance (D4)", () => {
      expect(CONTENT).toMatch(/menuId=\{`inv-content-issue-\$\{inv\.id\}`\}/);
    });

    it("issueType 분기 — expiring(폐기·재발주 검토) / expired / out_of_stock|low_stock (라이브 승계)", () => {
      expect(CONTENT).toMatch(/issueType === "expiring" \?/);
      expect(CONTENT).toMatch(/폐기 검토/);
      expect(CONTENT).toMatch(/재발주 검토/);
      expect(CONTENT).toMatch(/issueType === "expired" \?/);
      expect(CONTENT).toMatch(/issueType === "out_of_stock" \|\| issueType === "low_stock"/);
    });

    it("행 메뉴 재발주 진입 = 통합 패널 라우팅 (preparePanel 구세대 API 부활 차단)", () => {
      expect(CONTENT).toMatch(/openReorderReview\(inv\)/);
      expect(CONTENT).not.toMatch(/aiPanel\.preparePanel/);
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

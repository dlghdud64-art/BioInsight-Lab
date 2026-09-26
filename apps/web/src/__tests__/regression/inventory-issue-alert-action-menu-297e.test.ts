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

/* 🛑 부분 은퇴 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정) — 「성공해서 은퇴」가 아니다.
 *   아래 it.skip 항목이 물던 앵커는 `inventory-content.tsx` 의 `{false && (…)}` 블록 또는
 *   소비자 0 이던 `InventoryCard` 안에 있었다 — 렌더 0 이므로 **집행된 적이 없다.**
 *   dead 파일은 걸렀지만 같은 파일 안의 dead 구역은 그 축이 보지 못했다.
 *   명제는 그 자리에 원 단언째 남겨 둔다(복원용). 살아 있는 항목은 그대로 돈다.
 *   복원용 원 명제: 이슈 얼럿 행마다 `inv-content-issue-${inv.id}` ActionMenu 를 열고,
 *   issueType(expiring/expired/out_of_stock|low_stock)별 항목을 내고, 재발주 진입은 통합 패널로 라우팅한다.
 *   라이브 대체 = `PriorityActionQueue` + `handlePriorityQueueAction`(§inventory-reorder-surface-unify-p3a 가 잠근다). */
describe("§11.297e — inventory issue alert ActionMenu + Radix import 정리", () => {
  it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] §11.297e trace marker", () => {
    expect(CONTENT).toMatch(/§11\.297e/);
  });

  // §inventory-dead-file-cleanup 2차(2026-08-06) — inventory-main describe(6건) 은퇴:
  //   dead file(importer 0) 세대 잠금. issue alert intent 는 아래 라이브 describe 가
  //   보존·확장. aiPanel.preparePanel 은 구세대 API — 라이브는 통합 패널 라우팅
  //   openReorderReview(§inventory-panel-unify P3b-1)로 대체(의도된 진화).

  describe("inventory-content.tsx — D4 issue alert swap + D3 filter 잔존", () => {
    it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] ActionMenu inv-content-issue-${inv.id} instance (D4)", () => {
      expect(CONTENT).toMatch(/menuId=\{`inv-content-issue-\$\{inv\.id\}`\}/);
    });

    it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] issueType 분기 · expiring / expired / out_of_stock|low_stock", () => {
      expect(CONTENT).toMatch(/issueType === "expiring" \?/);
      expect(CONTENT).toMatch(/폐기 검토/);
      expect(CONTENT).toMatch(/재발주 검토/);
      expect(CONTENT).toMatch(/issueType === "expired" \?/);
      expect(CONTENT).toMatch(/issueType === "out_of_stock" \|\| issueType === "low_stock"/);
    });

    it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] 행 메뉴 재발주 진입 = 통합 패널 라우팅 (preparePanel 부활 차단)", () => {
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

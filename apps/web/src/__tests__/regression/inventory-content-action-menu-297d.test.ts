/**
 * §11.297d #inventory-content-action-menu — inventory-content.tsx D1/D2/D5
 *   utility + card 3 dropdown swap. D3 (filter, Select form) + D4 (issue
 *   alert, issueType 분기 complex) 잔존 — 별도 batch §11.297e.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.297d — inventory-content D1+D2+D5 ActionMenu", () => {
  it("§11.297d trace + ActionMenu shared import", () => {
    expect(SRC).toMatch(/§11\.297d/);
    expect(SRC).toMatch(/import \{ ActionMenu \} from "@\/components\/inventory\/action-menu"/);
  });

  it("openInvContentMenuId + openContentCardMenuId useState", () => {
    expect(SRC).toMatch(/const \[openInvContentMenuId, setOpenInvContentMenuId\] = useState<string \| null>\(null\)/);
    expect(SRC).toMatch(/const \[openContentCardMenuId, setOpenContentCardMenuId\] = useState<string \| null>\(null\)/);
  });

  it("ActionMenu instance (utility-desktop / card-actions) + 모바일 utility = 바텀 시트", () => {
    // §mobile-residual-5 1a (2026-09-07) — utility-mobile ActionMenu(드롭다운) → MobileActionSheet
    //   (scrim + 바텀 시트) 로 supersede. 데스크톱·카드 ActionMenu 는 보존.
    expect(SRC).not.toMatch(/menuId="inv-content-utility-mobile"/);
    expect(SRC).toMatch(/<MobileActionSheet/);
    expect(SRC).toMatch(/menuId="inv-content-utility-desktop"/);
    expect(SRC).toMatch(/menuId="inv-content-card-actions"/);
  });

  it("기존 handler 보존 · setIsImportWizardOpen / handleBulkLabelPrint / setIsSmartReceiveOpen / export-labels / setShowUsageDialog", () => {
    /* 승계 §inventory-import-fake-success (2026-09-26 · 호영님 지시) — 「재고 파일 가져오기」 핸들러가
       가짜 컴포넌트(setIsImportStagingOpen)에서 실배선 위저드(setIsImportWizardOpen)로 바뀌었다.
       명제(이 액션 메뉴가 가져오기 핸들러를 들고 있다)는 불변 · 여는 대상만 바뀌었다.
       배선축은 regression/inventory-import-fake-success.test.ts ① 가 든다. */
    expect(SRC).toMatch(/setIsImportWizardOpen\(true\)/);
    expect(SRC).toMatch(/handleBulkLabelPrint\(\)/);
    expect(SRC).toMatch(/setIsSmartReceiveOpen\(true\)/);
    expect(SRC).toMatch(/\/api\/inventory\/export-labels/);
    expect(SRC).toMatch(/setShowUsageDialog\(false\)/);
  });

  it("D3 (filter) + D4 (issue alert) Radix DropdownMenu 제거 완료 (§11.297e/f ActionMenu 이관)", () => {
    // §11.297e/f + §298f anti-Radix 로 Radix DropdownMenu → ActionMenu 이관 완료. 부재-lock.
    const dropdownCount = (SRC.match(/<DropdownMenu>/g) || []).length;
    expect(dropdownCount).toBe(0);
  });
});

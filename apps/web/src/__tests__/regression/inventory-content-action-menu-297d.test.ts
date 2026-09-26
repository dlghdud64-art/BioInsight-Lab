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

/* 🛑 부분 은퇴 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정) — 「성공해서 은퇴」가 아니다.
 *   아래 it.skip 항목이 물던 앵커는 `inventory-content.tsx` 의 `{false && (…)}` 블록 또는
 *   소비자 0 이던 `InventoryCard` 안에 있었다 — 렌더 0 이므로 **집행된 적이 없다.**
 *   dead 파일은 걸렀지만 같은 파일 안의 dead 구역은 그 축이 보지 못했다.
 *   명제는 그 자리에 원 단언째 남겨 둔다(복원용). 살아 있는 항목은 그대로 돈다.
 *   복원용 원 명제: 목록 카드의 utility-desktop / card-actions ActionMenu 인스턴스 + 그 카드가 부르던
 *   handler 5종(setIsImportWizardOpen · handleBulkLabelPrint · setIsSmartReceiveOpen · export-labels · setShowUsageDialog).
 *   그중 setShowUsageDialog 는 InventoryCard 전용이라 함께 사라졌다 — 나머지 4종은 라이브에 남아 있다. */
describe("§11.297d — inventory-content D1+D2+D5 ActionMenu", () => {
  it("§11.297d trace + ActionMenu shared import", () => {
    expect(SRC).toMatch(/§11\.297d/);
    expect(SRC).toMatch(/import \{ ActionMenu \} from "@\/components\/inventory\/action-menu"/);
  });

  it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] openInvContentMenuId + openContentCardMenuId useState", () => {
    expect(SRC).toMatch(/const \[openInvContentMenuId, setOpenInvContentMenuId\] = useState<string \| null>\(null\)/);
    expect(SRC).toMatch(/const \[openContentCardMenuId, setOpenContentCardMenuId\] = useState<string \| null>\(null\)/);
  });

  it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] ActionMenu instance (utility-desktop / card-actions) + 모바일 utility = 바텀 시트", () => {
    // §mobile-residual-5 1a (2026-09-07) — utility-mobile ActionMenu(드롭다운) → MobileActionSheet
    //   (scrim + 바텀 시트) 로 supersede. 데스크톱·카드 ActionMenu 는 보존.
    expect(SRC).not.toMatch(/menuId="inv-content-utility-mobile"/);
    expect(SRC).toMatch(/<MobileActionSheet/);
    expect(SRC).toMatch(/menuId="inv-content-utility-desktop"/);
    expect(SRC).toMatch(/menuId="inv-content-card-actions"/);
  });

  it.skip("[은퇴 2026-09-26 · {false &&} 안이었다] 기존 handler 보존 · setIsImportWizardOpen / handleBulkLabelPrint / setIsSmartReceiveOpen / export-labels / setShowUsageDialog", () => {
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

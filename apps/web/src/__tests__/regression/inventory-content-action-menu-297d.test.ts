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

  it("3 ActionMenu instance (utility-mobile / utility-desktop / card-actions)", () => {
    expect(SRC).toMatch(/menuId="inv-content-utility-mobile"/);
    expect(SRC).toMatch(/menuId="inv-content-utility-desktop"/);
    expect(SRC).toMatch(/menuId="inv-content-card-actions"/);
  });

  it("기존 handler 보존 — setIsImportStagingOpen / handleBulkLabelPrint / setIsSmartReceiveOpen / export-labels / setShowUsageDialog", () => {
    expect(SRC).toMatch(/setIsImportStagingOpen\(true\)/);
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

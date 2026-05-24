/**
 * §11.298c #dropdown-3-files-298c — safety-spend + organizations + bom
 *   Radix → plain (ActionMenu shared 또는 inline plain).
 *
 *   quotes/page.tsx + quote-panel + data-table = 별도 batch §11.298d/e.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SAFETY = readFileSync(resolve(__dirname, "../../app/dashboard/safety-spend/page.tsx"), "utf8");
const ORG = readFileSync(resolve(__dirname, "../../app/dashboard/organizations/[id]/page.tsx"), "utf8");
const BOM = readFileSync(resolve(__dirname, "../../app/protocol/bom/page.tsx"), "utf8");

describe("§11.298c — 3 file Radix → plain dropdown", () => {
  it("§11.298c trace marker (3 file)", () => {
    expect(SAFETY).toMatch(/§11\.298c/);
    expect(ORG).toMatch(/§11\.298c/);
    expect(BOM).toMatch(/§11\.298c/);
  });

  it("Radix DropdownMenu* import 완전 제거 (3 file)", () => {
    [SAFETY, ORG, BOM].forEach((src) => {
      expect(src).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
      expect(src).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
    });
  });

  describe("safety-spend (inline plain — Download trigger + 3 export)", () => {
    it("isExportMenuOpen + handleExport csv/xlsx/pdf 보존", () => {
      expect(SAFETY).toMatch(/const \[isExportMenuOpen, setIsExportMenuOpen\] = useState\(false\)/);
      expect(SAFETY).toMatch(/handleExport\("csv"\)/);
      expect(SAFETY).toMatch(/handleExport\("xlsx"\)/);
      expect(SAFETY).toMatch(/handleExport\("pdf"\)/);
    });
  });

  describe("organizations (ActionMenu shared — isPending 분기)", () => {
    it("openMemberActionId + isPending 분기 보존 (초대 재발송/취소 vs 멤버 제거)", () => {
      expect(ORG).toMatch(/const \[openMemberActionId, setOpenMemberActionId\] = useState<string \| null>\(null\)/);
      expect(ORG).toMatch(/menuId=\{`org-member-\$\{rawMember\.id\}`\}/);
      expect(ORG).toMatch(/isPending \?/);
      expect(ORG).toMatch(/resendInviteMutation\.mutate\(rawMember\.id\)/);
      expect(ORG).toMatch(/removeMemberMutation\.mutate\(rawMember\.id\)/);
    });
  });

  describe("bom (ActionMenu shared — reagent row action)", () => {
    it("openReagentMenuId + handleDeleteReagent + setEditingReagentId 보존", () => {
      expect(BOM).toMatch(/const \[openReagentMenuId, setOpenReagentMenuId\] = useState<string \| null>\(null\)/);
      expect(BOM).toMatch(/menuId=\{`reagent-\$\{reagent\.id\}`\}/);
      expect(BOM).toMatch(/setEditingReagentId\(reagent\.id\)/);
      expect(BOM).toMatch(/handleDeleteReagent\(reagent\.id\)/);
    });
  });
});

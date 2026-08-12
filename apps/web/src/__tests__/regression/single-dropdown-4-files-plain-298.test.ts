/**
 * §11.298 #single-dropdown-4-files-plain — 단일 dropdown 4 file plain.
 *
 * 호영님 A안 (2026-05-24): application-wide Radix wiring 완전 종결 1/3
 *   batch. InventoryQRCode + export-button + compliance-links + workspace
 *   4 file 의 1 dropdown 씩 plain button 단순화 (ActionMenu shared 또는
 *   inline plain). user-menu (큰 swap) + 나머지 6 file 별도 batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QR = readFileSync(resolve(__dirname, "../../components/inventory/InventoryQRCode.tsx"), "utf8");
const EXPORT = readFileSync(resolve(__dirname, "../../components/quote-list/export-button.tsx"), "utf8");
/**
 * ⚠️ 2026-08-12 — compliance-links 대상 **은퇴** (4 file → 3 file).
 *
 * `ComplianceLink` 모델이 스키마에 없어 화면 CRUD 가 전부 실패했고 화면을 폐기했다
 * (§phantom-model-call). **Radix dropdown 제거 정책이 폐기된 것이 아니다** —
 * 나머지 3파일 잠금은 그대로다.
 *
 * 복원 조건: 모델 신설 → 화면 복원 시 이 파일의 compliance 단언도 함께 되살린다
 * (docs/plans/PLAN_schema-proposal-4models.md §1-3).
 */
const WORKSPACE = readFileSync(resolve(__dirname, "../../app/settings/workspace/page.tsx"), "utf8");

describe("§11.298 — 단일 dropdown 4 file plain swap", () => {
  it("§11.298 trace marker (3 file — compliance 은퇴)", () => {
    expect(QR).toMatch(/§11\.298/);
    expect(EXPORT).toMatch(/§11\.298/);
    expect(WORKSPACE).toMatch(/§11\.298/);
  });

  it("Radix DropdownMenu* import 완전 제거 (3 file)", () => {
    expect(QR).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
    expect(EXPORT).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
    expect(WORKSPACE).not.toMatch(/from "@\/components\/ui\/dropdown-menu"/);
  });

  it("Radix DropdownMenu 사용 완전 부재 (3 file)", () => {
    [QR, EXPORT, WORKSPACE].forEach((src) => {
      expect(src).not.toMatch(/<DropdownMenu(?:Trigger|Content|Item|Label|Separator)?\s/);
    });
  });

  describe("InventoryQRCode (inline plain dropdown)", () => {
    it("isMoreMenuOpen useState + plain button + Download/Copy menuItem", () => {
      expect(QR).toMatch(/const \[isMoreMenuOpen, setIsMoreMenuOpen\] = useState\(false\)/);
      expect(QR).toMatch(/aria-label="더보기"/);
      expect(QR).toMatch(/handleDownload\(\)/);
      expect(QR).toMatch(/navigator\.clipboard\.writeText\(scanUrl\)/);
    });
  });

  describe("export-button (inline plain dropdown)", () => {
    it("isExportMenuOpen useState + 3 export option", () => {
      expect(EXPORT).toMatch(/const \[isExportMenuOpen, setIsExportMenuOpen\] = useState\(false\)/);
      expect(EXPORT).toMatch(/handleExport\("items_tsv"\)/);
      expect(EXPORT).toMatch(/handleExport\("responses_csv"\)/);
      expect(EXPORT).toMatch(/handleExport\("pack_zip"\)/);
    });
  });

  describe("workspace (ActionMenu shared)", () => {
    it("ActionMenu import + openMemberMenuId useState + handleDeleteMember", () => {
      expect(WORKSPACE).toMatch(/import \{ ActionMenu \} from "@\/components\/inventory\/action-menu"/);
      expect(WORKSPACE).toMatch(/const \[openMemberMenuId, setOpenMemberMenuId\] = useState<string \| null>\(null\)/);
      expect(WORKSPACE).toMatch(/menuId=\{`member-\$\{member\.id\}`\}/);
      expect(WORKSPACE).toMatch(/handleDeleteMember\(/);
    });
  });
});

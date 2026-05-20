/**
 * §11.266c #inventory-back-nav-touch-target — inventory lot-tracking back nav
 *   44x44 touch target
 *   (§11.266 P1 cluster 3/5, §11.264h family cross-cutting concern 확장)
 *
 * §11.266 Phase 0 audit P1 세 번째 cluster — inventory lot-tracking TabsContent
 * 안 "품목 관리로 돌아가기" back nav button (line ~2290) 이
 * `flex items-center gap-1.5 text-xs font-medium text-blue-400 ... mb-1`
 * 로 padding 0 → 세로 ~16-20px → 44x44 미달. lot-tracking 진입 후 모바일에서
 * navigation 빈도 높은 entry. Apple HIG / Material / WCAG 2.1 SC 2.5.5 미달.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: flex items-center gap-1.5 text-xs font-medium text-blue-400
 *         hover:text-blue-300 transition-colors mb-1
 *   신규: inline-flex items-center gap-1.5 text-xs font-medium min-h-[44px]
 *         px-2 text-blue-400 hover:text-blue-300 transition-colors mb-1
 *   - flex → inline-flex (자연스러운 inline button)
 *   - min-h-[44px] = 세로 44px 보장
 *   - px-2 = 가로 padding 8px (touch 영역 가로 확보)
 *   - text-xs / text-blue-400 hover:text-blue-300 / mb-1 모두 보존
 *
 * canonical truth lock:
 *   - setActiveInventoryTab("manage") onClick 보존 (back nav handler)
 *   - ChevronRight rotate-180 icon (back direction) 보존
 *   - "품목 관리로 돌아가기" 라벨 보존
 *   - text-blue-400 hover:text-blue-300 tone 보존 (시각 연속성)
 *   - mb-1 spacing 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266c #1 — inventory back nav 44x44 touch target", () => {
  it("§11.266c trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.266c/);
  });

  it("back nav button className 에 min-h-[44px] 추가", () => {
    // setActiveInventoryTab("manage") onClick 의 className 안에 min-h-[44px]
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}className="[^"]*min-h-\[44px\]/,
    );
  });

  it("back nav button className 에 inline-flex items-center 적용 (44px 안 가운데 정렬)", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}className="inline-flex items-center/,
    );
  });

  it("back nav button className 에 px-2 추가 (touch 영역 가로 확보)", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}className="[^"]*px-2[^"]*"/,
    );
  });
});

describe("§11.266c #2 — invariant 보존 (canonical truth)", () => {
  it("setActiveInventoryTab(\"manage\") onClick 보존", () => {
    expect(page).toMatch(/onClick=\{\(\) => setActiveInventoryTab\("manage"\)\}/);
  });

  it("\"품목 관리로 돌아가기\" 라벨 보존", () => {
    expect(page).toMatch(/품목 관리로 돌아가기/);
  });

  it("ChevronRight rotate-180 icon (back direction) 보존", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}<ChevronRight[^/]*rotate-180/,
    );
  });

  it("text-blue-400 hover:text-blue-300 톤 보존 (시각 연속성)", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}text-blue-400 hover:text-blue-300/,
    );
  });

  it("text-xs 시각 사이즈 보존", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}text-xs/,
    );
  });

  it("mb-1 spacing 보존", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}mb-1/,
    );
  });

  it("transition-colors 보존", () => {
    expect(page).toMatch(
      /setActiveInventoryTab\("manage"\)[\s\S]{0,400}transition-colors/,
    );
  });

  it("lot-tracking TabsContent (back nav 위치) 보존", () => {
    expect(page).toMatch(/<TabsContent value="lot-tracking"/);
  });
});

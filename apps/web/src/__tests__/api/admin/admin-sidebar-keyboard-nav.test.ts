/**
 * §11.122 #admin-sidebar-keyboard-nav
 *
 * Source-level regression guard — AdminSidebar mobile drawer 의 키보드/스크린
 * 리더 접근성 강화.
 *
 * 강화 항목:
 *   - Esc key → drawer close
 *   - focus trap (drawer open 시 Tab 이 drawer 내부 순회)
 *   - aria-modal="true" + role="dialog" on drawer
 *   - aria-label on drawer + buttons
 *   - drawer close 시 hamburger button focus 복귀
 *
 * §11.121 mobile drawer 의 후속 정형화.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/admin/_components/admin-sidebar.tsx",
);

describe("AdminSidebar keyboard / a11y — regression guard (§11.122)", () => {
  const source = readFileSync(PATH, "utf8");

  it("Esc key handler 존재 (KeyboardEvent listener)", () => {
    expect(source).toMatch(/keydown|onKeyDown|Escape|"Esc"/);
  });

  it("aria-modal 또는 role=dialog 분기", () => {
    expect(source).toMatch(/aria-modal|role="dialog"/);
  });

  it("aria-label on hamburger / close button", () => {
    expect(source).toMatch(/aria-label/);
  });

  it("focus trap 또는 useRef (focus management)", () => {
    expect(source).toMatch(/useRef|focus\(\)|focusable/);
  });

  it("drawer close 시 trigger button focus 복귀 (return-focus)", () => {
    // close 시 hamburger ref.focus() or document focus return
    expect(source).toMatch(/triggerRef|hamburgerRef|menuButton.*focus/);
  });

  it("z-index layering 유지 (§11.121 회귀 차단)", () => {
    expect(source).toMatch(/z-\d+/);
  });
});

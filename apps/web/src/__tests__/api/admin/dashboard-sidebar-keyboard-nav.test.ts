/**
 * §11.124 #dashboard-sidebar-keyboard-nav
 *
 * Source-level regression guard — DashboardSidebar (general user, 모든
 * dashboard page 적용) 에 §11.123 useDialogA11y hook 적용 + ARIA 강화.
 *
 * §11.122 AdminSidebar 와 동일 패턴 reuse — 키보드 only 운영자 / screen
 * reader / focus 복귀.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/_components/dashboard-sidebar.tsx",
);

describe("DashboardSidebar keyboard / a11y — regression guard (§11.124)", () => {
  const source = readFileSync(PATH, "utf8");

  it("useDialogA11y hook 사용 (또는 inline Esc + focus trap)", () => {
    expect(source).toMatch(/useDialogA11y|Escape|"Esc"/);
  });

  it("role=dialog + aria-modal", () => {
    expect(source).toMatch(/role="dialog"/);
    expect(source).toMatch(/aria-modal/);
  });

  it("aria-label on drawer", () => {
    expect(source).toMatch(/aria-label/);
  });

  it("Tab focus trap 또는 querySelectorAll focusable (hook 또는 inline)", () => {
    expect(source).toMatch(/useDialogA11y|querySelectorAll.*focusable|focusable/);
  });

  it("기존 mobile drawer 회귀 0 — pathname auto-close 유지", () => {
    expect(source).toMatch(/pathname.*setIsMobileOpen|setIsMobileOpen.*false/);
  });
});

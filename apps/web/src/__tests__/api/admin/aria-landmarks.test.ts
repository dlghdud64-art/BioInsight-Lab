/**
 * §11.129 #aria-landmarks
 *
 * Source-level regression guard — 다중 <nav> element 에 aria-label 추가.
 * 스크린 리더가 navigation 들을 의미적으로 구분 가능 (WCAG 2.4.6 Headings
 * and Labels + 1.3.1 Info and Relationships).
 *
 * 영향 범위:
 *   - AdminSidebar: 관리자 메뉴 nav
 *   - BottomNav: 모바일 메뉴 nav
 *   - DashboardHeader: breadcrumb nav
 *   - DashboardSidebar: 4 nav (primary / secondary / etc)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

describe("ARIA landmarks aria-label — regression guard (§11.129)", () => {
  it("AdminSidebar nav 에 aria-label", () => {
    const source = readFileSync(
      resolve(ROOT, "app/admin/_components/admin-sidebar.tsx"),
      "utf8",
    );
    expect(source).toMatch(/<nav[^>]*aria-label/);
  });

  it("BottomNav 에 aria-label", () => {
    const source = readFileSync(
      resolve(ROOT, "components/layout/bottom-nav.tsx"),
      "utf8",
    );
    expect(source).toMatch(/<nav[^>]*aria-label/);
  });

  it("DashboardSidebar 의 메인 nav 에 aria-label", () => {
    const source = readFileSync(
      resolve(ROOT, "app/_components/dashboard-sidebar.tsx"),
      "utf8",
    );
    expect(source).toMatch(/<nav[^>]*aria-label/);
  });

  it("DashboardHeader 의 breadcrumb nav 에 aria-label", () => {
    const source = readFileSync(
      resolve(ROOT, "components/dashboard/Header.tsx"),
      "utf8",
    );
    expect(source).toMatch(/<nav[^>]*aria-label/);
  });
});

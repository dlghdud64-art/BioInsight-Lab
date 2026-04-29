/**
 * §11.121 #admin-sidebar-mobile-drawer
 *
 * Source-level regression guard — AdminSidebar 가 모바일에서 hidden +
 * hamburger toggle drawer 패턴을 보유하는지 확인.
 *
 * 본 변경은 AdminSidebar 컴포넌트 자체에 한정 — 7 admin page (admin/,
 * orders, users, quotes, organizations, activity, settings) 모두에 자동 적용.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/admin/_components/admin-sidebar.tsx",
);

describe("AdminSidebar mobile drawer — regression guard (§11.121)", () => {
  const source = readFileSync(PATH, "utf8");

  it("desktop sidebar 분기 (md:flex 또는 hidden md:)", () => {
    // 데스크탑에서만 항상 노출되는 inline sidebar
    expect(source).toMatch(/hidden\s+md:|md:flex|md:translate-x-0/);
  });

  it("mobile drawer toggle state (useState)", () => {
    expect(source).toMatch(/useState/);
  });

  it("mobile open trigger button (Menu/Hamburger icon)", () => {
    // 모바일 trigger 는 menu 또는 햄버거 icon 사용
    expect(source).toMatch(/Menu\b|Hamburger|MenuIcon/);
  });

  it("backdrop overlay (drawer open 시)", () => {
    // backdrop click → close
    expect(source).toMatch(/backdrop|onClose|setOpen.*false|fixed inset/);
  });

  it("pathname 변경 시 drawer 자동 close (UX)", () => {
    // useEffect 또는 onClick={() => setOpen(false)} on Link
    expect(source).toMatch(/useEffect|setOpen\(false\)/);
  });

  it("z-index layering — drawer > backdrop > content", () => {
    expect(source).toMatch(/z-\d+|z-\[/);
  });
});

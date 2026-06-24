/**
 * §quote-management-redesign 동반(호영님) — 사이드바 네이비 + 발주 관리 게이팅
 *   (PLAN: docs/plans/PLAN_quote-management-redesign.md / 시안 디자인 토큰: 사이드바 navy slate-900)
 *
 * ① 사이드바 navy(bg-slate-900) 다크 테마 — 시안 토큰 정합(기존 bg-white 라이트 → 네이비).
 * ② ENABLE_PURCHASING off 시 "발주 관리" 메뉴 렌더 숨김(소스 NavItem 보존 = rollback, 렌더만 필터).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(REPO_ROOT, "src/app/_components/dashboard-sidebar.tsx"),
  "utf8",
);

describe("§sidebar-navy — 네이비 다크 테마", () => {
  it("aside 배경 navy(bg-slate-900) — 라이트 bg-white 제거", () => {
    expect(SRC).toMatch(/bg-slate-900 border-r border-slate-800/);
    expect(SRC).not.toMatch(/bg-white border-r border-slate-200/);
  });
  it("nav active = bg-blue-600 text-white / inactive = text-slate-300(다크 정합)", () => {
    expect(SRC).toMatch(/"text-white font-semibold bg-blue-600"/);
    expect(SRC).toMatch(/"text-slate-300 hover:text-white hover:bg-slate-800"/);
  });
});

describe("§sidebar-purchasing-gate — 발주 관리 게이팅", () => {
  it("ENABLE_PURCHASING off 시 발주 관리 렌더 필터(getFlag + purchase-orders 제외)", () => {
    expect(SRC).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(SRC).toMatch(/it\.href !== "\/dashboard\/purchase-orders"/);
    expect(SRC).toMatch(/visibleGroups/);
  });
  it("회귀 0 — 발주 관리 NavItem 정의(소스 문자열) 보존(rollback)", () => {
    expect(SRC).toMatch(/title: "발주 관리"/);
    expect(SRC).toMatch(/href: "\/dashboard\/purchase-orders"/);
  });
  it("회귀 0 — 견적 관리·재고 관리 메뉴 보존", () => {
    expect(SRC).toMatch(/title: "견적 관리"/);
    expect(SRC).toMatch(/title: "재고 관리"/);
  });
});

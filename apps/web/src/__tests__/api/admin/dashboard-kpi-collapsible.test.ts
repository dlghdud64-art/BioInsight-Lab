/**
 * §11.139 #dashboard-kpi-mobile-collapsible
 *
 * Source-level regression guard — KpiCard 의 §11.98 always-visible inline
 * breakdown 을 collapsible (accordion) 로 전환. mobile 카드 높이 부담 해소.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../components/dashboard/executive-summary-section.tsx",
);

describe("KpiCard mobile breakdown collapsible — regression guard (§11.139)", () => {
  const source = readFileSync(PATH, "utf8");

  it("breakdownExpanded state (useState toggle)", () => {
    expect(source).toMatch(/breakdownExpanded|isBreakdownOpen/);
  });

  it("expand toggle button (한국어 '내역 보기' / '내역 닫기' 또는 chevron)", () => {
    expect(source).toMatch(/내역 보기|내역 닫기|toggleBreakdown|ChevronDown|ChevronUp/);
  });

  it("breakdown list 가 conditional render (md:hidden 분기)", () => {
    expect(source).toMatch(/breakdownExpanded\s*&&|isBreakdownOpen\s*&&/);
  });

  it("§11.98 회귀 0 — desktop hover popup 보존 (hidden md:block)", () => {
    expect(source).toMatch(/hidden md:block|md:block.*hover/);
  });

  it("toggle button onClick stopPropagation (Link wrapper 와 click conflict 회피)", () => {
    expect(source).toMatch(/stopPropagation|preventDefault/);
  });
});

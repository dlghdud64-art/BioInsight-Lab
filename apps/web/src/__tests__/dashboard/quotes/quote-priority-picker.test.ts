/**
 * §quote-priority-picker — 견적 우선순위 팝오버 선택기 (cycle → popover 직접 선택)
 *   (PLAN: docs/plans/PLAN_quote-priority-picker.md · 호영님 패치 "우선순위 선택기")
 *
 * 칩 클릭 순환(다음 값 추측) → 팝오버 메뉴에서 3단계(긴급/높음/보통) 색 점 + 설명과 함께
 *   직접 선택, 선택 즉시 상단 재정렬. 3단계 유지(호영님 결정 — 낮음 미도입).
 * ★ canonical: prioMap 세션 override(DB 0) · computePriority 파생 보존 · pill 신호색 불변.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-priority-picker — 팝오버 컴포넌트", () => {
  it("QuotePriorityPicker 컴포넌트 정의 + 캐럿(ChevronDown 회전)", () => {
    expect(PAGE).toMatch(/function QuotePriorityPicker/);
    expect(PAGE).toMatch(/ChevronDown[\s\S]{0,80}rotate-180/);
  });
  it("3단계 메뉴 옵션(긴급/높음/보통 + 설명) — 직접 선택", () => {
    expect(PAGE).toMatch(/"즉시 처리 · 최상단 고정"/);
    expect(PAGE).toMatch(/"우선 처리"/);
    expect(PAGE).toMatch(/label: "긴급"[\s\S]{0,200}label: "높음"[\s\S]{0,200}label: "보통"/);
  });
  it("현재 값 체크(Check) + blue 강조(on)", () => {
    expect(PAGE).toMatch(/<Check /);
    expect(PAGE).toMatch(/on \? "bg-blue-50" : ""/);
  });
  it("a11y — listbox/option roles + aria-selected/haspopup/expanded", () => {
    expect(PAGE).toMatch(/role="listbox"/);
    expect(PAGE).toMatch(/role="option"/);
    expect(PAGE).toMatch(/aria-selected=\{on\}/);
    expect(PAGE).toMatch(/aria-haspopup="listbox"/);
    expect(PAGE).toMatch(/aria-expanded=\{open\}/);
  });
  it("외부 클릭 + ESC 닫힘", () => {
    expect(PAGE).toMatch(/!ref\.current\.contains\(e\.target as Node\)\) setOpen\(false\)/);
    expect(PAGE).toMatch(/e\.key === "Escape"[\s\S]{0,40}setOpen\(false\)/);
  });
});

describe("§quote-priority-picker — 직접 선택 → 재정렬", () => {
  it("onSet → setPriorityOverride 직접(순환 아님)", () => {
    expect(PAGE).toMatch(/setPriorityOverride = useCallback/);
    expect(PAGE).toMatch(/onSet=\{\(lvl\) => setPriorityOverride\(quote\.id, lvl\)\}/);
  });
  it("재정렬 = effective rankOf(prioMap override 우선) 보존", () => {
    expect(PAGE).toMatch(/const lvl = prioMap\[q\.id\] \?\? base/);
    expect(PAGE).toMatch(/\}, \[filteredQuotes, sortState, prioMap\]\)/);
  });
});

describe("§quote-priority-picker — 회귀 0(canonical 보존)", () => {
  it("test-id 보존(smoke-p5 의존)", () => {
    expect(PAGE).toMatch(/data-testid="quote-priority-override-toggle"/);
  });
  it("pill 신호색 보존(critical red / high yellow dot)", () => {
    expect(PAGE).toMatch(/priorityLevel === "critical" \? "bg-red-500" : "bg-yellow-500"/);
  });
  it("세션 override(DB 0) — localStorage/PATCH 비대상 보존", () => {
    expect(PAGE).not.toMatch(/localStorage[\s\S]{0,40}prioMap/);
    expect(PAGE).toMatch(/const \[prioMap, setPrioMap\] = useState<Record<string, "high" \| "mid" \| "low">>/);
  });
  it("3단계 유지(4단계 '낮음' 미도입 — taxonomy lock)", () => {
    expect(PAGE).not.toMatch(/label: "낮음"/);
  });
});

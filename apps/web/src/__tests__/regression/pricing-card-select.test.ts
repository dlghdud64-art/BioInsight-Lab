/**
 * §pricing-final §2 — 카드 클릭 선택형 (호영님 2026-06-27, 최종 §2/체크리스트 기준)
 *
 * 전체 카드 role=button → 클릭/Enter/Space 로 선택 이동. 선택 카드만 dark navy + 우상단 체크 배지.
 * 기본 선택 = Basic(team). "가장 많이 선택" 배지는 recommendTag(Basic 고정)로 독립. CTA stopPropagation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "app/pricing/page.tsx"),
  "utf8",
);
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§pricing-final §2 — 클릭 선택형", () => {
  it("기본 선택 = Basic(team) state", () => {
    expect(CODE).toMatch(/const \[selectedPlan, setSelectedPlan\] = useState<PlanIntent>\("team"\)/);
  });
  it("navy = 선택 상태 구동(isDarkNavy = selected)", () => {
    expect(CODE).toMatch(/const isDarkNavy = selected === true/);
    expect(CODE).toMatch(/selected=\{selectedPlan === intent\}/);
    expect(CODE).toMatch(/onCardSelect=\{setSelectedPlan\}/);
  });
  it("전체 카드 role=button + 키보드(Enter/Space) 선택", () => {
    expect(CODE).toMatch(/role="button"/);
    expect(CODE).toMatch(/onClick=\{\(\) => onCardSelect\?\.\(intent\)\}/);
    expect(CODE).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
  });
  it("선택 시 체크 배지", () => {
    expect(CODE).toMatch(/selected && \(/);
  });
  it("CTA stopPropagation(카드 선택과 분리)", () => {
    expect(CODE).toMatch(/e\.stopPropagation\(\); handleClick\(\)/);
  });
  it("'가장 많이 선택' 배지는 recommendTag로 독립 보존", () => {
    expect(CODE).toMatch(/recommendTag !== null/);
  });
});

/**
 * §quote-management-redesign P3 — 우선순위 클릭 세션 override + 상단 재정렬 (호영님 시안 정합)
 *   (PLAN: docs/plans/PLAN_quote-management-redesign.md Phase 3)
 *
 * 우선순위 pill 클릭 → prioMap[id] high→mid→low 순환(세션 state, DB 0) → effective level
 *   (override ?? computePriority.level)로 정렬 상단 재배치. 새로고침 시 canonical 복귀.
 * ★ Product Constraint: 세션 override는 canonical computePriority 위 UI-state 레이어로만 작동
 *   (truth 대체 금지) — override 부재 시 computePriority 파생 그대로.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-management-redesign P3 — 세션 override state(DB 0)", () => {
  it("prioMap 세션 state(useState, 저장/PATCH 아님)", () => {
    expect(PAGE).toMatch(/const \[prioMap, setPrioMap\] = useState<Record<string, "high" \| "mid" \| "low">>\(\{\}\)/);
  });
  it("순환 핸들러 high→mid→low(setPrioMap, 세션만)", () => {
    expect(PAGE).toMatch(/cyclePriorityOverride = useCallback/);
    expect(PAGE).toMatch(/current === "high" \? "mid" : current === "mid" \? "low" : "high"/);
  });
  it("prioMap 은 localStorage/server PATCH 비대상(세션 only — 새로고침 복귀)", () => {
    expect(PAGE).not.toMatch(/localStorage[\s\S]{0,40}prioMap/);
    expect(PAGE).not.toMatch(/prioMap[\s\S]{0,40}localStorage/);
  });
});

describe("§quote-management-redesign P3 — effective level(canonical 보존)", () => {
  it("effective = override ?? computePriority.level (truth 대체 아님)", () => {
    expect(PAGE).toMatch(/const baseLevel: "high" \| "mid" \| "low" = priorityResult\?\.level \?\? "low"/);
    expect(PAGE).toMatch(/const effectiveLevel: "high" \| "mid" \| "low" = prioMap\[quote\.id\] \?\? baseLevel/);
  });
  it("priorityLevel 매핑이 effectiveLevel 기반(override 반영)", () => {
    expect(PAGE).toMatch(/effectiveLevel === "high"\s*\?\s*"critical"/);
  });
});

describe("§quote-management-redesign P3 — pill 클릭 wiring + 상단 재정렬", () => {
  it("우선순위 pill = 클릭 버튼(override 순환, row onClick stopPropagation)", () => {
    expect(PAGE).toMatch(/data-testid="quote-priority-override-toggle"/);
    expect(PAGE).toMatch(/e\.stopPropagation\(\);\s*cyclePriorityOverride\(quote\.id, baseLevel\)/);
  });
  it("수동 지정 시 시각 표기(honesty — canonical 아님 명시)", () => {
    expect(PAGE).toMatch(/isPriorityOverridden/);
    expect(PAGE).toMatch(/수동 지정/);
  });
  it("기본 정렬 = effective 우선순위(override 우선, 동순위 stable)", () => {
    expect(PAGE).toMatch(/const lvl = prioMap\[q\.id\] \?\? base/);
    expect(PAGE).toMatch(/rankOf\(a\.q\) - rankOf\(b\.q\)/);
    expect(PAGE).toMatch(/\}, \[filteredQuotes, sortState, prioMap\]\)/);
  });
});

describe("§quote-management-redesign P3 — 회귀 0(canonical 파생·정렬 보존)", () => {
  it("computePriority 가 effective base(파생 제거 아님)", () => {
    expect(PAGE).toMatch(/c \? computePriority\(c\)\.level : "low"/);
  });
  it("기존 정렬 키 보존(price/createdAt/responseCount)", () => {
    expect(PAGE).toMatch(/sortState\.key === "price"/);
    expect(PAGE).toMatch(/sortState\.key === "createdAt"/);
    expect(PAGE).toMatch(/sortState\.key === "responseCount"/);
  });
  it("우선순위 pill 신호색 보존(critical red / high yellow dot)", () => {
    expect(PAGE).toMatch(/priorityLevel === "critical" \? "bg-red-500" : "bg-yellow-500"/);
  });
});

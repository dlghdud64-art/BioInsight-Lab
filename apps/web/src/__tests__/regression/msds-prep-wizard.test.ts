/**
 * §msds-version-validation ③ — 3단계 점검 준비 마법사 + 체크리스트 export (호영님 2026-06-27)
 *
 * 범위 → 담당·일정 → 패키지 3단계. 종착 = 체크리스트 CSV export(실 Blob 다운로드, no-op 0).
 * 버전 검증 패널(단일 소스)은 step1(MSDS 범위 on)에 노출.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"),
  "utf8",
);
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§msds-version ③ — 3단계 마법사 state/네비", () => {
  it("prepStep(1|2|3) + 범위/담당/마감 state", () => {
    expect(CODE).toMatch(/const \[prepStep, setPrepStep\]/);
    expect(CODE).toMatch(/const \[prepScope, setPrepScope\]/);
    expect(CODE).toMatch(/const \[prepAssignee, setPrepAssignee\]/);
    expect(CODE).toMatch(/const \[prepDue, setPrepDue\]/);
  });
  it("스텝 인디케이터 3단계(범위·담당·일정·패키지) + 다음/이전 네비", () => {
    expect(CODE).toMatch(/prepStep === 1/);
    expect(CODE).toMatch(/prepStep === 2/);
    expect(CODE).toMatch(/prepStep === 3/);
    expect(CODE).toMatch(/setPrepStep\(\(s\) => \(s \+ 1\)/);
    expect(CODE).toMatch(/setPrepStep\(\(s\) => \(s - 1\)/);
  });
  it("진입 시 step 리셋(openPrepWizard)", () => {
    expect(CODE).toMatch(/const openPrepWizard = \(\) => \{ setPrepStep\(1\); setAiPanelOpen\(true\); \}/);
  });
});

describe("§msds-version ③ — 체크리스트 export (실 산출물, no-op 0)", () => {
  it("종착 = 실 CSV Blob 다운로드(가짜 success 아님)", () => {
    expect(CODE).toMatch(/const exportPrepChecklist = \(\)/);
    expect(CODE).toMatch(/new Blob\(/);
    expect(CODE).toMatch(/URL\.createObjectURL/);
    expect(CODE).toMatch(/\.download = /);
  });
  it("생성 버튼이 exportPrepChecklist 실행 + 대상 0이면 disabled", () => {
    expect(CODE).toMatch(/onClick=\{exportPrepChecklist\}/);
    expect(CODE).toMatch(/disabled=\{prepTargets\.length === 0\}/);
  });
  it("대상 = canonical items 범위 필터(prepScope 반영)", () => {
    expect(CODE).toMatch(/prepScope\.msds && !i\.hasMsds/);
    expect(CODE).toMatch(/prepScope\.insp && !i\.lastInspection/);
  });
  it("'준비 중' 가짜 disabled 액션 제거", () => {
    expect(CODE).not.toMatch(/분석 실행 \(준비 중\)/);
    expect(CODE).not.toMatch(/점검 실행 저장 기능은 준비 중입니다/);
  });
});

describe("§msds-version ③ — 버전 검증 패널(step1 단일 소스)", () => {
  it("MSDS 범위 on일 때 버전 검증 패널 노출(단일 소스)", () => {
    expect(CODE).toMatch(/prepScope\.msds &&/);
    expect(CODE).toMatch(/n: msdsVersionSummary\.stale/);
    expect(CODE).toMatch(/메타 기반 추정/);
  });
});

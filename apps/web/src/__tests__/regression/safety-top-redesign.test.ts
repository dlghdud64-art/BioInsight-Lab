/**
 * §safety-redesign 상단정합 — 라이브 상단을 시안과 정합 (호영님 2026-06-27)
 *
 * 시안 정합: 저장 상태 바 제거 · 안전 판단 요약 패널(시급배너+준비도바+CTA, sticky) ·
 * 트렌드 차트(mock) 제거 · KPI 코너 배지+0값 회색 · AI 큐 전체보기 푸터.
 * 모든 CTA wired-or-disabled(no-op 0), 준비도는 canonical 충족률 파생.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"),
  "utf8",
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§safety-redesign 상단정합 — 저장 상태 바 제거", () => {
  it("저장 상태 바 testid/표시 파생 부재", () => {
    expect(CODE).not.toMatch(/safety-preferences-save-state/);
    expect(CODE).not.toMatch(/safetySaveBoundaryLabel/);
    expect(CODE).not.toMatch(/safetyAppliedCount/);
  });
  it("activeFrame persistence 보존(hydration+PATCH)", () => {
    expect(CODE).toMatch(/updateSafetyFilter\(\{ activeFrame \}\)/);
    expect(CODE).toMatch(/setActiveFrame/);
  });
});

describe("§safety-redesign 상단정합 — 안전 판단 요약 패널", () => {
  it("요약 패널 제목 + sticky", () => {
    expect(CODE).toMatch(/안전 판단 요약/);
    expect(CODE).toMatch(/lg:sticky/);
    expect(CODE).not.toMatch(/오늘의 안전 판단/);
  });
  it("가장 시급 배너(MSDS 미등록) + 준비도 바(canonical 파생)", () => {
    expect(CODE).toMatch(/등록만 완료하면 안전 지수가 회복/);
    expect(CODE).toMatch(/GMP 준비도/);
    expect(CODE).toMatch(/KOSHA 준비도/);
    expect(CODE).toMatch(/const koshaReadiness = totalCount > 0/);
    expect(CODE).toMatch(/const gmpReadiness = totalCount > 0/);
  });
  it("MSDS 일괄 등록 CTA = 실 동작(패널 open) + 미등록 0이면 disabled", () => {
    expect(CODE).toMatch(/MSDS 일괄 등록 시작/);
    expect(CODE).toMatch(/disabled=\{msdsMissingCount === 0\}/);
    // §msds-version-validation ③ — CTA 핸들러가 인라인 setAiPanelOpen → openPrepWizard(step 리셋+패널 open)로 승격.
    //   기능(count>0 게이트 + 패널 open) 보존, 마법사 진입으로 reorg.
    expect(CODE).toMatch(/msdsMissingCount > 0\) openPrepWizard\(\)/);
    expect(CODE).toMatch(/openPrepWizard = \(\) => \{ setPrepStep\(1\); setAiPanelOpen\(true\); \}/);
  });
});

describe("§safety-redesign 상단정합 — 트렌드 차트 제거(mock)", () => {
  it("TREND_DATA 상수 + 트렌드 차트 렌더 부재", () => {
    expect(CODE).not.toMatch(/TREND_DATA/);
    expect(CODE).not.toMatch(/안전 지수 트렌드/);
    expect(CODE).not.toMatch(/<LineChart/);
  });
});

describe("§safety-redesign 상단정합 — KPI 코너 배지 + 0값 회색", () => {
  it("코너 배지 4종(대장 등록/규정 준수 불가/미분류/점검 이력 없음)", () => {
    expect(CODE).toMatch(/대장 등록/);
    expect(CODE).toMatch(/규정 준수 불가/);
    expect(CODE).toMatch(/미분류/);
    expect(CODE).toMatch(/점검 이력 없음/);
  });
  it("0값 회색 톤(text-slate-400 조건부) 적용", () => {
    expect(CODE).toMatch(/totalCount > 0 \? "text-slate-900" : "text-slate-400"/);
    expect(CODE).toMatch(/highRiskCount > 0 \? "text-slate-900" : "text-slate-400"/);
  });
});

describe("§safety-redesign 상단정합 — KPI 카드 높이 축소(핸드오프-KPI축소)", () => {
  it("카드 패딩 컴팩트(p-3.5 md:p-4) + 값 폰트 축소(text-2xl md:text-3xl)", () => {
    expect(CODE).toMatch(/bg-white p-3\.5 md:p-4 hover:shadow-md/);
    expect(CODE).toMatch(/text-2xl md:text-3xl font-extrabold/);
    expect(CODE).not.toMatch(/bg-white p-5 hover:shadow-md/);
  });
  it("코너 배지 모바일 숨김(hidden sm:inline-flex) + 2열 유지(grid-cols-2)", () => {
    expect(CODE).toMatch(/hidden sm:inline-flex items-center text-\[10px\] font-semibold/);
    expect(CODE).toMatch(/grid grid-cols-2 lg:grid-cols-4/);
  });
});

describe("§safety-redesign 상단정합 — AI 큐 전체보기 푸터", () => {
  it("전체 보기 푸터 = 테이블 섹션 scroll(실 동작)", () => {
    expect(CODE).toMatch(/건 보기/);
    expect(CODE).toMatch(/safety-chem-list/);
    expect(CODE).toMatch(/getElementById\("safety-chem-list"\)/);
  });
});

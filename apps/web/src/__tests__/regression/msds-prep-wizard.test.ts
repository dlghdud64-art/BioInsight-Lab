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

describe("§msds-registration Track A — 라벨 정직화 (호영님 2026-07-03, fake-success 해소)", () => {
  it("safety 전역에 '일괄 등록' 거짓 라벨 0건 (CSV 산출물을 등록으로 오인 금지)", () => {
    expect(PAGE).not.toMatch(/일괄 등록/);
    expect(PAGE).not.toMatch(/등록 완료/);
  });
  it("primary CTA = 실동작(CSV export)과 일치하는 라벨", () => {
    expect(CODE).toMatch(/MSDS 점검 준비 목록 내보내기/);
    expect(CODE).toMatch(/onClick=\{\(\) => \{ if \(msdsMissingCount > 0\) openPrepWizard\(\); \}\}/);
  });
  it("선택-바 bulk 버튼 = 정직 라벨 + disabled 유지(no-op 금지)", () => {
    expect(CODE).toMatch(/선택 항목 점검 준비/);
  });
  it("prep 체크리스트 CSV = \\uFEFF BOM 이스케이프(리터럴 BOM 금지, Excel 인코딩 정합)", () => {
    expect(CODE).toMatch(/new Blob\(\["\\uFEFF" \+ meta/);
  });
});

describe("§msds-registration 회귀 — 단일 실 등록(option b) 무접촉 보존", () => {
  it("단일 MSDS 실 업로드 경로 보존(POST /api/products/[id]/sds, 파일 필수)", () => {
    expect(CODE).toMatch(/const handleMsdsSave = async/);
    expect(CODE).toMatch(/fetch\(`\/api\/products\/\$\{productId\}\/sds`/);
    expect(CODE).toMatch(/MSDS 문서 업로드/);
    expect(CODE).toMatch(/disabled=\{msdsSaving \|\| !msdsFile\}/);
  });
});

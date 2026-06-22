import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §quote-screen-sian §09b — 발송 검토 no-supplier 통합 히어로(호영님 이미지 시안
//   2026-06-23). 후보 0일 때 중복 경고 3블록(보강 strip·empty 배너·선별 실패)을
//   단일 배너 + "이메일로 공급사 추가" 히어로 + "LabAxis 추천 공급사 탐색"으로 통합.
//   기존 후보 브라우저 markup 은 source 보존(§09 sentinel 회귀 0) + "탐색" 클릭으로
//   노출(dead button 0).
const WORKBENCH_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "components",
  "quotes",
  "dispatch",
  "vendor-dispatch-workbench.tsx",
);

describe("§quote-screen-sian §09b — no-supplier 통합 히어로", () => {
  const src = readFileSync(WORKBENCH_PATH, "utf8");

  it("게이트 — showNoSupplierHero = !hasResolved && !candidatesExpanded", () => {
    expect(src).toContain("const showNoSupplierHero = !hasResolved && !candidatesExpanded");
    expect(src).toContain('data-testid="quote-dispatch-no-supplier-hero"');
  });

  it("통합 배너 — 단일 안내(중복 3블록 대체)", () => {
    expect(src).toContain("공급사를 먼저 추가하세요");
    expect(src).toContain("이 품목에 매칭되는 공급사가 없습니다. 이메일로 직접 추가하면 바로 전송할 수 있어요.");
  });

  it("이메일로 공급사 추가 히어로 — 직접 입력 폼 승격(실제 추가 wiring)", () => {
    expect(src).toContain("이메일로 공급사 추가");
    expect(src).toContain("견적 요청을 받을 공급사의 이메일을 입력하세요");
    expect(src).toContain('placeholder="공급사 이메일 *"');
    expect(src).toContain('data-testid="quote-dispatch-no-supplier-add"');
    // 추가 버튼은 실제 addManualVendor 호출(dead button 0).
    expect(src).toMatch(/data-testid="quote-dispatch-no-supplier-add"[\s\S]{0,200}onClick=\{addManualVendor\}|onClick=\{addManualVendor\}[\s\S]{0,200}quote-dispatch-no-supplier-add/);
  });

  it("또는 + LabAxis 추천 공급사 탐색 — 후보 브라우저 펼침(dead button 0)", () => {
    expect(src).toContain("LabAxis 추천 공급사 탐색");
    expect(src).toContain('data-testid="quote-dispatch-explore-recommended"');
    expect(src).toContain("onClick={() => setCandidatesExpanded(true)}");
  });

  it("subtitle — no-supplier 정합", () => {
    expect(src).toContain("전송하려면 공급사가 1곳 이상 필요합니다. 아래에서 직접 추가해 주세요.");
  });

  it("기존 후보 브라우저는 !showNoSupplierHero 게이트(탐색 시 노출)", () => {
    expect(src).toContain("{!showNoSupplierHero && (");
  });

  it("회귀 0 — §09 기존 markup source 보존", () => {
    expect(src).toContain('data-testid="quote-dispatch-state-banner"');
    expect(src).toContain('data-testid="quote-dispatch-manual-supplier-panel"');
    expect(src).toContain('data-testid="quote-dispatch-supplier-remediation-visible-cta"');
    expect(src).toContain("등록된 공급사");
    expect(src).toContain("LabAxis 추천");
    expect(src).toContain('data-testid="quote-dispatch-stepper"');
  });
});

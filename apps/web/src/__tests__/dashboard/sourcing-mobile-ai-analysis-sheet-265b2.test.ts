/**
 * §11.265b-2 — 【SUPERSEDED by §1-3】 AI 분석 바텀시트 제거 가드
 *
 * 원래 §11.265b-2 는 "AI 분석 바텀시트 shell + content"를 canonical lock 했으나:
 *   - 그 시트의 TRIAGE 콘텐츠(Sourcing Result Triage / sourcingTriage.sections.map /
 *     sourcing-result-triage)는 이미 §11.292(호영님 P1 1단계)에서 제거됨 → 본 테스트는
 *     §1-3 이전부터 일부 stale.
 *   - §1-3/§4(현재 호영님): "별도 AI 버튼/패널 금지, ontology=inline 신호". → AI 분석
 *     시트·트리거 전면 제거, 신호는 상단 우선 배너 1개 + 행 inline chip 으로 전환.
 *
 * 따라서 본 가드는 "시트가 제거되고 inline 신호로 대체됐는지"를 검증한다(supersede).
 * 보존 invariant(햄버거 등)는 회귀 0 으로 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265b-2 → §1-3 supersede — AI 분석 시트 제거", () => {
  it("aiAnalysisSheetOpen state 제거", () => {
    expect(page).not.toMatch(/aiAnalysisSheetOpen/);
  });
  it("sourcing-ai-analysis-sheet 제거", () => {
    expect(page).not.toMatch(/sourcing-ai-analysis-sheet/);
  });
  it("AI 분석 트리거(sourcing-ai-analysis-trigger) 제거", () => {
    expect(page).not.toMatch(/sourcing-ai-analysis-trigger/);
  });
});

describe("§1-3 — inline 신호 대체 surface 존재", () => {
  it("상단 우선 배너 1개(sourcing-top-banner) + pickTopBanner 배선", () => {
    expect(page).toMatch(/data-testid="sourcing-top-banner"/);
    expect(page).toMatch(/pickTopBanner\(/);
  });
});

describe("§11.265b-2 — 회귀 0(보존 invariant)", () => {
  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });
  // §11.265a unified filter row 보존 assertion 제거 — 해당 row 는 이전 배치에서
  //   이미 제거됨(현 코드 부재). stale 가드라 carry-forward 하지 않음(§1-3 무관).
});

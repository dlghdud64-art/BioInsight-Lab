/**
 * Phase 3 — 소싱 AI surface inline 신호 + compare 단계 게이트 wiring sentinel
 * PLAN_ai-stage-gate-inline-signal / §1-3 · §1-4.
 *
 * sandbox vitest 실행 불가 → 클로드코드 실제 실행 PASS 확정.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SEARCH = "src/app/_workbench/search/page.tsx";
const COMPARE_MODAL = "src/app/_workbench/_components/comparison-modal.tsx";

describe("§1-3 — search 결과 inline 신호(AI 분석 패널 폐기)", () => {
  it("상단 우선 배너 pickTopBanner 배선", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/from "@\/lib\/ai\/sourcing-signal-surface"/);
    expect(src).toMatch(/pickTopBanner\(aiSearchSummary\)/);
    expect(src).toMatch(/data-testid="sourcing-top-banner"/);
  });

  it("AI 분석 트리거/시트 제거(§4 별도 AI 패널 폐기)", () => {
    const src = read(SEARCH);
    expect(src).not.toMatch(/sourcing-ai-analysis-trigger/);
    expect(src).not.toMatch(/aiAnalysisSheetOpen/);
  });

  it("§1-2⑦ 정렬 라벨 '추천순'(AI 데코 제거)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/>추천순</);
    expect(src).not.toMatch(/AI 추천순/);
  });
});

describe("§1-4 — compare 2단계 게이트(comparison-modal)", () => {
  it("evaluateCompareStage 배선 + 가격·납기 보유 후보 수", () => {
    const src = read(COMPARE_MODAL);
    expect(src).toMatch(/evaluateCompareStage\(quoteReadyCount\)/);
    expect(src).toMatch(/typeof p\.price === "number" && p\.price > 0 && !!p\.leadTime/);
  });

  it("자동 분석은 post-quote(canAiAnalyze)일 때만 — 조숙 Gemini 호출 차단", () => {
    const src = read(COMPARE_MODAL);
    expect(src).toMatch(/categoryGuard\.compareMode === "direct" && compareStage\.canAiAnalyze/);
  });

  it("pre-quote 게이트 배너 + '견적 요청 만들기' primary", () => {
    const src = read(COMPARE_MODAL);
    expect(src).toMatch(/data-testid="compare-pre-quote-gate"/);
    expect(src).toMatch(/!compareStage\.canAiAnalyze/);
    expect(src).toMatch(/견적 요청 만들기/);
  });

  // 회귀 0 — 기존 가드 보존
  it("§11.318 카테고리 가드 + human-in-loop caveat 보존", () => {
    const src = read(COMPARE_MODAL);
    expect(src).toMatch(/그래도 분석/);
    expect(src).toMatch(/분석은 추천 근거/);
  });
});

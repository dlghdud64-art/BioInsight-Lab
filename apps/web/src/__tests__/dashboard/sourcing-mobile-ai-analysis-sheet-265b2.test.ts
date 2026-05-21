/**
 * §11.265b-2 #sourcing-mobile-ai-analysis-sheet — NEW AI 분석 바텀시트 shell + content (호영님 spec)
 *
 * 호영님 spec "AI 분석 바텀시트":
 *   SOURCING RESULT TRIAGE / Exact / Cross / Alternative / Blocked /
 *   AI 제안: 비교 권장 · 가격차 4622% / [비교 후보 담기] /
 *   차단 사유: 없음 / [보류 검토] [제외 사유] [비교 검토 열기]
 *
 * §11.265b-2 scope: Sheet shell + state + content 복제. 트리거 0 (§11.265c).
 *   Sheet 컴포넌트는 모바일 한정 진입 path — content 는 §11.265b-1 hidden
 *   inline block 와 동일 (page 안 closure 변수 그대로 접근 — 별도 컴포넌트
 *   분리 X, markup duplication ~80 line acceptable trade-off).
 *
 * canonical truth lock:
 *   - §11.265b-1 inline AI 제안 + TRIAGE hidden md:block 보존
 *   - sourcingTriage / aiSearchSummary / handleProtectedAction /
 *     toggleCompare / setAiDismissedHash / openSourcingTriageReview 보존
 *   - §11.265a unified row hidden 보존
 *   - §11.254b 햄버거 + §11.263a header spacer 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265b-2 #1 — aiAnalysisSheetOpen state + Sheet shell", () => {
  it("§11.265b-2 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.265b-2/);
  });

  it("aiAnalysisSheetOpen useState 도입 (default false)", () => {
    expect(page).toMatch(
      /const\s+\[aiAnalysisSheetOpen,\s+setAiAnalysisSheetOpen\]\s*=\s*useState\(\s*false\s*\)/,
    );
  });

  it("AI 분석 Sheet 컴포넌트 신규 (data-testid 부여)", () => {
    // <Sheet open={aiAnalysisSheetOpen} onOpenChange={setAiAnalysisSheetOpen}>
    //   <SheetContent side="bottom" ...
    expect(page).toMatch(
      /<Sheet open=\{aiAnalysisSheetOpen\} onOpenChange=\{setAiAnalysisSheetOpen\}>/,
    );
    // data-testid 부여 (Chrome MCP / e2e 안정)
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-sheet"/);
  });

  it("Sheet side=bottom + max-h 모바일 친화 (max-h-[85vh])", () => {
    expect(page).toMatch(
      /sourcing-ai-analysis-sheet[\s\S]{0,500}side="bottom"[\s\S]{0,300}h-\[85vh\]|sourcing-ai-analysis-sheet[\s\S]{0,500}side="bottom"[\s\S]{0,300}h-\[80vh\]/,
    );
  });
});

describe("§11.265b-2 #2 — Sheet content (TRIAGE + AI 제안 복제)", () => {
  it("Sheet 안 TRIAGE 헤더 'Sourcing Result Triage' 복제", () => {
    // 2번 등장 (line 1020 데스크탑 inline + Sheet 안 모바일)
    const matches = page.match(/Sourcing Result Triage/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("Sheet 안 sourcing-ai-analysis 안 TRIAGE sections.map 복제", () => {
    // 2번 등장 — 데스크탑 inline + Sheet 안 모바일
    const matches = page.match(/sourcingTriage\.sections\.map\(/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("Sheet 안 비교 검토 열기 / 보류 검토 / 제외 사유 3 버튼 복제", () => {
    // 각 라벨 2번 등장
    const compareMatches = page.match(/비교 검토 열기/g);
    expect(compareMatches?.length ?? 0).toBeGreaterThanOrEqual(2);
    const reviewMatches = page.match(/보류 검토/g);
    expect(reviewMatches?.length ?? 0).toBeGreaterThanOrEqual(2);
    const excludeMatches = page.match(/제외 사유/g);
    expect(excludeMatches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("Sheet 안 차단 사유 라벨 복제", () => {
    // "차단 사유:" 2번 등장
    const matches = page.match(/차단 사유:/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("§11.265b-2 #3 — invariant 보존 (canonical truth)", () => {
  it("§11.265b-1 inline AI 제안 fallback hidden md:block 보존", () => {
    expect(page).toMatch(
      /!shouldShowSourcingStrip && aiShouldShow[\s\S]{0,400}className="hidden md:block px-4 pt-1\.5"/,
    );
  });

  it("§11.265b-1 inline TRIAGE section hidden md:block 보존", () => {
    expect(page).toMatch(
      /data-testid="sourcing-result-triage"[\s\S]{0,300}className="px-3 pt-2"/,
    );
  });

  it("§11.265a unified filter row hidden 보존", () => {
    expect(page).toMatch(
      /<div className="hidden\s+items-center\s+gap-1\.5\s+overflow-x-auto\s+px-4\s+py-2/,
    );
  });

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });

  it("openSourcingTriageReview 함수 보존", () => {
    expect(page).toMatch(/openSourcingTriageReview/);
  });

  it("sourcingTriage 의존 데이터 보존 (sections / blockedReason)", () => {
    expect(page).toMatch(/sourcingTriage\.blockedReason/);
    expect(page).toMatch(/sourcingTriage\.sections/);
  });
});

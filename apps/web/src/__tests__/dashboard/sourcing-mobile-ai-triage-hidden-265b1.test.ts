/**
 * §11.265b-1 #sourcing-mobile-ai-triage-hidden — AI 제안 fallback + TRIAGE 블록 모바일 hidden
 *
 * 호영님 spec ("소싱 모바일 — 검색 본질 회복" 후속):
 *   AI 제안 fallback (line 999-1018, ~50px) + TRIAGE 블록 (line 1020-1100, ~180px) +
 *   차단 사유 + 보류 검토/제외 사유 → AI 분석 바텀시트로 이동. 검색 결과 카드
 *   도달 거리 ~230px 추가 단축. §11.265a 의 ~140px 와 합산 ~370px 절약 (~spec 의
 *   "340px 절약" 정합).
 *
 * §11.265b-1 scope (minimum diff first):
 *   인라인 두 block 의 wrapper className 에 hidden md:block 추가 → 모바일에서
 *   비표시. 데스크탑 (md+) 은 그대로 inline 표시 (변경 0). content / state /
 *   handler / props 변경 0.
 *
 * 후속 §11.265b-2 (별도 cluster):
 *   NEW <AiAnalysisBottomSheet> 컴포넌트 + state + content 복제. 모바일 트리거
 *   버튼은 §11.265c 1줄 요약 row 안 "AI 분석" 버튼.
 *
 * canonical truth lock:
 *   - AI 제안 fallback content (aiSearchSummary / handleProtectedAction /
 *     setAiDismissedHash / toggleCompare) 보존
 *   - TRIAGE 블록 content (sourcingTriage.sections / blockedReason /
 *     openSourcingTriageReview 3 callsite) 보존
 *   - data-testid 보존 (sourcing-result-triage / sourcing-triage-*) — e2e 안정
 *   - 데스크탑 (md+) 정상 표시
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.265b-1 #1 — 인라인 두 block 모바일 hidden", () => {
  it("§11.265b-1 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.265b-1/);
  });

  it("AI 제안 fallback wrapper className hidden md:block", () => {
    // 기존: !shouldShowSourcingStrip && aiShouldShow 분기 안 wrapper className "px-4 pt-1.5"
    // 신규: className 에 "hidden md:block" 추가
    expect(page).toMatch(
      /!shouldShowSourcingStrip && aiShouldShow[\s\S]{0,300}className="hidden md:block px-4 pt-1\.5"/,
    );
  });

  it("TRIAGE 블록 (sourcing-result-triage) section className hidden md:block", () => {
    // 기존: <section data-testid="sourcing-result-triage" ... className="px-3 pt-2">
    // 신규: className 에 "hidden md:block" 추가
    expect(page).toMatch(
      /data-testid="sourcing-result-triage"[\s\S]{0,200}className="hidden md:block px-3 pt-2"/,
    );
  });
});

describe("§11.265b-1 #2 — invariant 보존 (canonical truth)", () => {
  it("AI 제안 fallback content 보존 (aiSearchSummary, signal compare, handleProtectedAction)", () => {
    expect(page).toMatch(/aiSearchSummary\[0\]\?\.text/);
    expect(page).toMatch(/aiSearchSummary\.some\(l => l\.signal === "compare"\)/);
    expect(page).toMatch(/handleProtectedAction\(\(\) =>/);
    expect(page).toMatch(/setAiDismissedHash\(aiContextHash\)/);
  });

  it("AI 제안 fallback 비교 후보 담기 버튼 보존", () => {
    expect(page).toMatch(/비교 후보 담기/);
  });

  it("TRIAGE 블록 sections.map 보존", () => {
    expect(page).toMatch(/sourcingTriage\.sections\.map\(/);
    expect(page).toMatch(/section\.tone === "blue"/);
    expect(page).toMatch(/section\.tone === "violet"/);
    expect(page).toMatch(/section\.tone === "emerald"/);
  });

  it("TRIAGE 비교 검토 열기 / 보류 검토 / 제외 사유 핸들러 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-triage-compare-cta"/);
    expect(page).toMatch(/onClick=\{openSourcingTriageReview\}/);
    expect(page).toMatch(/비교 검토 열기/);
    expect(page).toMatch(/보류 검토/);
    expect(page).toMatch(/제외 사유/);
  });

  it("TRIAGE blockedReason 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-triage-blocked-reason"/);
    expect(page).toMatch(/차단 사유:\s*\{sourcingTriage\.blockedReason\}/);
  });

  it("§11.265a unified mobile filter row hidden 보존", () => {
    expect(page).toMatch(
      /<div className="hidden\s+items-center\s+gap-1\.5\s+overflow-x-auto\s+px-4\s+py-2/,
    );
  });

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });
});

/**
 * §11.264i #quote-bottom-sheet-dual-overlap — 견적 바텀시트 2중 겹침 fix (호영님 spec P0 긴급)
 *
 * 호영님 spec:
 *   "새 회신 보기" 탭 시 바텀시트가 2장 동시에 올라옴:
 *     1층 (뒤): 견적 상세 시트 (§11.248e mobile context sheet)
 *     2층 (앞): 운영 브리핑 시트 (§11.155 MobileOperationalBriefSheet)
 *   - 닫으려면 X를 2번 눌러야 함
 *   - 사용자는 "새 회신"을 보려고 했는데 시트 2장이 겹쳐서 뜸
 *
 * Root cause: 두 sheet 가 동일 `selectedQuote` state 를 단일 truth 로 공유 →
 *   §11.248e (line 2755, min-[1200px]:hidden) + §11.155 (line 3380, breakpoint
 *   guard 0) 가 모바일 (< 1200px) viewport 에서 동시 렌더.
 *
 * Fix (방안 A — 호영님 권장):
 *   (1) 새 state `briefSheetOpen` 도입 — §11.155 MobileOperationalBriefSheet 의
 *       trigger 를 selectedQuote → briefSheetOpen 으로 분리.
 *   (2) §11.248e header 옆 "✦ 운영 브리핑" 버튼 추가 → setBriefSheetOpen(true).
 *   (3) closeQuoteContextRail 에 setBriefSheetOpen(false) 동기 → 견적 닫기 시
 *       운영 브리핑도 함께 닫힘 (orphan state 방지).
 *
 * 추가 (#3): KPI 5 카드 모바일 도트 인디케이터 추가 — 가로 스크롤 hint.
 *
 * canonical truth lock:
 *   - selectedQuoteId state 보존
 *   - openQuoteContextRail / closeQuoteContextRail 함수 시그니처 보존
 *   - §11.248e mobile context sheet 구조 보존 (badge/title/summary/body)
 *   - §11.155 MobileOperationalBriefSheet props 시그니처 보존
 *   - §11.264a chips override (상태 요약 / 회신 현황 / 리스크 / 발주 전환) 보존
 *   - §11.264d objectLabel 동적 결합 보존
 *   - §11.259a KPI cards flex sm:grid + snap-x 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264i #1 — briefSheetOpen state 분리 (2중 겹침 fix)", () => {
  it("§11.264i trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264i/);
  });

  it("briefSheetOpen useState 도입 (default false)", () => {
    expect(page).toMatch(
      /const\s+\[briefSheetOpen,\s+setBriefSheetOpen\]\s*=\s*useState[<\(]/,
    );
    // default false (모달이 기본적으로 닫혀 있어야 함)
    expect(page).toMatch(
      /const\s+\[briefSheetOpen,\s+setBriefSheetOpen\]\s*=\s*useState[<\w>\s]*\(\s*false\s*\)/,
    );
  });

  it("§11.155 MobileOperationalBriefSheet 조건에 briefSheetOpen 추가", () => {
    // 기존: {selectedQuote && selectedSignals && (
    // 신규: {briefSheetOpen && selectedQuote && selectedSignals && (
    expect(page).toMatch(
      /\{briefSheetOpen\s*&&\s*selectedQuote\s*&&\s*selectedSignals\s*&&\s*\(/,
    );
  });

  it("MobileOperationalBriefSheet open prop = briefSheetOpen", () => {
    // 기존: open={!!selectedQuote}
    // 신규: open={briefSheetOpen}
    expect(page).toMatch(/open=\{briefSheetOpen\}/);
  });

  it("MobileOperationalBriefSheet onClose 에 setBriefSheetOpen(false) 호출", () => {
    // 기존: onClose={() => closeQuoteContextRail("x_button")}
    // 신규: onClose={() => setBriefSheetOpen(false)}
    // (closeQuoteContextRail 은 견적 자체를 닫음 — 운영 브리핑만 닫을 때는 setBriefSheetOpen(false))
    expect(page).toMatch(/onClose=\{\(\)\s*=>\s*setBriefSheetOpen\(false\)\}/);
  });

  it("§11.248e header 옆 ✦ 운영 브리핑 진입 버튼 추가", () => {
    // header 영역 (badge + #ID + X button) 안에 새 버튼:
    //   onClick={() => setBriefSheetOpen(true)}
    //   aria-label 로 진입 명시
    expect(page).toMatch(/setBriefSheetOpen\(true\)/);
    expect(page).toMatch(/aria-label="운영 브리핑 열기"/);
    expect(page).toMatch(/✦/);
  });

  it("closeQuoteContextRail 에 setBriefSheetOpen(false) 동기 (orphan state 방지)", () => {
    // 견적 자체 닫을 때 briefSheet 도 닫혀야 함
    // closeQuoteContextRail 함수 안 또는 호출 후 setBriefSheetOpen(false)
    expect(page).toMatch(
      /closeQuoteContextRail[\s\S]{0,800}setBriefSheetOpen\(false\)/,
    );
  });
});

describe("§11.264i #3 — KPI 5 카드 모바일 도트 인디케이터", () => {
  it("§11.264i KPI 도트 인디케이터 wrapper 존재 (sm:hidden)", () => {
    // KPI cards row 아래에 5 도트 (모바일 한정)
    expect(page).toMatch(
      /data-testid="quote-kpi-scroll-dots"[\s\S]{0,200}sm:hidden/,
    );
  });

  it("도트 5개 렌더 (5 카드 정합)", () => {
    // [0,1,2,3,4].map 또는 KPI_DOTS_COUNT 같은 패턴
    expect(page).toMatch(
      /data-testid="quote-kpi-scroll-dots"[\s\S]{0,500}Array\(5\)\.fill|data-testid="quote-kpi-scroll-dots"[\s\S]{0,500}\[0,\s*1,\s*2,\s*3,\s*4\]/,
    );
  });
});

describe("§11.264i #2 — invariant 보존 (canonical truth)", () => {
  it("selectedQuoteId useState 보존", () => {
    expect(page).toMatch(
      /const\s+\[selectedQuoteId,\s+setSelectedQuoteId\]\s*=\s*useState/,
    );
  });

  it("openQuoteContextRail 함수 시그니처 보존", () => {
    expect(page).toMatch(
      /const\s+openQuoteContextRail\s*=\s*\(caseId:\s*string,\s*source:\s*string\s*=\s*"row"\)/,
    );
  });

  it("§11.248e mobile context sheet 구조 보존 (badge + #ID + title + summary)", () => {
    expect(page).toMatch(/selectedSignals\.badge/);
    expect(page).toMatch(/selectedQuote\.id\.slice\(0,\s*8\)\.toUpperCase\(\)/);
    expect(page).toMatch(
      /<h3\s+className="text-sm font-semibold text-slate-900 truncate">\{selectedQuote\.title\}</,
    );
    expect(page).toMatch(/selectedSignals\.summary/);
  });

  it("§11.248e min-[1200px]:hidden 보존 (mobile/tablet only)", () => {
    expect(page).toMatch(/min-\[1200px\]:hidden fixed inset-0 z-40/);
  });

  it("§11.155 MobileOperationalBriefSheet import 보존", () => {
    expect(page).toMatch(
      /import\s+\{\s*MobileOperationalBriefSheet\s*\}\s+from\s+"@\/components\/operational-brief\/mobile-bottom-sheet"/,
    );
  });

  it("§11.264a chips override (4 entry) 보존: 상태 요약 / 회신 현황 / 리스크 / 발주 전환", () => {
    expect(page).toMatch(/\{ id: "summary",\s+label: "상태 요약" \}/);
    expect(page).toMatch(/\{ id: "facts",\s+label: "회신 현황" \}/);
    expect(page).toMatch(/\{ id: "risks",\s+label: "리스크" \}/);
    expect(page).toMatch(/\{ id: "next",\s+label: "발주 전환" \}/);
  });

  it("§11.264d objectLabel 동적 결합 보존", () => {
    expect(page).toMatch(
      /objectLabel=\{`선택한 견적\s*·\s*\$\{selectedQuote\.title\}`\}/,
    );
  });

  it("§11.259a KPI cards flex sm:grid + snap-x 보존 (모바일 가로 스크롤)", () => {
    expect(page).toMatch(
      /flex sm:grid overflow-x-auto sm:overflow-visible snap-x snap-mandatory/,
    );
  });

  it("KPI 5 카드 라벨 보존: 발송 대기 / 회신 추적 / 비교 검토 필요 / 승인 ・ 예외 처리 / 발주 전환 가능", () => {
    expect(page).toMatch(/label: "발송 대기"/);
    expect(page).toMatch(/label: "회신 추적"/);
    expect(page).toMatch(/label: "비교 검토 필요"/);
    expect(page).toMatch(/label: "승인 ?\/ ?예외 처리"/);
    expect(page).toMatch(/label: "발주 전환 가능"/);
  });
});

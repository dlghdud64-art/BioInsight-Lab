/**
 * §11.268c #sourcing-action-dock-divider — 액션 바 2행 divider tone 강화
 *   (§11.268 family final close 3/3, 호영님 spec "비교 행 / 견적 행 명확 분리")
 *
 * 호영님 보고: "여전히 비교 행 + 견적 행 + '전체 해제'가 혼재".
 * §11.252f 가 이미 2행 분리 구조 (1행 비교 + 2행 견적 + 전체 해제 row) 적용.
 * §11.268a FAB 제거로 겹침 해소. 잔여: divider tone subtle (border-white/10)
 * → 시각 분리 부족. divider opacity 강화로 시각 명확화.
 *
 * Fix (minimum diff, 2 className swap):
 *   (1) 1행 비교 (line ~1633): border-b border-white/10 → border-white/20
 *       — 1행과 2행 사이 명확 divider.
 *   (2) 전체 해제 row (line ~1695): border-t border-white/5 → border-white/15
 *       — 2행과 전체 해제 사이 명확 divider.
 *
 * canonical truth lock:
 *   - §11.252f 2 row 조건부 렌더 (compareIds.length > 0, quoteItems.length > 0) 보존
 *   - clearCompare / removeQuoteItem onClick 보존
 *   - 비교 검토 / 견적 요청서 만들기 / 견적 요청 (sm:hidden 축약) 보존
 *   - PenLine / FileText icon + Badge 보존
 *   - min-h-[44px] 보존
 *   - ml-auto 우측 정렬 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.268c #1 — divider tone 강화 (border-white/10 → border-white/20)", () => {
  it("§11.268c trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.268c/);
  });

  it("1행 비교 row 의 divider border-white/20 적용", () => {
    // px-4 min-h-[44px] flex items-center gap-2 sm:gap-3 border-b border-white/20
    expect(page).toMatch(
      /px-4 min-h-\[44px\] flex items-center gap-2 sm:gap-3 border-b border-white\/20/,
    );
  });

  it("§11.312-b 정합 — 옛 별도 줄 'border-t border-white/15' 제거 후 견적 bar 본체 🗑 통합 (라벨/onClick 보존)", () => {
    // §11.312-b 호영님 spec 5번: "전체 해제 별도 줄" 제거 + bar 본체 🗑 + AlertDialog 확인 다이얼로그.
    // 옛 border-t border-white/15 별도 줄 패턴 잔존 0.
    expect(page).not.toMatch(/border-t border-white\/15[\s\S]{0,200}전체 해제/);
    // §11.312-b 신규 testid + aria-label 매칭 (라벨 "전체 해제" 는 aria-label 안 보존).
    expect(page).toMatch(/data-testid="sourcing-bar-clear-all-trigger"/);
    expect(page).toMatch(/aria-label="견적 후보 전체 해제"/);
  });
});

describe("§11.268c #2 — invariant 보존 (canonical truth)", () => {
  it("§11.252f 1행 비교 (compareIds.length > 0) 조건부 렌더 보존", () => {
    expect(page).toMatch(/compareIds\.length > 0 && \(/);
  });

  it("§11.252f 2행 견적 (quoteItems.length > 0) 조건부 렌더 보존", () => {
    expect(page).toMatch(/quoteItems\.length > 0 && \(/);
  });

  it("1행 비교 icon (PenLine) + Badge + 비교 검토 button 보존", () => {
    expect(page).toMatch(/<PenLine className="h-4 w-4 text-blue-600 shrink-0" \/>/);
    expect(page).toMatch(/<Sparkles className="h-3\.5 w-3\.5 mr-1"[\s\S]{0,100}비교 검토/);
  });

  it("2행 견적 icon (FileText) + Badge + 견적 요청서 만들기 / 견적 요청 (sm:hidden 축약) 보존", () => {
    expect(page).toMatch(/<FileText className="h-4 w-4 text-emerald-500 shrink-0" \/>/);
    expect(page).toMatch(/<span className="hidden sm:inline">견적 요청서 만들기<\/span>/);
    expect(page).toMatch(/<span className="sm:hidden">견적 요청<\/span>/);
  });

  it("clearCompare + removeQuoteItem 전체 해제 onClick 보존", () => {
    expect(page).toMatch(
      /onClick=\{\(\) => \{ clearCompare\(\); quoteItems\.forEach\(\(item: any\) => removeQuoteItem\(item\.id\)\); \}\}/,
    );
  });

  it("\"전체 해제\" 라벨 보존", () => {
    expect(page).toMatch(/전체 해제/);
  });

  it("min-h-[44px] 2 row 모두 보존", () => {
    expect(page).toMatch(
      /compareIds\.length > 0 && \(\s*<div className="px-4 min-h-\[44px\]/,
    );
    expect(page).toMatch(
      /quoteItems\.length > 0 && \(\s*<div className="px-4 min-h-\[44px\]/,
    );
  });

  it("§11.268a FAB 부재 + 헤더 inline 보존", () => {
    expect(page).not.toMatch(/data-testid="sourcing-label-scan-fab"/);
    expect(page).toMatch(
      /onClick=\{\(\) => setLabelScanOpen\(true\)\}[\s\S]{0,400}bg-emerald-500\/15 text-emerald-400/,
    );
  });

  it("§11.268b 3 button outline 통일 (정렬 select + 필터 + AI 분석 slate) 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-sort-select"[\s\S]{0,500}min-h-\[44px\]/);
    expect(page).toMatch(
      /setAiAnalysisSheetOpen\(true\)[\s\S]{0,800}text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200/,
    );
  });
});

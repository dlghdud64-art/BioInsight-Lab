/**
 * §11.312 #sourcing-bar-ux — Regression sentinel
 *
 * ⚠️ §11.339 v2 supersede: 하단 SourcingCandidatesSheet(드로어) 제거 → 우측
 *   QuoteCartPanel 탭으로 일원화. bar 탭 = FocusKey 카운터 증가(forceQuoteKey/
 *   forceCompareKey)로 탭 전환. 본 sentinel 의 search/page wiring 단언을 그
 *   동작에 맞게 갱신(§11.356 Phase2 — sheet 기대는 stale 이었음).
 *
 * 호영님 P1 spec (2026-05-26):
 *   1. 비교/견적 bar 의 숫자 영역 탭 → SourcingCandidatesSheet (개별 ✕ 삭제)
 *   2. ⚠ 검토 N 배지 dead button → 탭 시 review mode sheet (사유 + [재고 확인] / [그래도 유지])
 *   3. bar 미리보기 텍스트 (첫 항목명 truncate)
 *   4. amber → yellow (§11.302 색상 체계)
 *   5. 🗑 휴지통 button 제거 (sheet 내 "전체 삭제" 통합)
 *
 * 회귀 보호 (§11.252f + §11.268c):
 *   - 2-row 구조 보존 (compareIds.length > 0 + quoteItems.length > 0)
 *   - divider border-white/20 보존
 *   - requestHandoff 분기 (요청 조립 vs 요청서 만들기) 보존
 *   - totalAmount 표시 보존
 *   - "전체 해제" 우측 링크 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SEARCH_PATH = "src/app/_workbench/search/page.tsx";
const SHEET_PATH = "src/components/sourcing/SourcingCandidatesSheet.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.312 — SourcingCandidatesSheet 컴포넌트", () => {
  it("파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, SHEET_PATH))).toBe(true);
  });

  it("export SourcingCandidatesSheet + 3 mode (compare/quote/review)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/export\s+function\s+SourcingCandidatesSheet/);
    expect(src).toMatch(/CandidatesSheetMode\s*=\s*["']compare["']\s*\|\s*["']quote["']\s*\|\s*["']review["']/);
  });

  it("각 항목 ✕ 개별 삭제 (candidate-remove-cta testid)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="candidate-remove-cta"/);
  });

  it("전체 삭제 → window.confirm + sheet 내 통합", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="candidates-clear-all"/);
    expect(src).toMatch(/window\.confirm/);
  });

  it("Review mode [재고 확인] / [그래도 견적에 유지] 액션 (dead button 해소)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/data-testid="review-inventory-check-cta"/);
    expect(src).toMatch(/data-testid="review-keep-anyway-cta"/);
    expect(src).toMatch(/\/dashboard\/inventory\?search=/);
  });

  it("Review mode 검토 사유 노출", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/사유:\s*\{q\.reviewReason/);
  });

  it("§11.302 색상 정합 (yellow-100/yellow-700, amber 0 in sheet)", () => {
    const src = read(SHEET_PATH);
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
    expect(src).not.toMatch(/bg-amber-50 text-amber-/);
  });
});

describe("§11.312 — search/page.tsx wiring", () => {
  it("SourcingCandidatesSheet import", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/import\s*\{[^}]*SourcingCandidatesSheet[^}]*\}\s*from\s*["']@\/components\/sourcing\/SourcingCandidatesSheet["']/);
  });

  it("candidatesSheetMode state (compare | quote | review | null)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/candidatesSheetMode/);
    expect(src).toMatch(/setCandidatesSheetMode/);
    expect(src).toMatch(/"compare"\s*\|\s*"quote"\s*\|\s*"review"\s*\|\s*null/);
  });

  it("비교 bar 영역 탭 → sheet open (sourcing-bar-compare-open testid)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/data-testid="sourcing-bar-compare-open"/);
    expect(src).toMatch(/setCompareFocusKey/); // §11.339 v2 탭전환
  });

  it("견적 bar 영역 탭 → sheet open (sourcing-bar-quote-open testid)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/data-testid="sourcing-bar-quote-open"/);
    expect(src).toMatch(/setQuoteFocusKey/); // §11.339 v2 탭전환
  });

  it("⚠ 검토 N 배지 dead button 해소 → review mode sheet (sourcing-bar-review-open testid)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/data-testid="sourcing-bar-review-count"/); // §11.339 v2: 견적함 탭 인라인
    expect(src).toMatch(/setReviewFocusKey/); // §11.339 v2 탭전환
  });

  it("amber → yellow swap (compare 1행 + 견적 배지)", () => {
    const src = read(SEARCH_PATH);
    // §11.252f bar 영역 (line 1454~) 의 amber 패턴 0
    expect(src).not.toMatch(/text-amber-500.*2개 이상 필요/);
    expect(src).not.toMatch(/bg-amber-50 text-amber-600.*검토/);
    // yellow 정합 (bar 내 2개 이상 경고: text-yellow-500 + "2개 이상 필요" 각각 존재)
    expect(src).toMatch(/text-yellow-500/);
    expect(src).toMatch(/2개 이상 필요/);
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
  });

  it("🗑 휴지통 (Trash2) button 제거 (bar 영역, sheet 내 통합)", () => {
    const src = read(SEARCH_PATH);
    // bar 영역 (clearCompare / removeQuoteItem 단독 Trash2 button) 제거
    expect(src).not.toMatch(/aria-label="비교 후보 비우기"/);
    expect(src).not.toMatch(/aria-label="견적 후보 비우기"/);
  });

  it("§11.339 v2 — bar 탭 → QuoteCartPanel forceKey 탭 전환 (sheet 드로어 폐지)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/<QuoteCartPanel/);
    expect(src).toMatch(/forceQuoteKey=/);
    expect(src).toMatch(/forceCompareKey=/);
    expect(src).toMatch(/onRemoveQuoteItem=\{\(id\)\s*=>\s*removeQuoteItem\(id\)\}/);
  });

  it("미리보기 텍스트 — products lookup (compare 첫 항목명)", () => {
    const src = read(SEARCH_PATH);
    // 비교 bar 안 첫 항목명 truncate 표시
    expect(src).toMatch(/truncate max-w-\[140px\]/);
    expect(src).toMatch(/products\.find\(\(p:\s*any\)\s*=>\s*p\.id\s*===\s*compareIds\[0\]\)/);
  });
});

describe("§11.312 — 회귀 0 (보존)", () => {
  it("§11.252f 2-row 분기 보존 (compareIds.length > 0 + quoteItems.length > 0)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/compareIds\.length > 0 && \(/);
    expect(src).toMatch(/quoteItems\.length > 0 && \(/);
  });

  it("§11.268c divider border-white/20 보존", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/border-b border-white\/20/);
  });

  it("requestHandoff 분기 (요청 조립 vs 요청서 만들기) 보존", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/requestHandoff\s*\?/);
    expect(src).toMatch(/견적 요청 조립/);
    expect(src).toMatch(/견적 요청서 만들기/);
  });

  it("totalAmount 표시 보존 (tabular-nums)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/totalAmount\.toLocaleString\("ko-KR"\)/);
    expect(src).toMatch(/tabular-nums/);
  });

  it("전체 해제 우측 링크 보존 (clearCompare + removeQuoteItem 일괄)", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/전체 해제/);
  });

  it("setComparisonModalOpen / setRequestWizardOpen wiring 보존", () => {
    const src = read(SEARCH_PATH);
    expect(src).toMatch(/setComparisonModalOpen\(true\)/);
    expect(src).toMatch(/setRequestWizardOpen\(true\)/);
  });
});

/**
 * §11.312-b #sourcing-bar-clear-all-confirm — Regression sentinel (Phase 1 RED)
 *
 * 호영님 P1 (구 spec §11.306 = §11.312 보강, 번호 매핑 §11.312-b, 2026-05-30):
 *
 *   §11.312 1차 production smoke 후 호영님 잔여 보강:
 *   - 데스크탑 sticky bar "전체 해제" 별도 줄 (line 1565-1575) = bar 본체와 분리
 *   - 회색 텍스트 링크, primary CTA 옆 → 오탭 위험
 *   - 호영님 spec 5번: bar 본체 내 🗑 통합 + AlertDialog 확인 다이얼로그
 *
 *   Phase 0 audit 결과 §11.312-b 실제 잔여 = 데스크탑 보강 only.
 *   다른 spec 이슈(A 개별 삭제 / B "검토 N" dead button / C bar 정보 강화) =
 *   §11.312 1차 sandbox 완료, plan 문서 stale 정정만 필요.
 *
 *   본 sentinel = Phase 1 RED. Phase 2 GREEN target:
 *   - 별도 줄 제거 (line 1565-1575 삭제)
 *   - 견적 bar 본체 안 🗑 Trash2 button 신설 (totalAmount 뒤, primary CTA 앞)
 *   - AlertDialog 확인 다이얼로그 ("견적 후보 N건을 모두 해제할까요?")
 *   - 🗑 outline + primary CTA filled 시각 대비 (gap-3 분리)
 *
 * canonical 보존:
 *   - SourcingCandidatesSheet wiring (A/B/C) 영향 0
 *   - 비교 bar 별도 처리 0 (호영님 spec 5번 견적 bar 만)
 *   - clearCompare + quoteItems forEach removeQuoteItem 동작 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE_PATH = "src/app/_workbench/search/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.312-b — '전체 해제' 별도 줄 제거 (Phase 2 GREEN target)", () => {
  it("옛 별도 줄 div(flex justify-end + border-t white/15) 잔존 0", () => {
    const src = read(PAGE_PATH);
    // 옛 패턴: <div className="px-4 py-1 flex justify-end border-t border-white/15"> + 전체 해제 Button
    expect(src).not.toMatch(/border-t border-white\/15[\s\S]{0,300}전체 해제/);
  });

  it("ghost variant + h-7 px-2 + text-slate-500 hover:text-red-500 패턴 잔존 0", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/variant="ghost"[\s\S]{0,200}text-slate-500 hover:text-red-500[\s\S]{0,100}전체 해제/);
  });
});

describe("§11.312-b — 견적 bar 본체 🗑 button + AlertDialog (Phase 2 GREEN target)", () => {
  it("견적 bar 본체 내 Trash2 button testid", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/data-testid="sourcing-bar-clear-all-trigger"/);
  });

  it("AlertDialog 확인 다이얼로그 — '모두 해제' 또는 '전체 해제' 문구", () => {
    const src = read(PAGE_PATH);
    // AlertDialog 안에 견적 후보 N건 문구
    expect(src).toMatch(/AlertDialogTitle|AlertDialogDescription[\s\S]{0,300}모두 해제|모두 해제할/);
  });

  it("Trash2 + onClick 또는 onAction 으로 clearCompare + quoteItems forEach removeQuoteItem 호출", () => {
    const src = read(PAGE_PATH);
    // 확인 동작 = clearCompare + quoteItems.forEach
    expect(src).toMatch(/clearCompare\(\)[\s\S]{0,200}quoteItems\.forEach[\s\S]{0,100}removeQuoteItem/);
  });
});

describe("§11.312-b — canonical 보존 (§11.312 1차 sandbox 보존)", () => {
  it("SourcingCandidatesSheet wiring 보존 (sheet open + onClose + 3 mode)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/<QuoteCartPanel/); // §11.339 v2: sheet→QuoteCartPanel 탭 일원화
    expect(src).toMatch(/setCompareFocusKey/); // §11.339 v2 탭전환
    expect(src).toMatch(/setQuoteFocusKey/);
    expect(src).toMatch(/setReviewFocusKey/);
  });

  it("미리보기 truncate (§11.312 1차) + 검토 배지 yellow-100 (§11.302) 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/truncate max-w-\[140px\]/);
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
  });

  it("primary CTA (견적 요청서 만들기 / 견적 요청 조립) bg-emerald-600 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/bg-emerald-600 hover:bg-emerald-500[\s\S]{0,300}견적 요청/);
  });
});

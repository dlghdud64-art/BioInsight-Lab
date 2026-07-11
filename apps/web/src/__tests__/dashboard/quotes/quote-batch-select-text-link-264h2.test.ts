/**
 * §11.264h-2 #quote-batch-select-text-link — 전체 선택(8건) 칩 → 텍스트 링크 (호영님 spec 견적 #4-2)
 *
 * 호영님 spec ("필터 칩 잘림" 후속):
 *   "전체 선택(8건)은 칩이 아닌 우측 끝 텍스트 링크로 분리"
 *
 * Root cause: §11.220 전체 선택 CTA 가 mode chip 들과 동일 칩 형태
 *   (`rounded-full border bg-violet-50/50 text-violet-700`) → 사용자가 mode
 *   chip 과 혼동 가능. 호영님 spec "칩이 아닌 텍스트 링크".
 *
 * Fix (minimum diff, Tailwind class swap):
 *   chip 톤 → 텍스트 링크 톤. className 변경:
 *     기존: ml-auto inline-flex items-center gap-1 text-[11px] px-2.5 py-1
 *           rounded-full border font-medium transition-all whitespace-nowrap
 *           text-violet-700 border-violet-300/60 bg-violet-50/50 hover:bg-violet-100
 *     신규: ml-auto inline-flex items-center gap-1 text-[11px] px-1 py-1
 *           font-medium underline-offset-2 hover:underline transition-colors
 *           whitespace-nowrap text-violet-700 hover:text-violet-900
 *           (rounded-full + border + bg 제거 → 시각적 텍스트 링크)
 *
 * canonical truth lock:
 *   - aria-label / onClick (clearSelection / setSelectedQuoteIds) 보존
 *   - selectablePending null guard 보존
 *   - allSelected 분기 라벨 (전체 해제 / 전체 선택 (N건)) 보존
 *   - ml-auto (우측 정렬) 보존
 *   - text-violet-700 톤 보존 (시각 연속성)
 *   - whitespace-nowrap 보존 (§11.264h)
 *   - mode chips row container 보존
 *
 * §quotes-quick-filter-4a P2 — 구 MODE_CHIPS(단일선택 mode chip)가 QUICK_CHIP_META 5칩
 *   다중선택 빠른 필터로 교체됨. 아래 sibling mode-chip whitespace-nowrap cross-invariant을
 *   신 QUICK_CHIP_META.map chip className으로 재앵커(전체 선택 텍스트 링크 본 검증은 불변).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h-2 #1 — 전체 선택 CTA 텍스트 링크 변환", () => {
  it("§11.264h-2 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264h-2/);
  });

  it("CTA className 에서 chip 톤 (rounded-full + border + bg-violet-50/50) 제거", () => {
    // 기존 chip 톤 패턴 제거 — selectablePending block 안에 chip 톤 fragment 없어야 함
    expect(page).not.toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}rounded-full border[\s\S]{0,200}bg-violet-50\/50/,
    );
  });

  it("CTA className 에 텍스트 링크 톤 적용 (underline-offset + hover:underline)", () => {
    // className 은 aria-label 보다 앞에 등장 — selectablePending 호출 후 className 안에 underline 패턴
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}underline-offset-2 hover:underline/,
    );
  });

  it("CTA text-violet-700 톤 보존 (시각 연속성)", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}text-violet-700/,
    );
  });

  it("ml-auto (우측 정렬) 보존", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}className="ml-auto/,
    );
  });
});

describe("§11.264h-2 #2 — invariant 보존 (canonical truth)", () => {
  it("§11.220 전체 선택 CTA section 보존 (selectablePending guard)", () => {
    expect(page).toMatch(
      /const\s+selectablePending\s*=\s*filteredQuotes\.filter\(q => deriveRailState\(q\) === "request_not_sent"\)/,
    );
    expect(page).toMatch(/if \(selectablePending\.length === 0\) return null;/);
  });

  it("allSelected 분기 + onClick handler 보존", () => {
    expect(page).toMatch(
      /const\s+allSelected\s*=\s*selectablePending\.every\(q => selectedQuoteIds\.has\(q\.id\)\)/,
    );
    expect(page).toMatch(/if \(allSelected\) \{\s*clearSelection\(\);/);
    expect(page).toMatch(
      /setSelectedQuoteIds\(new Set\(selectablePending\.map\(q => q\.id\)\)\)/,
    );
  });

  it("aria-label 라벨 보존 (전체 선택 해제 / 발송 대기 견적 전체 선택)", () => {
    expect(page).toMatch(
      /aria-label=\{allSelected \? "전체 선택 해제" : "발송 대기 견적 전체 선택"\}/,
    );
  });

  it("visible 라벨 보존 (전체 해제 / 전체 선택 (N건))", () => {
    expect(page).toMatch(
      /\{allSelected \? "전체 해제" : `전체 선택 \(\$\{selectablePending\.length\}건\)`\}/,
    );
  });

  it("§11.264h whitespace-nowrap 보존", () => {
    // className 이 aria-label 보다 앞에 등장 — selectablePending 호출 후 className 안에 whitespace-nowrap
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}whitespace-nowrap/,
    );
  });

  it("§11.264h 빠른 필터 chip className whitespace-nowrap 보존 (§quotes-quick-filter-4a P2 supersede)", () => {
    // §quotes-quick-filter-4a P2 supersession — 구 MODE_CHIPS.map mode-chip(py-1 포함) →
    //   QUICK_CHIP_META.map 신 chip(min-h-[44px] + whitespace-nowrap, py-1 제거). 텍스트 링크와
    //   시각 구분되는 sibling chip whitespace-nowrap invariant 재앵커.
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,1500}className=\{`inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2\.5 rounded-full border font-medium transition-all whitespace-nowrap/,
    );
  });

  it("§11.264i briefSheetOpen + ✦ 운영 브리핑 보존", () => {
    expect(page).toMatch(
      /const\s+\[briefSheetOpen,\s+setBriefSheetOpen\]\s*=\s*useState/,
    );
    expect(page).toMatch(/aria-label="운영 브리핑 열기"/);
  });

  it("§11.264j 공급사별 회신 현황 보존", () => {
    expect(page).toMatch(/공급사별 회신 현황/);
    expect(page).toMatch(/data-testid="quote-vendor-response-status"/);
  });
});

/**
 * §11.264h #quote-mode-chips-nowrap — 견적 mode chips 줄바꿈 차단 (호영님 spec 견적 모바일 #4)
 *
 * 호영님 spec:
 *   "우선 처리 / 차단 있음 / 오늘 처리 / 전환 가능 / 전체 선택(8건)" 의
 *   각 chip 내부 텍스트가 2줄로 깨짐 ("우선\n처리", "전체 선택\n(8건)").
 *
 * Root cause: chip className 에 `whitespace-nowrap` 부재. flex container
 * 의 가로 너비 부족 시 chip 내부 텍스트 wrap 발생. `flex-nowrap` 은
 * chip 끼리 줄바꿈 차단 (이미 적용) 이지만 chip 내부 텍스트 wrap 은 별도.
 *
 * Fix (§11.263b 패턴 reuse):
 *   (1) mode chip className 에 `whitespace-nowrap` 추가
 *   (2) §11.220 전체 선택 CTA className 에 `whitespace-nowrap` 추가
 *
 * canonical truth lock:
 *   - mode chip onClick (setModeChip) 보존
 *   - 전체 선택 CTA onClick (clearSelection / setSelectedQuoteIds) 보존
 *   - active 시각 (bg-blue-600/10 text-blue-600 border-blue-600/30) 보존
 *   - 전체 선택 CTA 시각 (text-violet-700 border-violet-300/60 bg-violet-50/50) 보존
 *   - aria-label 보존
 *   - mode chips row flex-nowrap + overflow-x-auto 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h #1 — mode chips whitespace-nowrap", () => {
  it("§11.264h trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264h/);
  });

  it("mode chip className 에 whitespace-nowrap 적용 (§11.264h-4 min-h-[44px] supersede)", () => {
    // MODE_CHIPS.map 안의 button className 안에 whitespace-nowrap 존재
    // §11.264h-4 가 text-[11px] 뒤에 min-h-[44px] 추가 → invariant supersede.
    // §11.264h-4 JSDoc 확장으로 distance 800 → 1500 확장 (§11.264h-2/h-3 패턴 reuse).
    expect(page).toMatch(
      /MODE_CHIPS(?:\.filter\([\s\S]*?\))?\.map[\s\S]{0,1500}className=\{`inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2\.5 py-1 rounded-full border font-medium transition-all whitespace-nowrap/,
    );
  });

  it("§11.220 전체 선택 CTA className whitespace-nowrap 보존 (§11.264h-2/h-3 supersede)", () => {
    // §11.264h-2 가 chip 톤 → 텍스트 링크 톤으로 swap. §11.264h-3 가 min-h-[44px] 추가.
    //   기존 (§11.264h): rounded-full border bg-violet-50/50 + whitespace-nowrap
    //   신규 (§11.264h-3): px-2 py-1 min-h-[44px] underline-offset-2 hover:underline + whitespace-nowrap
    expect(page).toMatch(
      /ml-auto inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2 py-1 font-medium underline-offset-2 hover:underline transition-colors whitespace-nowrap/,
    );
  });
});

describe("§11.264h #2 — invariant 보존 (canonical truth)", () => {
  it("MODE_CHIPS.map + setModeChip onClick 보존", () => {
    expect(page).toMatch(/MODE_CHIPS(?:\.filter\([\s\S]*?\))?\.map\(chip => \{/);
    expect(page).toMatch(/setModeChip\(isActive \? null : chip\.key\)/);
  });

  it("mode chip active 시각 (§quote-screen-sian P6.2 §08 tone — 위험 빨강/주의 앰버) 보존", () => {
    expect(page).toMatch(/chip\.tone === "danger" \? "bg-red-50 text-red-700 border-red-300"/);
  });

  it("mode chip 비활성 시각 (§08 옅은 tone + 0건 비활성) 보존", () => {
    expect(page).toMatch(/chip\.tone === "danger" \? "bg-white text-red-600 border-red-200/);
  });

  it("mode chips row flex-nowrap + overflow-x-auto 보존 (§11.259c)", () => {
    expect(page).toMatch(/flex items-center gap-1\.5 flex-nowrap overflow-x-auto/);
  });

  it("§11.220 전체 선택 CTA aria-label 보존", () => {
    expect(page).toMatch(/aria-label=\{allSelected \? "전체 선택 해제" : "발송 대기 견적 전체 선택"\}/);
  });

  it("§11.220 전체 선택 CTA 시각 (text-violet-700 보존, §11.264h-2 supersede)", () => {
    // §11.264h-2: chip 톤 (border-violet-300/60 bg-violet-50/50) 제거 → text-violet-700 + hover:text-violet-900
    expect(page).toMatch(/text-violet-700 hover:text-violet-900/);
  });

  it("modeChip 초기화 버튼 보존", () => {
    expect(page).toMatch(/setModeChip\(null\)[\s\S]{0,200}초기화/);
  });

  it("§11.262a fade overlay 보존 (모바일 fade gradient)", () => {
    expect(page).toMatch(/§11\.262a/);
    expect(page).toMatch(/bg-gradient-to-r from-white to-transparent pointer-events-none sm:hidden/);
  });
});

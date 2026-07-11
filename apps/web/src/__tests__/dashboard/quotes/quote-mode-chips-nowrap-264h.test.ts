/**
 * §11.264h #quote-mode-chips-nowrap — 빠른 필터 칩 줄바꿈 차단 (호영님 spec 견적 모바일 #4)
 *
 * §quotes-quick-filter-4a P2 진화:
 *   구 MODE_CHIPS(우선 처리/차단 있음/오늘 처리/전환 가능) 단일선택 mode chip 시스템이
 *   5칩 다중선택 빠른 필터(QUICK_CHIP_META + quickStatus:Set)로 대체됨. 신 UI 전체 truth =
 *   quick-filter-4a-render.test.ts. 이 sentinel 이 지키던 "칩 내부 텍스트 wrap 차단
 *   (whitespace-nowrap)" 의도는 그대로 살아있음 — 신 상태칩 className 이 whitespace-nowrap
 *   을 유지. MODE_CHIPS.map/setModeChip 앵커는 QUICK_CHIP_META.map/toggleQuickStatus 로
 *   repoint, mode chip danger 톤 assertion 은 신호등 QUICK_CHIP_CLS.danger 로 repoint.
 *
 * canonical truth lock:
 *   - 신 상태칩 onClick (toggleQuickStatus) 보존, 구 setModeChip 부재
 *   - 전체 선택 CTA onClick / aria-label / text-violet-700 보존
 *   - 신호등 danger 톤 (bg-red-50 text-red-700 / bg-white text-red-600) 보존
 *   - 칩 row flex-nowrap + overflow-x-auto 보존
 *   - §11.262a fade overlay 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h #1 — 빠른 필터 칩 whitespace-nowrap", () => {
  it("§11.264h trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264h/);
  });

  it("상태칩 className 에 whitespace-nowrap 적용 (구 MODE_CHIPS chip supersede)", () => {
    // §quotes-quick-filter-4a P2 — MODE_CHIPS.map → QUICK_CHIP_META.map 상태칩.
    //   칩 내부 텍스트 wrap 차단(whitespace-nowrap) 의도 불변.
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,600}inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2\.5 rounded-full border font-medium transition-all whitespace-nowrap/,
    );
  });

  it("§11.220 전체 선택 CTA className whitespace-nowrap 보존 (§11.264h-2/h-3 supersede)", () => {
    // §11.264h-2 가 chip 톤 → 텍스트 링크 톤으로 swap. §11.264h-3 가 min-h-[44px] 추가.
    expect(page).toMatch(
      /ml-auto inline-flex items-center gap-1 text-\[11px\] min-h-\[44px\] px-2 py-1 font-medium underline-offset-2 hover:underline transition-colors whitespace-nowrap/,
    );
  });
});

describe("§11.264h #2 — invariant 보존 (canonical truth)", () => {
  it("상태칩 toggleQuickStatus onClick 보존 + 구 MODE_CHIPS/setModeChip 부재", () => {
    // §quotes-quick-filter-4a P2 — MODE_CHIPS/setModeChip 제거(의도), toggleQuickStatus 로 대체.
    expect(page).toMatch(/onClick=\{\(\) => toggleQuickStatus\(meta\.key\)\}/);
    // MODE_CHIPS.map/setModeChip 라이브 참조 제거 확인(잔여 MODE_CHIPS 문자열은 주석 1건뿐).
    expect(page).not.toMatch(/MODE_CHIPS\.map/);
    expect(page).not.toMatch(/setModeChip/);
  });

  it("상태칩 active 신호등 danger 톤 (위험 빨강) 보존", () => {
    // §quotes-quick-filter-4a P2 — mode chip 톤 → QUICK_CHIP_CLS 신호등으로 흡수.
    expect(page).toMatch(/danger:\s*\{ active: "bg-red-50 text-red-700 border-red-300"/);
  });

  it("상태칩 idle 신호등 danger 톤 (옅은 빨강) 보존", () => {
    expect(page).toMatch(/idle: "bg-white text-red-600 border-red-200/);
  });

  it("칩 row flex-nowrap + overflow-x-auto 보존 (§11.259c)", () => {
    expect(page).toMatch(/flex items-center gap-1\.5 flex-nowrap overflow-x-auto/);
  });

  it("§11.220 전체 선택 CTA aria-label 보존", () => {
    expect(page).toMatch(/aria-label=\{allSelected \? "전체 선택 해제" : "발송 대기 견적 전체 선택"\}/);
  });

  it("§11.220 전체 선택 CTA 시각 (text-violet-700 보존, §11.264h-2 supersede)", () => {
    expect(page).toMatch(/text-violet-700 hover:text-violet-900/);
  });

  it("빠른 필터 초기화 버튼 보존 (구 modeChip 초기화 → resetQuick)", () => {
    expect(page).toMatch(/onClick=\{resetQuick\}[\s\S]{0,200}초기화/);
  });

  it("§11.262a fade overlay 보존 (모바일 fade gradient)", () => {
    expect(page).toMatch(/§11\.262a/);
    expect(page).toMatch(/bg-gradient-to-r from-white to-transparent pointer-events-none sm:hidden/);
  });
});

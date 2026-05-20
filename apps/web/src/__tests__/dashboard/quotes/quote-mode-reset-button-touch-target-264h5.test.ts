/**
 * §11.264h-5 #quote-mode-reset-button-touch-target — modeChip 초기화 button
 *   44x44 touch target (호영님 모바일 spec a11y 일관성, §11.264h family final close)
 *
 * §11.264h-4 가 mode chip 4종 (우선 처리/차단 있음/오늘 처리/전환 가능) 에 min-h-[44px]
 * 적용. 동일 row 안 sibling 인 modeChip 초기화 button (`text-[11px] text-slate-500
 * ml-1` — padding 0, height ~17-20px) 은 여전히 44x44 미달. §11.264h-3 (전체 선택
 * 텍스트 링크 44px) + §11.264h-4 (mode chip 44px) cross-cutting 일관성의 마지막
 * 마침표. Apple HIG / Material / WCAG 2.1 SC 2.5.5 Target Size 표준 정합.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: text-[11px] text-slate-500 hover:text-slate-900 ml-1
 *   신규: inline-flex items-center text-[11px] min-h-[44px] px-2 text-slate-500
 *         hover:text-slate-900 ml-1
 *   - inline-flex items-center = items-center 로 text 가운데 정렬 (44px 안)
 *   - min-h-[44px] = 세로 44px 보장
 *   - px-2 = 가로 padding 8px (touch 영역 가로 확보 — §11.264h-3 패턴 reuse)
 *   - text-[11px] / text-slate-500 / hover:text-slate-900 / ml-1 모두 보존
 *
 * canonical truth lock:
 *   - setModeChip(null) onClick 보존 (modeChip 초기화 동작)
 *   - modeChip 조건부 렌더 ({modeChip && (...)}) 보존
 *   - "초기화" 라벨 보존
 *   - text-slate-500 hover:text-slate-900 톤 보존 (시각 연속성)
 *   - ml-1 좌측 여백 보존 (mode chip 들 뒤 spacing)
 *   - text-[11px] 시각 사이즈 보존
 *   - §11.264h mode chip whitespace-nowrap (이미 §11.264h-4 supersede 됨) 보존
 *   - §11.264h-3 전체 선택 텍스트 링크 min-h-[44px] 보존
 *   - §11.264h-4 mode chip min-h-[44px] 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h-5 #1 — 초기화 button 44x44 touch target", () => {
  it("§11.264h-5 trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264h-5/);
  });

  it("초기화 button className 에 min-h-[44px] 추가", () => {
    // setModeChip(null) onClick 버튼의 className 안에 min-h-[44px] 존재
    expect(page).toMatch(
      /setModeChip\(null\)[\s\S]{0,300}className=\"[^\"]*min-h-\[44px\]/,
    );
  });

  it("초기화 button className 에 inline-flex items-center 추가 (44px 안 가운데 정렬)", () => {
    expect(page).toMatch(
      /setModeChip\(null\)[\s\S]{0,300}className=\"inline-flex items-center/,
    );
  });

  it("초기화 button className 에 px-2 추가 (touch 영역 가로 확보)", () => {
    expect(page).toMatch(
      /setModeChip\(null\)[\s\S]{0,300}className=\"[^\"]*px-2[^\"]*\"/,
    );
  });
});

describe("§11.264h-5 #2 — invariant 보존 (canonical truth)", () => {
  it("setModeChip(null) onClick 보존 (modeChip 초기화 동작)", () => {
    expect(page).toMatch(/onClick=\{\(\) => setModeChip\(null\)\}/);
  });

  it("modeChip 조건부 렌더 보존 ({modeChip && (...))", () => {
    expect(page).toMatch(/\{modeChip && \(/);
  });

  it("초기화 라벨 보존", () => {
    expect(page).toMatch(/setModeChip\(null\)[\s\S]{0,300}초기화/);
  });

  it("text-slate-500 hover:text-slate-900 톤 보존 (시각 연속성)", () => {
    expect(page).toMatch(
      /setModeChip\(null\)[\s\S]{0,300}text-slate-500 hover:text-slate-900/,
    );
  });

  it("ml-1 좌측 여백 보존 (mode chip 들 뒤 spacing)", () => {
    expect(page).toMatch(
      /setModeChip\(null\)[\s\S]{0,300}ml-1/,
    );
  });

  it("text-[11px] 시각 사이즈 보존", () => {
    expect(page).toMatch(
      /setModeChip\(null\)[\s\S]{0,300}text-\[11px\]/,
    );
  });

  it("§11.264h-4 mode chip min-h-[44px] 보존 (sibling consistency)", () => {
    expect(page).toMatch(
      /MODE_CHIPS\.map[\s\S]{0,1500}text-\[11px\] min-h-\[44px\] px-2\.5 py-1 rounded-full/,
    );
  });

  it("§11.264h-3 전체 선택 텍스트 링크 min-h-[44px] 보존 (sibling consistency)", () => {
    expect(page).toMatch(
      /selectablePending\.map\(q => q\.id\)[\s\S]{0,1500}min-h-\[44px\]/,
    );
  });

  it("§11.259c flex-nowrap + overflow-x-auto row container 보존", () => {
    expect(page).toMatch(/flex items-center gap-1\.5 flex-nowrap overflow-x-auto/);
  });
});

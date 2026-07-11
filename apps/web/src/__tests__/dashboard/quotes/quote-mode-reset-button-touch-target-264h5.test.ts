/**
 * §11.264h-5 #quote-mode-reset-button-touch-target — 빠른 필터 "초기화" button
 *   44x44 touch target (호영님 모바일 spec a11y 일관성).
 *
 * §quotes-quick-filter-4a P2 진화:
 *   MODE_CHIPS / setModeChip / {modeChip &&} 단일선택 mode chip 시스템이 5칩 다중선택
 *   빠른 필터(quickStatus:Set / quickMine / quickPeriod)로 대체됨. 신 UI 전체 truth =
 *   quick-filter-4a-render.test.ts. 이 sentinel 이 지키던 "초기화 button 44px touch
 *   target" 의도는 그대로 살아있음 — 초기화 button 이 이제 `{quickActive && (` 안에서
 *   `onClick={resetQuick}` 로 렌더되며 `inline-flex items-center text-[11px]
 *   min-h-[44px] px-2 text-slate-500 hover:text-slate-900 ml-1 shrink-0` 클래스를
 *   그대로 유지. setModeChip(null)/{modeChip &&} 앵커만 resetQuick/{quickActive &&} 로
 *   repoint, 44px/px-2/inline-flex/시각 assertion 은 신 button 을 계속 보호.
 *   sibling consistency 는 구 MODE_CHIPS 대신 신 상태칩(QUICK_CHIP_META.map)의
 *   min-h-[44px] 로 repoint. Apple HIG / Material / WCAG 2.1 SC 2.5.5 정합.
 *
 * canonical truth lock:
 *   - onClick={resetQuick} 보존 (빠른 필터 초기화 동작)
 *   - {quickActive && (...)} 조건부 렌더 보존
 *   - "초기화" 라벨 보존
 *   - text-slate-500 hover:text-slate-900 톤 보존 (시각 연속성)
 *   - ml-1 좌측 여백 보존 / text-[11px] 시각 사이즈 보존
 *   - 신 상태칩 min-h-[44px] 보존 (sibling consistency)
 *   - §11.264h-3 전체 선택 텍스트 링크 min-h-[44px] 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264h-5 #1 — 초기화 button 44x44 touch target", () => {
  it("§quotes-quick-filter-4a trace marker comment 존재 (§11.264h-5 supersede)", () => {
    // §11.264h-5 marker 는 §quotes-quick-filter-4a P2 로 흡수. 신 scope 마커 검증.
    expect(page).toMatch(/§quotes-quick-filter-4a/);
  });

  it("초기화 button className 에 min-h-[44px] 존재", () => {
    // resetQuick onClick 버튼의 className 안에 min-h-[44px] 존재
    expect(page).toMatch(
      /onClick=\{resetQuick\}[\s\S]{0,300}className="[^"]*min-h-\[44px\]/,
    );
  });

  it("초기화 button className 에 inline-flex items-center 존재 (44px 안 가운데 정렬)", () => {
    expect(page).toMatch(
      /onClick=\{resetQuick\} className="inline-flex items-center/,
    );
  });

  it("초기화 button className 에 px-2 존재 (touch 영역 가로 확보)", () => {
    expect(page).toMatch(
      /onClick=\{resetQuick\}[\s\S]{0,300}className="[^"]*px-2[^"]*"/,
    );
  });
});

describe("§11.264h-5 #2 — invariant 보존 (canonical truth)", () => {
  it("onClick={resetQuick} 보존 + 구 setModeChip 부재 (초기화 동작 이관)", () => {
    // §quotes-quick-filter-4a P2 — setModeChip 제거. 초기화는 resetQuick 로 이관.
    expect(page).toMatch(/onClick=\{resetQuick\}/);
    expect(page).not.toMatch(/setModeChip/);
  });

  it("{quickActive && (...)} 조건부 렌더 보존 (구 {modeChip &&} 대체)", () => {
    expect(page).toMatch(/\{quickActive && \(/);
  });

  it("초기화 라벨 보존", () => {
    expect(page).toMatch(/onClick=\{resetQuick\}[\s\S]{0,300}초기화/);
  });

  it("text-slate-500 hover:text-slate-900 톤 보존 (시각 연속성)", () => {
    expect(page).toMatch(
      /onClick=\{resetQuick\}[\s\S]{0,300}text-slate-500 hover:text-slate-900/,
    );
  });

  it("ml-1 좌측 여백 보존 (칩들 뒤 spacing)", () => {
    expect(page).toMatch(
      /onClick=\{resetQuick\}[\s\S]{0,300}ml-1/,
    );
  });

  it("text-[11px] 시각 사이즈 보존", () => {
    expect(page).toMatch(
      /onClick=\{resetQuick\}[\s\S]{0,300}text-\[11px\]/,
    );
  });

  it("신 상태칩 min-h-[44px] 보존 (sibling consistency — 구 MODE_CHIPS 대체)", () => {
    // §quotes-quick-filter-4a P2 — MODE_CHIPS.map 제거 → QUICK_CHIP_META.map 상태칩.
    expect(page).toMatch(
      /QUICK_CHIP_META\.map[\s\S]{0,600}text-\[11px\] min-h-\[44px\] px-2\.5 rounded-full/,
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

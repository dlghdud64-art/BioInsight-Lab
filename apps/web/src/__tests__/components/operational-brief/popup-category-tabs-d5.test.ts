/**
 * #operational-brief-category-tabs-d5
 *
 * 호영님 5 axis redesign 의 Batch 4b (D5).
 *
 * spec: "카테고리 선택 → 견적 관리 → 개별 RFQ 브리핑까지 3단계 드릴다운
 *       구조인데, 뒤로 가기('← 카테고리')가 작아요. 사용자가 다른 카테고리
 *       브리핑도 빠르게 전환하고 싶을 수 있는데, 지금은 뒤로 → 카테고리 선택
 *       → 다시 진입이라서 두 번 클릭이에요. 상단에 카테고리 탭(견적 | 발주 |
 *       입고 | 재고)을 넣으면 한 번에 전환 가능해요."
 *
 * canonical truth lock:
 *   - PopupCategoryListWithExpand 에 4 chip 탭 strip 추가.
 *   - 현재 카테고리 chip = E1 tone 강조 (bg-{tone}-100 text-{tone}-700).
 *   - 다른 카테고리 chip = subtle + click 시 setSelectedCategory 직접 전환
 *     (back + 새 카테고리 진입 = 1 click).
 *   - onSwitchCategory prop 신설 — caller 가 setSelectedCategory + reset.
 *   - back button 보존 (E3 별도 batch).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-category-tabs-d5 — 4 chip 탭 strip", () => {
  it("PopupCategoryListWithExpand 에 onSwitchCategory prop 추가", () => {
    expect(popup).toMatch(/onSwitchCategory/);
  });

  it("4 chip 탭 strip 안 CATEGORIES.map render", () => {
    // popup.tsx 안 CATEGORIES.map 호출이 PopupCategoryGrid 외 1곳 더 — chip strip.
    const matches = popup.match(/CATEGORIES\.map/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("각 chip click 시 onSwitchCategory 호출 (현재 카테고리 외)", () => {
    expect(popup).toMatch(/onSwitchCategory\s*\(\s*cat\.module\s*\)/);
  });

  it("현재 카테고리 chip = E1 tone 강조 (active state)", () => {
    expect(popup).toMatch(/CATEGORY_TONE_ACTIVE_BG/);
    expect(popup).toMatch(/bg-blue-100\s+text-blue-700/);
  });
});

describe("#operational-brief-category-tabs-d5 — caller wiring", () => {
  it("popup root 에서 onSwitchCategory wire — setSelectedCategory + setSelectedItemId(null)", () => {
    expect(popup).toMatch(/onSwitchCategory\s*=\s*\{[\s\S]{0,150}setSelectedCategory/);
  });
});

describe("#operational-brief-category-tabs-d5 — invariant 보존", () => {
  it("PopupCategoryListWithExpand 의 onBack prop 보존 (E3 별도 batch)", () => {
    expect(popup).toMatch(/onBack/);
  });

  it("E1 tone 매핑 보존 (CATEGORY_TONE_BORDER / CATEGORY_TONE_ICON)", () => {
    expect(popup).toMatch(/CATEGORY_TONE_BORDER/);
    expect(popup).toMatch(/CATEGORY_TONE_ICON/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-category-tabs-d5|카테고리 탭|category-tabs/);
  });
});

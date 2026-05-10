/**
 * #operational-brief-category-color-e1 + #operational-brief-urgent-badge-e2
 *
 * 호영님 production 검증 5 axis redesign 의 Batch 4a (E1 + E2).
 *
 * E1 spec: "카테고리 모달 전체가 거의 모노톤 — 견적 / 발주 / 입고 / 재고
 *          전부 같은 시각적 무게라서 구분이 안 됨. 카테고리별 컬러 코드:
 *          견적=블루 / 발주=퍼플 / 입고=그린 / 재고=앰버. 카드 좌측에
 *          컬러 바를 넣으면 컬러만으로 카테고리 인지 가능."
 *
 * E2 spec: "각 카테고리 카드 하단 '현재 2건 / 긴급 2건' 의 긴급 건수가
 *          빨간색이 아님. 빨간 뱃지 → 이 카테고리에 지금 주의가 필요"
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-category-color-e1 — 4 카테고리 컬러 코드", () => {
  it("CATEGORIES 상수에 tone 필드 추가 (blue / purple / emerald / amber)", () => {
    // CATEGORIES 정의 영역 안 4 tone 키워드 매칭.
    expect(popup).toMatch(/tone:\s*["']blue["']/);
    expect(popup).toMatch(/tone:\s*["']purple["']/);
    expect(popup).toMatch(/tone:\s*["']emerald["']/);
    expect(popup).toMatch(/tone:\s*["']amber["']/);
  });

  it("PopupCategoryGrid 카드 className 에 tone-별 border-l-{tone} 매핑 (E1)", () => {
    // 4 tone color 매핑이 카드 className 에 반영.
    expect(popup).toMatch(/border-l-blue-500|border-blue-500/);
    expect(popup).toMatch(/border-l-purple-500|border-purple-500/);
    expect(popup).toMatch(/border-l-emerald-500|border-emerald-500/);
    expect(popup).toMatch(/border-l-amber-500|border-amber-500/);
  });

  it("Icon 색도 tone-별 적용 (text-{tone}-600)", () => {
    expect(popup).toMatch(/text-blue-600/);
    expect(popup).toMatch(/text-purple-600/);
    expect(popup).toMatch(/text-emerald-600/);
    expect(popup).toMatch(/text-amber-600/);
  });
});

describe("#operational-brief-urgent-badge-e2 — 긴급 뱃지 solid red 강조", () => {
  it("긴급 뱃지 solid red — bg-rose-500 + text-white (호영님 'solid 빨간색')", () => {
    // 기존 bg-rose-50 text-rose-700 (subtle) → bg-rose-500 text-white (solid).
    expect(popup).toMatch(/bg-rose-500\s+text-white|bg-rose-500.*text-white/);
  });

  it("기존 subtle 패턴 (bg-rose-50 text-rose-700) 단독 잔존하지 않음", () => {
    // 긴급 뱃지의 옛 className 은 swap. 단 다른 영역 (DETECTED RISKS 등) 의
    // bg-rose-50 사용은 보존 — 본 sentinel 은 긴급 뱃지 영역만 대상.
    // 긴급 뱃지 line 의 패턴 — `긴급 {stat.urgent}` 직전 className.
    expect(popup).not.toMatch(/bg-rose-50\s+text-rose-700\s+text-\[10px\]\s+font-bold[\s\S]{0,40}긴급/);
  });
});

describe("#operational-brief-category-color-e1 + e2 — invariant 보존", () => {
  it("CATEGORIES 4개 (quote/po/receiving/stock_risk) 보존", () => {
    expect(popup).toMatch(/module:\s*["']quote["']/);
    expect(popup).toMatch(/module:\s*["']po["']/);
    expect(popup).toMatch(/module:\s*["']receiving["']/);
    expect(popup).toMatch(/module:\s*["']stock_risk["']/);
  });

  it("PopupCategoryGrid + onSelectCategory handler 보존", () => {
    expect(popup).toMatch(/PopupCategoryGrid/);
    expect(popup).toMatch(/onSelectCategory/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-category-color-e1|#operational-brief-urgent-badge-e2|컬러 코드|카테고리 컬러/);
  });
});

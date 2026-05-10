/**
 * #operational-brief-rail-conversion-g1
 *
 * 호영님 Gemini Studio mockup Option A — popup overlay → desktop sticky right
 * rail 영구 노출 전환.
 *
 * 5 spec:
 *   1. desktop (xl 이상) rail 모드: isOpen 무관 항상 mount
 *      (현재 line 335 `if (!isOpen) return null` guard 가 desktop 에서는 무시).
 *   2. desktop variant: fixed top-16 right-0 → sticky 또는 main sibling
 *      (main content 와 reflow 균형, floating overlay 0).
 *   3. desktop close X 버튼 hide (`xl:hidden`) — rail 영구 노출이라 close 의미 0.
 *   4. desktop minimize 버튼 hide (`xl:hidden`) — rail 모드 minimize 의미 0.
 *   5. floating-entry 버튼 desktop hide (`xl:hidden`) — rail 항상 노출이라 trigger 0.
 *
 * canonical truth lock:
 *   - popup.tsx 의 19 cluster invariant 보존 (Phase A + D1~D5 + E1+E2 + F1)
 *   - mobile (Radix Sheet) + tablet (popup overlay) touch 0
 *   - mobile breakpoint < md, tablet breakpoint md~xl, desktop breakpoint ≥ xl
 *   - popup-context.tsx (isMinimized §11.195) touch 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const FLOATING_PATH = resolve(__dirname, "../../../components/operational-brief/floating-entry.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");
const floating = readFileSync(FLOATING_PATH, "utf8");

describe("#operational-brief-rail-conversion-g1 — desktop rail 영구 노출", () => {
  it("isOpen guard 가 desktop rail 모드에서 무시 — !isOpen && !isDesktopRail 패턴 또는 등가", () => {
    // line 335 의 단독 `if (!isOpen) return null` 는 desktop 에서도 unmount 시켜
    // rail 영구 노출 spec 위반. desktop rail 분기 필요.
    expect(popup).toMatch(/isDesktopRail|desktopRail|isXlDesktop|!isOpen\s*&&\s*!/);
  });

  it("desktop breakpoint detection — 2xl (1536px) breakpoint helper (Path C 상향)", () => {
    // Path C: xl(1280) → 2xl(1536) 상향. useIsRailDesktop hook + matchMedia 1536.
    expect(popup).toMatch(/useIsRailDesktop|matchMedia.*1536|isDesktopRail/);
  });
});

describe("#operational-brief-rail-conversion-g1 — desktop variant sticky / inline", () => {
  it("desktop variant 가 fixed overlay 가 아닌 inline / sticky 분기 보유 (2xl: Path C)", () => {
    // Path C: xl→2xl breakpoint 상향. 2xl:static 분기.
    expect(popup).toMatch(/2xl:sticky|2xl:relative|2xl:static|2xl:flex/);
  });

  it("backdrop desktop hide (`2xl:hidden`) — rail 영구 노출이라 backdrop 0 (Path C)", () => {
    // Path C: xl→2xl 상향. md:block 다음 2xl:hidden.
    expect(popup).toMatch(/md:block 2xl:hidden|hidden md:block 2xl:hidden/);
  });
});

describe("#operational-brief-rail-conversion-g1 — desktop close / minimize hide", () => {
  it("desktop close X 버튼 2xl:hidden — rail 영구 노출이라 close 의미 0 (Path C)", () => {
    expect(popup).toMatch(/2xl:hidden[\s\S]{0,800}브리핑 닫기|브리핑 닫기[\s\S]{0,800}2xl:hidden/);
  });

  it("desktop minimize 버튼 2xl:hidden — rail 모드 minimize 의미 0 (Path C)", () => {
    expect(popup).toMatch(/브리핑 최소화[\s\S]{0,300}2xl:hidden|2xl:hidden[\s\S]{0,300}브리핑 최소화/);
  });
});

describe("#operational-brief-rail-conversion-g1 — floating-entry desktop hide (Path C)", () => {
  it("floating-entry button 에 2xl:hidden 추가 — desktop rail 모드 진입점 중복 차단", () => {
    expect(floating).toMatch(/2xl:hidden/);
  });
});

describe("#operational-brief-rail-conversion-g1 — E4 상단 여백 rail 모드 압축 (Path C)", () => {
  it("PopupCategoryGrid + PopupCategoryListWithExpand header padding 2xl 분기 — pt-6 pb-5 pr-20 → 2xl:pt-4 2xl:pb-3 2xl:pr-6", () => {
    expect(popup).toMatch(/2xl:pt-4[\s\S]{0,40}2xl:pb-3[\s\S]{0,40}2xl:pr-6|2xl:pt-4 2xl:pb-3 2xl:pr-6/);
  });
});

describe("#operational-brief-rail-conversion-g1b — Path C rail width 축소", () => {
  it("rail width 축소 — 2xl:w-[420px] 적용 (mockup spec)", () => {
    expect(popup).toMatch(/2xl:w-\[420px\]/);
  });
});

describe("#operational-brief-rail-conversion-g1 — invariant 보존 (19 cluster)", () => {
  it("F1 LABAXIS AI INSIGHT 다크 + glow 보존", () => {
    expect(popup).toMatch(/bg-slate-900/);
    expect(popup).toMatch(/blur-2xl/);
    expect(popup).toMatch(/pointer-events-none/);
  });

  it("F1 LIVE pill + animate-pulse 보존", () => {
    expect(popup).toMatch(/bg-emerald-500\/20/);
    expect(popup).toMatch(/animate-pulse/);
  });

  it("F1 back button 큰 영역 보존", () => {
    // 양방향 매칭 — className 위 / aria-label 아래 또는 반대.
    expect(popup).toMatch(/aria-label="카테고리 목록으로"[\s\S]{0,400}px-3|px-3[\s\S]{0,400}aria-label="카테고리 목록으로"/);
  });

  it("F1 비활성 카테고리 grayscale 보존", () => {
    expect(popup).toMatch(/opacity-60[\s\S]{0,40}grayscale/);
  });

  it("D5 chip strip + onSwitchCategory 보존", () => {
    expect(popup).toMatch(/onSwitchCategory/);
  });

  it("D4 priority hierarchy border-l-[6px] 보존", () => {
    expect(popup).toMatch(/border-l-\[6px\]/);
  });

  it("D3 derivePriorityReason 보존", () => {
    expect(popup).toMatch(/derivePriorityReason/);
  });

  it("D2 마지막 분석 라벨 보존", () => {
    expect(popup).toMatch(/마지막 분석/);
  });

  it("E1 카테고리 tone 매핑 보존", () => {
    expect(popup).toMatch(/CATEGORY_TONE_BORDER/);
    expect(popup).toMatch(/CATEGORY_TONE_ICON/);
  });

  it("E2 긴급 뱃지 solid red 보존", () => {
    expect(popup).toMatch(/bg-rose-500\s+text-white|bg-rose-500.*text-white/);
  });

  it("Phase A deriveActiveCategoryFromPath 보존", () => {
    expect(popup).toMatch(/deriveActiveCategoryFromPath/);
  });

  it("mobile (Radix Sheet) 분기 보존", () => {
    expect(popup).toMatch(/SheetPrimitive\.Root|SheetPrimitive\.Portal/);
  });

  it("§11.195 minimize state 보존 (popup-context 와 정합)", () => {
    expect(popup).toMatch(/isMinimized/);
    expect(popup).toMatch(/toggleMinimize/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-rail-conversion-g1|rail conversion|rail 영구/);
  });
});

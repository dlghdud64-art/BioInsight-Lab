/**
 * #operational-brief-rail-conversion-g2
 *
 * G1 / g1b / g1c (rail 영구 노출 모드) revert. 호영님 spec 변경:
 * popup overlay 모델 + button toggle + 노출 시 header 영역 (top-0)
 * 까지 full-height + z-[60] (DashboardHeader z-50 위).
 *
 * Behavior:
 *   desktop / tablet / mobile 모두 button (floating-entry) click → isOpen
 *   toggle. isOpen=true 시 viewport top 부터 bottom 까지 full-height popup
 *   노출. mobile = Radix Sheet (변경 0).
 *
 * canonical truth lock:
 *   - 19 cluster invariant 보존 (Phase A + D1~D5 + E1+E2 + F1)
 *   - mobile (`MobileOperationalBriefSheet` + Radix Sheet) touch 0
 *   - popup-context.tsx (isMinimized §11.195) touch 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const FLOATING_PATH = resolve(__dirname, "../../../components/operational-brief/floating-entry.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");
const floating = readFileSync(FLOATING_PATH, "utf8");

describe("#operational-brief-rail-conversion-g2 — G1 rail 영구 모드 revert", () => {
  it("isOpen guard 단순화 — !isOpen 만 (G1 의 !isDesktopRail 분기 제거)", () => {
    expect(popup).toMatch(/if\s*\(\s*!isOpen\s*\)\s*return\s+null/);
  });

  it("useIsRailDesktop hook 제거됨", () => {
    expect(popup).not.toMatch(/function useIsRailDesktop|useIsRailDesktop\(\)/);
  });

  it("isDesktopRail 변수 제거됨", () => {
    expect(popup).not.toMatch(/const\s+isDesktopRail\s*=/);
  });
});

describe("#operational-brief-rail-conversion-g2 — desktop popup full-height + header 영역", () => {
  it("desktop variant top-0 (header 영역까지 노출)", () => {
    // 기존 top-16 → top-0 swap.
    expect(popup).toMatch(/fixed top-0 right-0 z-\[60\]/);
  });

  it("desktop variant h-screen (full viewport height)", () => {
    expect(popup).toMatch(/h-screen/);
  });

  it("desktop variant z-[60] — DashboardHeader z-50 위", () => {
    expect(popup).toMatch(/z-\[60\]/);
  });

  it("기존 width 분기 보존 (md=400 / xl=540 / 2xl=420)", () => {
    expect(popup).toMatch(/md:w-\[400px\]/);
    expect(popup).toMatch(/xl:w-\[540px\]/);
    expect(popup).toMatch(/2xl:w-\[420px\]/);
  });
});

describe("#operational-brief-rail-conversion-g2 — close cluster + backdrop + button 항상 노출", () => {
  it("desktop close X 버튼 2xl:hidden 제거됨 (close 항상 노출)", () => {
    // close cluster outer div 에 2xl:hidden 잔존하지 않음.
    expect(popup).not.toMatch(/right-3 top-2 z-10 flex items-center gap-1 2xl:hidden/);
  });

  it("backdrop 2xl:hidden 제거됨 (backdrop 항상 노출)", () => {
    // hidden md:block 만 잔존 (2xl:hidden 추가 0).
    expect(popup).toMatch(/hidden md:block bg-black/);
    expect(popup).not.toMatch(/hidden md:block 2xl:hidden bg-black/);
  });

  it("floating-entry 2xl:hidden 제거됨 (button 모든 viewport 노출)", () => {
    expect(floating).not.toMatch(/2xl:hidden/);
  });
});

describe("#operational-brief-card-format-h1 — popup 내부 카드 디자인 강화", () => {
  it("list container space-y-3 + 카드별 spacing", () => {
    expect(popup).toMatch(/px-4 py-3 space-y-3/);
  });

  it("PopupItemRow 카드 형식 — rounded-xl + border + bg-white + shadow-sm", () => {
    expect(popup).toMatch(/rounded-xl[\s\S]{0,80}border border-slate-200[\s\S]{0,40}bg-white[\s\S]{0,40}shadow-sm/);
  });

  it("hover shadow 강화 — hover:shadow-md", () => {
    expect(popup).toMatch(/hover:shadow-md/);
  });

  it("기존 divide-y flat list 패턴 잔존하지 않음 (drift 차단)", () => {
    expect(popup).not.toMatch(/divide-y divide-bd\/40[\s\S]{0,60}items\.map/);
  });
});

describe("#operational-brief-rail-conversion-g2 — invariant 보존 (19 cluster)", () => {
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

  it("§11.195 minimize state 보존", () => {
    expect(popup).toMatch(/isMinimized/);
    expect(popup).toMatch(/toggleMinimize/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-rail-conversion-g2|G1[\s\S]{0,30}revert/);
  });
});

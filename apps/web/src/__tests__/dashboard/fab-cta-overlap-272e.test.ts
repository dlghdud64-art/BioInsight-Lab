/**
 * §11.272e #fab-cta-overlap-hide-on-scroll — 호영님 P0 모바일 라이브 4장.
 *
 * 운영 브리핑 FAB(fixed bottom-right)가 스크롤 콘텐츠의 CTA("견적 요청 발송" 등)를
 * 상시 덮어 tap 불가 → dead button 화. 패딩만으론 중간 카드 CTA 미해결.
 *
 * Fix:
 *   1. 아래로 스크롤 시 FAB hide(translate + pointer-events-none → 탭이 CTA 로 통과),
 *      위로/최상단 시 복귀 (useHideOnScrollDown, #main-content scroll).
 *   2. safe-area-inset 반영 bottom 정렬(노치폰 BottomNav 위).
 *   3. shell main 스크롤 콘텐츠 하단 FAB 클리어런스 패딩.
 *
 * 회귀 0: §11.272d body scroll lock hide 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FAB = readFileSync(
  resolve(__dirname, "../../components/operational-brief/floating-entry.tsx"),
  "utf8",
);
const SHELL = readFileSync(
  resolve(__dirname, "../../app/dashboard/_components/dashboard-shell.tsx"),
  "utf8",
);

describe("§11.272e #1 — FAB CTA 가림(dead button) 봉합", () => {
  it("아래로 스크롤 시 FAB hide(pointer-events-none → 탭 통과)", () => {
    expect(FAB).toContain("useHideOnScrollDown");
    expect(FAB).toContain("main-content");
    expect(FAB).toContain("translate-y-24 opacity-0 pointer-events-none");
    expect(FAB).toMatch(/hiddenOnScroll\s*&&/);
  });

  it("FAB safe-area-inset 정렬(노치폰 BottomNav 위)", () => {
    expect(FAB).toContain("bottom-[calc(72px_+_env(safe-area-inset-bottom))]");
  });

  it("shell main 스크롤 콘텐츠 FAB 클리어런스 패딩", () => {
    expect(SHELL).toContain("pb-[calc(8rem_+_env(safe-area-inset-bottom))]");
  });
});

describe("§11.272e #2 — 회귀 0 (기존 hide/wiring 보존)", () => {
  it("§11.272d body scroll lock hide 보존", () => {
    expect(FAB).toContain("useBodyScrollLocked");
    expect(FAB).toContain("if (bodyScrollLocked) return null;");
  });

  it("FAB onClick(popup.open) wiring 보존 — dead button 0", () => {
    expect(FAB).toContain("popup.open()");
    expect(FAB).toContain("aria-label={open ?");
  });
});

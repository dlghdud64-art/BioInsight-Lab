/**
 * #operational-brief-popup-header-cutoff — popup 위쪽 짤림 방지 sentinel
 *
 * Goal: DashboardHeader (sticky top-0 z-50 h-14 md:h-16) 가 popup (z-40) 위로
 *       올라가서 popup 의 위쪽 64px (운영 브리핑 eyebrow + "카테고리 선택" h3)
 *       가 header 뒤로 짤리는 마찰 (호영님 Chrome smoke 2026-05-09) 차단.
 *
 * canonical truth lock:
 *   - desktop popup 은 `top-16` (header 아래) + `h-[calc(100vh-4rem)]` 사용.
 *   - top-0 + h-full 단독 조합은 다시 들어가면 안 됨 (drift 차단).
 *   - mobile sheet 은 `bottom-0` 기반이라 영향 없음 — 본 sentinel 은 desktop 만.
 *   - z-40 보존 (header z-50 아래로 — header navigation 항상 접근 가능 유지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-popup-header-cutoff — desktop popup top offset", () => {
  it("desktop popup 이 top-16 (header 아래) 사용", () => {
    // desktop 분기 (hidden md:flex md:flex-col) 의 className 안 top-16 매칭.
    expect(popup).toMatch(/fixed\s+top-16\s+right-0\s+z-40\s+hidden\s+md:flex/);
  });

  it("#operational-brief-popup-width-expand — xl:540px 분기 (Phase C2)", () => {
    // 호영님 폭 확대 spec: md:400px (기본) + xl:540px (1280px+ 에서 더 넓게).
    expect(popup).toMatch(/md:w-\[400px\]\s+xl:w-\[540px\]/);
  });

  it("desktop popup height 가 calc(100vh-4rem) 보정", () => {
    expect(popup).toMatch(/h-\[calc\(100vh-4rem\)\]/);
  });
});

describe("#operational-brief-popup-header-cutoff — drift sentinel", () => {
  it("desktop popup 이 top-0 + h-full 단독 조합으로 회귀하지 않음", () => {
    // 옛 패턴: `fixed top-0 right-0 z-40 hidden md:flex md:flex-col\n h-full`
    // 새 패턴: top-16 + h-[calc(100vh-4rem)].
    expect(popup).not.toMatch(/fixed\s+top-0\s+right-0\s+z-40\s+hidden\s+md:flex[\s\S]{0,80}h-full\s+md:w-\[400px\]/);
  });
});

describe("#operational-brief-popup-header-cutoff — header invariant 보존", () => {
  it("popup z-40 보존 (header z-50 아래 — navigation 항상 접근)", () => {
    expect(popup).toMatch(/fixed\s+top-16\s+right-0\s+z-40/);
  });

  it("mobile sheet 의 bottom-0 path 보존 (영향 없음 검증)", () => {
    expect(popup).toMatch(/inset-x-0\s+bottom-0\s+h-\[85vh\]/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-popup-header-cutoff|header 뒤로|짤림/);
  });
});

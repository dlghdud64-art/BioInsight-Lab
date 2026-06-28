/**
 * #operational-brief-popup-header-cutoff — popup 위쪽 짤림 방지 sentinel
 *
 * #operational-brief-rail-conversion-g2 spec 변경: 호영님 "상단 개인계정
 * 부분까지 꽉 채워" 정합 — desktop popup 이 top-0 + h-screen + z-[60]
 * (header z-50 위) 으로 viewport top 부터 full-height 노출. 기존 짤림 spec
 * (top-16 + h-[calc(100vh-4rem)] + z-40) 는 invalid.
 *
 * canonical truth lock (G2 정합):
 *   - desktop popup `top-0` + `h-screen` + `z-[60]` (header 위 overlay).
 *   - mobile sheet 은 `bottom-0` 기반이라 영향 없음 — 본 sentinel 은 desktop 만.
 *   - width 분기 보존 (md=400 / xl=460 / 2xl=432).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-popup-header-cutoff — G2 desktop popup full-height", () => {
  it("desktop popup 이 top-0 + z-[60] (header 위 overlay)", () => {
    expect(popup).toMatch(/fixed\s+top-0\s+right-0\s+z-\[60\]\s+hidden\s+md:flex/);
  });

  it("desktop popup width 분기 보존 (md=400 / xl=460 / 2xl=432)", () => {
    expect(popup).toMatch(/md:w-\[400px\]\s+xl:w-\[460px\]\s+2xl:w-\[432px\]/);
  });

  it("desktop popup height h-screen (full viewport)", () => {
    expect(popup).toMatch(/h-screen/);
  });
});

describe("#operational-brief-popup-header-cutoff — header invariant 보존", () => {
  it("popup z-[60] (header z-50 위 overlay)", () => {
    expect(popup).toMatch(/z-\[60\]/);
  });

  it("mobile sheet 의 bottom-0 path 보존 (영향 없음 검증)", () => {
    expect(popup).toMatch(/inset-x-0\s+bottom-0\s+h-\[85vh\]/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/role="complementary"|운영 브리핑/);
  });
});

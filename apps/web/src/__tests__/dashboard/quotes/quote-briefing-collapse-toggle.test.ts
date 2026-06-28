/**
 * §11.248e-2 #quote-briefing-collapse-toggle — [SUPERSEDED by §quote-briefing-rail-overlay]
 *
 * 원래 §11.248e-2 (호영님 P0 §11.248 #5): 1200px+ Briefing 패널 접힘/펼침 토글 +
 *   우측 edge floating button(writing-mode-vertical "BRIEFING") + localStorage 영구화.
 *
 * ⚠️ 폐기됨 — §quote-briefing-rail-overlay (호영님 directed 2026-06-29, 업로드
 *   "견적관리 브리핑 레일 수정 핸드오프"): 레일을 ≥1200 항상 overlay(테이블 풀폭)로
 *   전환 → "접어서 폭 회복" 목적 소멸. 접기 메커니즘(isBriefingCollapsed state · LS ·
 *   서버영속 wiring · 세로 edge tab · collapse button) 전면 retire. 진입 = 행 선택 /
 *   닫기 = X(헤더, 기존 3772) · Esc(기존 1496). canonical = 레일 항상 overlay.
 *
 * 본 sentinel 정리:
 *   - 접기 state/LS/edge-tab/collapse-button 단언 RETIRE — 폐기되어 더 이상 유효 X.
 *   - 생존 invariant 유지: 레일 ≥1200 노출(w-480) + mobile sheet + 운영 브리핑 + gating
 *     + closeQuoteContextRail.
 *   - 신 invariant: 세로 edge tab(writing-mode/floating expand) 0 · isBriefingCollapsed 0 ·
 *     레일 항상 overlay(min-[1200px]:fixed 노출, min-[1440px]:sticky push 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quote-briefing-rail-overlay — 접기 메커니즘 폐기(RETIRED)", () => {
  it("isBriefingCollapsed state 0", () => {
    expect(page).not.toMatch(/isBriefingCollapsed/);
    expect(page).not.toMatch(/setIsBriefingCollapsed/);
  });

  it("BRIEFING_COLLAPSED localStorage key 0", () => {
    expect(page).not.toMatch(/BRIEFING_COLLAPSED_LS_KEY/);
    expect(page).not.toMatch(/labaxis-briefing-collapsed/);
  });

  it("세로 edge tab (writing-mode-vertical / floating expand) 0", () => {
    expect(page).not.toMatch(/writing-mode-vertical/);
    expect(page).not.toMatch(/writingMode/);
    expect(page).not.toMatch(/briefing-floating-expand/);
  });

  it("collapse button (briefing-collapse-button) 0", () => {
    expect(page).not.toMatch(/briefing-collapse-button/);
  });
});

describe("§quote-briefing-rail-overlay — 레일 항상 overlay", () => {
  it("레일 ≥1200 overlay: min-[1200px]:fixed 노출", () => {
    expect(page).toMatch(/min-\[1200px\]:fixed/);
  });

  it("1440 push 폐기 — min-[1440px]:sticky / self-start / ml-5 0", () => {
    expect(page).not.toMatch(/min-\[1440px\]:sticky/);
    expect(page).not.toMatch(/min-\[1440px\]:self-start/);
    expect(page).not.toMatch(/min-\[1440px\]:ml-5/);
  });
});

describe("§quote-briefing-rail-overlay — 생존 invariant 보존", () => {
  it("레일 ≥1200 노출 + 480px (hidden min-[1200px]:flex … w-[480px])", () => {
    expect(page).toMatch(/hidden\s+min-\[1200px\]:flex[\s\S]{0,200}w-\[480px\]/);
  });

  it("mobile bottom-sheet min-[1200px]:hidden fixed inset-0 보존", () => {
    expect(page).toMatch(/min-\[1200px\]:hidden\s+fixed\s+inset-0/);
  });

  it("운영 브리핑 헤더 보존", () => {
    expect(page).toMatch(/운영 브리핑/);
  });

  it("selectedQuote && selectedSignals && selectedOpStatus gating 보존", () => {
    expect(page).toMatch(/selectedQuote && selectedSignals && selectedOpStatus/);
  });

  it("closeQuoteContextRail mutation 보존 (X·Esc 닫기 경로)", () => {
    expect(page).toMatch(/closeQuoteContextRail/);
  });
});

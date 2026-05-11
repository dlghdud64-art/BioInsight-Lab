/**
 * #quote-card-batch1-density — 호영님 견적 카드 UI 고도화 Batch I
 *
 * P0 spec 2 항목:
 *
 * #1. 긴급도 뱃지 (delayed 시 solid red "긴급")
 *   - 호영님 spec: "🔴 긴급" — #9 정합 (이모지 → 컬러 도트 + 텍스트)
 *   - E2 패턴 mirror (`bg-rose-500 text-white`)
 *   - 위치: signals 영역 (운영 신호 3종 line) 안 quoteRef 직전
 *
 * #2. Progress bar 활성 단계 강조
 *   - 호영님 spec: "활성 단계 라벨만 14px bold"
 *   - 기존: 모든 라벨 text-[8/9px] (작음)
 *   - 신규: current 분기 시 text-sm font-bold (14px)
 *   - 완료 단계는 Check icon 추가
 *
 * canonical truth lock:
 *   - quote.status / responses / readinessStage 변경 0
 *   - card 외부 wrapping styling (border-l-[3px] + selected hover) 보존
 *   - §11.217 / §11.218 cluster invariant 보존 (firstItemName + user/org line)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-card-batch1-density — 긴급도 뱃지 (delayed 시 solid red)", () => {
  it("delayed 분기 시 solid red 긴급 뱃지 (E2 패턴 — bg-rose-500 + text-white)", () => {
    // signals 영역 안 delayed && (`긴급` 텍스트 포함된 bg-rose-500 span) 매칭.
    expect(page).toMatch(/delayed\s*&&[\s\S]{0,300}bg-rose-500[\s\S]{0,80}text-white[\s\S]{0,80}긴급/);
  });

  it("긴급 뱃지가 font-bold + text-[10px] 또는 text-xs 강조", () => {
    expect(page).toMatch(/bg-rose-500\s+text-white[\s\S]{0,80}font-bold|font-bold[\s\S]{0,80}bg-rose-500\s+text-white/);
  });
});

describe("#quote-card-batch1-density — Progress bar 활성 단계 14px bold", () => {
  it("readiness strip 의 current 분기 text-sm font-bold 강화", () => {
    // current ? "text-blue-... font-bold text-sm" 패턴 매칭.
    expect(page).toMatch(/current\s*\?\s*["`'][\s\S]{0,80}text-sm\s+font-bold|current\s*\?\s*["`'][\s\S]{0,80}font-bold[\s\S]{0,40}text-sm/);
  });

  it("readiness strip 의 미도달 (!active) 분기 text-slate-300 보존", () => {
    expect(page).toMatch(/text-slate-300/);
  });
});

describe("#quote-card-batch1-density — invariant 보존", () => {
  it("§11.217 firstItemName + 외 N건 패턴 보존", () => {
    expect(page).toMatch(/외 \$\{moreCount\}건|displayTitle/);
  });

  it("§11.218 카드 구분자 (요청자 + 부서/조직) 보존", () => {
    expect(page).toMatch(/quote\.user\?\.name/);
    expect(page).toMatch(/quote\.organization\?\.name/);
  });

  it("선택된 카드 styling (border-blue-600 + ring + bg-blue-600/5) 보존", () => {
    expect(page).toMatch(/border-blue-600\/40[\s\S]{0,80}ring-1[\s\S]{0,80}bg-blue-600\/5/);
  });

  it("readiness strip READINESS_LABELS map 보존", () => {
    expect(page).toMatch(/READINESS_LABELS\.map/);
  });

  it("cluster trace marker", () => {
    expect(page).toMatch(/#quote-card-batch1-density|긴급도 뱃지|활성 단계 강조/);
  });
});

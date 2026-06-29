/**
 * §quotes-mobile-density P2 — 퍼널 카드 → 얇은 세그먼트 칩(밀도)
 *   (PLAN: docs/plans/PLAN_quotes-mobile-density.md Phase 2)
 *
 * 문제: 퍼널이 세로스택(아이콘 box w7h7 + text-lg count + 라벨)으로 퍼스트뷰 ~80px 점유.
 * P2: per-stage render를 인라인 라벨+카운트(~36px)로 압축. 카드 단독 점유 → 얇은 1줄.
 * ★ canonical 보존: deriveStage/counts/focus/allZero/disabled/onStageClick(§quote-management P2)
 *   + 래퍼 flex items-stretch gap-2(§quotes-mobile-redesign) 전부 무손 — render 밀도만 변경.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..", "..");
const FUNNEL = readFileSync(join(ROOT, "src/components/quotes/quote-funnel.tsx"), "utf8");

describe("§quotes-mobile-density P2 — 얇은 인라인 칩", () => {
  it("아이콘 box(w-7 h-7) + text-lg 세로스택 폐지", () => {
    expect(FUNNEL).not.toMatch(/w-7 h-7 rounded-lg/);
    expect(FUNNEL).not.toMatch(/text-lg font-extrabold/);
    // 인라인: items-center + 카운트 text-sm
    expect(FUNNEL).toMatch(/flex items-center justify-center gap-1\.5 rounded-lg px-2 py-1\.5/);
    expect(FUNNEL).toMatch(/text-sm font-extrabold tabular-nums/);
  });
  // §quote-funnel-sian-restore (호영님 2026-06-29) — 반응형 복원: 데스크탑 리치(아이콘+현재집중 배지+chevron),
  //   모바일은 P2 압축 칩 유지(밀도). 아이콘은 데스크탑(md+)에서만 렌더.
  it("반응형 — 데스크탑 리치(아이콘/chevron 복원) + 모바일 압축(칩)", () => {
    expect(FUNNEL).toMatch(/hidden md:flex/); // 데스크탑 리치 분기
    expect(FUNNEL).toMatch(/flex md:hidden/); // 모바일 압축 분기
    expect(FUNNEL).toMatch(/<Icon className=/); // 데스크탑 아이콘 복원
    expect(FUNNEL).toMatch(/ChevronRight/); // 단계 사이 chevron
    expect(FUNNEL).toMatch(/icon: Send/); // STAGES 소스 보존
  });
});

describe("§quotes-mobile-density P2 — canonical 보존(회귀 0)", () => {
  it("§quote-management P2 로직 무손(deriveStage/counts/현재집중/disabled/onStageClick)", () => {
    expect(FUNNEL).toMatch(/deriveStage/);
    expect(FUNNEL).toMatch(/counts\[s\] \+= 1/);
    expect(FUNNEL).toMatch(/현재 집중/);
    expect(FUNNEL).toMatch(/disabled=\{n === 0\}/);
    expect(FUNNEL).toMatch(/n > 0 && onStageClick/);
    expect(FUNNEL).toMatch(/opacity-50/);
  });
  it("§quotes-mobile-redesign 래퍼/게이트/collapse 보존", () => {
    expect(FUNNEL).toMatch(/items-stretch gap-2/); // §sian-restore — 모바일 압축 래퍼(md:hidden) 보존
    expect(FUNNEL).toMatch(/진행 중 견적 없음/);
    expect(FUNNEL).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(FUNNEL).toMatch(/s\.key !== "s5"/);
    expect(FUNNEL).toMatch(/label: "발주 전환"/);
  });
  it("§11.302 색 정합 보존(yellow=회신추적, amber/orange 0)", () => {
    expect(FUNNEL).toMatch(/text-yellow-600/);
    expect(FUNNEL).not.toMatch(/-amber-|-orange-/);
  });
});

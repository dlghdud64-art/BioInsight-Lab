/**
 * §quote-management-redesign P4 — 우선 추천 카드 navy 토큰 정합 + 퍼널 5단계 현행 가드 (호영님 시안)
 *   (PLAN: docs/plans/PLAN_quote-management-redesign.md Phase 4)
 *
 * 카드: 대시보드 NextStepBanner navy 토큰 재사용(linear-gradient #1b2b50→#243a72→#2f6be0 + 광택).
 *   §11.302 amber/orange 0. canonical(computePriority 룰베이스)·"우선 추천"(AI 격상 0)·真 level 보존.
 * 퍼널: 호영님 결정 "현행 유지(발주 전환·발주 off 시 s5 hide)" — 5단계 라벨/0건 흐림/게이트 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CARD = readFileSync(
  resolve(__dirname, "../../../components/quotes/priority-recommendation-card.tsx"),
  "utf8",
);
const FUNNEL = readFileSync(
  resolve(__dirname, "../../../components/quotes/quote-funnel.tsx"),
  "utf8",
);

describe("§quote-management-redesign P4 — 우선 추천 카드 navy 토큰(시안 정합)", () => {
  it("대시보드 NextStepBanner navy 토큰 재사용(3-stop linear-gradient + 광택 boxShadow)", () => {
    expect(CARD).toMatch(/linear-gradient\(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%\)/);
    expect(CARD).toMatch(/boxShadow: "0 6px 18px -8px rgba\(20,38,80,\.55\)"/);
    expect(CARD).toMatch(/text-\[#a9c2f5\]/);
  });
  it("§11.302 amber/orange 0(카드 — Tailwind 클래스)", () => {
    expect(CARD).not.toMatch(/-amber-|-orange-/);
  });
});

describe("§quote-management-redesign P4 — 카드 canonical 보존(AI 격상 0)", () => {
  it("computePriority 룰베이스 + '우선 추천' 라벨(AI 라벨/Sparkles 금지)", () => {
    expect(CARD).toMatch(/computePriority/);
    expect(CARD).toMatch(/우선 추천/);
    // 'Sparkles 금지' 설명 주석(/* … */·//)의 Sparkles 언급은 live 아님 → 주석 제거 후 검사(금지 보호의도=실 import/JSX 부재 불변).
    const code = CARD.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/Sparkles/);
  });
  it("真 level 표시(높음/보통/낮음 — 가짜 격상 0)", () => {
    expect(CARD).toMatch(/high: "높음"/);
    expect(CARD).toMatch(/mid: "보통"/);
    expect(CARD).toMatch(/low: "낮음"/);
  });
});

describe("§quote-management-redesign P4 — 퍼널 5단계 현행 가드(호영님 결정)", () => {
  it("5단계 라벨 보존(발송 대기/회신 추적/비교 검토/승인·예외/발주 전환)", () => {
    expect(FUNNEL).toMatch(/label: "발송 대기"/);
    expect(FUNNEL).toMatch(/label: "회신 추적"/);
    expect(FUNNEL).toMatch(/label: "비교 검토"/);
    expect(FUNNEL).toMatch(/label: "승인\/예외"/);
    expect(FUNNEL).toMatch(/label: "발주 전환"/);
  });
  it("발주 off 시 s5 hide 게이트 + 0건 흐림 보존", () => {
    expect(FUNNEL).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
    expect(FUNNEL).toMatch(/s\.key !== "s5"/);
    expect(FUNNEL).toMatch(/opacity-50/);
  });
  it("§11.302 amber/orange 0(퍼널 — Tailwind 클래스)", () => {
    expect(FUNNEL).not.toMatch(/-amber-|-orange-/);
  });
});

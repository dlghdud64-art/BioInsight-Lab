/**
 * §11.308b #dashboard-eyebrow-live-removed — Regression sentinel
 *
 * 호영님 P2 spec (Q11 = A, 2026-05-26):
 *   대시보드 헤더의 영문 eyebrow + Live 배지 완전 제거.
 *   - "Operational Intelligence Dashboard" 영문 eyebrow → 사용자 무의미
 *   - "Live" 배지 (animate-ping pulse) → 대시보드는 원래 실시간, 별도 표기 불필요
 *   → 헤더 단순화: 한국어 "대시보드" title + greeting 만.
 *
 * 회귀 보호:
 *   - §11.308a-v2 ScanLine 헤더 진입점 보존
 *   - §11.243 AIInsightDialog + isOnboardingMode 분기 보존
 *   - §11.243 OnboardingHero (isOnboardingMode + !onboardingDismissed) 보존
 *   - greeting (session.user.name) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.308b — 영문 eyebrow + Live 배지 완전 제거", () => {
  it("'Operational Intelligence Dashboard' 영문 텍스트 0 (주석 제외 render)", () => {
    // 주석(제거 사유 설명)은 제외하고 실제 render 에서 영문 eyebrow 0 검증.
    const src = read(PATH).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/Operational Intelligence Dashboard/);
  });

  it("eyebrow <p> 컨테이너 (tracking-[0.12em] uppercase) 제거", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/tracking-\[0\.12em\]\s+uppercase\s+text-slate-500/);
  });

  it("'Live' 배지 textContent 0 (헤더 영역 한정)", () => {
    const src = read(PATH);
    // bg-emerald-50 text-emerald-700 + Live 패턴 (Live 배지 자체 제거)
    expect(src).not.toMatch(/bg-emerald-50 text-emerald-700 text-\[10px\] font-bold border border-emerald-200\/60[\s\S]{0,300}Live/);
  });

  it("animate-ping pulse span 제거 (Live 배지 안 ping 효과)", () => {
    const src = read(PATH);
    // "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
    // 패턴이 헤더에서 0 (다른 곳 in src/components 등은 무관)
    expect(src).not.toMatch(/animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75/);
  });
});

describe("§11.308b — 헤더 한국어 title 보존 (§11.374 P3.4 AppPageHeader 이전)", () => {
  it("'대시보드' title 보존 — AppPageHeader 단일 문법", () => {
    const src = read(PATH);
    expect(src).toMatch(/<AppPageHeader/);
    expect(src).toMatch(/title="대시보드"/);
  });

  // 인라인 h2 폰트 클래스 + greeting("○○님") assertion 은 §11.374 P3.4(AppPageHeader
  //   헤더 단일화) + §dashboard-home-redesign P2(헤더 인사 제거)로 은퇴. title 은 위에서 보존.
});

describe("§11.308b — 회귀 0 (§11.308a-v2 + §11.243 보존)", () => {
  it("§11.243 isOnboardingMode 모드 파생 보존", () => {
    const src = read(PATH);
    // OnboardingHero 렌더 게이팅은 진화, isOnboardingMode 파생(데이터 유무)은 canonical 보존.
    expect(src).toMatch(/const isOnboardingMode = !hasAnyOperationalData/);
  });

  it("§11.243 AIInsightDialog 보존 (§P2 disabled={false} + !isOnboardingMode 게이트)", () => {
    const src = read(PATH);
    expect(src).toMatch(/!isOnboardingMode && <AIInsightDialog disabled=\{false\}/);
  });

  it("§11.308a-v2 SmartReceivingScannerModal 임포트 0 (헤더로 승격, 본문 제거)", () => {
    const src = read(PATH);
    // 본 page 에는 SmartReceivingScannerModal 없음 (헤더 승격), 단 Header.tsx 에는 있음.
    expect(src).not.toMatch(/SmartReceivingScannerModal/);
  });

  it("PlanOnboardingBanner 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/<PlanOnboardingBanner\s*\/>/);
  });
});

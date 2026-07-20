/**
 * §dashboard-mobile-refine P4 #dismiss-per-insight — 배너 dismiss 단건화
 *
 * 정본: docs/plans/PLAN_dashboard-mobile-refine.md Phase 4 + 호영님 F7 판정(2026-07-20).
 *
 * F7 = (c) 절충 채택:
 *   - ❌ 온보딩 `1/3` 진행 점 · 단계 텍스트 **미구현** — §dashboard-shifan-adopt P2 (C) 의
 *        "시작하기 3단계 hero 폐지" 결정을 존중. deriveInsight 의 "가장 시급한 신호 하나만" 원칙 유지.
 *   - ✅ `✕` dismiss **단건화만** 구현.
 *
 * 고치는 결함: 현행 `lab_insight_dismissed="1"` 은 **영구 전역 dismiss** 라, 사용자가 ✕ 를 한 번
 *   누르면 이후 발생하는 **모든 운영 신호**(재고 부족·예산 초과·발송 대기)가 영구히 가려진다.
 *   → insight 별 id 로 dismiss 를 기록하고, dismiss 된 후보는 건너뛰어 **다음 추천을 노출**한다.
 *   전 후보가 dismiss 된 경우에만 배너를 숨긴다.
 *
 * 저장소 migration: 신규 키 `lab_insight_dismissed_v2`(JSON 배열). 레거시 `"1"`(전역 차단)은
 *   승계하지 않는다 — 그 시맨틱 자체가 이번에 제거하는 결함이기 때문. 기존 사용자에게 배너가
 *   1회 재노출되며, 이는 의도된 동작이다.
 *
 * ⚠️ Phase 4 RED sentinel — 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const BANNER = read("src/components/dashboard/next-step-banner.tsx");

describe("§dashboard-mobile-refine P4 — dismiss 단건화", () => {
  it("insight 마다 안정적 id 보유", () => {
    expect(BANNER).toMatch(/id:\s*"budget-unset"/);
    expect(BANNER).toMatch(/id:\s*"stock-short"/);
    expect(BANNER).toMatch(/id:\s*"quote-open"/);
  });

  it("후보 목록 방식 — 우선순위 순 배열 생성", () => {
    expect(BANNER).toMatch(/deriveInsightCandidates/);
  });

  it("dismiss 된 후보는 건너뛰고 다음 추천 노출", () => {
    expect(BANNER).toMatch(/dismissed/);
    expect(BANNER).toMatch(/\.find\(/);
  });

  it("신규 저장 키(JSON 배열) — 영구 전역 차단 폐지", () => {
    expect(BANNER).toMatch(/lab_insight_dismissed_v2/);
    expect(BANNER).toMatch(/JSON\.parse/);
    expect(BANNER).toMatch(/JSON\.stringify/);
  });

  it("레거시 전역 차단 시맨틱 제거 (setItem 에 '1' 고정 저장 0)", () => {
    expect(BANNER).not.toMatch(/setItem\("lab_insight_dismissed",\s*"1"\)/);
  });

  it("전 후보 dismiss 시에만 배너 숨김", () => {
    expect(BANNER).toMatch(/return null/);
  });
});

describe("§dashboard-mobile-refine P4 — F7(c) 범위 준수: 온보딩 3단계 미도입", () => {
  it("진행 점 / 단계 카운터 미구현 (hero 폐지 결정 존중)", () => {
    expect(BANNER).not.toMatch(/1\s*\/\s*3/);
    expect(BANNER).not.toMatch(/onboardingSteps/);
    expect(BANNER).not.toMatch(/예산 등록 →/);
  });

  it("ontology 를 chatbot/assistant 로 재해석 0", () => {
    expect(BANNER).not.toMatch(/chatbot|assistant|terminal|commandPalette/i);
  });
});

describe("§dashboard-mobile-refine P4 — 회귀 0 (P2 + shifan-adopt 핀 전수)", () => {
  it("navy 토큰 + thin 컨테이너 + 인라인 아이콘 보존", () => {
    expect(BANNER).toMatch(/linear-gradient\(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%\)/);
    expect(BANNER).toMatch(/boxShadow: "0 6px 18px -8px rgba\(20,38,80,\.55\)"/);
    expect(BANNER).toMatch(/flex items-center gap-2\.5/);
    expect(BANNER).toMatch(/<Icon className="relative z-10 h-4 w-4 flex-none/);
    expect(BANNER).not.toMatch(/flex flex-col gap-0\.5/);
    expect(BANNER).not.toMatch(/h-10 w-10 flex-shrink-0 items-center justify-center/);
  });

  it("P2 뷰포트 분기 보존 (모바일 2줄 / sm↑ thin)", () => {
    expect(BANNER).toMatch(/line-clamp-2/);
    expect(BANNER).toMatch(/sm:line-clamp-none/);
    expect(BANNER).toMatch(/sm:truncate/);
    expect(BANNER).not.toMatch(/leading-snug truncate"/);
  });

  it("deriveInsight 우선순위 문구 + CTA wired + 44px 보존", () => {
    expect(BANNER).toMatch(/다음 단계 추천/);
    expect(BANNER).toMatch(/budget\.isSet/);
    expect(BANNER).toMatch(/예산 설정/);
    expect(BANNER).toMatch(/재고 점검/);
    expect(BANNER).toMatch(/발송 대기 견적/);
    expect(BANNER).toMatch(/href=\{ins\.cta\.href\}/);
    expect(BANNER).toMatch(/min-h-\[44px\]/);
  });

  it("localStorage 차단 환경 graceful + allEmpty self-gate 폐지 유지", () => {
    expect(BANNER).toMatch(/localStorage/);
    expect(BANNER).not.toMatch(/derived\.allEmpty/);
  });

  it("가짜 차트/목업 0", () => {
    expect(BANNER).not.toMatch(/MOCKUP|mockup|recharts|AreaChart/);
  });
});

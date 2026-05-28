/**
 * §11.247 #operator-quick-actions-responsive — 호영님 P0 운영 바로가기 반응형 개선
 *
 * 호영님 spec (3 요구사항):
 *   (1) Progressive Disclosure — 견적 발송 카드 기본 접힘 / 클릭 시 펼침
 *       - 접힌 상태: 카드 제목 + 설명 + 대기 건수 배지 (다른 3 카드와 동일 높이)
 *       - 펼친 상태: 상태 흐름표 + Send to supplier 버튼 영역 확장
 *       - 트랜지션 200~300ms ease
 *   (2) 반응형 그리드 중간 단계 — repeat(auto-fit, minmax(280px, 1fr))
 *       - ≥1200px : 4열 / 800~1199px : 2×2 / <800px : 1열 (자동 분기)
 *   (3) 카드 높이 균일화 — 동일 min-height (모든 카드)
 *
 * canonical truth lock:
 *   - count 자체 mutation 0 (display only)
 *   - 4 ACTIONS 배열 + TONE_MAP + quoteDispatchReadiness props 보존
 *   - §11.243 #5 (build 뱃지) 보존
 *   - dashboard page.tsx caller forward 영향 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_PATH = resolve(
  __dirname,
  "../../../components/dashboard/operator-quick-actions.tsx",
);
const component = readFileSync(COMPONENT_PATH, "utf8");

describe("§11.247 #1 — Progressive Disclosure (견적 발송 카드 isExpanded state)", () => {
  it("useState import (React hooks)", () => {
    expect(component).toMatch(/import\s*\{[\s\S]{0,200}useState[\s\S]{0,200}\}\s*from\s*["']react["']/);
  });

  it("isQuoteDispatchExpanded useState (default false)", () => {
    expect(component).toMatch(/(isQuoteDispatchExpanded|isExpanded)[\s\S]{0,80}useState[\s\S]{0,80}(false|<boolean>\(false\))/);
  });

  it("toggle handler (onClick 또는 onKeyDown)", () => {
    // setIsQuoteDispatchExpanded 또는 setIsExpanded 호출 — toggle 패턴
    expect(component).toMatch(/(setIsQuoteDispatchExpanded|setIsExpanded)\(\s*\(?\s*(prev|!)/);
  });

  it("접힌 상태 분기 — 펼침 false 시 minimal layout", () => {
    // isQuoteDispatchExpanded ? <펼친 layout> : <접힌 layout>
    // 또는 {!isExpanded && <minimal>} / {isExpanded && <full>}
    expect(component).toMatch(/(!isQuoteDispatchExpanded|!isExpanded|isQuoteDispatchExpanded \?|isExpanded \?)/);
  });

  it("자세히 보기 / 접기 CTA (펼침 toggle 트리거)", () => {
    expect(component).toMatch(/(자세히|접기|펼치기|상세)/);
  });
});

describe("§11.247 #2 — 반응형 grid auto-fit (3 breakpoint 자동 분기)", () => {
  it("grid-cols arbitrary auto-fit minmax(280px, 1fr) 패턴", () => {
    // Tailwind arbitrary: grid-cols-[repeat(auto-fit,minmax(280px,1fr))]
    // 또는 inline style gridTemplateColumns
    expect(component).toMatch(/(grid-cols-\[repeat\(auto-fit,minmax\(280px,_?1fr\)\)\]|repeat\(auto-fit,\s*minmax\(280px,\s*1fr\)\))/);
  });

  it("기존 grid-cols-2 lg:grid-cols-4 제거 (auto-fit 으로 대체)", () => {
    // 새 패턴이 기존 단일 breakpoint pattern 을 대체했는지
    expect(component).not.toMatch(/grid grid-cols-2 lg:grid-cols-4/);
  });
});

describe("§11.247 #3 — 카드 높이 균일화 (min-h 또는 동일 padding)", () => {
  it("min-h 균일 — 4 카드 동일 최소 높이", () => {
    // min-h-[숫자px] 또는 min-h-{tailwind preset} 형태
    expect(component).toMatch(/min-h-\[(\d+)(px|rem)?\]|min-h-(36|40|44|48|52|56|60|64)/);
  });
});

describe("§11.247 #4 — 트랜지션 200-300ms ease", () => {
  it("transition-all duration-200 ~ 300", () => {
    expect(component).toMatch(/transition[\s\S]{0,40}duration-(200|250|300)/);
  });
});

describe("§11.247 #5 — invariant 보존", () => {
  it("'use client' directive 보존", () => {
    expect(component).toMatch(/^['"]use client['"]/m);
  });

  it("ACTIONS 배열 보존 (4 verb)", () => {
    expect(component).toMatch(/견적 발송|견적 등록/);
    expect(component).toMatch(/발주 전환/);
    expect(component).toMatch(/입고 처리/);
    expect(component).toMatch(/재고 점검/);
  });

  it("OperatorQuickActionsProps counts 보존 (§11.308d-2 — quoteDispatchReadiness prop 제거)", () => {
    expect(component).toMatch(/counts\?\s*:\s*OperatorQuickActionsCounts/);
    // §11.308d-2 — in-card 발송 시뮬레이션 제거로 readiness prop/타입 삭제 (caller 미전달, dead).
    expect(component).not.toMatch(/quoteDispatchReadiness/);
    expect(component).not.toMatch(/OperatorQuickActionsQuoteDispatchReadiness/);
  });

  it("§11.243 #5 건수 뱃지 보존 (대기 N건)", () => {
    expect(component).toMatch(/대기/);
  });

  it("§11.308d-2 — 펼친 상태 단일 CTA = 견적 워크벤치 진입 (영구 비활 Send 제거)", () => {
    // 재설계: in-card 가짜 발송 button(공급사에 전송 + canSendToSupplier 비활) →
    //   워크벤치 진입 CTA. 발송 truth 는 /dashboard/quotes 소유.
    expect(component).toMatch(/견적 워크벤치 열기/);
    expect(component).toMatch(/href="\/dashboard\/quotes\?labaxisPilot=quote-dispatch"/);
    expect(component).not.toMatch(/canSendToSupplier/);
  });

  it("dashboard-quote-dispatch-card data-testid 보존 (cluster lineage)", () => {
    expect(component).toMatch(/dashboard-quote-dispatch-card/);
  });

  it("§11.247 trace marker comment", () => {
    expect(component).toMatch(/§11\.247[\s\S]{0,300}(progressive|disclosure|반응형|responsive|auto-fit|expand|disclosure)/i);
  });
});

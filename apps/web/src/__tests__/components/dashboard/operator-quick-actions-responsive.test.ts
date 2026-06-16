/**
 * §11.247 #operator-quick-actions-responsive — 반응형 invariant
 *
 * §11.364 D-1 (호영님 P1, 2026-06-04) supersede:
 *   Progressive Disclosure(견적 발송 카드 expand/접기 + in-card CTA)는
 *   액션존↔네비존 역할 분리로 **폐기**. 운영 바로가기 = 순수 네비 카드.
 *   → 본 sentinel 의 #1 expand describe 는 강등 가드로 전환.
 *   보존 항목(반응형 grid / min-h / transition / 4 verb / counts)은 유지.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_PATH = resolve(
  __dirname,
  "../../../components/dashboard/operator-quick-actions.tsx",
);
const component = readFileSync(COMPONENT_PATH, "utf8");

describe("§11.364 D-1 — Progressive Disclosure 폐기 (순수 네비 강등)", () => {
  it("expand state / toggle 제거 (in-card disclosure 0)", () => {
    expect(component).not.toMatch(/isQuoteDispatchExpanded/);
    expect(component).not.toMatch(/setIsQuoteDispatchExpanded/);
    expect(component).not.toMatch(/useState/);
  });

  it("in-card 접기/펼치기 CTA 제거", () => {
    expect(component).not.toMatch(/견적 발송 카드 (접기|펼치기)/);
    expect(component).not.toMatch(/클릭하여 발송 대기 요약 보기/);
  });
});

describe("§11.247 #2 → shifan P-fid3 — 2×2 고정 그리드(auto-fit 폐지)", () => {
  it("grid-cols-2 고정 (side-col 반폭 일관 2×2)", () => {
    // P-fid3: auto-fit minmax(280px) 가 side-col 반폭에서 1×4 로 무너짐(라이브 실측) →
    //   grid-cols-2 고정으로 전환. 시안 빠른작업 2×2 정합.
    expect(component).toMatch(/grid grid-cols-2/);
  });

  it("auto-fit / lg:grid-cols-4 회귀 차단", () => {
    expect(component).not.toMatch(/grid-cols-\[repeat\(auto-fit/);
    expect(component).not.toMatch(/grid grid-cols-2 lg:grid-cols-4/);
  });
});

describe("§11.247 #3 — 카드 높이 균일화 (보존)", () => {
  it("min-h 균일 — 4 카드 동일 최소 높이", () => {
    expect(component).toMatch(/min-h-\[(\d+)(px|rem)?\]/);
  });
});

describe("§11.247 #4 — 트랜지션 (보존)", () => {
  it("transition-all duration-300", () => {
    expect(component).toMatch(/transition[\s\S]{0,40}duration-(200|250|300)/);
  });
});

describe("§11.247 #5 — invariant 보존", () => {
  it("'use client' directive 보존", () => {
    expect(component).toMatch(/^['"]use client['"]/m);
  });

  it("ACTIONS 배열 보존 (4 verb)", () => {
    expect(component).toMatch(/견적 발송/);
    expect(component).toMatch(/발주 전환/);
    expect(component).toMatch(/입고 처리/);
    expect(component).toMatch(/재고 점검/);
  });

  it("OperatorQuickActionsProps counts 보존 (display-only)", () => {
    expect(component).toMatch(/counts\?\s*:\s*OperatorQuickActionsCounts/);
    expect(component).not.toMatch(/quoteDispatchReadiness/);
  });

  it("§11.364 D-1 — 발송 진입 동선 보존 (균질 네비 카드 href)", () => {
    // 발송 truth 는 워크벤치 소유 — 카드 클릭 시 워크벤치 라우팅(진입 보존).
    expect(component).toMatch(/href:\s*"\/dashboard\/quotes\?labaxisPilot=quote-dispatch"/);
    expect(component).not.toMatch(/canSendToSupplier/);
  });

  it("§11.247 / §11.364 trace marker comment", () => {
    expect(component).toMatch(/§11\.(247|364)/);
  });
});

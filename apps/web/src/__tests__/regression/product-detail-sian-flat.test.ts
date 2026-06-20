/**
 * §product-detail PD-flat (시안 정합) — 콘텐츠 영역 플랫 전환 가드
 *
 * 호영님 2026-06-20 결정: /products/:id 콘텐츠를 시안(추출 ImprovedPage) 플랫 스타일로 정합.
 *   범위 = `.q-embed` 콘텐츠 스코프 한정, 전역 셸 불변. 글래스모피즘(blur orb·rounded-3xl·
 *   bg-pn/80 backdrop)은 콘텐츠에서 제거, 시안 토큰(흰 카드·hairline·radius 18px·accent #2f6be0).
 *
 * 단계: P2 히어로(이 파일 현행). P3 제품사양/안전, P4 우측레일/대체품은 land 시 본 파일에 추가.
 * detail-contrast(text-slate-900 대비)·dead-button(견적함만)·canonical(getDisplaySpecs)은 불변.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§PD-flat — 콘텐츠 플랫 스코프(.q-embed)", () => {
  it("콘텐츠 컨테이너에 .q-embed 스코프 클래스(전역 셸 무영향)", () => {
    expect(DETAIL).toMatch(/max-w-7xl mx-auto q-embed/);
  });
});

describe("§PD-flat P2 — 히어로 플랫", () => {
  it("히어로 카드 = 플랫 흰 카드(글래스/blur orb 폐기)", () => {
    expect(DETAIL).toMatch(/bg-white shadow-sm rounded-\[18px\] p-6 md:p-7 border border-gray-200/);
  });
  it("히어로 blur orb 데코 제거(시안 플랫)", () => {
    // 폐기된 히어로 orb 특정 가드(브리틀 regex 회피)
    expect(DETAIL).not.toContain("w-64 h-64 bg-blue-50/30 rounded-full blur-3xl");
  });
  it("히어로 썸네일 96px + accent 그라데이션(시안 정합)", () => {
    expect(DETAIL).toMatch(/w-20 h-20 md:w-24 md:h-24 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50/);
  });
  it("키 팩트 행 — 세로 구분선(border-left, 시안)", () => {
    expect(DETAIL).toMatch(/border-l border-gray-100/);
    expect(DETAIL).toMatch(/i === 0 \? "pl-0"/);
  });
  it("회귀 0 — text-slate-900 대비 + 완성도 + 키팩트 라벨 보존", () => {
    expect(DETAIL).toMatch(/font-bold text-slate-900 leading-tight/);
    expect(DETAIL).toMatch(/<ProductCompleteness product=\{product\}/);
    expect(DETAIL).toMatch(/label: "출처"/);
    expect(DETAIL).toMatch(/label: "안전 위험도"/);
  });
});

describe("§PD-flat — dead button 0(시안 요소 라우트 분기)", () => {
  it("비교 트레이/비교하기 미도입(/compare 부재 → 견적함만)", () => {
    expect(DETAIL).not.toMatch(/비교표 열기/);
    expect(DETAIL).not.toMatch(/비교하기/);
  });
});

describe("§PD-flat P3 — 제품사양/안전 카드 플랫", () => {
  it("좌측 콘텐츠 카드 글래스 잔재 0(spec body bg-pn/rounded-b-3xl 부재)", () => {
    // 우측 레일/대체품은 P4 전환 예정 → 전역 rounded-3xl 단언은 P4에서 추가.
    expect(DETAIL).not.toMatch(/bg-pn\/50 rounded-b-3xl/);
    expect(DETAIL).not.toMatch(/bg-pg\/30 rounded-t-3xl/);
  });
  it("제품사양/안전/사용용도 = 시안 플랫 카드(radius18·hairline)", () => {
    expect(DETAIL).toMatch(/mb-6 md:mb-8 rounded-\[18px\] border border-gray-200 bg-white shadow-sm overflow-hidden/);
    expect(DETAIL).toMatch(/rounded-\[18px\] border border-gray-200 bg-white shadow-sm p-6 md:p-8/);
  });
  it("'N개 항목 확인' 배지(확인 사양 수, 시안)", () => {
    expect(DETAIL).toMatch(/개 항목 확인/);
    expect(DETAIL).toMatch(/const specCount = \(product\.catalogNumber \? 1 : 0\)/);
  });
  it("PD-N 래퍼 indigo blur orb 제거", () => {
    expect(DETAIL).not.toContain("w-48 h-48 bg-indigo-50/20 rounded-full blur-3xl");
  });
  it("회귀 0 — §125 상세스펙 그리드/empty + getDisplaySpecs + 완성도 보존", () => {
    expect(DETAIL).toMatch(/상세 스펙 \(Specifications\)/);
    expect(DETAIL).toMatch(/등록된 상세 스펙이 없습니다/);
    expect(DETAIL).toMatch(/getDisplaySpecs\(product\.specifications\)\.map/);
    expect(DETAIL).toMatch(/<h3 className="text-lg font-bold text-slate-900">제품 사양<\/h3>/);
  });
});

/**
 * §product-detail PD-C (§07) — 안전·규제: MSDS 유무 배지 + MSDS 없음 경고/SDS 요청
 *
 * 시안 §07 잔여 2건(포털 6그리드·면책은 기구축):
 *   - 헤더 위험도 배지에 MSDS 유무 병기("· MSDS 없음/등록").
 *   - MSDS 없음 = 회색 텍스트 대신 yellow 경고 배너 + "SDS 요청"(실 이동 /support, dead button 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DETAIL = readFileSync(
  join(__dirname, "..", "..", "app/products/[id]/page.tsx"),
  "utf8",
);

describe("§product-detail PD-C(§07) — 위험도 배지", () => {
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §5, 호영님 승인 2026-08-09)
   *    MSDS 병기 제거(계약⑤)는 유지. 표기만 `위험도: {label}` → `위험도 {label}` pill 로 정리(콜론 제거, nowrap 고정).
   *    모바일 320~430px 에서 칩이 헤더 밖으로 이탈하던 회귀를 shrink-0 + whitespace-nowrap 으로 잠근다. */
  it("위험도 단일 표기 + 헤더 1행 고정(칩 이탈 0)", () => {
    expect(DETAIL).toMatch(/위험도 \{safetyLevel\.label\}/);
    expect(DETAIL).not.toMatch(/위험도: \{safetyLevel\.label\} · MSDS/);
    expect(DETAIL).toMatch(/shrink-0 whitespace-nowrap[\s\S]{0,300}?위험도 \{safetyLevel\.label\}/);
    expect(DETAIL).toMatch(/whitespace-nowrap">안전·규제 정보<\/h3>/);
  });
});

describe("§product-detail PD-C(§07) — SDS 미등록 고지", () => {
  /* 🔁 은퇴→승계 (§product-detail-sourcing-v21 §1·§5)
   *    구 단언은 미등록 시 `SDS 업로드 → /support` 액션이 **항상 존재**할 것을 강제했다.
   *    v21 §1: SDS 는 공급사/관리자만 등록(개인 업로드 = 오매칭 위험, canonical 단일 관리).
   *    buyer 에겐 요청 링크 없이 정직 표기만 — "미등록을 숨기지 않는다" 는 원래 의도는 그대로 승계. */
  it("미등록 은폐 0 — 정직 표기 + 업로드는 canEditSpec 게이트", () => {
    expect(DETAIL).not.toMatch(/MSDS\/SDS 문서 정보가 없습니다/);
    expect(DETAIL).not.toMatch(/bg-\[#fbf0db\]/);
    expect(DETAIL).toMatch(/등록 없음 · 공급사\/관리자 등록 시 표시됩니다/);
    expect(DETAIL).toMatch(/canEditSpec[\s\S]{0,400}?SDS 업로드/);
    expect(DETAIL).not.toMatch(/action=\{\{ label: "SDS 업로드", href: "\/support" \}\}/);
  });
});

describe("§product-detail PD-C(§07) — 회귀 0(기구축 보존)", () => {
  it("규제 링크 소스 보존 + 면책은 회색 각주로 승계", () => {
    expect(DETAIL).toMatch(/getRegulationLinksForProduct\(/);
    // §v21 §5 — yellow Alert(<Disclaimer type="safety">) → 회색 각주 1줄(과경고 제거). 공용 컴포넌트는 무접촉.
    expect(DETAIL).toMatch(/참고용 정보입니다\. 취급\/보관\/폐기 지침은 SDS\/MSDS 원문을 우선 확인하세요\./);
  });
});

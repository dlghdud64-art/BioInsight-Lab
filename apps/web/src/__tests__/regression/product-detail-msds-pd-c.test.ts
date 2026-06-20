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

describe("§product-detail PD-C(§07) — MSDS 유무 배지", () => {
  it("위험도 배지에 MSDS 유무 병기", () => {
    expect(DETAIL).toMatch(/위험도: \{safetyLevel\.label\} · MSDS \{product\.msdsUrl \? "등록" : "없음"\}/);
  });
});

describe("§product-detail PD-C(§07) — MSDS 없음 경고 배너", () => {
  it("회색 텍스트 폐기 → 시안 amber-hex 경고 + SDS 요청(/support 실 이동)", () => {
    // CEO 2026-06-21 §11.302 예외: 안전 경고 = 시안 amber 톤(hex). amber/orange 클래스 0 유지(app-wide 가드 정합).
    expect(DETAIL).not.toMatch(/MSDS\/SDS 문서 정보가 없습니다/);
    expect(DETAIL).toMatch(/MSDS\/SDS 미등록/);
    expect(DETAIL).toMatch(/bg-\[#fbf0db\] border border-\[#f0dcae\]/);
    expect(DETAIL).toMatch(/href="\/support"[^>]*>\s*SDS 요청/);
  });
});

describe("§product-detail PD-C(§07) — 회귀 0(기구축 보존)", () => {
  it("규제포털 6그리드 + 면책 보존", () => {
    expect(DETAIL).toMatch(/getRegulationLinksForProduct\(/);
    expect(DETAIL).toMatch(/<Disclaimer type="safety"/);
  });
});

/**
 * §cas-hazard-classification P3 (호영님 2026-07-04) — 읽기측 canonical 배선 + 미분류 정직표기.
 * 어댑터가 casNo→정적분류·deriveHazardLevel 사용, 페이지가 classified 기반 "미분류" 렌더.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const ADAPTER = rd("lib/safety/product-to-safety-item.ts");
const PAGE = rd("app/dashboard/safety/page.tsx");
const ENGINE = rd("lib/ai/safety-decision-engine.ts");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§cas-hazard P3 — 엔진 타입", () => {
  it("SafetyItemInput.classified 플래그", () => {
    expect(strip(ENGINE)).toMatch(/classified\?:\s*boolean/);
  });
});

describe("§cas-hazard P3 — 어댑터 canonical 분류", () => {
  const A = strip(ADAPTER);
  it("정적 분류기 사용(classifyByCas·deriveHazardLevel)", () => {
    expect(A).toMatch(/classifyByCas\(p\.casNo\)/);
    expect(A).toMatch(/deriveHazardLevel\(\{\s*classified/);
  });
  it("cas = casNo 파생(빈 문자열 하드코딩 제거)", () => {
    expect(A).toMatch(/cas:\s*normalizeCas\(p\.casNo\)/);
    expect(A).not.toMatch(/cas:\s*"",/);
  });
  it("classified 방출 + casNo 입력 필드", () => {
    expect(A).toMatch(/casNo\?:\s*string/);
    expect(A).toMatch(/\n\s*classified,\n/);
  });
  it("구 조잡 파생(hazardCodes.length>0?HIGH) 제거", () => {
    expect(A).not.toMatch(/isHighRisk\s*=\s*\n?\s*pictograms\.some/);
  });
});

describe("§cas-hazard P3 — 페이지 미분류 정직표기", () => {
  const P = strip(PAGE);
  it("canonical 라벨/톤 헬퍼", () => {
    expect(P).toMatch(/function riskLabelOf/);
    expect(P).toMatch(/function riskClsOf/);
    expect(P).toMatch(/classified === false\) return "미분류"/);
  });
  it("주의(MEDIUM) = §11.302 amber(쨍한 yellow 금지)", () => {
    expect(P).toMatch(/bg-\[#fdf3ec\] text-\[#b45821\] border-\[#f3d4bf\]/);
    expect(P).not.toMatch(/riskCls = item\.level === "HIGH".*bg-yellow-100/);
  });
  it("라벨 렌더 지점이 헬퍼 경유(인라인 삼항 잔존 0)", () => {
    expect(P).not.toMatch(/level === "HIGH" \? "고위험" : .*"중위험"/);
  });
});

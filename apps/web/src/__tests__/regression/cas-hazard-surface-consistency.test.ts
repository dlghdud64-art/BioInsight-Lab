/**
 * §cas-hazard-classification T1+T2 (호영님 2026-07-04) — 미분류 착시 전 surface 완결.
 * T1: product-detail(getProductSafetyLevel)도 미분류=unknown 표기(안전페이지 정합).
 * T2: 안전페이지 "미분류" 필터칩+카운트 능동 노출.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§cas-hazard T1 — product-detail 정합(safety-visualization)", () => {
  const V = strip(rd("lib/utils/safety-visualization.ts"));
  it("SafetyLevel 에 unknown 추가", () => {
    expect(V).toMatch(/"low" \| "medium" \| "high" \| "critical" \| "unknown"/);
  });
  it("getProductSafetyLevel: 미분류 조기반환(낮음 오도 금지) + casNo 판정", () => {
    expect(V).toMatch(/classifyByCas/);
    expect(V).toMatch(/casNo\?:\s*string/);
    expect(V).toMatch(/level:\s*"unknown"/);
    expect(V).toMatch(/label:\s*"미분류"/);
    expect(V).toMatch(/!hasCodes && !hasPictos && !casResult\.matched/);
  });
});

describe("§cas-hazard T2 — 안전페이지 미분류 노출", () => {
  const P = strip(rd("app/dashboard/safety/page.tsx"));
  it("chipFilter 에 unclassified + 필터 로직", () => {
    expect(P).toMatch(/"all" \| "msds" \| "insp" \| "high" \| "unclassified"/);
    expect(P).toMatch(/chipFilter === "unclassified" && item\.classified !== false/);
  });
  it("unclassifiedCount + 필터칩 노출", () => {
    expect(P).toMatch(/const unclassifiedCount = items\.filter\(\(i\) => i\.classified === false\)/);
    expect(P).toMatch(/key: "unclassified", label: "미분류", count: unclassifiedCount/);
  });
});

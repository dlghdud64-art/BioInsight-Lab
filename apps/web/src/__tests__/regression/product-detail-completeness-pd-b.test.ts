/**
 * §product-detail PD-B (§04·§05) — 완성도(8필드 고정) + 미등록 1줄 축약(정직)
 *
 * 호영님 확정: 완성도 % = 채워진 8필드 / 8 × 100, 분모 8 고정(필드 골라 조작 금지).
 *   8필드: catalogNumber·specification·regulatoryCompliance·grade·manufacturer·
 *          usageDescription·storageCondition·msdsUrl.
 *   100%면 배지 숨김. §11.302 yellow(빨강 금지). 미등록 1줄 + 정보 요청(/support 실 이동).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const LIB = root("lib/product-detail/completeness.ts");
const COMP = root("components/products/product-completeness.tsx");
const PAGE = root("app/products/[id]/page.tsx");

describe("§product-detail PD-B(§04) — 완성도 엔진(8필드 고정 분모)", () => {
  it("산정 8필드 고정(정직 — 어려운 필드 포함)", () => {
    for (const k of [
      "catalogNumber", "specification", "regulatoryCompliance", "grade",
      "manufacturer", "usageDescription", "storageCondition", "msdsUrl",
    ]) {
      expect(LIB).toMatch(new RegExp(`key: "${k}"`));
    }
  });
  it("분모 = COMPLETENESS_FIELDS.length 고정(조작 금지) + isEmpty 정직", () => {
    expect(LIB).toMatch(/const total = COMPLETENESS_FIELDS\.length/);
    expect(LIB).toMatch(/known \/ total/);
    expect(LIB).toMatch(/toLowerCase\(\) === "null"/);
  });
});

describe("§product-detail PD-B(§04·§05) — 완성도 바 + 미등록 축약", () => {
  it("100%면 배지 숨김 + computeCompleteness 사용", () => {
    expect(COMP).toMatch(/export function ProductCompleteness/);
    expect(COMP).toMatch(/computeCompleteness/);
    expect(COMP).toMatch(/if \(pct >= 100\) return null/);
  });
  it("미등록 1줄 축약 + 정보 요청(실 라우트 /support, dead button 0)", () => {
    expect(COMP).toMatch(/missingLabels\.join/);
    expect(COMP).toMatch(/href="\/support"/);
    expect(COMP).toMatch(/정보 요청/);
  });
  it("§11.302 — yellow 중립톤(빨강·amber·orange 0)", () => {
    expect(COMP).toMatch(/bg-yellow-/);
    expect(COMP).not.toMatch(/-amber-|-orange-/);
    expect(COMP).not.toMatch(/bg-red-|text-red-|border-red-/);
  });
});

describe("§product-detail PD-B — page 삽입", () => {
  it("ProductCompleteness import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ ProductCompleteness \}/);
    expect(PAGE).toMatch(/<ProductCompleteness product=\{product\}/);
  });
});

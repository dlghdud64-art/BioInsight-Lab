/**
 * §cas-hazard-classification P3b (호영님 2026-07-04) — 입고 시 casNo 저장 + 정적 위험분류.
 * 서버 authoritative: smart-receiving 은 OcrJob.finalResult 파싱값, inventory 는 body.casNumber.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§cas-hazard P3b — 공유 헬퍼", () => {
  const H = strip(rd("lib/safety/product-hazard-fields.ts"));
  it("buildProductHazardFields + 정적 분류기 사용", () => {
    expect(H).toMatch(/export function buildProductHazardFields/);
    expect(H).toMatch(/classifyByCas/);
    expect(H).toMatch(/normalizeCas/);
    expect(H).toMatch(/pictogramsFromHazardCodes/);
  });
});

describe("§cas-hazard P3b — smart-receiving 배선(서버 authoritative)", () => {
  const S = strip(rd("app/api/inventory/smart-receiving/route.ts"));
  it("헬퍼 import + create spread", () => {
    expect(S).toMatch(/buildProductHazardFields/);
    expect(S).toMatch(/\.\.\.hazardFields,/);
  });
  it("OcrJob.finalResult.parsedFields 로 casNumber 소싱", () => {
    expect(S).toMatch(/finalResult:\s*\{\s*select:\s*\{\s*parsedFields:\s*true/);
    expect(S).toMatch(/ocrParsed\?\.casNumber/);
  });
});

describe("§cas-hazard P3b — inventory 수기/API 배선", () => {
  const I = strip(rd("app/api/inventory/route.ts"));
  it("헬퍼 import + casNumber 파싱 + create spread", () => {
    expect(I).toMatch(/buildProductHazardFields/);
    expect(I).toMatch(/\n\s*casNumber,\n/);
    expect(I).toMatch(/\.\.\.buildProductHazardFields\(casNumber\)/);
  });
});

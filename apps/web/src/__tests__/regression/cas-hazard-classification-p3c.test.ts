/**
 * §cas-hazard-classification P3c (호영님 2026-07-04) — MSDS 업로드 backfill(fill-empty, best-effort).
 * 기존 제품을 MSDS 업로드 시 organic 분류. canonical 우선(저장값 보존), 업로드 무해(never throw).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§cas-hazard P3c — backfill 헬퍼", () => {
  const H = strip(rd("lib/safety/msds-hazard-backfill.ts"));
  it("파이프라인 재사용(pdf-parser + safety-extractor)", () => {
    expect(H).toMatch(/extractTextFromPDF/);
    expect(H).toMatch(/extractSafetyInfoFromMSDS/);
  });
  it("가드: sds만 · OPENAI_API_KEY · PDF만", () => {
    expect(H).toMatch(/docType !== "sds"/);
    expect(H).toMatch(/process\.env\.OPENAI_API_KEY/);
    expect(H).toMatch(/includes\("pdf"\)/);
  });
  it("fill-empty: 기존 hazardCodes 있으면 보존(canonical 우선)", () => {
    expect(H).toMatch(/already_classified/);
    expect(H).toMatch(/Array\.isArray\(existing\) && existing\.length > 0/);
  });
  it("best-effort: 절대 throw 안 함(업로드 무해)", () => {
    expect(H).toMatch(/\}\s*catch\s*\{/);
    expect(H).toMatch(/reason:\s*"extract_failed"/);
  });
});

describe("§cas-hazard P3c — sds 라우트 배선", () => {
  const S = strip(rd("app/api/products/[id]/sds/route.ts"));
  it("업로드 성공 후 sds일 때만 backfill 호출", () => {
    expect(S).toMatch(/backfillHazardFromMsds/);
    expect(S).toMatch(/if \(docType === "sds"\)/);
  });
  it("응답에 hazardBackfilled(가짜 성공 아님, 실제 결과 반영)", () => {
    expect(S).toMatch(/hazardBackfilled/);
  });
});

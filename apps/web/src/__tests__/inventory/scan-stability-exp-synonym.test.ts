/**
 * §scan-stability + §label-exp-synonym — 호영님 모바일 라이브 시약 스캔.
 *
 * #11 간헐 실패: 동일 선명 라벨 13:43 성공 / 15:42 실패 = 백엔드(rate limit 429 / timeout),
 *   이미지 아님. callGeminiWithFallback 은 404 model-fallback 전용 → 429/timeout 재시도 0 이었음.
 *   Fix: transient(429/timeout/5xx) exponential backoff 재시도 + route 정직 UX(실패 단정 금지).
 *
 * #10 EXP 미추출: 라벨이 "NEXT RETEST: 2028/06"(Condalab) 등 validity 동의어 표기 →
 *   프롬프트가 "expiration date"만 지시해 누락. Fix: 동의어(Retest/Cad./유효기간 …) 매핑 + today 금지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG = readFileSync(resolve(__dirname, "../../lib/ocr/gemini-config.ts"), "utf8");
const PARSER = readFileSync(resolve(__dirname, "../../lib/ocr/gemini-label-parser.ts"), "utf8");
const ROUTE = readFileSync(resolve(__dirname, "../../app/api/inventory/scan-label/route.ts"), "utf8");

describe("§scan-stability — Gemini transient backoff 재시도", () => {
  it("429/timeout/5xx 일시적 오류 분류 + backoff 재시도", () => {
    expect(CONFIG).toContain("isTransientGeminiError");
    expect(CONFIG).toMatch(/429|RESOURCE_EXHAUSTED/);
    expect(CONFIG).toContain("MAX_TRANSIENT_RETRIES");
    expect(CONFIG).toMatch(/backoff/i);
  });

  it("404 model fallback 보존 (회귀 0)", () => {
    expect(CONFIG).toContain("GEMINI_FALLBACK_MODEL");
    expect(CONFIG).toMatch(/NOT_FOUND/);
  });

  it("route 정직 UX — 일시적이면 실패 단정 금지", () => {
    expect(ROUTE).toContain("isTransientGeminiError");
    expect(ROUTE).toContain("일시적 오류");
  });
});

describe("§label-exp-synonym — validity 동의어 프롬프트", () => {
  it("Next Retest / Retest Date / 유효기간 → expirationDate 매핑 지시", () => {
    expect(PARSER).toContain("Next Retest");
    expect(PARSER).toContain("Retest Date");
    expect(PARSER).toContain("유효기간");
  });

  it("today 자동 추정 금지 명시", () => {
    expect(PARSER).toContain("never default to today");
  });
});

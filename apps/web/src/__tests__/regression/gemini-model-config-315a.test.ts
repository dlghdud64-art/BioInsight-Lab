/**
 * §11.315-a #gemini-model-config — Regression sentinel (Part A: P0 모델 + friendly error)
 *
 * 호영님 P0 (2026-05-28):
 *   기존 `gemini-2.5-flash-preview-04-17` (preview) 가 정식 출시 후 폐기되어
 *   404 NOT_FOUND. + parse-image route 가 raw Gemini JSON 을 사용자에게 노출.
 *
 * Fix:
 *   - lib/ocr/gemini-config.ts 신설 — env-aware PRIMARY/FALLBACK + 404 시 재시도
 *   - 3 caller (label/quote/bom) 전부 callGeminiWithFallback 으로 교체
 *   - parse-image catch 에서 raw error.message 노출 차단 → friendlyGeminiErrorMessage
 *   - scan-label friendly catch 메시지 회귀 가드
 *
 * Part B/C(입구 정리·명칭 분리)는 §11.315-b 후속 batch (별도 호영님 확인 필요).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  callGeminiWithFallback,
  friendlyGeminiErrorMessage,
  GEMINI_PRIMARY_MODEL,
  GEMINI_FALLBACK_MODEL,
} from "@/lib/ocr/gemini-config";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.315-a — gemini-config 모듈 (env-aware + fallback)", () => {
  it("PRIMARY/FALLBACK 모델 ID 가 preview 가 아닌 GA stable", () => {
    expect(GEMINI_PRIMARY_MODEL).toBeTruthy();
    expect(GEMINI_PRIMARY_MODEL).not.toMatch(/preview/);
    expect(GEMINI_FALLBACK_MODEL).toBeTruthy();
    expect(GEMINI_FALLBACK_MODEL).not.toMatch(/preview/);
  });

  it("callGeminiWithFallback — 성공 시 PRIMARY 로 1회 호출", async () => {
    const calls: string[] = [];
    const result = await callGeminiWithFallback(async (model) => {
      calls.push(model);
      return { ok: true, model };
    });
    expect(calls).toEqual([GEMINI_PRIMARY_MODEL]);
    expect(result).toEqual({ ok: true, model: GEMINI_PRIMARY_MODEL });
  });

  it("callGeminiWithFallback — 404 NOT_FOUND 시 FALLBACK 으로 재시도", async () => {
    const calls: string[] = [];
    const result = await callGeminiWithFallback(async (model) => {
      calls.push(model);
      if (model === GEMINI_PRIMARY_MODEL) {
        throw new Error(
          'models/gemini-test is not found for API version v1beta. "code": 404 NOT_FOUND',
        );
      }
      return { ok: true, model };
    });
    expect(calls).toEqual([GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL]);
    expect(result).toEqual({ ok: true, model: GEMINI_FALLBACK_MODEL });
  });

  it("callGeminiWithFallback — 404 가 아닌 에러는 fallback 시도 0, 원본 throw", async () => {
    const calls: string[] = [];
    await expect(
      callGeminiWithFallback(async (model) => {
        calls.push(model);
        throw new Error("RATE_LIMIT_EXCEEDED");
      }),
    ).rejects.toThrow(/RATE_LIMIT_EXCEEDED/);
    expect(calls).toEqual([GEMINI_PRIMARY_MODEL]);
  });

  it("friendlyGeminiErrorMessage — raw JSON 차단, context 별 한국어 메시지", () => {
    expect(friendlyGeminiErrorMessage("quote")).toMatch(/거래명세서.*다시 시도/);
    expect(friendlyGeminiErrorMessage("label")).toMatch(/이미지.*다시 시도/);
    expect(friendlyGeminiErrorMessage("bom")).toMatch(/BOM.*다시 시도/);
    // 어떤 context 든 raw JSON("error":"code":404) 형식 0
    for (const ctx of ["quote", "label", "bom"] as const) {
      const msg = friendlyGeminiErrorMessage(ctx);
      expect(msg).not.toMatch(/"code":/);
      expect(msg).not.toMatch(/NOT_FOUND/);
      expect(msg).not.toMatch(/v1beta/);
    }
  });
});

describe("§11.315-a — 3 caller 가 preview 모델 하드코딩 제거 + callGeminiWithFallback 사용", () => {
  const CALLERS = [
    "src/lib/ocr/gemini-label-parser.ts",
    "src/lib/ocr/gemini-quote-parser.ts",
    "src/app/api/ai/bom-parse/route.ts",
  ];

  for (const rel of CALLERS) {
    it(`${rel} — preview-04-17 하드코딩 0 + fallback 헬퍼 사용`, () => {
      const src = read(rel);
      expect(src).not.toMatch(/gemini-2\.5-flash-preview-04-17/);
      expect(src).toMatch(/callGeminiWithFallback/);
      // 모델 ID 하드코딩 0 (env-aware config 경유)
      expect(src).not.toMatch(/model:\s*["']gemini-/);
    });
  }
});

describe("§11.315-a — parse-image route raw JSON 노출 차단 + scan-label friendly 회귀 가드", () => {
  it("parse-image catch — error.message 직접 반환 0, friendlyGeminiErrorMessage 경유", () => {
    const src = read("src/app/api/quotes/parse-image/route.ts");
    // raw 노출 패턴 0 (error?.message || "..." 패턴 제거 확인)
    expect(src).not.toMatch(/error:\s*error\?\.message\s*\|\|/);
    // friendly 경유 + import
    expect(src).toMatch(/friendlyGeminiErrorMessage/);
    expect(src).toMatch(/gemini-config/);
  });

  it("scan-label catch — 친화 메시지 회귀 0 (기존 양호 메시지 보존)", () => {
    const src = read("src/app/api/inventory/scan-label/route.ts");
    expect(src).toMatch(/AI 라벨 분석에 실패했습니다\. 텍스트를 직접 입력해주세요\./);
  });
});

/**
 * §ocr-parse-failure (호영님 2026-09-05) — 사유가 파서에서 화면까지 끊기지 않고 도달한다.
 *
 * 잠그는 것:
 *   1) 두 파서(Tier 1 Gemini · Tier 2 Claude)가 **각각** 사유를 만든다 — 동형 결함이었다
 *   2) 닫는 펜스를 요구하는 구 정규식이 부활하지 않는다
 *   3) finishReason 을 읽는다 (API 가 말해주는 걸 안 읽는 게 진짜 결함)
 *   4) 화면이 그 사유를 노출한다 — "0 품목 인식" 과 구분
 *   5) 🛑 catch 가 사유 없이 값만 지어내는 형태로 회귀하지 않는다
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const GEMINI = "src/lib/ocr/gemini-quote-parser.ts";
const CLAUDE = "src/lib/ocr/claude-structurer.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const LIB = "src/lib/ocr/parse-failure.ts";

describe("§ocr-parse-failure — 두 파서가 각각 사유를 만든다 (동형 결함)", () => {
  it("Tier 1 (Gemini) catch 가 describeParseFailure 를 부른다", () => {
    // ④ 경로는 OR 로 묶지 않는다 — 하나만 고치면 다른 쪽으로 떨어질 때 또 침묵한다.
    const src = read(GEMINI);
    const idx = src.indexOf("} catch (err) {");
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 500)).toMatch(/parseFailure = describeParseFailure\(\{/);
  });

  it("Tier 2 (Claude) catch 도 사유를 만든다", () => {
    const src = read(CLAUDE);
    expect(src).toMatch(/quoteParseFailure = describeParseFailure\(\{/);
  });

  it("두 결과 타입 모두 parseFailure 를 선언한다 (타입에서 탈락 방지)", () => {
    expect(read(GEMINI)).toMatch(/parseFailure: ParseFailure \| null;/);
    expect(read(CLAUDE)).toMatch(/parseFailure: ParseFailure \| null;/);
  });

  it("두 반환문 모두 사유를 싣는다", () => {
    expect(stripComments(read(GEMINI))).toMatch(/\n\s*parseFailure,\n/);
    expect(stripComments(read(CLAUDE))).toMatch(/parseFailure: quoteParseFailure,/);
  });
});

describe("§ocr-parse-failure — 구 형태 회귀 차단", () => {
  it("🛑 닫는 펜스를 요구하는 정규식이 부활하지 않는다", () => {
    // 구: /```(?:json)?\s*([\s\S]*?)```/ — 잘린 응답에서 매칭 자체가 실패했다.
    for (const rel of [GEMINI, CLAUDE]) {
      const code = stripComments(read(rel));
      expect(code, rel).not.toMatch(/match\(\/```\(\?:json\)\?/);
    }
  });

  it("두 파서 모두 공용 stripCodeFence 를 쓴다", () => {
    expect(read(GEMINI)).toMatch(/stripCodeFence\(rawText\)/);
    expect(read(CLAUDE)).toMatch(/stripCodeFence\(rawText\)/);
  });

  it("Tier 1 이 finishReason 을 읽는다 (본문 휴리스틱이 1순위가 아니다)", () => {
    const src = read(GEMINI);
    expect(src).toMatch(/candidates\?\.\[0\]\?\.finishReason/);
    expect(src).toMatch(/describeParseFailure\(\{ finishReason, rawText, error: err \}\)/);
  });

  it("판정 함수가 finishReason 을 본문보다 먼저 본다", () => {
    const src = stripComments(read(LIB));
    const idx = src.indexOf("export function detectTruncation");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 700);
    const frIdx = win.indexOf("finishReason");
    const heuristicIdx = win.indexOf("```");
    expect(frIdx).toBeGreaterThan(-1);
    expect(heuristicIdx).toBeGreaterThan(frIdx);
  });
});

describe("§ocr-parse-failure — 화면이 사유를 노출한다", () => {
  it("파싱 실패 블록이 실재하고 서버 문구를 그대로 쓴다", () => {
    const src = read(MODAL);
    const idx = src.indexOf('data-testid="srm-parse-failure"');
    expect(idx).toBeGreaterThan(-1);
    // 창은 조건부 렌더 시작부터(② 창 시작점).
    const cond = src.indexOf("{scanResult.parseFailure && (");
    expect(cond).toBeGreaterThan(-1);
    const win = src.slice(cond, cond + 1200);
    expect(win).toMatch(/\{scanResult\.parseFailure\.message\}/);
    expect(win).toMatch(/\{scanResult\.parseFailure\.detail\}/);
  });

  it("§11.302 — 주의는 yellow (amber/orange 금지)", () => {
    const cond = read(MODAL).indexOf("{scanResult.parseFailure && (");
    const win = read(MODAL).slice(cond, cond + 1200);
    expect(win).toMatch(/yellow-/);
    expect(win).not.toMatch(/amber-|orange-/);
  });

  it("회귀 0 — 품목 수 표시는 그대로 남는다 (사유는 그 옆에 붙는다)", () => {
    expect(read(MODAL)).toMatch(/\{scanResult\.itemCount\} 품목 인식/);
  });
});

describe("§ocr-parse-failure — 사유 문구 계약", () => {
  it("잘림 안내가 사용자가 할 수 있는 일을 담는다", () => {
    const src = read(LIB);
    expect(src).toMatch(/품목 수를 줄이거나 나눠서 스캔/);
  });

  it("세 코드가 각각 문구를 갖는다 (빠지면 build 가 깨진다)", () => {
    const src = read(LIB);
    expect(src).toMatch(/MESSAGE: Record<ParseFailureCode, string>/);
    for (const k of ["TRUNCATED", "MALFORMED", "EMPTY"]) {
      expect(src, `문구 누락: ${k}`).toMatch(new RegExp(`${k}:\\s*\n?\\s*"`));
    }
  });
});

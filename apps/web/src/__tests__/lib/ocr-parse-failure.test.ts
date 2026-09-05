/**
 * §ocr-parse-failure (호영님 2026-09-05) — 파싱 실패는 빈 결과가 아니다.
 *
 * 사고 실측(prod, 2026-09-05):
 *   Lot 열이 있는 7열 명세서 → 화면 `낮은 신뢰도 · 0 품목 인식`.
 *   그런데 OcrResult.rawText 에는 Gemini 가 제대로 읽은 내용이 있었다 —
 *   공급사 "한빛랩앤서플라이 주식회사", 담당자 "김영업" 까지.
 *   응답이 1094자에서 끊겨 닫는 `}` 도 닫는 코드펜스도 없었고,
 *   펜스 정규식이 닫는 펜스를 요구해 매칭 실패 → JSON.parse 실패 → catch 가 빈 문서로 대체.
 *   화면은 "0 품목" 이라고 **거짓말**했고, 그 거짓말 때문에 원인 가설을 셋 세워 전부 틀렸다.
 */

import { describe, it, expect } from "vitest";
import {
  detectTruncation,
  stripCodeFence,
  describeParseFailure,
  PARSE_FAILURE,
} from "@/lib/ocr/parse-failure";

describe("§ocr-parse-failure — 잘림 감지", () => {
  it("finishReason 이 1순위다 — API 가 말해주는 걸 읽는다", () => {
    // 🔑 maxOutputTokens 상향은 수정이 아니라 연기다(20품목 명세서면 또 잘린다).
    //    진짜 결함은 API 가 잘렸다고 말해주는데 코드가 안 읽는 것이다.
    expect(detectTruncation({ finishReason: "MAX_TOKENS", text: "{}" })).toBe(true);
    expect(detectTruncation({ finishReason: "LENGTH", text: "{}" })).toBe(true);
    expect(detectTruncation({ finishReason: "max_tokens", text: "{}" })).toBe(true);
    expect(detectTruncation({ finishReason: "STOP", text: "{}" })).toBe(false);
  });

  it("finishReason 이 없어도 본문으로 보조 판정한다 — 이번 실측 형태", () => {
    // 여는 펜스만 있고 닫는 펜스가 없다.
    expect(detectTruncation({ text: '```json\n{"a":1' })).toBe(true);
    // 중괄호가 안 닫혔다.
    expect(detectTruncation({ text: '{"items":[{"productName":"x"' })).toBe(true);
    // 정상 응답.
    expect(detectTruncation({ text: '{"items":[]}' })).toBe(false);
    expect(detectTruncation({ text: '```json\n{"items":[]}\n```' })).toBe(false);
  });
});

describe("§ocr-parse-failure — 펜스 제거", () => {
  it("🛑 닫는 펜스를 요구하지 않는다 (구 정규식이 여기서 통째로 실패했다)", () => {
    // 구: /```(?:json)?\s*([\s\S]*?)```/ — 닫는 ``` 이 없으면 매칭 자체가 안 됐다.
    expect(stripCodeFence('```json\n{"a":1')).toBe('{"a":1');
    expect(stripCodeFence('```\n{"a":1')).toBe('{"a":1');
  });

  it("정상 펜스도 벗긴다 · 펜스 없는 원문은 그대로", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
    expect(stripCodeFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});

describe("§ocr-parse-failure — 사유 생성", () => {
  it("잘림이면 TRUNCATED + 무엇을 하면 되는지까지 말한다", () => {
    const f = describeParseFailure({
      finishReason: "MAX_TOKENS",
      rawText: '```json\n{"vendor":{"name":"한빛랩앤서플라이 주식회사"',
    });
    expect(f.code).toBe(PARSE_FAILURE.TRUNCATED);
    expect(f.message).toContain("잘렸습니다");
    // 🔑 "실패했습니다" 로 끝내지 않는다 — 사용자가 할 수 있는 일을 준다.
    expect(f.message).toMatch(/품목 수를 줄이거나 나눠서 스캔/);
  });

  it("형식 이탈은 MALFORMED", () => {
    const f = describeParseFailure({ finishReason: "STOP", rawText: "죄송합니다, 읽을 수 없습니다." });
    expect(f.code).toBe(PARSE_FAILURE.MALFORMED);
  });

  it("빈 응답은 EMPTY — 잘림과 구분한다", () => {
    expect(describeParseFailure({ rawText: "" }).code).toBe(PARSE_FAILURE.EMPTY);
    expect(describeParseFailure({ rawText: "   " }).code).toBe(PARSE_FAILURE.EMPTY);
  });

  it("detail 에 진단 근거가 실린다 — 값을 지어내지 않았다는 증거", () => {
    const f = describeParseFailure({
      finishReason: "MAX_TOKENS",
      rawText: "x".repeat(1094),
      error: new Error("Expected ',' or '}' after property value"),
    });
    expect(f.detail).toContain("finishReason=MAX_TOKENS");
    expect(f.detail).toContain("길이=1094");
    expect(f.detail).toContain("parse=Expected");
  });

  it("finishReason 이 없으면 '(없음)' 으로 명시한다 — 빈 값과 미측정을 구분", () => {
    const f = describeParseFailure({ rawText: "not json" });
    expect(f.detail).toContain("finishReason=(없음)");
  });

  it("세 코드가 각각 존재한다", () => {
    expect(new Set(Object.values(PARSE_FAILURE)).size).toBe(3);
  });
});

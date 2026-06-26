/**
 * §label-scan-extraction — Gemini 라벨 JSON 추출 견고성 + Gibco 골든 샘플 회귀
 *   (호영님 2026-06-27: 선명한 Gibco PBS 라벨이 전 필드 빈값 + "낮은 신뢰도".
 *    root: ```fence``` 만 처리하던 추출이 unfenced/앞말 응답에서 JSON.parse 실패 → silent 전-null.)
 *
 * 이 테스트는 Gemini 호출 없이 parser 의 JSON 추출 로직만 검증(결함이 있던 정확한 단계).
 * ★ 골든 샘플: Gibco PBS 라벨을 모델이 읽었을 때의 응답에서 5필드(제품명·REF·LOT·EXP·NET) 추출 통과.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractLabelJsonString } from "./gemini-label-parser";

// §label-scan-extraction — source-grep 단언용. new URL(import.meta.url) 은 vitest 에서 file:// 스킴
//   아니라 throw → 레포 표준 resolve(__dirname) 패턴으로 읽는다.
const PARSER_SRC = readFileSync(resolve(__dirname, "./gemini-label-parser.ts"), "utf8");

const GIBCO = {
  brand: "gibco",
  productName: "Dulbecco's Phosphate Buffered Saline",
  catalogNo: "21600-044",
  lotNo: "3164244",
  expirationDate: "2028-02-28",
  quantity: "477.5 g/pkg",
};
const GIBCO_JSON = JSON.stringify(GIBCO);

describe("§label-scan-extraction — JSON 추출 견고성(fence/unfenced/앞말)", () => {
  it("```json``` fence 추출(기존 경로 보존)", () => {
    const raw = "```json\n" + GIBCO_JSON + "\n```";
    expect(JSON.parse(extractLabelJsonString(raw)!)).toMatchObject(GIBCO);
  });
  it("unfenced 순수 JSON 추출(이전 실패 케이스)", () => {
    expect(JSON.parse(extractLabelJsonString(GIBCO_JSON)!)).toMatchObject(GIBCO);
  });
  it("앞말 + JSON('Here is the data: {…}') 추출(이전 silent 전-null 원인)", () => {
    const raw = "Here is the extracted reagent label data:\n" + GIBCO_JSON;
    expect(JSON.parse(extractLabelJsonString(raw)!)).toMatchObject(GIBCO);
  });
  it("JSON + 뒷말 추출(trailing 텍스트)", () => {
    const raw = GIBCO_JSON + "\n\nNote: hourglass icon indicates expiry.";
    expect(JSON.parse(extractLabelJsonString(raw)!)).toMatchObject(GIBCO);
  });
  it("fence + 앞말 동시", () => {
    const raw = "Sure!\n```json\n" + GIBCO_JSON + "\n```\nDone.";
    expect(JSON.parse(extractLabelJsonString(raw)!)).toMatchObject(GIBCO);
  });
  it("JSON 객체 없음 → null(빈/거부 응답 — 정직 실패)", () => {
    expect(extractLabelJsonString("I cannot see an image.")).toBeNull();
    expect(extractLabelJsonString("")).toBeNull();
  });
});

describe("§label-scan-extraction — Gibco 골든 샘플(5필드 회귀 기준)", () => {
  it("제품명·REF(catalogNo)·LOT·EXP·NET(quantity) 전부 추출", () => {
    const raw = "다음은 라벨 분석 결과입니다:\n" + GIBCO_JSON;
    const parsed = JSON.parse(extractLabelJsonString(raw)!);
    expect(parsed.productName).toBe("Dulbecco's Phosphate Buffered Saline");
    expect(parsed.catalogNo).toBe("21600-044");
    expect(parsed.lotNo).toBe("3164244");
    expect(parsed.expirationDate).toBe("2028-02-28");
    expect(parsed.quantity).toBe("477.5 g/pkg");
  });
});

describe("§label-scan-extraction — 실패 분해 로깅 + 프롬프트 강화(source)", () => {
  it("silent catch 제거 — JSON 파싱 실패 시 rawText console.error", () => {
    const src = PARSER_SRC;
    expect(src).toMatch(/console\.error\(\s*"\[label-parser\] JSON 파싱 실패/);
    expect(src).toMatch(/rawText\.slice\(0, 800\)/);
    // 0필드(valid JSON·all-null, H_C) 도 로깅
    expect(src).toMatch(/0 필드 추출/);
  });
  it("프롬프트 — REF/NET/모래시계(hourglass) 매핑 룰 + few-shot", () => {
    const src = PARSER_SRC;
    expect(src).toMatch(/"REF"/);
    expect(src).toMatch(/NET/);
    expect(src).toMatch(/hourglass/);
    expect(src).toMatch(/Do NOT return all-null for a legible label/);
  });
});

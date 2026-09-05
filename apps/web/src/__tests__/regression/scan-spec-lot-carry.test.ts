/**
 * §scan-spec-carry · §scan-lot-slot (호영님 2026-09-05) — 인식된 값이 버려지지 않는다.
 *
 * 사고 실측(prod rawText 원문):
 *   화면이 `6 EA` 만 보여줘서 호영님도 operator 도 **정답을 오인식으로 읽었다.**
 *   모델은 정확했다:
 *     specification "4 L" · quantity 6 · unit "EA"  → 4L 짜리 6개
 *     notes "Lot No: MB2409A17, Expiry Date: 2029-03-31"  ← 자리가 없어 밀어넣은 것
 *   결함은 인식이 아니라 **전달**이었다. specification 은 SmartReceivingLine 에 전달조차
 *   안 돼 등록 시 영구 소실됐고, Lot 은 담을 자리가 없었다.
 *
 * 🛑 notes 를 정규식으로 캐지 않는다(호영님) — 그 임시 형식이 계약이 된다.
 *    모델이 다음에 "LOT: … / EXP: …" 로 쓰면 조용히 null 이 되고 "Lot 인식 안 됨" 으로 오독한다.
 *    자리를 만들면 모델이 직접 채운다. 자리가 있던 필드는 전부 정확히 들어왔다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const GEMINI = "src/lib/ocr/gemini-quote-parser.ts";
const CLAUDE = "src/lib/ocr/claude-structurer.ts";

function multiItemsBlock(src: string): string {
  const start = src.indexOf("items: includedLines.map((l) => ({");
  if (start < 0) throw new Error("items payload 앵커를 찾지 못했다");
  const end = src.indexOf("})),", start);
  if (end < 0) throw new Error("items payload 닫는 자리를 찾지 못했다");
  return src.slice(start, end);
}

describe("§scan-lot-slot — 자리를 만든다 (notes 파싱 금지)", () => {
  it("두 프롬프트 모두 lotNumber·expiryDate 자리를 준다 (Tier 1·2 각각)", () => {
    // ④ 경로는 OR 로 묶지 않는다 — Tier 2 로 떨어질 때 자리가 없으면 또 notes 로 간다.
    for (const rel of [GEMINI, CLAUDE]) {
      const src = read(rel);
      expect(src, rel).toMatch(/"lotNumber":\s*"[^"]*lot/i);
      expect(src, rel).toMatch(/"expiryDate":\s*"[^"]*expiry/i);
    }
  });

  it("타입에 자리가 있다 — optional 이 아니라 nullable", () => {
    const src = read(GEMINI);
    const idx = src.indexOf("export interface ParsedQuoteLineItem");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 1600);
    expect(win).toMatch(/lotNumber: string \| null;/);
    expect(win).toMatch(/expiryDate: string \| null;/);
  });

  it("🛑 notes 에서 Lot 을 정규식으로 캐내지 않는다", () => {
    // 임시 형식을 계약으로 굳히는 형태의 부활 차단.
    for (const rel of [ROUTE, MODAL]) {
      const code = stripComments(read(rel));
      expect(code, rel).not.toMatch(/Lot\s*No\s*:/i);
      expect(code, rel).not.toMatch(/notes[\s\S]{0,80}?match\(/);
    }
  });

  it("프롬프트가 notes 로 접지 말라고 명시한다", () => {
    expect(read(GEMINI)).toMatch(/Do NOT fold them into notes/);
  });
});

describe("§scan-spec-carry — 규격이 canonical 까지 간다", () => {
  it("라인·단품 타입 모두 specification 을 받는다", () => {
    const src = read(ROUTE);
    expect((src.match(/specification\?: string \| null;/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("두 Product.create 모두 specification 을 쓴다 (경로 각각)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/specification: line\.specification \?\? null,/);
    expect(src).toMatch(/specification: confirmedData\.specification \?\? null,/);
  });

  it("클라이언트가 규격·Lot·유효기간을 전송한다", () => {
    const block = multiItemsBlock(read(MODAL));
    expect(block).toMatch(/specification: l\.specification\.trim\(\) \|\| null/);
    expect(block).toMatch(/lotNumber: l\.lotNumber\.trim\(\) \|\| null/);
    expect(block).toMatch(/expirationDate: l\.expiryDate\.trim\(\) \|\| null/);
  });

  it("라인 초기값이 인식 결과에서 온다 (빈 문자열 하드코딩 금지)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/specification: it\.specification \?\? "",/);
    expect(src).toMatch(/lotNumber: it\.lotNumber \?\? "",/);
    expect(src).toMatch(/expiryDate: it\.expiryDate \?\? "",/);
  });
});

describe("§scan-spec-carry — 화면이 규격×수량 관계를 보여준다", () => {
  it("formatQuantityWithSpec 이 `규격 × 수량` 으로 합친다", () => {
    const src = read(MODAL);
    const idx = src.indexOf("function formatQuantityWithSpec(");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 700);
    // 🔑 `6 EA` 만도 `4 L` 만도 안 된다 — 둘의 관계라야 총량이 보인다.
    expect(win).toMatch(/\$\{spec\} × \$\{count\}/);
    // 규격이 없으면 수량만 — 지어내지 않는다.
    expect(win).toMatch(/spec \? .+ : count/);
  });

  it("다품목 행이 그 함수를 실제로 쓴다 (계산만 하고 안 쓰는 형태 차단)", () => {
    const src = read(MODAL);
    const idx = src.indexOf('data-testid="srm-multi-spec"');
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 600);
    expect(win).toMatch(/formatQuantityWithSpec\(l\.specification, l\.quantity, l\.unit\)/);
  });

  it("Lot·유효기간도 행에 보인다 (있을 때만)", () => {
    const idx = read(MODAL).indexOf('data-testid="srm-multi-spec"');
    const win = read(MODAL).slice(idx, idx + 600);
    expect(win).toMatch(/l\.lotNumber \? ` · Lot \$\{l\.lotNumber\}` : ""/);
    expect(win).toMatch(/l\.expiryDate \?/);
  });

  it("회귀 0 — Cat.No 표시 보존", () => {
    const idx = read(MODAL).indexOf('data-testid="srm-multi-spec"');
    const win = read(MODAL).slice(idx, idx + 600);
    expect(win).toMatch(/Cat \$\{l\.catalogNumber\}/);
    expect(win).toMatch(/Cat\.No 없음/);
  });
});

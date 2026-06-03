/**
 * §11.339-1 (회귀) — 견적 후보 드로어 즉시정정 sentinel
 *
 * (1) 열기 트리거: "견적" 라벨+배지+미리보기 button 전체 클릭(동그라미 숫자만 아님) — 기존 충족.
 * (2) 노란 하이라이트: q.reviewReason 있을 때만 노랑, 나머지 중립(white) — 기존 §11.302 정합.
 * (3) 수량 조절: 각 후보 행에 −/input/+ 추가. 기본 1, 단위 표시. updateQuoteItem 연결.
 *     + §11.338 정합: 미견적 가격은 "견적 후 확정"(lineTotal fallback 제거).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SHEET = "src/components/sourcing/SourcingCandidatesSheet.tsx";
const SEARCH = "src/app/_workbench/search/page.tsx";

describe("§11.339-1 (3) 수량 조절", () => {
  it("CandidateQuoteItem 에 quantity/unit 필드", () => {
    const src = read(SHEET);
    expect(src).toMatch(/quantity\?: number;/);
    expect(src).toMatch(/unit\?: string \| null;/);
  });
  it("onQuantityChange prop + 수량 UI(−/input/+)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/onQuantityChange\?: \(itemId: string, quantity: number\) => void/);
    expect(src).toMatch(/data-testid="candidate-qty"/);
    expect(src).toMatch(/aria-label="수량 감소"/);
    expect(src).toMatch(/aria-label="수량 증가"/);
    expect(src).toMatch(/Math\.max\(1, \(q\.quantity \?\? 1\) - 1\)/);
  });
  it("호출부 quantity/unit 매핑 + updateQuoteItem 연결", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/quantity: q\.quantity \?\? 1/);
    expect(src).toMatch(/unit: q\.unit \?\? products\.find/); // §11.339 v2 cart 매핑(중첩괄호 회피)
    expect(src).toMatch(/onQuantityChange=\{\(id, quantity\) => updateQuoteItem\(id, \{ quantity \}\)\}/);
  });
});

describe("§11.339-1 (2) 노란 하이라이트 §11.302 정합(기존 보존)", () => {
  it("reviewReason 있을 때만 노랑, 나머지 white", () => {
    const src = read(SHEET);
    expect(src).toMatch(/q\.reviewReason\s*\n?\s*\?\s*"border-yellow-200 bg-yellow-50"\s*\n?\s*:\s*"border-slate-200 bg-white"/);
  });
});

describe("§11.339-1 §11.338 가격 정합", () => {
  it("드로어 미견적 가격 '견적 후 확정'", () => {
    const src = read(SHEET);
    expect(src).toMatch(/\(q\.price \?\? 0\) > 0 \?.*: "견적 후 확정"/s);
  });
  it("호출부 unitPrice 전달 (가격판정은 §11.339 v2 QuoteCartPanel priceText 로 이동)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/unitPrice: q\.unitPrice/);
  });
});

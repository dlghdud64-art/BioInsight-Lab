/**
 * §11.338 (회귀) — 견적 가격 표시 정합 sentinel
 *
 * 모순: 우측 패널은 "가격 문의 필요"(미견적)인데 하단 견적 바는 ₩금액 무조건 표시.
 *   + 이전 시드(PBS 1X ₩18,000) cart localStorage 잔존.
 * 정정:
 *   A. 하단 바 = 확정가(unitPrice>0)만 합산, 미견적은 "N건 가격 미정". 전부 미견적이면 "견적 후 확정".
 *   B. cart STORAGE_KEY 버전(v2) + 구버전 키 제거 → 시드 잔존 1회 무효화.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SEARCH = "src/app/_workbench/search/page.tsx";
const PROVIDER = "src/app/_workbench/_components/test-flow-provider.tsx";

describe("§11.338 Part A — 하단 바 확정가만 합산", () => {
  it("totalAmount 가 unitPrice>0 항목만 합산", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/\(item\.unitPrice \?\? 0\) > 0 \? \(item\.lineTotal \|\| 0\) : 0/);
  });
  it("priceUnknownCount + hasConfirmedPrice 계산", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/priceUnknownCount = quoteItems\.filter/);
    expect(src).toMatch(/hasConfirmedPrice = quoteItems\.some/);
  });
  it("하단 바: 확정가 없으면 '견적 후 확정', 미견적 'N건 가격 미정'", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/hasConfirmedPrice \? `₩\$\{totalAmount\.toLocaleString\("ko-KR"\)\}` : "견적 후 확정"/);
    expect(src).toMatch(/\{priceUnknownCount\}건 가격 미정/);
    expect(src).toMatch(/data-testid="quote-bar-total"/);
  });
});

describe("§11.338 Part B — cart 스키마 버전(잔존 정리)", () => {
  it("STORAGE_KEY v2 + legacy 키 목록", () => {
    const src = read(PROVIDER);
    // canonical key 는 lib/quote/quote-cart-storage 의 QUOTE_CART_STORAGE_KEY(="quote-cart-storage-v2") SSOT 참조.
    expect(src).toMatch(/STORAGE_KEY = QUOTE_CART_STORAGE_KEY/);
    expect(src).toMatch(/from "@\/lib\/quote\/quote-cart-storage"/);
    expect(src).toMatch(/LEGACY_STORAGE_KEYS = \["quote-cart-storage"\]/);
  });
  it("복원 시 구버전 키 removeItem", () => {
    const src = read(PROVIDER);
    expect(src).toMatch(/for \(const k of LEGACY_STORAGE_KEYS\)/);
    expect(src).toMatch(/localStorage\.removeItem\(k\)/);
  });
});

describe("§11.338 회귀 0 — 우측 패널 기존 정상 동작 보존", () => {
  it("product-detail-summary '가격 문의 필요' 보존", () => {
    const src = read("src/app/_workbench/_components/product-detail-summary.tsx");
    expect(src).toMatch(/가격 문의 필요/);
    expect(src).toMatch(/견적 시 안내/);
  });
});

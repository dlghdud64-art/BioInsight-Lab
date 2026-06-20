/**
 * §product-detail PD-D (§09) — 견적함 정직 트레이바
 *
 * 지시문 §09. 견적함 담긴 항목 시 하단 고정 바 + 견적 진행(실재 /dashboard/quotes).
 *   ★ 정직: 비교 결과 화면(/test) 부재 → "비교표 열기" dead button 금지 → 견적함만.
 *   count 0 = 노출 0. 비우기 = 실제 clear. 데스크탑 전용(모바일 기존 바 충돌 방지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const TRAY = root("components/products/quote-tray-bar.tsx");
const PAGE = root("app/products/[id]/page.tsx");

describe("§product-detail PD-D(§09) — 견적함 트레이(정직)", () => {
  it("count 0 노출 0 + quote-cart-storage 단일 출처", () => {
    expect(TRAY).toMatch(/export function QuoteTrayBar/);
    expect(TRAY).toMatch(/readQuoteCart\(\)\.length/);
    expect(TRAY).toMatch(/if \(count === 0\) return null/);
  });
  it("견적 진행 = 실재 /dashboard/quotes (dead button 0)", () => {
    expect(TRAY).toMatch(/href="\/dashboard\/quotes"/);
    expect(TRAY).toMatch(/견적 진행/);
  });
  it("비교표 열기 dead button 없음(비교 destination 부재 → 견적함만)", () => {
    expect(TRAY).not.toMatch(/비교표/);
  });
  it("비우기 = 실제 clear + 데스크탑 전용", () => {
    expect(TRAY).toMatch(/removeItem\(QUOTE_CART_STORAGE_KEY\)/);
    expect(TRAY).toMatch(/hidden lg:flex/);
  });
});

describe("§product-detail PD-D — page 배선", () => {
  it("QuoteTrayBar import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ QuoteTrayBar \}/);
    expect(PAGE).toMatch(/<QuoteTrayBar \/>/);
  });
  it("견적 담기 시 cart-changed 이벤트 dispatch(트레이 갱신)", () => {
    expect(PAGE).toMatch(/dispatchEvent\(new Event\("quote-cart-changed"\)\)/);
  });
});

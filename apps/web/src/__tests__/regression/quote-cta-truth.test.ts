/**
 * #quote-cta-truth — 상세 "견적 담기" fake success 수리 + 견적 truth 승계 sentinel
 *   (§번호 호영님 배정 대기 — PLAN_quote-cta-truth.md)
 *
 * 호영님 결정 (2026-06-11):
 *   - 견적함 canonical = provider quoteItems + localStorage("quote-cart-storage-v2")
 *   - 결선 = ⓐ 저장소 합류: 상세가 동일 순수함수(computeAddToQuote) + 동일 키 경유
 *
 * 계약:
 *   - lib/quote/quote-cart-storage.ts — 키·read/add 단일 출처 (fetch 0, 순수 storage 계층)
 *   - provider 는 키 literal 을 공유 lib 에서 import (기록자 2곳이어도 키·로직 단일)
 *   - 상세 CTA: GET-only fake success 제거 → addToQuoteCart 결과 조건부 toast
 *   - 상세 배지: "견적함에 포함됨" (동일 truth read) — §1-2⑤ ③ deferred 해소
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const STORAGE_LIB = "src/lib/quote/quote-cart-storage.ts";
const PROVIDER = "src/app/_workbench/_components/test-flow-provider.tsx";
const DETAIL = "src/app/products/[id]/page.tsx";

describe("#quote-cta-truth — 저장 계층 단일 출처", () => {
  it("quote-cart-storage lib 존재 + 키·read·add export + fetch 0", () => {
    expect(existsSync(join(REPO_ROOT, STORAGE_LIB))).toBe(true);
    const src = read(STORAGE_LIB);
    expect(src).toMatch(/QUOTE_CART_STORAGE_KEY\s*=\s*"quote-cart-storage-v2"/);
    expect(src).toMatch(/export function readQuoteCart/);
    expect(src).toMatch(/export function addToQuoteCart/);
    expect(src).toMatch(/computeAddToQuote/);
    expect(src).not.toMatch(/fetch\(/);
  });

  it("provider — 키 literal 을 공유 lib import 로 교체 (단일 출처)", () => {
    const src = read(PROVIDER);
    expect(src).toMatch(/QUOTE_CART_STORAGE_KEY/);
    expect(src).not.toMatch(/STORAGE_KEY\s*=\s*"quote-cart-storage-v2"/);
  });
});

describe("#quote-cta-truth — 상세 CTA 정직화", () => {
  it("GET-only fake success 패턴 제거", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/fetch\(`\/api\/products\/\$\{id\}`\)[\s\S]{0,400}견적 담기 완료/);
  });

  it("addToQuoteCart 실 결선 + 결과 조건부 toast", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/addToQuoteCart\(/);
    expect(src).toMatch(/result\.ok/);
  });

  it("견적함 포함 배지 — 동일 truth read (§1-2⑤ ③ deferred 해소)", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/견적함에 포함됨/);
    expect(src).toMatch(/readQuoteCart/);
  });
});

describe("#quote-cta-truth — 회귀 0", () => {
  it("provider addProductToQuote·computeAddToQuote 경로 보존", () => {
    const src = read(PROVIDER);
    expect(src).toMatch(/const addProductToQuote = \(/);
    expect(src).toMatch(/computeAddToQuote\(\{/);
  });

  it("computeAddToQuote lib 무변경 보존", () => {
    expect(existsSync(join(REPO_ROOT, "src/lib/quote/add-product-to-quote.ts"))).toBe(true);
  });

  it("상세 — 비교 배지(§1-2⑤)·비교 추가 라벨 보존", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/비교에 포함됨/);
    expect(src).toMatch(/비교 추가/);
  });
});

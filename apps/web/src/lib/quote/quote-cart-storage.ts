/**
 * #quote-cta-truth — 견적함(장바구니) 저장 계층 단일 출처
 *
 * 호영님 결정 (2026-06-11, ⓐ 저장소 합류):
 *   견적함 canonical = test-flow-provider quoteItems + localStorage 영속.
 *   provider 경계 밖 surface(제품 상세 등)가 동일 키·동일 순수함수
 *   (computeAddToQuote)를 경유해 같은 truth 에 합류한다 — 키/로직 단일 출처.
 *
 * 순수 storage 계층: 네트워크 0, mutation 은 localStorage 한정.
 * 서버 영속은 견적 요청 생성(POST /api/quotes) 단계부터 — 본 lib 스코프 밖.
 */

import { computeAddToQuote, type ComputeAddToQuoteResult } from "./add-product-to-quote";

export const QUOTE_CART_STORAGE_KEY = "quote-cart-storage-v2";

export function readQuoteCart(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(QUOTE_CART_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQuoteCart(items: any[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length > 0) {
      localStorage.setItem(QUOTE_CART_STORAGE_KEY, JSON.stringify(items));
    } else {
      localStorage.removeItem(QUOTE_CART_STORAGE_KEY);
    }
  } catch {
    // storage 불가(시크릿 모드 quota 등) — 호출부가 result 로 판단
  }
}

/**
 * 견적함에 제품 추가 — read → computeAddToQuote(단일 로직) → write.
 * provider 와 동일 순수함수 경유로 아이템 shape·중복 정책 drift 0.
 */
export function addToQuoteCart(product: any, vendorId?: string): ComputeAddToQuoteResult {
  const currentItems = readQuoteCart();
  const result = computeAddToQuote({ product, vendorId, currentItems });
  if (result.ok) {
    writeQuoteCart(result.nextItems);
  }
  return result;
}

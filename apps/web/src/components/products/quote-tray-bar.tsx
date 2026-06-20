"use client";

/**
 * §product-detail PD-D (§09) — 견적함 정직 트레이바
 *
 * 지시문 §09. 담긴 항목이 있으면 하단 고정 바에 개수 + 다음 흐름(견적 진행).
 *   ★ 정직: 비교 결과 화면(/test 플로우)이 현재 없어 비교 열기 CTA는 dead button →
 *     본 트레이는 견적함만(실재 라우트 /dashboard/quotes). 비교 트레이는 destination
 *     생긴 뒤 별도(fake handoff 금지).
 *   - count 0 = 노출 0(빈 트레이 금지). 비우기 = 실제 cart clear.
 *   - 데스크탑(lg+) 전용 — 모바일은 기존 하단 "견적 담기" 바와 충돌 방지.
 *   - canonical: quote-cart-storage 단일 출처(읽기 전용 표시 + 비우기).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { readQuoteCart, QUOTE_CART_STORAGE_KEY } from "@/lib/quote/quote-cart-storage";
import { ShoppingCart, ArrowRight, X } from "lucide-react";

export function QuoteTrayBar() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => setCount(readQuoteCart().length), []);

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("quote-cart-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("quote-cart-changed", refresh);
    };
  }, [refresh]);

  if (count === 0) return null; // 빈 트레이 노출 0(정직)

  const clear = () => {
    try {
      localStorage.removeItem(QUOTE_CART_STORAGE_KEY);
    } catch {
      /* storage 불가 — no-op */
    }
    window.dispatchEvent(new Event("quote-cart-changed"));
  };

  return (
    <div className="hidden lg:flex fixed bottom-0 left-0 right-0 z-40 items-center justify-center px-6 py-2.5 bg-slate-900/95 backdrop-blur text-white shadow-lg">
      <div className="flex items-center gap-4 w-full max-w-5xl">
        <div className="flex items-center gap-2 text-sm">
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold">견적함 {count}건</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2 py-1"
          >
            <X className="h-3 w-3" aria-hidden="true" /> 비우기
          </button>
          <Link
            href="/dashboard/quotes"
            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg"
          >
            견적 진행 <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

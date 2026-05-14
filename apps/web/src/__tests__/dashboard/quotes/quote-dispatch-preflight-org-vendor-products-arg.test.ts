/**
 * #quote-dispatch-preflight-org-vendor-products-arg — P0 production hot fix.
 *
 * 호영님 production 마찰 (2026-05-11 21:10 KST):
 *   "전체 선택 누르면 에러가 뜬다"
 *   Console: ReferenceError: organizationVendorProducts is not defined
 *     at getQuoteDispatchPreflight
 *     at QuotesPageContent (useMemo)
 *   Result: 일시적인 오류 발생 페이지 fallback UI.
 *
 * Root cause:
 *   - getQuoteDispatchPreflight (module scope function, line 274) 시그니처가
 *     (q, organizationVendors) 2 인자만.
 *   - 함수 body line 293 에서 `organizationVendorProducts` 3rd 변수 참조.
 *   - 함수가 module scope 이므로 QuotesPageContent component 안 useMemo
 *     `organizationVendorProducts` (line 843) closure 불가.
 *   - "전체 선택" 클릭 시 dispatchableCount useMemo (line 1097~) 가 모든
 *     quote 에 대해 getQuoteDispatchPreflight 호출 → runtime ReferenceError.
 *
 * Vercel build pass 이유:
 *   - next.config typescript.ignoreBuildErrors=true (예상). tsc error
 *     발생했지만 deploy 통과. lazy evaluation 으로 함수 호출되기 전까진
 *     trigger 안 됨.
 *
 * Minimal-Diff Resolution:
 *   - 함수 시그니처 3rd 인자 `organizationVendorProducts` 추가 (default []).
 *   - 3 caller (line 941, 1106, 2231) 모두 forward.
 *
 * canonical truth lock:
 *   - resolveSuppliers spec 변경 0 (이미 organizationVendorProducts 받음).
 *   - QuotesPageContent useMemo (line 843) 변경 0.
 *   - 기존 §11.221 / §11.222 / §11.223 / §11.224 cluster invariant 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-dispatch-preflight-org-vendor-products-arg — 시그니처 확장", () => {
  it("getQuoteDispatchPreflight 시그니처에 organizationVendorProducts 인자 정의", () => {
    // function getQuoteDispatchPreflight(q, organizationVendors, organizationVendorProducts) {...}
    expect(page).toMatch(
      /function getQuoteDispatchPreflight\([\s\S]{0,800}organizationVendorProducts[\s\S]{0,200}vendorId[\s\S]{0,80}productId/,
    );
  });

  it("organizationVendorProducts 인자 default 빈 array (backward compat)", () => {
    // default [] — caller 가 인자 안 줘도 동작 (vendor-catalog 미등록 조직 정합).
    expect(page).toMatch(
      /function getQuoteDispatchPreflight\([\s\S]{0,1200}organizationVendorProducts[\s\S]{0,300}=\s*\[\]/,
    );
  });
});

describe("#quote-dispatch-preflight-org-vendor-products-arg — 3 caller forward", () => {
  it("selectedQuote caller (single quote preflight) — 3 인자", () => {
    // line 941 근처 — getQuoteDispatchPreflight(selectedQuote, organizationVendors, organizationVendorProducts)
    expect(page).toMatch(
      /getQuoteDispatchPreflight\(\s*selectedQuote,\s*organizationVendors,\s*organizationVendorProducts/,
    );
  });

  it("dispatchableCount caller (bulk preflight, line 1097~) — 3 인자", () => {
    // for-each quote 안에서 호출. 변수명 q.
    expect(page).toMatch(
      /getQuoteDispatchPreflight\(\s*q,\s*organizationVendors,\s*organizationVendorProducts/,
    );
  });

  it("BatchSheet getPreflight prop (line 2231) — 3 인자", () => {
    // (q: Quote) => getQuoteDispatchPreflight(q, organizationVendors, organizationVendorProducts)
    // 3 인자 패턴이 page 전체에서 2번 이상 나옴 (dispatchableCount + BatchSheet).
    const matches = page.match(/getQuoteDispatchPreflight\(\s*q,\s*organizationVendors,\s*organizationVendorProducts/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("2 인자 caller (organizationVendorProducts 누락) 잔존하지 않음 — drift sentinel", () => {
    // getQuoteDispatchPreflight(... organizationVendors) 직후 ) 만 오는 패턴 부재.
    // 즉 `organizationVendors)` (단순 닫힘) 가 함수 호출 종료가 아닌 patten 만 허용.
    expect(page).not.toMatch(
      /getQuoteDispatchPreflight\(\s*[\w.]+,\s*organizationVendors\s*\)/,
    );
  });
});

describe("#quote-dispatch-preflight-org-vendor-products-arg — invariant 보존", () => {
  it("resolveSuppliers 가 여전히 organizationVendorProducts 받음", () => {
    expect(page).toMatch(
      /resolveSuppliers\(\{[\s\S]{0,200}organizationVendorProducts/,
    );
  });

  it("QuotesPageContent 안 organizationVendorProducts useMemo (line 843~) 보존", () => {
    expect(page).toMatch(
      /const organizationVendorProducts[\s\S]{0,200}useMemo/,
    );
  });

  it("organizationVendorProductsData fetch (line 831~) 보존", () => {
    expect(page).toMatch(/organizationVendorProductsData/);
    expect(page).toMatch(/\/api\/organization-vendor-products/);
  });

  it("§11.224 테이블 뷰 9 컬럼 + §11.223 RelativeDeliveryText 보존 (§11.230b dynamic 정합)", () => {
    expect(page).toMatch(/(<th[^>]{0,80}>가격<\/th>|price:\s*"가격")/);
    expect(page).toMatch(/(<th[^>]{0,80}>납기<\/th>|delivery:\s*"납기")/);
    expect(page).toMatch(/<RelativeDeliveryText/);
  });

  it("cluster trace marker (§11.225)", () => {
    expect(page).toMatch(/#quote-dispatch-preflight-org-vendor-products-arg|§11\.225|organizationVendorProducts.*인자/);
  });
});

/**
 * §price-currency-honesty (2026-09-17 · 릴레이 A안 승인) · **KRW 가 아닌 가격을 원화로 그리지 않는다.**
 *
 * ── 왜 ──
 * 검색 결과·상세가 `ProductVendor.priceInKRW` 를 무조건 원화로 그렸다. DMEM(USD 52)이 「72,000원 · VAT 별도」.
 *   prod 실측 2026-09-17(로컬 operator-shell → Supabase xhid… · SELECT only):
 *     가격 행 9개 전부 시드 리터럴 · 원화/원통화 비율 USD 1368.4~1384.6 제각각 · EUR 1540.5 → 환율·기준일 없음.
 *   환율 모듈(lib/api/exchange-rate.ts)은 prod 에 API 키가 없어 폴백 상수(6통화)를 쓰고, 폴백은 방향이 뒤집혀
 *   `/api/exchange-rates?from=USD&amount=52` → converted **0.039** (2026-09-17 prod 비로그인 GET).
 * 없는 환율로 원화를 단정하면 사용자가 그 숫자로 예산을 짠다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 표기 단일 출처(lib/pricing/display-price) — KRW 아닌 행은 원통화 그대로, 원화 금액은 KRW 행만.
 *   ② 살아 있는 가격 표면은 priceInKRW 를 원화로 직접 그리지 않고 단일 출처를 거친다.
 *   ③ 대체품 API 는 원통화 금액(price)을 통화와 함께 내려준다.
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. 표시가 아닌 **계산 축**. priceInKRW 를 원화로 읽는 곳이 워크벤치에 더 있다 — 비교 priceKRW
 *      (_workbench/search/page.tsx :535 :571 :797 :2293 · compare-review-work-window :126) · 견적 공유 단가
 *      (share-actions-card :73 :138) · 후보 카드 최저가(candidate-products-card :43) · 스펙 비교
 *      (sourcing-spec-compare-section :45). 오늘은 KRW 아닌 가격 행이 시드 9개뿐이라 D안(가격 행 삭제)
 *      판정 대기. 가격 데이터가 들어오면 이 목록부터 krwAmount 로 옮겨야 한다.
 *   2. 렌더 도달 불가 표면: _workbench/_components/search-result-item.tsx(importer 0) ·
 *      components/search/product-card.tsx(유일 호출자 app/search/SearchResultList.tsx 가 importer 0).
 *   3. lib/api/exchange-rate.ts 폴백 방향 오류 · lib/api/products.ts 의 priceInKRW 역기입(:307-315) — 별건.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { displayPrice, krwAmount, sourceCurrency, formatDisplayAmount } from "@/lib/pricing/display-price";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

describe("§price-currency-honesty ① 표기 단일 출처", () => {
  it("KRW 아닌 행은 원통화 그대로 · 원화 금액 없음 (DMEM 실측 행)", () => {
    const dmem = { price: 52, currency: "USD", priceInKRW: 72000 };
    expect(displayPrice(dmem)).toEqual({ amount: 52, currency: "USD" });
    expect(krwAmount(dmem)).toBeNull();
    expect(formatDisplayAmount(displayPrice(dmem)!)).toBe("52");
  });

  it("KRW 행은 원화 · priceInKRW 우선, 없으면 price", () => {
    expect(displayPrice({ price: 50000, currency: "KRW", priceInKRW: 55000 })).toEqual({ amount: 55000, currency: "KRW" });
    expect(krwAmount({ price: 50000, currency: "KRW", priceInKRW: null })).toBe(50000);
    expect(formatDisplayAmount({ amount: 72000, currency: "KRW" })).toBe("₩72,000");
  });

  it("가격 없는 행은 null (「견적 필요」 로 떨어진다) · mp- 카탈로그 형태", () => {
    expect(displayPrice({ price: null, currency: "KRW", priceInKRW: null })).toBeNull();
    expect(displayPrice({ price: null, currency: "USD", priceInKRW: 72000 })).toBeNull();
    expect(displayPrice(undefined)).toBeNull();
  });

  it("통화 미기재는 스키마 기본값 KRW · 소문자 통화 정규화", () => {
    expect(sourceCurrency({ currency: null })).toBe("KRW");
    expect(sourceCurrency({ currency: "usd" })).toBe("USD");
  });
});

describe("§price-currency-honesty ② 살아 있는 가격 표면은 단일 출처를 거친다", () => {
  const ROW = "app/_workbench/_components/sourcing-result-row.tsx";
  const SUMMARY = "app/_workbench/_components/product-detail-summary.tsx";
  const PAGE = "app/products/[id]/page.tsx";

  it("검색 결과 행 · 상세 요약은 priceInKRW 를 직접 읽지 않는다", () => {
    for (const rel of [ROW, SUMMARY]) {
      const src = code(rel);
      expect(src, `${rel} · priceInKRW 직접 사용`).not.toMatch(/priceInKRW/);
      expect(src, `${rel} · 단일 출처 미사용`).toMatch(/displayPrice\s*\(/);
      expect(src, `${rel} · 통화를 KRW 로 고정`).not.toMatch(/<PriceDisplay[^>]*currency="KRW"/);
    }
  });

  it("제품 상세 페이지는 priceInKRW 를 원화 글자로 그리지 않는다", () => {
    const src = code(PAGE);
    expect(src).not.toMatch(/₩\{[^}]*priceInKRW/);
    expect(src).not.toMatch(/priceInKRW\s*\.\s*toLocaleString/);
    expect(src).not.toMatch(/const minPrice = [^;]*priceInKRW/);
    expect(src).toMatch(/displayPrice\(pv\)/);
    expect(src).toMatch(/displayPrice\(vendors\[0\]\)/);
    expect(src).toMatch(/displayPrice\(alt\.vendors\?\.\[0\]\)/);
  });

  it("검색 결과 행의 원화 임계값(고가·예산 검토)은 KRW 행만 본다", () => {
    const src = code(ROW);
    expect(src).toMatch(/const unitPrice = krwAmount\(vendor\)/);
    expect(src).toMatch(/buildOperatingSignals\(product, vendor, unitPrice\)/);
  });
});

describe("§price-currency-honesty ③ 대체품 API 는 원통화 금액을 함께 내려준다", () => {
  it("vendors 매핑에 price 와 currency 가 같이 있다", () => {
    const src = code("app/api/products/[id]/alternatives/route.ts");
    expect(src).toMatch(/price: v\.price \?\? undefined,\s*currency: v\.currency/);
  });
});

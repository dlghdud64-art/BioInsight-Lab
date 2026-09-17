/**
 * §price-currency-honesty (2026-09-17 · 릴레이 A안 승인) — 공급사 가격을 **어느 통화로 보여줄지**의 단일 출처.
 *
 * ── 왜 ──
 * 검색·상세 화면이 `ProductVendor.priceInKRW` 를 무조건 `currency="KRW"` 로 그렸다. 그런데 그 열은
 * 환율로 계산된 값이 아니라 시드 작성자가 손으로 적은 수였다(prod 실측 2026-09-17: USD 행 비율
 * 1368.4~1384.6 제각각 · EUR 1540.5). 환율·기준일이 어디에도 없으니 「72,000원」 은 근거 없는 원화 단정이다.
 * 게다가 환율 모듈(lib/api/exchange-rate.ts)은 prod 에 API 키가 없어 폴백 상수를 쓰고, 그 폴백은
 * 방향이 뒤집혀 있다(prod `/api/exchange-rates?from=USD&amount=52` → converted 0.039).
 *
 * ── 규칙 ──
 *   원통화가 KRW  → 원화로 보여준다(priceInKRW 우선, 없으면 price).
 *   원통화가 KRW 아님 → **원통화 그대로** 보여준다(USD 52). 원화 환산값은 그리지 않는다.
 *   원화 금액이 필요한 계산(고가 후보·예산 검토 임계값)은 `krwAmount` 만 쓴다 → KRW 아닌 행은 null.
 * 계약: __tests__/regression/price-currency-honesty.test.ts
 */

export interface VendorPriceLike {
  price?: number | null;
  currency?: string | null;
  priceInKRW?: number | null;
}

export interface DisplayPrice {
  amount: number;
  currency: string;
}

/** 원통화 · 값이 없으면 스키마 기본값(KRW)으로 읽는다 */
export function sourceCurrency(v: VendorPriceLike | null | undefined): string {
  const c = (v?.currency ?? "").trim().toUpperCase();
  return c === "" ? "KRW" : c;
}

/** 원화 금액 — **원통화가 KRW 일 때만**. 환산 근거가 없는 원화 값은 돌려주지 않는다. */
export function krwAmount(v: VendorPriceLike | null | undefined): number | null {
  if (!v || sourceCurrency(v) !== "KRW") return null;
  if (typeof v.priceInKRW === "number" && v.priceInKRW > 0) return v.priceInKRW;
  if (typeof v.price === "number" && v.price > 0) return v.price;
  return null;
}

/** 화면에 그릴 가격 — KRW 는 원화, 그 외는 원통화 그대로 */
export function displayPrice(v: VendorPriceLike | null | undefined): DisplayPrice | null {
  if (!v) return null;
  const currency = sourceCurrency(v);
  if (currency === "KRW") {
    const amount = krwAmount(v);
    return amount === null ? null : { amount, currency };
  }
  return typeof v.price === "number" && v.price > 0 ? { amount: v.price, currency } : null;
}

/** 금액 글자 — KRW 는 ₩ 접두, 그 외는 숫자만(통화 코드는 옆에 따로 붙인다) */
export function formatDisplayAmount(dp: DisplayPrice): string {
  return dp.currency === "KRW"
    ? `₩${dp.amount.toLocaleString("ko-KR")}`
    : dp.amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

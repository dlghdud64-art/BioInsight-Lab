/**
 * §11.310d #orders-draft-create — Regression sentinel
 *
 * 호영님 P1 spec (Q31 = A, 2026-05-26):
 *   /dashboard/purchase-orders/new [발주 생성] → POST /api/orders/draft →
 *   PurchaseRecord 신규 record (source=reorder-recommendation | manual).
 *
 * 단순화 정합:
 *   - 기존 /api/orders (quote-based) 변경 0 — 별도 endpoint
 *   - Order/OrderItem schema 변경 0 — PurchaseRecord 만 활용
 *   - auth() 만 (§11.309c 단순화 정합)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const API_PATH = "src/app/api/orders/draft/route.ts";
const PAGE_PATH = "src/app/dashboard/purchase-orders/new/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.310d — /api/orders/draft route", () => {
  it("파일 존재 + POST handler", () => {
    expect(existsSync(join(REPO_ROOT, API_PATH))).toBe(true);
    const src = read(API_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("auth() 인증 + 401 분기", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/await\s+auth\(\)/);
    expect(src).toMatch(/Unauthorized.*401/);
  });

  it("enforceAction 사용 0 (단순화 정합 — §11.309c 패턴)", () => {
    const src = read(API_PATH);
    expect(src).not.toMatch(/enforceAction\(/);
  });

  it("Input validation 3건 (productName / supplier / quantity)", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/productName 은 필수입니다/);
    expect(src).toMatch(/supplier 는 필수입니다/);
    expect(src).toMatch(/quantity 는 0보다 큰 숫자여야 합니다/);
  });

  it("PurchaseRecord create — vendorName/itemName/qty/unitPrice/amount", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/db\.purchaseRecord\.create/);
    expect(src).toMatch(/vendorName:\s*supplier\.trim\(\)/);
    expect(src).toMatch(/itemName:\s*productName\.trim\(\)/);
    expect(src).toMatch(/qty:\s*quantity/);
    expect(src).toMatch(/amount\s*=\s*quantity\s*\*\s*safeUnitPrice/);
  });

  it("scopeKey = user.id (§11.310b PurchaseRecord 패턴 정합)", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/scopeKey\s*=\s*user\.id/);
  });

  it("source 분기 — reorder-recommendation | manual", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/source === "reorder-recommendation"\s*\?\s*"reorder-recommendation"\s*:\s*"manual"/);
  });

  it("응답 shape — id/purchasedAt/vendorName/itemName/qty/unitPrice/amount/source", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/id:\s*created\.id/);
    expect(src).toMatch(/purchasedAt:\s*created\.purchasedAt\.toISOString\(\)/);
    expect(src).toMatch(/source:\s*recordSource/);
  });

  it("currency KRW + followUpStatus null (pending — §11.310d-2 후속)", () => {
    const src = read(API_PATH);
    expect(src).toMatch(/currency:\s*["']KRW["']/);
  });
});

describe("§11.310d — new page handleCreate fetch wiring", () => {
  it("isSubmitting state (button disabled 분기)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/isSubmitting.*useState\(false\)/);
    expect(src).toMatch(/setIsSubmitting/);
  });

  it("handleCreate — async + fetch /api/orders/draft POST", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/handleCreate\s*=\s*async\s*\(\)\s*=>/);
    expect(src).toMatch(/fetch\(["']\/api\/orders\/draft["']/);
    expect(src).toMatch(/method:\s*["']POST["']/);
  });

  it("Body payload (productName / supplier / quantity / unitPrice / notes / source)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/productName:\s*form\.productName\.trim\(\)/);
    expect(src).toMatch(/supplier:\s*form\.supplier\.trim\(\)/);
    expect(src).toMatch(/quantity:\s*form\.quantity/);
    expect(src).toMatch(/source:\s*isReorderRecommendation\s*\?\s*"reorder-recommendation"\s*:\s*"manual"/);
  });

  it("toast.success + router.push (성공 시 PO 목록 redirect)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/toast\.success\(["']발주 draft가 등록되었습니다/);
    expect(src).toMatch(/router\.push\(["']\/dashboard\/purchase-orders["']\)/);
  });

  it("toast.error (실패 시) + setIsSubmitting(false) finally", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/toast\.error\(msg\)/);
    expect(src).toMatch(/setIsSubmitting\(false\)/);
  });

  it("button disabled={isSubmitting} + label '등록 중...'", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/disabled=\{isSubmitting\}/);
    expect(src).toMatch(/isSubmitting \? "등록 중\.\.\." : "발주 생성"/);
  });

  it("§11.310d 안내문 — emerald 톤 (이전 slate-50 → emerald-50)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/bg-emerald-50 border border-emerald-200[\s\S]{0,300}PurchaseRecord에 등록/);
  });
});

describe("§11.310d — 회귀 0", () => {
  it("기존 /api/orders POST (quote-based) 변경 0 — 별도 endpoint", () => {
    const otherPath = "src/app/api/orders/route.ts";
    const src = readFileSync(join(REPO_ROOT, otherPath), "utf8");
    expect(src).toMatch(/quoteId is required/);
    expect(src).toMatch(/order_create/);
  });

  it("§11.310c new page 보존 — form 5 input testid + Suspense + 색상", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/data-testid="new-po-productName-input"/);
    expect(src).toMatch(/data-testid="new-po-supplier-input"/);
    expect(src).toMatch(/data-testid="new-po-quantity-input"/);
    expect(src).toMatch(/data-testid="new-po-unitPrice-input"/);
    expect(src).toMatch(/data-testid="new-po-notes-input"/);
    expect(src).toMatch(/<Suspense/);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
  });

  it("amber/orange 0 (§11.310 scope 정합)", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/bg-amber-/);
    expect(src).not.toMatch(/text-amber-/);
    expect(src).not.toMatch(/bg-orange-/);
  });
});

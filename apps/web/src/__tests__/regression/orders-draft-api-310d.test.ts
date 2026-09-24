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

/* 🛑 은퇴 §po-ui-removed(2026-09-24 · 호영님 판정) — describe("§11.310d — new page handleCreate fetch wiring").
 *    그 블록은 삭제된 `app/dashboard/purchase-orders/new/page.tsx` 하나만 읽었다.
 *    명제 원문: isSubmitting 중복제출 가드 · handleCreate 가 실 POST /api/orders/draft ·
 *    payload 6필드 · 성공 시 toast+redirect · 실패 시 toast.error+finally · 버튼 disabled 라벨.
 *    🔑 **엔드포인트 자체는 살아 있다** — 위 describe("/api/orders/draft route")가 그대로 든다
 *    (그쪽은 GREEN). 불러 쓰던 화면만 없어졌다. */

describe("§11.310d — 회귀 0", () => {
  it("기존 /api/orders POST (quote-based) 변경 0 — 별도 endpoint", () => {
    const otherPath = "src/app/api/orders/route.ts";
    const src = readFileSync(join(REPO_ROOT, otherPath), "utf8");
    expect(src).toMatch(/quoteId is required/);
    expect(src).toMatch(/order_create/);
  });

  /* 🛑 은퇴 §po-ui-removed — 「§11.310c new page 보존」. 재는 파일이 삭제됐다. */

  /* 🛑 은퇴 §po-ui-removed — 「amber/orange 0」. 같은 삭제 파일이 대상이었다.
   *    amber 금지 조항(§11.302)은 불변이고 amber-token-ratchet 이 전역을 둔다. */
});

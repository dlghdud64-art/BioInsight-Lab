/**
 * #post-approval-purchase-order-flow Phase 2.1 — RED→GREEN test
 *
 * vendor 별 PO PDF 생성 route + helper. 결재 통과 후 자동 생성된 vendor 별
 * Order 의 발주서를 한글 PDF 로 생성. storage upload + Order.poDocumentUrl
 * 매핑은 별도 mini-batch (Phase 2.3) — 본 batch 는 PDF stream 반환만.
 *
 * canonical truth = Order (DB). PDF 는 derived projection (snapshot) —
 * actual Order 를 PDF 로 변환만 하고 actual data 변경 0.
 *
 * Lock:
 *   - auth + ownership (Order.userId 또는 organizationMember)
 *   - Order.id 기반 fetch (vendor / items / orderNumber 포함)
 *   - 한글 폰트 임베드 (Pretendard 또는 NotoSansKR)
 *   - audit log createAuditLog (eventType SETTINGS_CHANGED, action: pdf_generate)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/orders/[id]/generate-pdf/route.ts";
const HELPER = "src/lib/orders/po-pdf-generator.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function exists(rel: string): boolean {
  return existsSync(join(REPO_ROOT_WEB, rel));
}

describe("#post-approval-purchase-order-flow Phase 2.1 — PDF route", () => {
  it("`/api/orders/[id]/generate-pdf/route.ts` 신규 file 존재", () => {
    expect(exists(ROUTE)).toBe(true);
  });

  it("POST handler + auth + ownership 검증", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/userId|organizationMember/);
  });

  it("Order fetch — id + vendor + items 포함", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/db\.order\.findUnique|db\.order\.findFirst/);
    expect(src).toMatch(/include[\s\S]*?items[\s\S]*?vendor|include[\s\S]*?vendor[\s\S]*?items/);
  });

  it("PDF helper 호출 + Buffer/Uint8Array 응답 (Content-Type: application/pdf)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/generatePoPdf|generatePOPdf|generatePurchaseOrderPdf/);
    expect(src).toMatch(/application\/pdf/);
  });

  it("audit log createAuditLog 호출 (action: pdf_generate)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/pdf_generate|pdf_generated|PDF_GENERATED/);
  });
});

describe("#post-approval-purchase-order-flow Phase 2.1 — PDF helper", () => {
  it("`lib/orders/po-pdf-generator.ts` 신규 file 존재", () => {
    expect(exists(HELPER)).toBe(true);
  });

  it("`generatePoPdf` (또는 동등 함수) export — Buffer/Uint8Array 반환", () => {
    const src = read(HELPER);
    expect(src).toMatch(/export\s+(async\s+)?function\s+(generatePoPdf|generatePOPdf|generatePurchaseOrderPdf)/);
    expect(src).toMatch(/Buffer|Uint8Array/);
  });

  it("한글 폰트 임베드 — Pretendard 또는 NotoSansKR 또는 한글 지원 명시", () => {
    const src = read(HELPER);
    expect(src).toMatch(/Pretendard|NotoSansKR|NanumGothic|registerFont|한글/);
  });

  it("Order detail 렌더링 — orderNumber / totalAmount / vendor 표시", () => {
    const src = read(HELPER);
    expect(src).toMatch(/orderNumber/);
    expect(src).toMatch(/totalAmount|총\s*액|합계/);
    expect(src).toMatch(/vendor/);
  });

  it("OrderItem 표 렌더링 — name / quantity / unitPrice / lineTotal", () => {
    const src = read(HELPER);
    expect(src).toMatch(/items\.map|items\.forEach|for\s*\(\s*const\s+item/);
    expect(src).toMatch(/quantity/);
    expect(src).toMatch(/unitPrice|lineTotal/);
  });
});

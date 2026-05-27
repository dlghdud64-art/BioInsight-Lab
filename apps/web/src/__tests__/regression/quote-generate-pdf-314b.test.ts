/**
 * §11.314-b #quote-generate-pdf — Regression sentinel (backend b-1)
 *
 * 호영님 §11.308 확인요청 → 옵션 C (PDF + mailto MVP):
 *   견적 요청서 PDF generator + generate-pdf route.
 *   order PDF 인프라(po-pdf-generator / orders generate-pdf) 패턴 복제.
 *
 * b-1 scope (backend): lib generator + API route.
 * b-2 (client wiring: 전송 버튼 PDF 다운로드 + mailto) 후속.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const GEN_PATH = "src/lib/quotes/quote-request-pdf-generator.ts";
const ROUTE_PATH = "src/app/api/quotes/[id]/generate-pdf/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.314-b — quote-request-pdf-generator", () => {
  it("파일 존재 + generateQuoteRequestPdf export", () => {
    expect(existsSync(join(REPO_ROOT, GEN_PATH))).toBe(true);
    const src = read(GEN_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+generateQuoteRequestPdf/);
  });

  it("pdfkit + Pretendard 한글 폰트 임베드 (fallback Helvetica)", () => {
    const src = read(GEN_PATH);
    expect(src).toMatch(/import PDFDocument from "pdfkit"/);
    expect(src).toMatch(/PretendardVariable\.ttf/);
    expect(src).toMatch(/doc\.font\("Helvetica"\)/);
  });

  it("견적 요청서 헤더 + 회신기한 + 요청품목 표", () => {
    const src = read(GEN_PATH);
    expect(src).toMatch(/견적 요청서 \(Quote Request\)/);
    expect(src).toMatch(/회신 기한/);
    expect(src).toMatch(/요청 품목/);
  });

  it("견적가 란 비움 (공급사 회신 시 작성 — 단가 미기재)", () => {
    const src = read(GEN_PATH);
    expect(src).toMatch(/견적가/);
    expect(src).toMatch(/견적가 란에 품목별 단가를 기재하여 회신/);
  });

  it("input shape — quote items (productName/brand/catalog/spec/grade/qty/notes)", () => {
    const src = read(GEN_PATH);
    expect(src).toMatch(/productName:\s*string/);
    expect(src).toMatch(/specification:\s*string \| null/);
    expect(src).toMatch(/grade:\s*string \| null/);
  });
});

describe("§11.314-b — generate-pdf route", () => {
  it("파일 존재 + GET/POST handler (mobile expo-file-system 호환)", () => {
    expect(existsSync(join(REPO_ROOT, ROUTE_PATH))).toBe(true);
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
    expect(src).toMatch(/return POST\(request, context\)/);
  });

  it("auth + 3-source ownership (owner / org member / guestKey)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/await auth\(\)/);
    expect(src).toMatch(/quote\.userId === session\.user\.id/);
    expect(src).toMatch(/isOrgMember/);
    expect(src).toMatch(/quote\.guestKey/);
    expect(src).toMatch(/Forbidden.*403|403.*Forbidden/);
  });

  it("QuoteItem productId → Product 조회 + 매핑 (productMap)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.product\.findMany/);
    expect(src).toMatch(/productMap/);
    expect(src).toMatch(/generateQuoteRequestPdf/);
  });

  it("PDF stream 반환 (application/pdf + attachment)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/"Content-Type":\s*"application\/pdf"/);
    expect(src).toMatch(/Content-Disposition.*attachment/);
  });

  it("audit log graceful (SETTINGS_CHANGED + quote_pdf_generate)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/eventType:\s*"SETTINGS_CHANGED"/);
    expect(src).toMatch(/action:\s*"quote_pdf_generate"/);
    expect(src).toMatch(/\.catch\(\(\)\s*=>/);
  });

  it("quote not found 404 분기", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/Quote not found.*404|404.*Quote not found/);
  });
});

describe("§11.314-b — 회귀 0 (기존 PDF 인프라 보존)", () => {
  it("order PDF generator 변경 0 (별도 file)", () => {
    const src = read("src/lib/orders/po-pdf-generator.ts");
    expect(src).toMatch(/generatePoPdf/);
    expect(src).toMatch(/발주서 \(Purchase Order\)/);
  });

  it("order generate-pdf route 변경 0", () => {
    const src = read("src/app/api/orders/[id]/generate-pdf/route.ts");
    expect(src).toMatch(/generatePoPdf/);
  });
});

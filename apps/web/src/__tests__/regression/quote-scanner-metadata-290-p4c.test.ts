/**
 * §11.290 Phase 4c #quote-scanner-metadata — parse-image + parse-pdf
 *   route ocrMetadata 응답 노출 + QuoteScannerModal NEW (skeleton).
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4a (route swap) + 4b (LabelScannerModal 강화) 완료 후 Phase 4c
 *   진입. 거래명세서 OCR scan trigger 위한 QuoteScannerModal NEW.
 *
 * Lock:
 *   - LabelScannerModal Phase 4b 패턴 복제 — ProviderBadge + CacheHitIndicator
 *   - parse-image + parse-pdf route 응답에 ocrMetadata field 추가
 *   - QuoteScannerModal 은 skeleton (simplified) — full review UI 는 Phase 4c-2
 *
 * Test scope:
 *   (1) parse-image/route.ts: ocrMetadata 응답 + outer scope retain
 *   (2) parse-pdf/route.ts: ocrMetadata 응답 + outer scope retain
 *   (3) QuoteScannerModal.tsx: 파일 존재 + ProviderBadge / CacheHitIndicator
 *       + 핵심 props (open / onOpenChange / onScanComplete?)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PARSE_IMAGE_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/quotes/parse-image/route.ts"),
  "utf8",
);

const PARSE_PDF_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/quotes/parse-pdf/route.ts"),
  "utf8",
);

const QUOTE_SCANNER_MODAL_PATH = resolve(
  __dirname,
  "../../components/inventory/QuoteScannerModal.tsx",
);

describe("§11.290 Phase 4c — parse-image/pdf ocrMetadata + QuoteScannerModal NEW", () => {
  // ─── (1) parse-image route ocrMetadata 응답 ───
  describe("/api/quotes/parse-image/route.ts", () => {
    it("§11.290 Phase 4c trace marker 존재", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/§11\.290 Phase 4c/);
    });

    it("ocrMetadata outer scope retain (let declaration)", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/let ocrMetadata/);
    });

    it("response JSON 에 ocrMetadata field 포함", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/ocrMetadata/);
    });

    it("pipelineResult metadata 3 field 보존 (jobId/providerUsed/cached)", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/jobId:\s*pipelineResult\.jobId/);
      expect(PARSE_IMAGE_ROUTE).toMatch(/providerUsed:\s*pipelineResult\.providerUsed/);
      expect(PARSE_IMAGE_ROUTE).toMatch(/cached:\s*pipelineResult\.cached/);
    });
  });

  // ─── (2) parse-pdf route ocrMetadata 응답 ───
  describe("/api/quotes/parse-pdf/route.ts", () => {
    it("§11.290 Phase 4c trace marker 존재", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/§11\.290 Phase 4c/);
    });

    it("ocrMetadata outer scope retain (let declaration)", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/let ocrMetadata/);
    });

    it("response JSON 에 ocrMetadata field 포함", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/ocrMetadata/);
    });

    it("pipelineResult metadata 3 field 보존", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/jobId:\s*pipelineResult\.jobId/);
      expect(PARSE_PDF_ROUTE).toMatch(/providerUsed:\s*pipelineResult\.providerUsed/);
      expect(PARSE_PDF_ROUTE).toMatch(/cached:\s*pipelineResult\.cached/);
    });
  });

  // ─── (3) QuoteScannerModal.tsx (NEW) ───
  describe("QuoteScannerModal.tsx (NEW)", () => {
    it("파일 존재 확인", () => {
      expect(existsSync(QUOTE_SCANNER_MODAL_PATH)).toBe(true);
    });

    it("§11.290 Phase 4c trace marker 존재", () => {
      const src = readFileSync(QUOTE_SCANNER_MODAL_PATH, "utf8");
      expect(src).toMatch(/§11\.290 Phase 4c/);
    });

    it("핵심 props (QuoteScannerModalProps interface)", () => {
      const src = readFileSync(QUOTE_SCANNER_MODAL_PATH, "utf8");
      expect(src).toMatch(/interface QuoteScannerModalProps/);
      expect(src).toMatch(/open:\s*boolean/);
      expect(src).toMatch(/onOpenChange:/);
    });

    it("ProviderBadge 컴포넌트 정의 (Phase 4b 패턴 복제)", () => {
      const src = readFileSync(QUOTE_SCANNER_MODAL_PATH, "utf8");
      expect(src).toMatch(/function ProviderBadge\(/);
    });

    it("CacheHitIndicator 컴포넌트 정의 (Phase 4b 패턴 복제)", () => {
      const src = readFileSync(QUOTE_SCANNER_MODAL_PATH, "utf8");
      expect(src).toMatch(/function CacheHitIndicator\(/);
    });

    it("data-testid='quote-scanner-modal' 존재 (Dialog 식별)", () => {
      const src = readFileSync(QUOTE_SCANNER_MODAL_PATH, "utf8");
      expect(src).toMatch(/data-testid=["']quote-scanner-modal["']/);
    });

    it("QuoteParseResult import (gemini-quote-parser type)", () => {
      const src = readFileSync(QUOTE_SCANNER_MODAL_PATH, "utf8");
      expect(src).toMatch(/QuoteParseResult.*from.*gemini-quote-parser/);
    });
  });
});

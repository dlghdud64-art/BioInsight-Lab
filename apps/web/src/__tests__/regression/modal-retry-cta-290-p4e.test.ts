/**
 * §11.290 Phase 4e #modal-retry-cta — LabelScannerModal + QuoteScannerModal
 *   review step 에 retry button + Phase 4d retry route 호출 handler 추가.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4d (retry + correct route NEW) 완료 후 Phase 4e 진입.
 *   2 modal 의 review step 에서 사용자가 confidence 낮은 결과 받았을 때
 *   재처리 trigger 가능 — Phase 4d route 의 첫 caller.
 *
 * Lock:
 *   - jobId (ocrMetadata.jobId) null 시 retry button disabled
 *   - 503 response 시 graceful (alert + state reset)
 *   - dead button 0 (jobId 존재할 때만 enabled, 503 안내 명확)
 *
 * Test scope:
 *   1. LabelScannerModal: data-testid="ocr-retry-button" 존재 + handler
 *   2. QuoteScannerModal: data-testid="ocr-retry-button" 존재 + handler
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

const QUOTE_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/QuoteScannerModal.tsx"),
  "utf8",
);

describe("§11.290 Phase 4e — modal retry CTA wiring", () => {
  // ─── (1) LabelScannerModal retry CTA ───
  describe("LabelScannerModal retry CTA", () => {
    it("§11.290 Phase 4e trace marker 존재", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/§11\.290 Phase 4e/);
    });

    it("data-testid='ocr-retry-button' 존재", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/data-testid=["']ocr-retry-button["']/);
    });

    it("retry handler — POST /api/ocr/retry path 호출", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/\/api\/ocr\/retry\//);
    });

    it("jobId 없으면 disabled — guard 존재", () => {
      // jobId 존재 여부 conditional check (disabled 또는 conditional render)
      expect(LABEL_SCANNER_MODAL).toMatch(/ocrMetadata\?\.jobId|jobId.*disabled|disabled.*jobId/);
    });
  });

  // ─── (2) QuoteScannerModal retry CTA ───
  describe("QuoteScannerModal retry CTA", () => {
    it("§11.290 Phase 4e trace marker 존재", () => {
      expect(QUOTE_SCANNER_MODAL).toMatch(/§11\.290 Phase 4e/);
    });

    it("data-testid='ocr-retry-button' 존재", () => {
      expect(QUOTE_SCANNER_MODAL).toMatch(/data-testid=["']ocr-retry-button["']/);
    });

    it("retry handler — POST /api/ocr/retry path 호출", () => {
      expect(QUOTE_SCANNER_MODAL).toMatch(/\/api\/ocr\/retry\//);
    });

    it("jobId 없으면 disabled — guard 존재", () => {
      expect(QUOTE_SCANNER_MODAL).toMatch(/ocrMetadata\?\.jobId|jobId.*disabled|disabled.*jobId/);
    });
  });
});

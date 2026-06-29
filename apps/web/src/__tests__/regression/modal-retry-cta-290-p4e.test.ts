/**
 * §11.290 Phase 4e #modal-retry-cta — scanner review step retry CTA.
 *
 * ★ §scan-card-declutter (호영님 2026-06-30) supersede (LabelScannerModal 한정):
 *   LabelScannerModal 의 retry CTA(ocr-retry-button) 제거 — 현 prod jobId null 로 항상
 *   비활성(dead button)이라 작업자에게 무의미. retry route(/api/ocr/retry)는 유지(미호출).
 *   QuoteScannerModal 의 retry CTA 는 미변경(별 트랙) — 그대로 lock.
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

describe("§scan-card-declutter — LabelScannerModal retry CTA 제거(진화)", () => {
  it("ocr-retry-button 제거 (dead button 0)", () => {
    expect(LABEL_SCANNER_MODAL).not.toMatch(/data-testid=["']ocr-retry-button["']/);
  });
  it("§scan-card-declutter trace marker 존재", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/§scan-card-declutter/);
  });
});

describe("§11.290 Phase 4e — QuoteScannerModal retry CTA(유지)", () => {
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

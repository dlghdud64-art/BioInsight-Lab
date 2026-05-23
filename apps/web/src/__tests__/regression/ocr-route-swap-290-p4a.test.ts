/**
 * §11.290 Phase 4a #ocr-route-swap — 기존 3 route 내부 parseWithGemini /
 *   parseQuoteWithGemini / parseQuotePDFWithGemini 직접 호출을 runOcrPipeline /
 *   runQuoteOcrPipeline wrapper 호출로 swap (호영님 Phase 0 결정 minimum-diff).
 *
 * Lock (호영님 Phase 0):
 *   기존 3 route 내부만 orchestrator 호출로 swap. 새 route 신설 0.
 *   UI 변경 0. backward-compatible (STORAGE_PROVIDER 미설정 시 fallback).
 *
 * Target routes:
 *   - /api/inventory/scan-label/route.ts → runOcrPipeline (LABEL)
 *   - /api/quotes/parse-image/route.ts → runQuoteOcrPipeline (kind: "image")
 *   - /api/quotes/parse-pdf/route.ts → runQuoteOcrPipeline (kind: "pdf")
 *
 * Test scope:
 *   1. scan-label/route.ts: runOcrPipeline import + parseWithGemini 직접 호출 잔존 0
 *   2. parse-image/route.ts: runQuoteOcrPipeline import + parseQuoteWithGemini 직접 호출 잔존 0
 *   3. parse-pdf/route.ts: runQuoteOcrPipeline import + parseQuotePDFWithGemini 직접 호출 잔존 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCAN_LABEL_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/inventory/scan-label/route.ts"),
  "utf8",
);

const PARSE_IMAGE_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/quotes/parse-image/route.ts"),
  "utf8",
);

const PARSE_PDF_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/quotes/parse-pdf/route.ts"),
  "utf8",
);

describe("§11.290 Phase 4a — 기존 3 route 내부 orchestration wrapper swap", () => {
  // ─── (1) /api/inventory/scan-label/route.ts ───
  describe("/api/inventory/scan-label/route.ts", () => {
    it("§11.290 trace marker 존재", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/§11\.290/);
    });

    it("runOcrPipeline import 존재 (orchestration wrapper)", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/runOcrPipeline.*from.*["']@\/lib\/ocr\/run-ocr-pipeline["']/);
    });

    it("runOcrPipeline 호출 존재 (try block 안)", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/await runOcrPipeline\(/);
    });

    it("parseWithGemini 직접 호출 잔존 부재 (wrapper 로 swap)", () => {
      // parseWithGemini import 자체는 보존 가능 (regex fallback 가 사용) — 직접 await 호출만 swap
      expect(SCAN_LABEL_ROUTE).not.toMatch(/await parseWithGemini\(/);
    });
  });

  // ─── (2) /api/quotes/parse-image/route.ts ───
  describe("/api/quotes/parse-image/route.ts", () => {
    it("§11.290 trace marker 존재", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/§11\.290/);
    });

    it("runQuoteOcrPipeline import 존재", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/runQuoteOcrPipeline.*from.*["']@\/lib\/ocr\/run-quote-ocr-pipeline["']/);
    });

    it("runQuoteOcrPipeline 호출 존재 (kind: image)", () => {
      expect(PARSE_IMAGE_ROUTE).toMatch(/await runQuoteOcrPipeline\(/);
      expect(PARSE_IMAGE_ROUTE).toMatch(/kind:\s*["']image["']/);
    });

    it("parseQuoteWithGemini 직접 호출 잔존 부재 (wrapper 로 swap)", () => {
      expect(PARSE_IMAGE_ROUTE).not.toMatch(/await parseQuoteWithGemini\(/);
    });
  });

  // ─── (3) /api/quotes/parse-pdf/route.ts ───
  describe("/api/quotes/parse-pdf/route.ts", () => {
    it("§11.290 trace marker 존재", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/§11\.290/);
    });

    it("runQuoteOcrPipeline import 존재", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/runQuoteOcrPipeline.*from.*["']@\/lib\/ocr\/run-quote-ocr-pipeline["']/);
    });

    it("runQuoteOcrPipeline 호출 존재 (kind: pdf)", () => {
      expect(PARSE_PDF_ROUTE).toMatch(/await runQuoteOcrPipeline\(/);
      expect(PARSE_PDF_ROUTE).toMatch(/kind:\s*["']pdf["']/);
    });

    it("parseQuotePDFWithGemini 직접 호출 잔존 부재 (wrapper 로 swap)", () => {
      expect(PARSE_PDF_ROUTE).not.toMatch(/await parseQuotePDFWithGemini\(/);
    });
  });
});
